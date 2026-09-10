from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, TokenResponse, TokenRefresh, UserResponse
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    decode_token
)
from app.core.session_store import (
    ensure_session, check_version, add_refresh_token,
    rotate_refresh_token, revoke_all,
)
from app.core.exceptions import AuthenticationError
from app.core.rate_limit import auth_rate_limit, login_rate_limit
from app.config import settings

router = APIRouter(tags=["Authentication"])


def _refresh_ttl() -> int:
    return settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


async def _issue_tokens(user: User, db: AsyncSession) -> TokenResponse:
    """Create a session (if needed) and issue version-bound token pair."""
    ver = await ensure_session(str(user.id))

    refresh_jti = str(uuid.uuid4())
    access_token = create_access_token(
        data={"sub": str(user.id), "ver": ver, "jti": str(uuid.uuid4())}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id), "ver": ver, "jti": refresh_jti}
    )
    await add_refresh_token(str(user.id), refresh_jti, _refresh_ttl())

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            created_at=user.created_at,
        ),
    )


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


@router.post("/register", response_model=TokenResponse)
async def register(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(auth_rate_limit),
):
    """Register a new user."""
    # Check if user exists
    existing_user = await db.execute(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists"
        )

    # Create new user
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return await _issue_tokens(new_user, db)


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(login_rate_limit),
):
    """Login user."""
    # Find user
    result = await db.execute(
        select(User).where(User.email == login_data.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise AuthenticationError("Invalid email or password")

    if not user.is_active:
        raise AuthenticationError("User account is inactive")

    return await _issue_tokens(user, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    token_data: TokenRefresh,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(auth_rate_limit),
):
    """Refresh access token (single-use rotation with reuse detection)."""
    try:
        payload = decode_token(token_data.refresh_token)
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")

        user_id = payload.get("sub")
        jti = payload.get("jti")
        ver_claim = payload.get("ver")
        if not user_id or not jti:
            raise AuthenticationError("Invalid token")

        if not await check_version(str(user_id), ver_claim):
            raise AuthenticationError("Session has been revoked")

        # Get user
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        # Single-use rotation
        new_refresh_jti = str(uuid.uuid4())
        outcome = await rotate_refresh_token(
            str(user.id), str(jti), new_refresh_jti, _refresh_ttl()
        )
        if outcome == "rejected":
            raise AuthenticationError("Invalid or expired refresh token")

        access_token = create_access_token(
            data={"sub": str(user.id), "ver": ver_claim, "jti": str(uuid.uuid4())}
        )
        refresh_token = create_refresh_token(
            data={"sub": str(user.id), "ver": ver_claim, "jti": new_refresh_jti}
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=UserResponse(
                id=user.id,
                email=user.email,
                username=user.username,
                full_name=user.full_name,
                avatar_url=user.avatar_url,
                is_active=user.is_active,
                created_at=user.created_at,
            ),
        )
    except ValueError:
        raise AuthenticationError("Invalid or expired refresh token")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    body: Optional[LogoutRequest] = None,
):
    """Revoke the user's sessions server-side.

    Identifies the user from either a valid access token (Authorization header)
    or the refresh token in the body, then bumps the session version and clears
    active refresh tokens. Any previously issued tokens are dead server-side.
    """
    user_id = None

    # Try to use the access token from the Authorization header
    authorization = request.headers.get("authorization")
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        try:
            payload = decode_token(token)
            if payload.get("type") == "access" and payload.get("sub"):
                user_id = str(payload["sub"])
        except ValueError:
            pass

    # Fall back to the refresh token in the body
    if user_id is None and body and body.refresh_token:
        try:
            payload = decode_token(body.refresh_token)
            if payload.get("type") == "refresh" and payload.get("sub"):
                if await check_version(str(payload["sub"]), payload.get("ver")):
                    user_id = str(payload["sub"])
        except ValueError:
            pass

    if user_id:
        await revoke_all(user_id)

    return
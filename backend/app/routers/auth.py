from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, TokenResponse, TokenRefresh, UserResponse
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    decode_token
)
from app.core.exceptions import AuthenticationError
from app.config import settings

router = APIRouter(tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
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
    
    # Generate tokens
    access_token = create_access_token(data={"sub": str(new_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(new_user.id)})
    
    # Create UserResponse
    user_response = UserResponse(
        id=new_user.id,
        email=new_user.email,
        username=new_user.username,
        full_name=new_user.full_name,
        avatar_url=new_user.avatar_url,
        is_active=new_user.is_active,
        created_at=new_user.created_at
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_response
    )

@router.post("/login", response_model=TokenResponse)
async def login(login_data: UserLogin, db: AsyncSession = Depends(get_db)):
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
    
    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # Create UserResponse
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        created_at=user.created_at
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_response
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(token_data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    """Refresh access token."""
    try:
        payload = decode_token(token_data.refresh_token)
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")
        
        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationError("Invalid token")
        
        # Get user
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")
        
        # Generate new tokens
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_refresh_token(data={"sub": str(user.id)})
        
        # Create UserResponse
        user_response = UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            created_at=user.created_at
        )
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=user_response
        )
    except ValueError:
        raise AuthenticationError("Invalid or expired refresh token")
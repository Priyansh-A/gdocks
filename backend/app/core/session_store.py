import logging
from typing import Optional

from app.config import settings
from app.redis_client import redis_client

logger = logging.getLogger(__name__)

REUSE_GRACE_SECONDS = 60


def _ver_key(user_id: str) -> str:
    return f"sess_ver:{user_id}"


def _set_key(user_id: str) -> str:
    return f"refresh_sessions:{user_id}"


def _used_key(user_id: str, jti: str) -> str:
    return f"refresh_used:{user_id}:{jti}"


async def ensure_session(user_id: str) -> int:
    """Create a session row for the user if absent; return current version."""
    try:
        key = _ver_key(user_id)
        created = await redis_client.set(key, 1, nx=True)
        if created:
            return 1
        val = await redis_client.get(key)
        return int(val) if val is not None else 1
    except Exception:
        logger.warning("Redis unavailable during ensure_session; using version 1")
        return 1


async def check_version(user_id: str, ver_claim: Optional[int]) -> bool:
    """Verify a token's version claim matches the current session version.

    Fail-open when Redis is down (matches project rate-limit fallback), so a
    Redis outage never locks out every user.
    """
    try:
        if not settings.REDIS_URL:
            return True
        current = await redis_client.get(_ver_key(user_id))
        if current is None:
            return False
        return str(ver_claim) == current
    except Exception:
        logger.warning("Redis unavailable during check_version; allowing")
        return True


async def add_refresh_token(user_id: str, jti: str, ttl_seconds: int) -> None:
    """Record a refresh token jti as active for the user."""
    try:
        key = _set_key(user_id)
        await redis_client.sadd(key, jti)
        await redis_client.expire(key, ttl_seconds)
    except Exception:
        logger.warning("Redis unavailable during add_refresh_token")


async def rotate_refresh_token(
    user_id: str, old_jti: str, new_jti: str, ttl_seconds: int
) -> str:
    """Rotate a refresh token.

    Returns:
      "ok"       - normal rotation: old jti removed, new jti recorded.
      "grace"    - old jti was rotated < REUSE_GRACE_SECONDS ago (likely another
                   tab); issue new tokens without treating it as theft.
      "rejected" - unknown/replayed jti; revoke all sessions for the user
                   (token-theft response) and reject.
    """
    try:
        set_key = _set_key(user_id)
        used = _used_key(user_id, old_jti)

        pipe = redis_client.pipeline(transaction=False)
        pipe.sismember(set_key, old_jti)
        pipe.exists(used)
        in_set, in_grace = await pipe.execute()

        if in_set:
            inner = redis_client.pipeline(transaction=False)
            inner.srem(set_key, old_jti)
            inner.sadd(set_key, new_jti)
            inner.expire(set_key, ttl_seconds)
            inner.set(used, "1", ex=REUSE_GRACE_SECONDS)
            await inner.execute()
            return "ok"

        if in_grace:
            inner = redis_client.pipeline(transaction=False)
            inner.sadd(set_key, new_jti)
            inner.expire(set_key, ttl_seconds)
            await inner.execute()
            return "grace"

        # Replayed or stolen token -> revoke every session for the user
        inner = redis_client.pipeline(transaction=False)
        inner.incr(_ver_key(user_id))
        inner.delete(set_key)
        await inner.execute()
        logger.warning("Refresh token reuse detected for user %s; sessions revoked", user_id)
        return "rejected"
    except Exception:
        logger.warning("Redis unavailable during rotate_refresh_token; allowing")
        return "ok"


async def revoke_all(user_id: str) -> None:
    """Bump the session version and drop active refresh tokens.

    Kills every access + refresh token issued for the user instantly.
    """
    try:
        pipe = redis_client.pipeline(transaction=False)
        pipe.incr(_ver_key(user_id))
        pipe.delete(_set_key(user_id))
        await pipe.execute()
    except Exception:
        logger.warning("Redis unavailable during revoke_all; sessions NOT revoked")
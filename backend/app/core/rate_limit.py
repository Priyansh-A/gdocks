import time
from typing import Optional

from fastapi import Request, HTTPException, status

from app.redis_client import redis_client
from app.config import settings


async def redis_rate_limit(
    key: str,
    limit: int,
    window_seconds: int,
    max_bytes: int = 200,
) -> Optional[HTTPException]:
    """Redis-based sliding window rate limiter.

    Returns an HTTPException when the limit is exceeded, otherwise None.
    Falls back to no-op when Redis is unavailable so auth never fully breaks.
    """
    try:
        if not settings.REDIS_URL:
            return None

        bucket = f"ratelimit:{key}"
        now_ms = int(time.time() * 1000)
        window_ms = window_seconds * 1000

        pipe = redis_client.pipeline(transaction=False)
        pipe.zremrangebyscore(bucket, 0, now_ms - window_ms)
        pipe.zadd(bucket, {f"{now_ms}-{__import__('secrets').token_hex(4)}": now_ms})
        pipe.zcard(bucket)
        pipe.expire(bucket, window_seconds + 1)
        results = await pipe.execute()
        count = results[2]

        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(window_seconds)},
            )
        return None
    except HTTPException:
        raise
    except Exception:
        return None


async def auth_rate_limit(request: Request):
    """Rate limit auth endpoints by client IP (20 requests / 10 min)."""
    client_ip = request.client.host if request.client else "unknown"
    return await redis_rate_limit(f"auth:{client_ip}", limit=20, window_seconds=600)


async def login_rate_limit(request: Request):
    """Stricter rate limit for login (5 attempts / 5 min per IP)."""
    client_ip = request.client.host if request.client else "unknown"
    return await redis_rate_limit(f"login:{client_ip}", limit=5, window_seconds=300)
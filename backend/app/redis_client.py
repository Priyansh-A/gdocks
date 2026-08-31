import redis.asyncio as redis
from app.config import settings

# Redis client
redis_client = redis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)

async def get_redis():
    return redis_client

# Helper to close Redis
async def close_redis():
    await redis_client.close()
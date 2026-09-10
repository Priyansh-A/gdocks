import logging
from fastapi import FastAPI, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import engine
from app.redis_client import close_redis
from app.websocket.handler import WebSocketHandler
from app.websocket.yjs_handler import yjs_ws_handler

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.PROJECT_NAME, settings.VERSION)
    yield
    await close_redis()
    await engine.dispose()
    logger.info("Shutting down...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

from app.routers import auth, users, documents, media, comments

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(comments.router, prefix="/api/v1/documents", tags=["Comments"])

# WebSocket endpoint for custom JSON protocol (chat, presence, cursor, typing)
@app.websocket("/ws/{document_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    document_id: str,
    token: str = Query(...)
):
    """WebSocket endpoint for real-time collaboration."""
    await WebSocketHandler.handle_connection(websocket, document_id, token)

# WebSocket endpoint for the Yjs collaboration protocol (y-websocket / y-protocols)
@app.websocket("/yws/{document_id}")
async def yjs_websocket_endpoint(
    websocket: WebSocket,
    document_id: str,
    token: str = Query(...)
):
    """WebSocket endpoint for Yjs CRDT sync (used by y-websocket clients)."""
    await yjs_ws_handler.handle_connection(websocket, document_id, token)

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/api/docs" if settings.DEBUG else None,
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "environment": settings.ENVIRONMENT}
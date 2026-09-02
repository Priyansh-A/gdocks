from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Any
import json
import asyncio
import uuid
from datetime import datetime
from app.websocket.connection_manager import connection_manager
from app.services.yjs_service import yjs_service
from app.services.document_service import DocumentService
from app.database import AsyncSessionLocal
from app.core.security import decode_token
from app.redis_client import redis_client

class WebSocketHandler:
    @staticmethod
    async def handle_connection(websocket: WebSocket, document_id: str, token: str):
        """Handle WebSocket connection."""
        # Authenticate user
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if not user_id:
                await websocket.close(code=4001, reason="Invalid token")
                return
        except:
            await websocket.close(code=4001, reason="Invalid token")
            return
        
        # Check document permission
        async with AsyncSessionLocal() as db:
            try:
                has_permission = await DocumentService.check_permission(
                    db, document_id, user_id, "viewer"
                )
                if not has_permission:
                    await websocket.close(code=4003, reason="Permission denied")
                    return
                
                # Get user info
                from app.models.user import User
                from sqlalchemy import select
                result = await db.execute(
                    select(User).where(User.id == user_id)
                )
                user = result.scalar_one_or_none()
                if not user:
                    await websocket.close(code=4004, reason="User not found")
                    return
                
                user_info = {
                    "id": str(user.id),
                    "username": user.username,
                    "full_name": user.full_name,
                    "avatar_url": user.avatar_url
                }
                
            except Exception as e:
                await websocket.close(code=4000, reason=str(e))
                return
        
        # Connect to WebSocket
        await connection_manager.connect(
            websocket, document_id, str(user_id), user_info
        )
        
        # Load document into Yjs
        try:
            # Load document from DB if exists
            async with AsyncSessionLocal() as db:
                from app.models.document import Document
                from sqlalchemy import select
                result = await db.execute(
                    select(Document).where(Document.id == document_id)
                )
                doc = result.scalar_one_or_none()
                
                if doc and doc.content:
                    # Load from existing content
                    loaded_doc = await yjs_service.load_from_db(document_id, doc.content)
                    if not loaded_doc:
                        # If loading fails, create new
                        await yjs_service.get_or_create_document(document_id)
                else:
                    # Create new document
                    await yjs_service.get_or_create_document(document_id)
            
            # Send current state to the user
            state = await yjs_service.get_document_state(document_id)
            await websocket.send_text(json.dumps({
                "type": "document_state",
                "data": state
            }))
            
            # Send chat history
            messages = await WebSocketHandler._get_chat_history(document_id)
            await websocket.send_text(json.dumps({
                "type": "chat_history",
                "data": messages
            }))
            
        except Exception as e:
            print(f"Error loading document: {e}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "data": {"message": "Failed to load document"}
            }))
        
        try:
            # Handle messages
            async for message in websocket.iter_text():
                try:
                    data = json.loads(message)
                    await WebSocketHandler._handle_message(
                        websocket, document_id, str(user_id), data
                    )
                except json.JSONDecodeError:
                    pass
                except Exception as e:
                    print(f"Error handling message: {e}")
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "data": {"message": str(e)}
                    }))
                    
        except WebSocketDisconnect:
            # Handle disconnect
            await connection_manager.disconnect(websocket, document_id, str(user_id))
            print(f"User {user_id} disconnected from document {document_id}")
    
    @staticmethod
    async def _handle_message(websocket: WebSocket, document_id: str, user_id: str, data: Dict):
        """Handle incoming WebSocket messages."""
        message_type = data.get("type")
        
        if message_type == "document_update":
            # Handle Yjs document update
            update_data = data.get("data", {})
            update_base64 = update_data.get("update")
            
            if update_base64:
                try:
                    # Apply update to Yjs document
                    ydoc, version = await yjs_service.apply_update(
                        document_id, update_base64
                    )
                    
                    # Get content to include in broadcast
                    content = await yjs_service.get_content(document_id)
                    
                    # Broadcast update to other users
                    await connection_manager.broadcast_document_update(
                        document_id,
                        {
                            "update": update_base64,
                            "version": version,
                            "user_id": user_id
                        },
                        websocket
                    )
                    
                except Exception as e:
                    print(f"Error applying update: {e}")
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "data": {"message": f"Update failed: {str(e)}"}
                    }))
        
        elif message_type == "cursor":
            # Handle cursor update
            cursor_data = data.get("data", {})
            await connection_manager.broadcast_cursor(
                document_id, user_id, cursor_data
            )
        
        elif message_type == "typing":
            # Handle typing status
            is_typing = data.get("data", {}).get("is_typing", False)
            await connection_manager.broadcast_typing(
                document_id, user_id, is_typing
            )
        
        elif message_type == "chat_message":
            # Handle chat message
            content = data.get("data", {}).get("content")
            if content and content.strip():
                # Get user info
                user_info = connection_manager.get_user_info(user_id)
                username = user_info.get("username", "Unknown") if user_info else "Unknown"
                
                message_data = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "username": username,
                    "content": content,
                    "timestamp": datetime.now().isoformat()
                }
                
                # Save to Redis for chat history (keep last 100 messages)
                await WebSocketHandler._save_chat_message(document_id, message_data)
                
                # Also save to PostgreSQL
                await WebSocketHandler._save_chat_to_db(document_id, user_id, content)
                
                # Broadcast to all users
                await connection_manager.broadcast_chat_message(
                    document_id, message_data
                )
        
        elif message_type == "get_chat_history":
            # Send chat history to user
            messages = await WebSocketHandler._get_chat_history(document_id)
            await connection_manager.send_to_user(websocket, {
                "type": "chat_history",
                "data": messages
            })
        
        elif message_type == "ping":
            # Heartbeat
            await connection_manager.send_to_user(websocket, {
                "type": "pong",
                "data": {"timestamp": datetime.now().isoformat()}
            })
    
    @staticmethod
    async def _save_chat_message(document_id: str, message_data: Dict):
        """Save chat message to Redis."""
        try:
            key = f"chat_history:{document_id}"
            # Add message to list
            await redis_client.lpush(key, json.dumps(message_data))
            # Keep only last 100 messages
            await redis_client.ltrim(key, 0, 99)
        except Exception as e:
            print(f"Error saving chat to Redis: {e}")
    
    @staticmethod
    async def _get_chat_history(document_id: str) -> list:
        """Get chat history from Redis."""
        try:
            key = f"chat_history:{document_id}"
            messages = await redis_client.lrange(key, 0, 99)
            return [json.loads(msg) for msg in messages]
        except Exception as e:
            print(f"Error getting chat history: {e}")
            return []
    
    @staticmethod
    async def _save_chat_to_db(document_id: str, user_id: str, content: str):
        """Save chat message to PostgreSQL (for permanent storage)."""
        try:
            from app.models.chat import ChatMessage
            async with AsyncSessionLocal() as db:
                message = ChatMessage(
                    document_id=document_id,
                    user_id=user_id,
                    content=content
                )
                db.add(message)
                await db.commit()
        except Exception as e:
            print(f"Error saving chat to DB: {e}")
from typing import Dict, Set, Optional, List
from fastapi import WebSocket
import json
import asyncio
from datetime import datetime
import uuid

class ConnectionManager:
    def __init__(self):
        # Document ID -> Set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # WebSocket -> User ID
        self.user_map: Dict[WebSocket, str] = {}
        # WebSocket -> Document ID
        self.document_map: Dict[WebSocket, str] = {}
        # Document ID -> Set of user IDs
        self.document_users: Dict[str, Set[str]] = {}
        # User ID -> User info
        self.user_info: Dict[str, Dict] = {}
    
    async def connect(self, websocket: WebSocket, document_id: str, user_id: str, user_info: Dict):
        """Connect a user to a document."""
        await websocket.accept()
        
        # Store connections
        if document_id not in self.active_connections:
            self.active_connections[document_id] = set()
        self.active_connections[document_id].add(websocket)
        
        self.user_map[websocket] = user_id
        self.document_map[websocket] = document_id
        
        if document_id not in self.document_users:
            self.document_users[document_id] = set()
        self.document_users[document_id].add(user_id)
        
        self.user_info[user_id] = {
            **user_info,
            "joined_at": datetime.now().isoformat(),
            "is_typing": False,
            "cursor": None
        }
        
        # Send current state to new user
        await self._send_document_state(websocket, document_id)
        
        # Broadcast user joined
        await self.broadcast_user_presence(document_id, user_id, "joined")
    
    async def disconnect(self, websocket: WebSocket, document_id: str, user_id: str):
        """Disconnect a user from a document."""
        if websocket in self.active_connections.get(document_id, set()):
            self.active_connections[document_id].discard(websocket)
        
        if document_id in self.document_users:
            self.document_users[document_id].discard(user_id)
        
        if websocket in self.user_map:
            del self.user_map[websocket]
        
        if websocket in self.document_map:
            del self.document_map[websocket]
        
        if user_id in self.user_info:
            del self.user_info[user_id]
        
        # Broadcast user left
        await self.broadcast_user_presence(document_id, user_id, "left")
        
        # Close WebSocket if still open
        try:
            await websocket.close()
        except:
            pass
    
    async def broadcast(self, document_id: str, message: Dict, sender: Optional[WebSocket] = None):
        """Broadcast a message to all users in a document."""
        if document_id not in self.active_connections:
            return
        
        message_str = json.dumps(message)
        for connection in self.active_connections[document_id]:
            if connection != sender:
                try:
                    await connection.send_text(message_str)
                except:
                    pass
    
    async def send_to_user(self, websocket: WebSocket, message: Dict):
        """Send a message to a specific user."""
        try:
            await websocket.send_text(json.dumps(message))
        except:
            pass
    
    async def broadcast_user_presence(self, document_id: str, user_id: str, event: str):
        """Broadcast user joined/left event."""
        if user_id not in self.user_info:
            return
        
        user_info = self.user_info[user_id]
        active_users = list(self.document_users.get(document_id, set()))
        
        message = {
            "type": "user_presence",
            "event": event,
            "user": {
                "id": user_id,
                "username": user_info.get("username"),
                "avatar_url": user_info.get("avatar_url")
            },
            "active_users": active_users,
            "active_count": len(active_users)
        }
        
        await self.broadcast(document_id, message)
    
    async def broadcast_cursor(self, document_id: str, user_id: str, cursor_data: Dict):
        """Broadcast cursor position update."""
        if user_id not in self.user_info:
            return
        
        self.user_info[user_id]["cursor"] = cursor_data
        
        message = {
            "type": "cursor_update",
            "user_id": user_id,
            "username": self.user_info[user_id].get("username"),
            "cursor": cursor_data
        }
        
        await self.broadcast(document_id, message)
    
    async def broadcast_typing(self, document_id: str, user_id: str, is_typing: bool):
        """Broadcast typing status."""
        if user_id not in self.user_info:
            return
        
        self.user_info[user_id]["is_typing"] = is_typing
        
        message = {
            "type": "typing_status",
            "user_id": user_id,
            "username": self.user_info[user_id].get("username"),
            "is_typing": is_typing
        }
        
        await self.broadcast(document_id, message)
    
    async def broadcast_chat_message(self, document_id: str, message_data: Dict):
        """Broadcast a chat message."""
        message = {
            "type": "chat_message",
            **message_data
        }
        await self.broadcast(document_id, message)
    
    async def broadcast_document_update(self, document_id: str, update_data: Dict, sender: WebSocket):
        """Broadcast document update (Yjs)."""
        message = {
            "type": "document_update",
            **update_data
        }
        await self.broadcast(document_id, message, sender)
    
    async def _send_document_state(self, websocket: WebSocket, document_id: str):
        """Send current document state to a new user."""
        # This will be implemented with Yjs
        message = {
            "type": "document_state",
            "data": {
                "document_id": document_id,
                "active_users": list(self.document_users.get(document_id, set())),
                "user_info": {
                    uid: info for uid, info in self.user_info.items()
                    if uid in self.document_users.get(document_id, set())
                }
            }
        }
        await self.send_to_user(websocket, message)
    
    def get_active_users(self, document_id: str) -> List[str]:
        """Get list of active user IDs in a document."""
        return list(self.document_users.get(document_id, set()))
    
    def get_user_info(self, user_id: str) -> Optional[Dict]:
        """Get user info by ID."""
        return self.user_info.get(user_id)

# Global connection manager instance
connection_manager = ConnectionManager()
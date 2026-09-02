from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid

class WebSocketMessage(BaseModel):
    type: str 
    document_id: str
    user_id: str
    data: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None

class DocumentUpdateMessage(BaseModel):
    update: str 
    version: int
    user_id: str

class CursorMessage(BaseModel):
    position: int
    selection: Optional[List[int]] = None
    user_id: str
    username: str

class ChatMessage(BaseModel):
    content: str
    user_id: str
    username: str
    timestamp: datetime

class UserPresence(BaseModel):
    user_id: str
    username: str
    avatar_url: Optional[str] = None
    cursor: Optional[CursorMessage] = None
    is_typing: bool = False
    joined_at: datetime
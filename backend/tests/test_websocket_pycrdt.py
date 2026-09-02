import asyncio
import websockets
import json
import base64
from pycrdt import Doc, Text

async def test_websocket_with_pycrdt():
    """Test WebSocket with pycrdt updates."""
    
    # Get your token from login endpoint
    token = "YOUR_ACCESS_TOKEN"  # Replace with actual token
    document_id = "YOUR_DOCUMENT_ID"  # Replace with actual document ID
    
    uri = f"ws://localhost:8000/ws/{document_id}?token={token}"
    
    async with websockets.connect(uri) as websocket:
        print("Connected to WebSocket")
        
        # Create a Yjs update
        doc = Doc()
        text = doc.get("content", type=Text)
        text.insert(0, "Hello from pycrdt!")
        
        # Get update as base64
        update = doc.get_snapshot()
        update_base64 = base64.b64encode(update).decode()
        
        # Send document update
        await websocket.send(json.dumps({
            "type": "document_update",
            "data": {
                "update": update_base64
            }
        }))
        print("Sent document update")
        
        # Send a chat message
        await websocket.send(json.dumps({
            "type": "chat_message",
            "data": {
                "content": "Hello from WebSocket test with pycrdt!"
            }
        }))
        print("Sent chat message")
        
        # Send cursor update
        await websocket.send(json.dumps({
            "type": "cursor",
            "data": {
                "position": 10,
                "selection": [5, 15]
            }
        }))
        print("Sent cursor update")
        
        # Listen for messages
        print("Waiting for responses...")
        for i in range(10):
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)
                print(f"Received [{i+1}]: {data.get('type')}")
                
                if data.get('type') == 'document_state':
                    content = data.get('data', {}).get('content', '')
                    print(f"Document content: {content[:100]}...")
                
                if data.get('type') == 'chat_message':
                    content = data.get('content', '')
                    username = data.get('username', 'Unknown')
                    print(f"   Chat from {username}: {content}")
                    
            except asyncio.TimeoutError:
                print("Timeout waiting for messages")
                break
        
        print("Test complete")

# Run test
if __name__ == "__main__":
    asyncio.run(test_websocket_with_pycrdt())
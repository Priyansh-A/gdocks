import asyncio
from pycrdt import Doc, Text
import base64
import json

async def test_pycrdt():
    """Test pycrdt functionality."""
    print("Testing pycrdt...")
    
    # Create a document
    doc = Doc()
    text = doc.get("content", type=Text)
    text.insert(0, "Hello, World!")
    
    print(f"Initial content: {text.to_string()}")
    
    # Get snapshot
    snapshot = doc.get_snapshot()
    snapshot_base64 = base64.b64encode(snapshot).decode()
    print(f"Snapshot (base64): {snapshot_base64[:50]}...")
    
    # Create new document and apply snapshot
    new_doc = Doc()
    update_bytes = base64.b64decode(snapshot_base64)
    new_doc.apply_update(update_bytes)
    
    new_text = new_doc.get("content", type=Text)
    print(f"Restored content: {new_text.to_string()}")
    
    # Apply another update
    new_text.insert(6, " Beautiful")
    print(f"Updated content: {new_text.to_string()}")
    
    # Get update
    update = new_doc.get_snapshot()
    update_base64 = base64.b64encode(update).decode()
    print(f"Update (base64): {update_base64[:50]}...")
    
    return "Test passed!"

# Run test
if __name__ == "__main__":
    result = asyncio.run(test_pycrdt())
    print(result)
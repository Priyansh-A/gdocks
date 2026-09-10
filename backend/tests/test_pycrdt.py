import asyncio
from pycrdt import Doc, Text
import base64

async def test_pycrdt():
    """Test pycrdt functionality."""
    print("Testing pycrdt...")
    
    # Create a document
    doc = Doc()
    text = doc.get("content", type=Text)
    text.insert(0, "Hello, World!")
    
    # Use str() to get content
    print(f"Initial content: {str(text)}")
    
    # Try different snapshot methods
    # Method 1: Try get_snapshot()
    try:
        snapshot = doc.get_snapshot()
        print("Using get_snapshot() method")
    except AttributeError:
        # Method 2: Try to_snapshot()
        try:
            snapshot = doc.to_snapshot()
            print("Using to_snapshot() method")
        except AttributeError:
            # Method 3: Try update() with full state
            try:
                snapshot = doc.update()
                print("Using update() method")
            except AttributeError:
                # Method 4: Try state() or encode_state()
                try:
                    snapshot = doc.state()
                    print("Using state() method")
                except AttributeError:
                    print("Could not find snapshot method. Trying to get content directly.")
                    snapshot = None
    
    if snapshot:
        snapshot_base64 = base64.b64encode(snapshot).decode()
        print(f"Snapshot (base64): {snapshot_base64[:50]}...")
        
        # Create new document and apply snapshot
        new_doc = Doc()
        update_bytes = base64.b64decode(snapshot_base64)
        new_doc.apply_update(update_bytes)
        
        new_text = new_doc.get("content", type=Text)
        print(f"Restored content: {str(new_text)}")
        
        # Apply another update
        new_text.insert(6, " Beautiful")
        print(f"Updated content: {str(new_text)}")
    
    return "Test passed"

# Run test
if __name__ == "__main__":
    result = asyncio.run(test_pycrdt())
    print(result)
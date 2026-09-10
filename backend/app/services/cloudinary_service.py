import cloudinary
import cloudinary.uploader
import cloudinary.api
from typing import Optional, Dict, Any
from fastapi import UploadFile
from app.config import settings
import uuid
import asyncio

class CloudinaryService:
    def __init__(self):
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True
        )
    
    async def upload_file(
        self,
        file: UploadFile,
        folder: str = None,
        public_id: str = None,
        transformation: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Upload a file to Cloudinary."""
        try:
            file_content = await file.read()
            
            if not public_id:
                public_id = f"{uuid.uuid4().hex}_{file.filename}"
            
            resource_type = "auto"
            if file.content_type and file.content_type.startswith("video/"):
                resource_type = "video"
            elif file.content_type and file.content_type.startswith("image/"):
                resource_type = "image"
            
            upload_options = {
                "public_id": public_id,
                "resource_type": resource_type,
                "folder": folder or settings.CLOUDINARY_UPLOAD_FOLDER,
                "use_filename": True,
                "unique_filename": False,
            }
            
            if resource_type == "image" and transformation:
                upload_options["transformation"] = transformation
            
            result = await asyncio.to_thread(
                cloudinary.uploader.upload,
                file_content,
                **upload_options
            )
            
            return {
                "success": True,
                "public_id": result["public_id"],
                "url": result["secure_url"],
                "thumbnail_url": self._get_thumbnail_url(result, resource_type),
                "metadata": {
                    "width": result.get("width"),
                    "height": result.get("height"),
                    "duration": result.get("duration"),
                    "format": result.get("format"),
                    "bytes": result.get("bytes"),
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def _get_thumbnail_url(self, result: Dict[str, Any], resource_type: str) -> Optional[str]:
        """Generate thumbnail URL for images and videos."""
        if resource_type == "image":

            return cloudinary.CloudinaryImage(result["public_id"]).build_url(
                transformation=[
                    {"width": 200, "height": 200, "crop": "fill"},
                    {"quality": "auto"}
                ]
            )
        elif resource_type == "video":
            # Generate video thumbnail
            return cloudinary.CloudinaryImage(result["public_id"]).build_url(
                resource_type="video",
                transformation=[
                    {"width": 200, "height": 200, "crop": "fill"},
                    {"start_offset": "0"},
                    {"format": "jpg"}
                ]
            )
        return None
    
    async def delete_file(self, public_id: str, resource_type: str = "image") -> bool:
        """Delete a file from Cloudinary."""
        try:
            result = await asyncio.to_thread(
                cloudinary.uploader.destroy,
                public_id,
                resource_type=resource_type
            )
            return result.get("result") == "ok"
        except Exception:
            return False
    
    async def get_file_info(self, public_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a file."""
        try:
            result = await asyncio.to_thread(cloudinary.api.resource, public_id)
            return result
        except Exception:
            return None
    
    async def generate_upload_signature(self) -> Dict[str, Any]:
        """Generate a timestamp and signature for direct uploads."""
        timestamp = cloudinary.utils.timestamp()
        signature = cloudinary.utils.api_sign_request(
            {"timestamp": timestamp},
            settings.CLOUDINARY_API_SECRET
        )
        return {
            "timestamp": timestamp,
            "signature": signature,
            "api_key": settings.CLOUDINARY_API_KEY,
            "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
            "upload_preset": "docs_clone_uploads" 
        }

cloudinary_service = CloudinaryService()
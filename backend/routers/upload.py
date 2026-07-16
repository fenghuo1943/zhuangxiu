from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pathlib import Path
import uuid

from ..auth import require_admin

router = APIRouter(prefix="/api/upload", tags=["Upload"])

IMAGE_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "assets" / "flow-images"

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    user=Depends(require_admin),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex[:12]}{ext}"
    filepath = IMAGE_DIR / filename

    content = await file.read()
    filepath.write_bytes(content)

    url = f"/assets/flow-images/{filename}"
    return {"url": url, "filename": filename}

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pathlib import Path
import uuid

from ..auth import get_current_user

router = APIRouter(prefix="/api/upload", tags=["Upload"])

IMAGE_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "assets" / "flow-images"

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}


def delete_uploaded_files(image_urls: list[str]) -> int:
    """删除已上传但尚未绑定到任何记录的图片文件。"""
    deleted = 0
    for image_url in image_urls or []:
        if "/assets/flow-images/" not in image_url:
            continue
        filename = image_url.split("/assets/flow-images/")[-1].split("?", 1)[0].split("#", 1)[0]
        if not filename or filename in {".", ".."} or "/" in filename or "\\" in filename:
            continue

        filepath = IMAGE_DIR / filename
        try:
            if filepath.exists() and filepath.is_file():
                filepath.unlink()
                deleted += 1
        except OSError:
            pass
    return deleted


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
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


@router.post("/cleanup")
async def cleanup_uploaded_images(
    payload: dict | None = None,
    user=Depends(get_current_user),
):
    """删除指定的已上传但未保存的图片，供新建/编辑草稿取消时调用。"""
    urls: list[str] = []
    if isinstance(payload, list):
        urls = payload
    elif isinstance(payload, dict):
        urls = payload.get("urls", []) or []

    deleted_count = delete_uploaded_files(urls)
    return {"deleted_count": deleted_count, "message": f"已清理 {deleted_count} 张未保存图片"}

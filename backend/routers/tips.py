import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from ..database import get_db
from ..models import Tip, KnowledgeArticle
from ..schemas import TipCreate, TipUpdate, TipOut
from ..auth import get_current_user

router = APIRouter(prefix="/api/tips", tags=["Tips"])

IMAGE_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "assets" / "flow-images"

# Matches /assets/flow-images/xxx.ext
_IMG_RE = re.compile(r"/assets/flow-images/([A-Za-z0-9._-]+)")


def _image_filenames(urls: list[str]) -> set[str]:
    """Extract image filenames from a list of image URLs."""
    names: set[str] = set()
    for url in urls or []:
        match = _IMG_RE.search(url or "")
        if match:
            names.add(match.group(1))
    return names


async def _referenced_filenames(db: AsyncSession) -> set[str]:
    """All image filenames referenced by any tip or knowledge article (cross-table check)."""
    used: set[str] = set()
    tip_result = await db.execute(select(Tip.images))
    for (images,) in tip_result:
        used |= _image_filenames(images or [])
    article_result = await db.execute(select(KnowledgeArticle.content))
    for (content,) in article_result:
        for match in re.finditer(r'<img[^>]+src=["\'](/assets/flow-images/([A-Za-z0-9._-]+))["\']', content or "", re.IGNORECASE):
            used.add(match.group(2))
    return used


def _delete_image_files(filenames: set[str]) -> int:
    """Delete image files from disk. Returns count of deleted files."""
    deleted = 0
    for name in filenames:
        filepath = IMAGE_DIR / name
        try:
            if filepath.exists():
                filepath.unlink()
                deleted += 1
        except OSError:
            pass  # skip files that can't be deleted
    return deleted


async def _get_owned_tip(tip_id: str, user_id: str, db: AsyncSession) -> Tip:
    result = await db.execute(select(Tip).where(Tip.id == tip_id, Tip.user_id == user_id))
    tip = result.scalar_one_or_none()
    if not tip:
        raise HTTPException(status_code=404, detail="技巧不存在")
    return tip


@router.get("", response_model=list[TipOut])
async def list_tips(
    room: str | None = Query(None, max_length=50),
    status: str | None = Query(None, pattern="^(pending|adopted|rejected)$"),
    q: str | None = Query(None, max_length=100),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    qs = select(Tip).where(Tip.user_id == user.id)
    if room:
        qs = qs.where(Tip.room == room)
    if status:
        qs = qs.where(Tip.status == status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        qs = qs.where(or_(Tip.title.like(like), Tip.content.like(like)))
    qs = qs.order_by(Tip.created_at.desc())
    result = await db.execute(qs)
    return result.scalars().all()


@router.post("", response_model=TipOut, status_code=201)
async def create_tip(
    data: TipCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tip = Tip(
        id=f"tip_{uuid.uuid4().hex[:12]}",
        user_id=user.id,
        title=data.title.strip(),
        room=data.room.strip(),
        content=data.content or "",
        status=data.status,
        images=data.images or [],
    )
    db.add(tip)
    await db.commit()
    await db.refresh(tip)
    return tip


@router.put("/{tip_id}", response_model=TipOut)
async def update_tip(
    tip_id: str,
    data: TipUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tip = await _get_owned_tip(tip_id, user.id, db)
    old_images = _image_filenames(tip.images or [])

    update_data = data.model_dump(exclude_unset=True)
    if "title" in update_data:
        update_data["title"] = (update_data["title"] or "").strip()
    if "room" in update_data:
        update_data["room"] = (update_data["room"] or "").strip()
    for key, value in update_data.items():
        setattr(tip, key, value)

    await db.commit()
    await db.refresh(tip)

    # Clean up images removed from the array (only if no longer referenced anywhere)
    if "images" in update_data:
        new_images = _image_filenames(update_data.get("images") or [])
        removed = old_images - new_images
        if removed:
            still_used = await _referenced_filenames(db)
            _delete_image_files(removed - still_used)

    return tip


@router.delete("/{tip_id}", status_code=204)
async def delete_tip(
    tip_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tip = await _get_owned_tip(tip_id, user.id, db)
    old_images = _image_filenames(tip.images or [])

    await db.delete(tip)
    await db.commit()

    # Clean up images no longer referenced by any tip or article
    if old_images:
        still_used = await _referenced_filenames(db)
        _delete_image_files(old_images - still_used)

    return None

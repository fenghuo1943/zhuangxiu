import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import KnowledgeArticle
from ..schemas import KnowledgeArticleCreate, KnowledgeArticleUpdate, KnowledgeArticleOut
from ..auth import get_current_user, require_admin

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge"])

IMAGE_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "assets" / "flow-images"

# Regex to match local image src: /assets/flow-images/xxx.ext
_IMG_RE = re.compile(r'<img[^>]+src=["\'](/assets/flow-images/([^"\']+))["\']', re.IGNORECASE)


def _extract_image_filenames(html: str) -> set[str]:
    """Extract all local image filenames from HTML content."""
    return set(match.group(2) for match in _IMG_RE.finditer(html))


async def _get_all_used_filenames(db: AsyncSession, exclude_resource_id: int | None = None) -> set[str]:
    """Get all image filenames referenced across all knowledge articles."""
    query = select(KnowledgeArticle.content)
    if exclude_resource_id is not None:
        query = query.where(KnowledgeArticle.resource_id != exclude_resource_id)
    result = await db.execute(query)
    all_filenames: set[str] = set()
    for (content,) in result:
        all_filenames |= _extract_image_filenames(content or "")
    return all_filenames


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


@router.get("/{resource_id}", response_model=KnowledgeArticleOut)
async def get_article(resource_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeArticle).where(KnowledgeArticle.resource_id == resource_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
    return article


@router.post("/{resource_id}", response_model=KnowledgeArticleOut, status_code=201)
async def create_article(
    resource_id: int,
    data: KnowledgeArticleCreate,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(KnowledgeArticle).where(KnowledgeArticle.resource_id == resource_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="该资源的文章已存在，请使用 PUT 更新")

    article = KnowledgeArticle(
        resource_id=resource_id,
        title=data.title,
        content=data.content,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article


@router.put("/{resource_id}", response_model=KnowledgeArticleOut)
async def update_article(
    resource_id: int,
    data: KnowledgeArticleUpdate,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeArticle).where(KnowledgeArticle.resource_id == resource_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    old_content = article.content or ""

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(article, key, value)

    await db.commit()
    await db.refresh(article)

    # Clean up images that were removed from the content
    if "content" in update_data:
        new_content = update_data["content"] or ""
        old_images = _extract_image_filenames(old_content)
        new_images = _extract_image_filenames(new_content)
        removed = old_images - new_images
        if removed:
            # Only delete if not referenced by any other article
            still_used = await _get_all_used_filenames(db, exclude_resource_id=resource_id)
            to_delete = removed - still_used
            _delete_image_files(to_delete)

    return article


@router.delete("/{resource_id}", status_code=204)
async def delete_article(
    resource_id: int,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeArticle).where(KnowledgeArticle.resource_id == resource_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    # Collect images before deleting the article
    old_images = _extract_image_filenames(article.content or "")

    await db.delete(article)
    await db.commit()

    # Clean up images that are no longer referenced by any other article
    if old_images:
        still_used = await _get_all_used_filenames(db)
        to_delete = old_images - still_used
        _delete_image_files(to_delete)

    return None

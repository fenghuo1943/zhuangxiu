import csv, io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project, PurchaseRefStage, PurchaseRefSubgroup, PurchaseRefItem, PriceModel, ChannelQuote, SyncedModel, SelectedPurchase, PurchasedItem
from ..schemas import PriceModelCreate, PriceModelOut, ChannelQuoteCreate, ChannelQuoteOut, SetBestQuoteRequest, CompareItemOut, CustomPurchaseCreate
from ..auth import get_current_user
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/api/projects/{project_id}/compare", tags=["Compare"])


def _scoped_id(raw_project_id: str, user_id: str) -> str:
    """Scope a frontend project ID to the current user for data isolation."""
    scope = user_id.replace("-", "")[:8]
    return f"{raw_project_id}_{scope}"


async def _ensure_project(raw_project_id: str, user: User, db: AsyncSession) -> str:
    """Ensure a project exists for this user. Returns the scoped project ID."""
    sid = _scoped_id(raw_project_id, user.id)
    result = await db.execute(
        select(Project).where(Project.id == sid, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        project = Project(id=sid, user_id=user.id, name="默认项目",
                          owner_name=user.username or "我")
        db.add(project)
        await db.commit()
        await db.refresh(project)
    return sid


async def _verify_owner(project_id: str, user: User, db: AsyncSession) -> Project:
    sid = _scoped_id(project_id, user.id)
    result = await db.execute(select(Project).where(Project.id == sid, Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


def _build_model_out(m: PriceModel, quotes: list[ChannelQuote]) -> PriceModelOut:
    return PriceModelOut(
        id=m.id, item_id=m.item_id, project_id=m.project_id,
        name=m.name, spec=m.spec, note=m.note, quantity=m.quantity,
        best_quote_id=None, quotes=[ChannelQuoteOut.model_validate(q) for q in quotes],
    )


# ── List compare items ──

@router.get("", response_model=list[CompareItemOut])
async def list_compare_items(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)

    # Get all purchase items with needs_compare=True
    items_result = await db.execute(
        select(PurchaseRefItem).where(PurchaseRefItem.needs_compare == True)
    )
    items = items_result.scalars().all()

    out = []
    for item in items:
        # Get subgroup and stage for context
        sub_result = await db.execute(select(PurchaseRefSubgroup).where(PurchaseRefSubgroup.id == item.subgroup_id))
        subgroup = sub_result.scalar_one_or_none()
        stage_parent = None
        subgroup_name = None
        if subgroup:
            subgroup_name = subgroup.name
            stage_result = await db.execute(select(PurchaseRefStage).where(PurchaseRefStage.id == subgroup.stage_id))
            stage = stage_result.scalar_one_or_none()
            if stage:
                stage_parent = stage.parent

        # Get price models for this item (for this project)
        models_result = await db.execute(
            select(PriceModel).where(PriceModel.item_id == item.id, PriceModel.project_id == sid)
        )
        models = models_result.scalars().all()
        models_out = []
        for m in models:
            quotes_result = await db.execute(select(ChannelQuote).where(ChannelQuote.model_id == m.id))
            models_out.append(_build_model_out(m, quotes_result.scalars().all()))

        out.append(CompareItemOut(
            item_id=item.id, item_name=item.name, spec=item.spec,
            qty=item.qty, unit=item.unit,
            stage_parent=stage_parent, subgroup_name=subgroup_name,
            models=models_out,
        ))

    return out


# ── Add compare item (same as purchase custom add + needs_compare flag) ──

@router.post("", response_model=CompareItemOut, status_code=201)
async def add_compare_item(project_id: str, data: CustomPurchaseCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)

    # Find stage by parent name
    stage_result = await db.execute(select(PurchaseRefStage).where(PurchaseRefStage.parent == data.stage_parent))
    stage = stage_result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="采购阶段不存在")

    # Find subgroup
    sub = None
    if data.subgroup_name:
        sub_result = await db.execute(
            select(PurchaseRefSubgroup).where(
                PurchaseRefSubgroup.stage_id == stage.id,
                PurchaseRefSubgroup.name == data.subgroup_name,
            )
        )
        sub = sub_result.scalar_one_or_none()
    if not sub:
        sub_result = await db.execute(select(PurchaseRefSubgroup).where(PurchaseRefSubgroup.stage_id == stage.id).limit(1))
        sub = sub_result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="子分组不存在")

    item = PurchaseRefItem(
        id=f"p_auto_{uuid.uuid4().hex[:12]}",
        subgroup_id=sub.id,
        name=data.name,
        spec=data.spec or "",
        qty=data.qty,
        unit=data.unit or "个",
        needs_compare=True,
    )
    db.add(item)
    # Auto-select
    db.add(SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=sid, item_id=item.id))
    await db.commit()
    await db.refresh(item)
    return CompareItemOut(
        item_id=item.id, item_name=item.name, spec=item.spec,
        qty=item.qty, unit=item.unit,
        stage_parent=data.stage_parent, subgroup_name=data.subgroup_name,
        models=[],
    )


# ── Toggle needs_compare (remove from compare list) ──

@router.put("/items/{item_id}/toggle-compare")
async def toggle_item_compare(project_id: str, item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    item_result = await db.execute(select(PurchaseRefItem).where(PurchaseRefItem.id == item_id))
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="物品不存在")
    item.needs_compare = not item.needs_compare
    await db.commit()
    return {"needs_compare": item.needs_compare}


# ── Models CRUD ──

@router.post("/items/{item_id}/models", response_model=PriceModelOut, status_code=201)
async def create_model(project_id: str, item_id: str, data: PriceModelCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    model = PriceModel(
        id=f"pm_{uuid.uuid4().hex[:12]}",
        item_id=item_id, project_id=sid,
        name=data.name, spec=data.spec, note=data.note, quantity=data.quantity,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return PriceModelOut(id=model.id, item_id=model.item_id, project_id=model.project_id,
        name=model.name, spec=model.spec, note=model.note, quantity=model.quantity,
        best_quote_id=None, quotes=[])


@router.delete("/models/{model_id}", status_code=204)
async def delete_model(project_id: str, model_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(PriceModel).where(PriceModel.id == model_id, PriceModel.project_id == sid))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="型号不存在")
    await db.delete(model)
    await db.commit()


# ── Quotes CRUD (operate on model, unchanged) ──

@router.post("/models/{model_id}/quotes", response_model=ChannelQuoteOut, status_code=201)
async def create_quote(project_id: str, model_id: str, data: ChannelQuoteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    quote = ChannelQuote(id=f"ch_{uuid.uuid4().hex[:12]}", model_id=model_id,
        channel=data.channel, price=data.price, url=data.url, updated_at=datetime.now(timezone.utc))
    db.add(quote)
    await db.commit()
    await db.refresh(quote)
    return quote


@router.delete("/quotes/{quote_id}", status_code=204)
async def delete_quote(project_id: str, quote_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(ChannelQuote).where(ChannelQuote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="报价不存在")
    await db.delete(quote)
    await db.commit()


# ── Best quote selection ──

@router.put("/models/{model_id}/best-quote")
async def set_best_quote(project_id: str, model_id: str, data: SetBestQuoteRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    model_result = await db.execute(select(PriceModel).where(PriceModel.id == model_id, PriceModel.project_id == sid))
    model = model_result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="型号不存在")

    if data.quote_id:
        quote_result = await db.execute(select(ChannelQuote).where(ChannelQuote.id == data.quote_id, ChannelQuote.model_id == model_id))
        if not quote_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="报价不存在")

    return {"best_quote_id": data.quote_id}


# ── Sync (mark linked purchase item as purchased) ──

@router.put("/models/{model_id}/sync")
async def toggle_model_sync(project_id: str, model_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    model_result = await db.execute(select(PriceModel).where(PriceModel.id == model_id, PriceModel.project_id == sid))
    model = model_result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="型号不存在")

    # Check SyncedModel for backward compat
    result = await db.execute(select(SyncedModel).where(SyncedModel.project_id == sid, SyncedModel.model_id == model_id))
    existing = result.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"synced": False, "auto_purchased": 0}

    # Create synced record
    db.add(SyncedModel(id=f"sm_{uuid.uuid4().hex[:12]}", project_id=sid, model_id=model_id))

    # Auto-purchase: toggle purchased on the linked purchase item
    auto_purchased = 0
    if model.item_id:
        pur_result = await db.execute(
            select(PurchasedItem).where(PurchasedItem.project_id == sid, PurchasedItem.item_id == model.item_id)
        )
        if not pur_result.scalar_one_or_none():
            db.add(PurchasedItem(id=f"pi_{uuid.uuid4().hex[:12]}", project_id=sid, item_id=model.item_id))
            auto_purchased = 1

    await db.commit()
    return {"synced": True, "auto_purchased": auto_purchased}


# ── CSV export/import ──

@router.get("/export-csv")
async def export_csv(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    items_result = await db.execute(select(PurchaseRefItem).where(PurchaseRefItem.needs_compare == True))
    items = items_result.scalars().all()

    output = io.StringIO()
    output.write("﻿物品,规格,阶段,分组,数量,型号,型号备注,渠道,价格\n")
    for item in items:
        # Get context
        sub_result = await db.execute(select(PurchaseRefSubgroup).where(PurchaseRefSubgroup.id == item.subgroup_id))
        subgroup = sub_result.scalar_one_or_none()
        stage_name = subgroup_name = ""
        if subgroup:
            subgroup_name = subgroup.name
            stage_result = await db.execute(select(PurchaseRefStage).where(PurchaseRefStage.id == subgroup.stage_id))
            stage = stage_result.scalar_one_or_none()
            if stage: stage_name = stage.parent

        models_result = await db.execute(
            select(PriceModel).where(PriceModel.item_id == item.id, PriceModel.project_id == sid)
        )
        models = models_result.scalars().all()
        if not models:
            output.write(f'"{item.name}","{item.spec or ""}","{stage_name}","{subgroup_name}",{item.qty},,,--,\n')
        for m in models:
            quotes_result = await db.execute(select(ChannelQuote).where(ChannelQuote.model_id == m.id))
            quotes = quotes_result.scalars().all()
            if not quotes:
                output.write(f'"{item.name}","{item.spec or ""}","{stage_name}","{subgroup_name}",{item.qty},"{m.name}","{m.note or ""}",,--\n')
            for q in quotes:
                output.write(f'"{item.name}","{item.spec or ""}","{stage_name}","{subgroup_name}",{item.qty},"{m.name}","{m.note or ""}","{q.channel}",{q.price or ""}\n')

    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=compare_{project_id}.csv"})


@router.post("/import-csv")
async def import_csv(project_id: str, file: UploadFile = File(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    imported = 0
    item_cache: dict[str, str] = {}
    for i, row in enumerate(rows):
        if i == 0: continue
        if len(row) < 5: continue
        item_name, spec, stage_name, subgroup_name, qty_str = row[0], row[1], row[2], row[3], row[4]
        model_name = row[5] if len(row) > 5 else ""
        model_note = row[6] if len(row) > 6 else ""
        channel = row[7] if len(row) > 7 else ""
        price_str = row[8] if len(row) > 8 else ""

        if not item_name or not model_name: continue
        qty = int(qty_str) if qty_str.isdigit() else 1

        cache_key = f"{item_name}|{spec}"
        if cache_key not in item_cache:
            # Find or create item with needs_compare
            item_result = await db.execute(
                select(PurchaseRefItem).where(PurchaseRefItem.name == item_name, PurchaseRefItem.needs_compare == True).limit(1)
            )
            item = item_result.scalar_one_or_none()
            if not item:
                # Create new item — find default subgroup
                sub = None
                if stage_name and subgroup_name:
                    stage_result = await db.execute(select(PurchaseRefStage).where(PurchaseRefStage.parent == stage_name))
                    stage = stage_result.scalar_one_or_none()
                    if stage:
                        sub_result = await db.execute(select(PurchaseRefSubgroup).where(
                            PurchaseRefSubgroup.stage_id == stage.id, PurchaseRefSubgroup.name == subgroup_name))
                        sub = sub_result.scalar_one_or_none()
                if not sub:
                    stage_result = await db.execute(select(PurchaseRefStage).limit(1))
                    stage = stage_result.scalar_one_or_none()
                    if stage:
                        sub_result = await db.execute(select(PurchaseRefSubgroup).where(PurchaseRefSubgroup.stage_id == stage.id).limit(1))
                        sub = sub_result.scalar_one_or_none()
                    if not sub:
                        continue
                item = PurchaseRefItem(
                    id=f"p_import_{uuid.uuid4().hex[:12]}",
                    subgroup_id=sub.id, name=item_name, spec=spec or None,
                    qty=qty, unit="个", needs_compare=True,
                )
                db.add(item)
                await db.flush()
                db.add(SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=sid, item_id=item.id))
            item_cache[cache_key] = item.id

        # Create model
        price = float(price_str) if price_str and price_str != "--" else None
        existing_model = False
        models_result = await db.execute(
            select(PriceModel).where(PriceModel.item_id == item_cache[cache_key], PriceModel.project_id == sid, PriceModel.name == model_name)
        )
        model = models_result.scalar_one_or_none()
        if not model:
            model = PriceModel(
                id=f"pm_{uuid.uuid4().hex[:12]}",
                item_id=item_cache[cache_key], project_id=sid,
                name=model_name, spec=None, note=model_note or None, quantity=1,
            )
            db.add(model)
            await db.flush()
        else:
            existing_model = True

        # Add quote
        if channel:
            db.add(ChannelQuote(
                id=f"ch_{uuid.uuid4().hex[:12]}", model_id=model.id,
                channel=channel, price=price, updated_at=datetime.now(timezone.utc),
            ))
        imported += 1

    await db.commit()
    return {"imported": imported}

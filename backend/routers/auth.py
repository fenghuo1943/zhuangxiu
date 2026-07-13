from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User
from ..schemas import UserRegister, UserLogin, UserOut, TokenOut, GuestRegister
from ..auth import hash_password, verify_password, create_token, get_current_user
import uuid

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=TokenOut)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已被注册")

    user = User(
        id=str(uuid.uuid4()),
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_token(user.id)
    return TokenOut(token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    token = create_token(user.id)
    return TokenOut(token=token, user=UserOut.model_validate(user))


@router.post("/guest", response_model=TokenOut)
async def register_guest(data: GuestRegister, db: AsyncSession = Depends(get_db)):
    """注册或查找设备对应的游客用户，返回JWT token。每个设备获得独立身份，数据互相隔离。"""
    import hashlib
    # 用 device_id 的 hash 生成短 ID，确保不超过 VARCHAR(36)
    id_suffix = hashlib.md5(data.device_id.encode()).hexdigest()[:16]
    guest_id = f"g_{id_suffix}"  # 总长 18 字符，符合 VARCHAR(36) 限制

    # 查找已有游客
    result = await db.execute(select(User).where(User.id == guest_id))
    user = result.scalar_one_or_none()

    if not user:
        short_id = data.device_id[:8]
        user = User(
            id=guest_id,
            username=f"游客_{short_id}",
            email=f"guest_{short_id}@device.local",
            password_hash="",  # 设备游客不能通过密码登录
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = create_token(user.id)
    return TokenOut(token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)

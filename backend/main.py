from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from .database import init_db, get_db
from .models import FlowStage as FlowStageModel
from .schemas import FlowStageOut
from .routers import auth, projects, budget, todos, expenses, flow, purchase, compare, sync, knowledge, upload


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="装修手记 API",
    description="装修项目管理工具后端服务",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Vite dev servers (port 5173–5180) and localhost aliases
_vite_ports = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180]
_origins = []
for p in _vite_ports:
    _origins.append(f"http://localhost:{p}")
    _origins.append(f"http://127.0.0.1:{p}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(budget.router)
app.include_router(todos.router)
app.include_router(expenses.router)
app.include_router(flow.router)
app.include_router(purchase.router)
app.include_router(compare.router)
app.include_router(sync.router)
app.include_router(knowledge.router)
app.include_router(upload.router)

# Mount static files for uploaded images
_public_dir = Path(__file__).resolve().parent.parent / "frontend" / "public"
if _public_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(_public_dir / "assets"), html=False), name="assets")


@app.get("/api/flow-stages", response_model=list[FlowStageOut])
async def get_flow_stages(
    flow_type: str = Query("new", pattern="^(new|old)$"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FlowStageModel)
        .where(FlowStageModel.flow_type == flow_type)
        .options(selectinload(FlowStageModel.resources))
        .order_by(FlowStageModel.sort_order)
    )
    stages = result.scalars().unique().all()
    # Sort resources within each stage
    for stage in stages:
        stage.resources.sort(key=lambda r: (r.resource_type, r.sort_order))
    return stages


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "装修手记 API"}

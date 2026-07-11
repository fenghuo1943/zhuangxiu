from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db
from .routers import auth, projects, budget, todos, expenses, flow, purchase, compare, sync


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="小装家 API",
    description="装修项目管理工具后端服务",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
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


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "小装家 API"}

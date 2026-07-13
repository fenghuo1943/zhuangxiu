from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


# ---- Auth ----
class UserRegister(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=6, max_length=100)

class GuestRegister(BaseModel):
    device_id: str = Field(..., min_length=8, max_length=64)

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}

class TokenOut(BaseModel):
    token: str
    user: UserOut


# ---- Project ----
class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=100)
    owner_name: str = Field("我", max_length=50)

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    owner_name: Optional[str] = None
    current_stage_id: Optional[str] = None

class ProjectOut(BaseModel):
    id: str
    user_id: str
    name: str
    owner_name: str
    current_stage_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Budget ----
class BudgetCategoryOut(BaseModel):
    id: str
    project_id: str
    name: str
    color: str
    allocated: float
    spent: float

    model_config = {"from_attributes": True}

class BudgetOut(BaseModel):
    total: float
    categories: List[BudgetCategoryOut]

class BudgetUpdate(BaseModel):
    total: float

class CategoryAllocationUpdate(BaseModel):
    allocated: float


# ---- Todo ----
class TodoCreate(BaseModel):
    title: str = Field(..., max_length=200)
    stage_id: str = Field("design", max_length=50)
    due_date: Optional[date] = None

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    stage_id: Optional[str] = None
    due_date: Optional[date] = None
    completed: Optional[bool] = None

class TodoOut(BaseModel):
    id: str
    project_id: str
    title: str
    stage_id: str
    due_date: Optional[date]
    completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Expense ----
class ExpenseCreate(BaseModel):
    title: str = Field(..., max_length=200)
    amount: float = Field(..., gt=0)
    category_id: str = Field("hard", max_length=50)
    stage_id: Optional[str] = None
    date: date
    status: str = Field("paid", pattern="^(paid|prepaid|unpaid|refunded)$")
    payer: Optional[str] = None
    note: Optional[str] = None

class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    category_id: Optional[str] = None
    stage_id: Optional[str] = None
    date: Optional[date] = None
    status: Optional[str] = None
    payer: Optional[str] = None
    note: Optional[str] = None

class ExpenseOut(BaseModel):
    id: str
    project_id: str
    title: str
    amount: float
    category_id: str
    stage_id: Optional[str]
    date: date
    status: str
    payer: Optional[str]
    note: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Flow ----
class FlowProgressUpdate(BaseModel):
    flow_type: Optional[str] = None
    done_step_ids: Optional[List[str]] = None
    custom_order: Optional[List[str]] = None

class FlowProgressOut(BaseModel):
    project_id: str
    flow_type: str
    done_step_ids: List[str]
    custom_order: Optional[List[str]]

    model_config = {"from_attributes": True}


# ---- Purchase Reference ----
class PurchaseRefItemOut(BaseModel):
    id: str
    name: str
    spec: Optional[str]
    qty: int
    unit: Optional[str]

    model_config = {"from_attributes": True}

class PurchaseRefSubgroupOut(BaseModel):
    name: str
    items: List[PurchaseRefItemOut]

class PurchaseRefStageOut(BaseModel):
    parent: str
    subs: List[PurchaseRefSubgroupOut]

class CustomPurchaseCreate(BaseModel):
    name: str
    stage_parent: str
    qty: int = 1


# ---- Price Compare ----
class ChannelQuoteCreate(BaseModel):
    channel: str = Field(..., max_length=100)
    price: Optional[float] = None
    url: Optional[str] = None

class ChannelQuoteOut(BaseModel):
    id: str
    channel: str
    price: Optional[float]
    url: Optional[str]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}

class PriceModelCreate(BaseModel):
    name: str = Field(..., max_length=200)
    spec: Optional[str] = None
    note: Optional[str] = None
    quantity: int = 1

class PriceModelOut(BaseModel):
    id: str
    name: str
    spec: Optional[str]
    note: Optional[str]
    quantity: int
    quotes: List[ChannelQuoteOut]

    model_config = {"from_attributes": True}

class PriceCategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    icon: str = "📦"

class PriceCategoryOut(BaseModel):
    id: str
    name: str
    icon: Optional[str]
    models: List[PriceModelOut]

    model_config = {"from_attributes": True}


# ---- Stage Notes ----
class StageNoteCreate(BaseModel):
    stage_id: str = Field(..., max_length=50)
    content: str = Field(..., max_length=2000)

class StageNoteUpdate(BaseModel):
    content: str = Field(..., max_length=2000)

class StageNoteOut(BaseModel):
    id: str
    project_id: str
    stage_id: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Custom Flow Steps ----
class CustomFlowStepCreate(BaseModel):
    flow_type: str = Field("new", max_length=10)
    title: str = Field(..., max_length=100)
    days: str = Field("", max_length=20)
    desc: str = Field("", max_length=1000)
    sort_order: int

class CustomFlowStepUpdate(BaseModel):
    title: Optional[str] = None
    days: Optional[str] = None
    desc: Optional[str] = None
    sort_order: Optional[int] = None

class CustomFlowStepOut(BaseModel):
    id: str
    project_id: str
    flow_type: str
    title: str
    days: str
    desc: str
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Sync ----
class AppStateSync(BaseModel):
    projects: List[dict] = []
    todos: List[dict] = []
    expenses: List[dict] = []
    budget: Optional[dict] = None
    flow_progress: Optional[dict] = None
    price_categories: List[dict] = []
    selected_purchase_ids: List[str] = []
    synced_model_ids: List[str] = []
    stage_notes: Optional[dict] = None
    custom_flow_steps: List[dict] = []

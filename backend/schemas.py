from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date as DateValue, datetime


# ---- Auth ----
class UserRegister(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=6, max_length=100)

class UserLogin(BaseModel):
    username: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    is_admin: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}

class TokenOut(BaseModel):
    token: str
    refresh_token: str
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

class CategoryAllocationItem(BaseModel):
    id: str
    allocated: float
    name: Optional[str] = None
    color: Optional[str] = None

class BudgetUpdate(BaseModel):
    total: float
    categories: Optional[List[CategoryAllocationItem]] = None

class CategoryAllocationUpdate(BaseModel):
    allocated: float
    name: Optional[str] = None
    color: Optional[str] = None


# ---- Todo ----
class TodoCreate(BaseModel):
    title: str = Field(..., max_length=200)
    stage_id: str = Field("design", max_length=50)
    due_date: Optional[DateValue] = None

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    stage_id: Optional[str] = None
    due_date: Optional[DateValue] = None
    completed: Optional[bool] = None

class TodoOut(BaseModel):
    id: str
    project_id: str
    title: str
    stage_id: str
    due_date: Optional[DateValue]
    completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Expense ----
class ExpenseCreate(BaseModel):
    title: str = Field(..., max_length=200)
    amount: float = Field(..., gt=0)
    category_id: str = Field("hard", max_length=50)
    sub_category_id: Optional[str] = None
    stage_id: Optional[str] = None
    date: DateValue
    status: str = Field("paid", pattern="^(paid|prepaid|unpaid|refunded)$")
    payer: Optional[str] = None
    note: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def normalize_blank_optional_fields(cls, values):
        if not isinstance(values, dict):
            return values
        for key in ('sub_category_id', 'stage_id', 'payer', 'note'):
            if values.get(key) == "":
                values[key] = None
        if values.get('date') == "":
            values['date'] = None
        return values

class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    category_id: Optional[str] = None
    sub_category_id: Optional[str] = None
    stage_id: Optional[str] = None
    date: Optional[DateValue] = None
    status: Optional[str] = None
    payer: Optional[str] = None
    note: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def normalize_blank_optional_fields(cls, values):
        if not isinstance(values, dict):
            return values
        for key in ('sub_category_id', 'stage_id', 'payer', 'note'):
            if values.get(key) == "":
                values[key] = None
        if values.get('date') == "":
            values['date'] = None
        return values

class ExpenseOut(BaseModel):
    id: str
    project_id: str
    title: str
    amount: float
    category_id: str
    sub_category_id: Optional[str] = None
    stage_id: Optional[str] = None
    date: DateValue
    status: str
    payer: Optional[str] = None
    note: Optional[str] = None
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
    needs_compare: bool = False  # 动态计算（通过 ProjectCompareItem），非 DB 列值
    category_id: Optional[str] = None
    sub_category_id: Optional[str] = None
    price: Optional[float] = None

    model_config = {"from_attributes": True}


class TogglePurchasedRequest(BaseModel):
    """请求体：切换已购状态时可附带价格和分类"""
    price: Optional[float] = None
    category_id: Optional[str] = None
    delete_expense: Optional[bool] = None  # 取消已购时是否同步删除关联账单


class SelectedPurchaseOut(BaseModel):
    """待购物品输出（含关联账单 ID 和价格）"""
    item_id: str
    expense_id: Optional[str] = None
    price: Optional[float] = None

    model_config = {"from_attributes": True}


class PurchasedItemOut(BaseModel):
    """已购物品输出（含关联账单 ID 和价格）"""
    item_id: str
    expense_id: Optional[str] = None
    price: Optional[float] = None

    model_config = {"from_attributes": True}

class TogglePurchasedResponse(BaseModel):
    purchased: bool
    expense_id: Optional[str] = None  # 添加至已购时返回关联的账单 ID

class PurchaseRefSubgroupOut(BaseModel):
    name: str
    items: List[PurchaseRefItemOut]

class PurchaseRefStageOut(BaseModel):
    parent: str
    subs: List[PurchaseRefSubgroupOut]

class CustomPurchaseCreate(BaseModel):
    name: str
    stage_parent: str
    subgroup_name: Optional[str] = None
    spec: Optional[str] = None
    unit: str = "个"
    qty: int = 1
    category_id: Optional[str] = None
    sub_category_id: Optional[str] = None
    price: Optional[float] = None
    # 若设置了价格，添加待购物品时会自动创建一笔未支付账单


# ── Update item price ──

class UpdateItemPriceRequest(BaseModel):
    price: float = Field(..., gt=0, description="新的物品价格")

class UpdateItemPriceResponse(BaseModel):
    item_id: str
    price: float
    updated_targets: list[str]  # e.g. ["quote", "expense"]
    quote_id: Optional[str] = None
    expense_id: Optional[str] = None


# ── Batch category update ──

class BatchCategoryItem(BaseModel):
    item_id: str
    category_id: Optional[str] = None
    sub_category_id: Optional[str] = None

class BatchCategoryUpdate(BaseModel):
    items: list[BatchCategoryItem]


# ── Add to compare (just sets needs_compare flag) ──

class ToggleCompareRequest(BaseModel):
    needs_compare: bool = True


# ---- Price Compare ----
class ChannelQuoteCreate(BaseModel):
    channel: str = Field(..., max_length=100)
    price: Optional[float] = None
    url: Optional[str] = None
    note: Optional[str] = None

class ChannelQuoteOut(BaseModel):
    id: str
    channel: str
    price: Optional[float]
    url: Optional[str]
    note: Optional[str] = None
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}

class PriceModelCreate(BaseModel):
    name: str = Field(..., max_length=200)
    spec: Optional[str] = None
    note: Optional[str] = None
    quantity: int = 1

class PriceModelOut(BaseModel):
    id: str
    item_id: Optional[str] = None
    project_id: Optional[str] = None
    name: str
    spec: Optional[str]
    note: Optional[str]
    quantity: int
    best_quote_id: Optional[str] = None
    synced: bool = False
    quotes: List[ChannelQuoteOut]

    model_config = {"from_attributes": True}

class CompareItemOut(BaseModel):
    """Purchase item with comparison data (models + quotes) for the compare page."""
    item_id: str
    item_name: str
    spec: Optional[str] = None
    qty: int
    unit: Optional[str] = None
    stage_parent: Optional[str] = None
    subgroup_name: Optional[str] = None
    category_id: Optional[str] = None
    sub_category_id: Optional[str] = None
    models: List[PriceModelOut] = []

class SetBestQuoteRequest(BaseModel):
    quote_id: Optional[str] = None  # None = clear selection


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
    price_models: List[dict] = []     # model data directly keyed by item_id
    selected_purchase_ids: List[str] = []
    selected_purchase_prices: dict = {}  # item_id -> price (project-scoped)
    purchased_item_ids: List[str] = []
    purchased_item_prices: dict = {}     # item_id -> price (project-scoped)
    project_compare_item_ids: List[str] = []  # per-project compare item IDs
    synced_model_ids: List[str] = []  # deprecated — kept for backward compat; prefer PriceModel.synced
    stage_notes: Optional[dict] = None
    custom_flow_steps: List[dict] = []


# ---- Knowledge Article ----
class KnowledgeArticleCreate(BaseModel):
    resource_id: int
    title: str = Field("", max_length=200)
    content: str = Field("", max_length=100000)

class KnowledgeArticleUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = Field(None, max_length=100000)

class KnowledgeArticleOut(BaseModel):
    id: int
    resource_id: int
    title: str
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---- Flow Stages (from DB) ----
class FlowStageResourceOut(BaseModel):
    id: int
    title: str
    resource_type: str
    sort_order: int

    model_config = {"from_attributes": True}

class FlowStageOut(BaseModel):
    id: int
    stage_key: str
    flow_type: str
    sort_order: int
    title: str
    days: str
    desc: str
    resources: list[FlowStageResourceOut] = []

    model_config = {"from_attributes": True}


# ---- Renovation Tips ----
class TipCreate(BaseModel):
    title: str = Field(..., max_length=200)
    room: str = Field(..., max_length=50)
    content: str = Field("", max_length=20000)
    status: str = Field("pending", pattern="^(pending|adopted|rejected)$")
    images: list[str] = []

class TipUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    room: Optional[str] = Field(None, max_length=50)
    content: Optional[str] = Field(None, max_length=20000)
    status: Optional[str] = Field(None, pattern="^(pending|adopted|rejected)$")
    images: Optional[list[str]] = None

class TipOut(BaseModel):
    id: str
    user_id: str
    title: str
    room: str
    content: str
    status: str
    images: list[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---- Expense SubCategory ----
class SubCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    category_id: str = Field(..., max_length=50)  # 归属哪个大分类

class SubCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    category_id: Optional[str] = Field(None, max_length=50)  # 移动到其他大分类

class SubCategoryOut(BaseModel):
    id: str
    project_id: Optional[str] = None  # NULL = 默认分类
    name: str
    category_id: str
    is_default: bool = False

    model_config = {"from_attributes": True}

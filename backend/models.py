import datetime
from sqlalchemy import Column, String, Float, Boolean, Date, DateTime, ForeignKey, JSON, Integer, Text
from sqlalchemy.orm import relationship
from .database import Base


def _pk():
    return Column(String(36), primary_key=True)

def _now():
    return datetime.datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id = _pk()
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), nullable=False)
    password_hash = Column(String(200), nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)

    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"
    id = _pk()
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    owner_name = Column(String(50), default="我")
    current_stage_id = Column(String(50), default="design")
    created_at = Column(DateTime, default=_now)

    user = relationship("User", back_populates="projects")
    budget = relationship("Budget", back_populates="project", uselist=False, cascade="all, delete-orphan")
    categories = relationship("BudgetCategory", back_populates="project", cascade="all, delete-orphan")
    todos = relationship("Todo", back_populates="project", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="project", cascade="all, delete-orphan")
    flow_progress = relationship("FlowProgress", back_populates="project", uselist=False, cascade="all, delete-orphan")
    price_categories = relationship("PriceCategory", back_populates="project", cascade="all, delete-orphan")
    selected_purchases = relationship("SelectedPurchase", back_populates="project", cascade="all, delete-orphan")
    synced_models = relationship("SyncedModel", back_populates="project", cascade="all, delete-orphan")
    stage_notes = relationship("StageNote", back_populates="project", cascade="all, delete-orphan")
    custom_flow_steps = relationship("CustomFlowStep", back_populates="project", cascade="all, delete-orphan")


class Budget(Base):
    __tablename__ = "budgets"
    project_id = Column(String(36), ForeignKey("projects.id"), primary_key=True)
    total = Column(Float, default=0.0)

    project = relationship("Project", back_populates="budget")


class BudgetCategory(Base):
    __tablename__ = "budget_categories"
    id = _pk()
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    name = Column(String(20), nullable=False)
    color = Column(String(10), nullable=False)
    allocated = Column(Float, default=0.0)
    spent = Column(Float, default=0.0)

    project = relationship("Project", back_populates="categories")


class Todo(Base):
    __tablename__ = "todos"
    id = _pk()
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    title = Column(String(200), nullable=False)
    stage_id = Column(String(50), default="design")
    due_date = Column(Date, nullable=True)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)

    project = relationship("Project", back_populates="todos")


class Expense(Base):
    __tablename__ = "expenses"
    id = _pk()
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    title = Column(String(200), nullable=False)
    amount = Column(Float, nullable=False)
    category_id = Column(String(50), nullable=False, default="hard")
    sub_category_id = Column(String(50), nullable=True)
    stage_id = Column(String(50), nullable=True)
    date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="paid")
    payer = Column(String(50), nullable=True)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=_now)

    project = relationship("Project", back_populates="expenses")


class FlowProgress(Base):
    __tablename__ = "flow_progress"
    project_id = Column(String(36), ForeignKey("projects.id"), primary_key=True)
    flow_type = Column(String(10), nullable=False, default="new")
    done_step_ids = Column(JSON, default=list)
    custom_order = Column(JSON, nullable=True)

    project = relationship("Project", back_populates="flow_progress")


# ---- Purchase Reference (global/shared reference data) ----

class PurchaseRefStage(Base):
    __tablename__ = "purchase_ref_stages"
    id = _pk()
    parent = Column(String(100), nullable=False)

    subs = relationship("PurchaseRefSubgroup", back_populates="stage", cascade="all, delete-orphan")


class PurchaseRefSubgroup(Base):
    __tablename__ = "purchase_ref_subgroups"
    id = _pk()
    stage_id = Column(String(36), ForeignKey("purchase_ref_stages.id"), nullable=False)
    name = Column(String(100), nullable=False)

    stage = relationship("PurchaseRefStage", back_populates="subs")
    items = relationship("PurchaseRefItem", back_populates="subgroup", cascade="all, delete-orphan")


class PurchaseRefItem(Base):
    __tablename__ = "purchase_ref_items"
    id = _pk()
    subgroup_id = Column(String(36), ForeignKey("purchase_ref_subgroups.id"), nullable=False)
    name = Column(String(200), nullable=False)
    spec = Column(String(100), nullable=True)
    qty = Column(Integer, default=1)
    unit = Column(String(20), nullable=True)

    subgroup = relationship("PurchaseRefSubgroup", back_populates="items")


class SelectedPurchase(Base):
    __tablename__ = "selected_purchases"
    id = _pk()
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    item_id = Column(String(36), ForeignKey("purchase_ref_items.id"), nullable=False)

    project = relationship("Project", back_populates="selected_purchases")


# ---- Price Comparison ----

class PriceCategory(Base):
    __tablename__ = "price_categories"
    id = _pk()
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    name = Column(String(100), nullable=False)
    icon = Column(String(10), default="📦")

    project = relationship("Project", back_populates="price_categories")
    models = relationship("PriceModel", back_populates="category", cascade="all, delete-orphan")


class PriceModel(Base):
    __tablename__ = "price_models"
    id = _pk()
    category_id = Column(String(36), ForeignKey("price_categories.id"), nullable=False)
    name = Column(String(200), nullable=False)
    spec = Column(String(100), nullable=True)
    note = Column(String(200), nullable=True)
    quantity = Column(Integer, default=1)

    category = relationship("PriceCategory", back_populates="models")
    quotes = relationship("ChannelQuote", back_populates="model", cascade="all, delete-orphan")


class ChannelQuote(Base):
    __tablename__ = "channel_quotes"
    id = _pk()
    model_id = Column(String(36), ForeignKey("price_models.id"), nullable=False)
    channel = Column(String(100), nullable=False)
    price = Column(Float, nullable=True)
    url = Column(String(500), nullable=True)
    updated_at = Column(DateTime, nullable=True)

    model = relationship("PriceModel", back_populates="quotes")


class SyncedModel(Base):
    __tablename__ = "synced_models"
    id = _pk()
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    model_id = Column(String(36), ForeignKey("price_models.id"), nullable=False)

    project = relationship("Project", back_populates="synced_models")


class StageNote(Base):
    """User notes attached to a specific flow stage."""
    __tablename__ = "stage_notes"
    id = _pk()
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    stage_id = Column(String(50), nullable=False, index=True)
    content = Column(String(2000), nullable=False)
    created_at = Column(DateTime, default=_now)

    project = relationship("Project")


class CustomFlowStep(Base):
    """User-inserted custom stages in the renovation flow."""
    __tablename__ = "custom_flow_steps"
    id = _pk()
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    flow_type = Column(String(10), nullable=False, default="new")
    title = Column(String(100), nullable=False)
    days = Column(String(20), default="")
    desc = Column(String(1000), default="")
    sort_order = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=_now)

    project = relationship("Project")


class KnowledgeArticle(Base):
    """Rich-text knowledge articles for flow stage resources (standards, acceptance, articles, pitfalls)."""
    __tablename__ = "knowledge_articles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_id = Column(Integer, unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False, default="")
    content = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class FlowStage(Base):
    """Renovation flow stages (e.g., 墙体拆改, 水电改造)."""
    __tablename__ = "flow_stages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stage_key = Column(String(50), nullable=False, index=True)  # e.g. 'design', 'demolish'
    flow_type = Column(String(10), nullable=False, default="new")  # 'new' or 'old'
    sort_order = Column(Integer, nullable=False)
    title = Column(String(100), nullable=False)
    days = Column(String(20), default="")
    desc = Column(String(2000), default="")

    resources = relationship("FlowStageResource", back_populates="stage", cascade="all, delete-orphan")


class FlowStageResource(Base):
    """Individual resources (standards, acceptance, articles, pitfalls) within a flow stage."""
    __tablename__ = "flow_stage_resources"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stage_id = Column(Integer, ForeignKey("flow_stages.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    resource_type = Column(String(20), nullable=False)  # 'standard', 'acceptance', 'article', 'pitfall'
    sort_order = Column(Integer, default=0)

    stage = relationship("FlowStage", back_populates="resources")

// ==================== Core Data Models ====================

export interface Project {
  id: string;
  name: string;
  ownerName: string;
  createdAt: string;
  currentStageId: string;
}

export interface Stage {
  id: string;
  name: string;
  order: number;
  description?: string;
  totalTasks: number;
  completedTasks: number;
}

export interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  allocated: number;
  spent: number;
}

export interface Budget {
  total: number;
  spent: number;
  categories: BudgetCategory[];
}

export interface Todo {
  id: string;
  projectId: string;
  title: string;
  stageId: string;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  name: string;
  category: string;
  stageId?: string;
  quantity?: number;
  unit?: string;
  expectedPrice?: number;
  actualPrice?: number;
  status: 'pending' | 'purchased';
}

export interface PurchaseReferenceItem {
  id: string;
  name: string;
  spec?: string;
  qty: number;
  unit?: string;
  selected?: boolean;
}

export interface PurchaseReferenceSubgroup {
  name: string;
  items: PurchaseReferenceItem[];
}

export interface PurchaseReferenceStage {
  parent: string;
  subs: PurchaseReferenceSubgroup[];
}

export interface ExpenseSubCategory {
  id: string;
  name: string;
  categoryId: string;
}

export interface ExpenseGroup {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

export interface Expense {
  id: string;
  projectId: string;
  title: string;
  amount: number;
  categoryId: string;
  subCategoryId?: string;
  stageId?: string;
  date: string;
  status: 'paid' | 'prepaid' | 'unpaid' | 'refunded';
  payer?: string;
  note?: string;
  createdAt: string;
}

// ==================== Flow / Process Types ====================

export type FlowType = 'new' | 'old';

export type FlowResourceType = 'standard' | 'acceptance' | 'article' | 'pitfall';

export interface FlowResource {
  id: number;
  title: string;
  type: FlowResourceType;
}

export interface FlowStep {
  id: string;
  type: FlowType;
  order: number;
  title: string;
  days: string;
  desc: string;
  standards: FlowResource[];
  acceptance: FlowResource[];
  articles: FlowResource[];
  pitfalls: FlowResource[];
  isCustom?: boolean;
}

export interface FlowProgress {
  projectId: string;
  flowType: FlowType;
  doneStepIds: string[];
  customOrder?: string[];
}

// ==================== Stage Notes ====================

export interface StageNote {
  id: string;
  project_id: string;
  stage_id: string;
  content: string;
  created_at: string;
}

// ==================== Custom Flow Steps ====================

export interface CustomFlowStep {
  id: string;
  project_id: string;
  flow_type: string;
  title: string;
  days: string;
  desc: string;
  sort_order: number;
  created_at: string;
}

// ==================== Price Comparison Types ====================

export interface ChannelQuote {
  id: string;
  channel: string;
  price?: number;
  url?: string;
  updatedAt?: string;
}

export interface PriceModel {
  id: string;
  name: string;
  spec?: string;
  note?: string;
  quantity?: number;
  channelQuotes: ChannelQuote[];
}

export interface PriceCategory {
  id: string;
  name: string;
  icon?: string;
  models: PriceModel[];
}

// ==================== App State ====================

export interface AppState {
  projects: Project[];
  activeProjectId: string;
  stages: Stage[];
  budget: Budget;
  todos: Todo[];
  purchaseItems: PurchaseItem[];
  purchaseReferences: PurchaseReferenceStage[];
  selectedPurchaseIds: string[];
  expenses: Expense[];
  recentExpenses: Expense[];
  expenseSubCategories: ExpenseSubCategory[];
  expenseGroups: ExpenseGroup[];
  flowType: FlowType;
  flowDoneStepIds: string[];
  flowCustomOrder: string[] | null;
  stageNotes: Record<string, StageNote[]>;  // stageId -> notes
  customFlowSteps: CustomFlowStep[];
  syncedModelIds: string[];
  priceCategories: PriceCategory[];
  projectStates: Record<string, ProjectState>;
}

export interface ProjectState {
  budget: { total: number; categories: { id: string; name: string; color: string; allocated: number; spent: number }[] };
  flowDoneStepIds: string[];
}

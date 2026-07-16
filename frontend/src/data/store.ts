import { useState, useEffect, useCallback } from 'react';
import type { AppState, Todo, BudgetCategory, Expense, PurchaseItem, PriceCategory, PriceModel, ChannelQuote, FlowStep, StageNote, CustomFlowStep, ExpenseSubCategory, ExpenseGroup } from './types';
import {
  DEFAULT_STAGES,
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_SUB_CATEGORIES,
  DEFAULT_EXPENSE_GROUPS,
  FLOW_STEPS_NEW,
  FLOW_STEPS_OLD,
  PURCHASE_REFERENCES,
} from './mockData';
import {
  fetchFlowProgress, updateFlowProgress, toggleStepDone as apiToggleStepDone,
  fetchStageNotes, createStageNote as apiCreateStageNote,
  editStageNote as apiEditStageNote, deleteStageNote as apiDeleteStageNote,
  fetchCustomSteps, createCustomStep as apiCreateCustomStep,
  updateCustomStep as apiUpdateCustomStep, deleteCustomStep as apiDeleteCustomStep,
  fetchFlowStages, type FlowStageRaw,
} from '../api/flow';
import { isAuthenticated } from '../api/client';
import {
  fetchExpenses, createExpenseApi, updateExpenseApi, deleteExpenseApi,
} from '../api/expenses';
import {
  fetchBudget, updateBudgetWithCategories as apiUpdateBudgetWithCategories,
  updateCategoryAllocation as apiUpdateCategoryAllocation,
} from '../api/budget';
import { pushState } from '../api/sync';

const STORAGE_KEY = 'xiaozhuangjia_state_v1';

function getInitialState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure backward compatibility
      return {
        projects: parsed.projects || [{ id: 'p1', name: '新家装修', ownerName: '我', createdAt: new Date().toISOString(), currentStageId: 'stage_prepare' }],
        activeProjectId: parsed.activeProjectId || 'p1',
        stages: parsed.stages || DEFAULT_STAGES,
        budget: parsed.budget || { total: 0, spent: 0, categories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, allocated: 0, spent: 0 })) },
        todos: parsed.todos || [],
        purchaseItems: parsed.purchaseItems || [],
        purchaseReferences: parsed.purchaseReferences || PURCHASE_REFERENCES,
        selectedPurchaseIds: parsed.selectedPurchaseIds || [],
        purchasedItemIds: parsed.purchasedItemIds || [],
        expenses: parsed.expenses || [],
        recentExpenses: parsed.recentExpenses || [],
        flowType: parsed.flowType || 'new',
        flowDoneStepIds: parsed.flowDoneStepIds || [],
        flowCustomOrder: parsed.flowCustomOrder || null,
        stageNotes: parsed.stageNotes || {},
        customFlowSteps: parsed.customFlowSteps || [],
        flowStepsFromBackend: parsed.flowStepsFromBackend || {},
        syncedModelIds: parsed.syncedModelIds || [],
        priceCategories: parsed.priceCategories || [],
        projectStates: parsed.projectStates || {},
        expenseSubCategories: parsed.expenseSubCategories || DEFAULT_SUB_CATEGORIES,
        expenseGroups: parsed.expenseGroups || DEFAULT_EXPENSE_GROUPS,
      };
    }
  } catch {
    // localStorage corrupted, use defaults
  }

  return {
    projects: [{ id: 'p1', name: '新家装修', ownerName: '我', createdAt: new Date().toISOString(), currentStageId: 'stage_prepare' }],
    activeProjectId: 'p1',
    stages: DEFAULT_STAGES,
    budget: { total: 0, spent: 0, categories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, allocated: 0, spent: 0 })) },
    todos: [],
    purchaseItems: [],
    purchaseReferences: PURCHASE_REFERENCES,
    selectedPurchaseIds: [],
    purchasedItemIds: [],
    expenses: [],
    recentExpenses: [],
    flowType: 'new',
    flowDoneStepIds: [],
    flowCustomOrder: null,
    stageNotes: {},
    customFlowSteps: [],
    flowStepsFromBackend: {},
    syncedModelIds: [],
    priceCategories: [],
    projectStates: {},
    expenseSubCategories: DEFAULT_SUB_CATEGORIES,
    expenseGroups: DEFAULT_EXPENSE_GROUPS,
  };
}

let globalState: AppState = getInitialState();
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach(l => l());
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
  } catch {
    // Storage full or unavailable
  }
}

export function getState(): AppState {
  return globalState;
}

export function useStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const cb = () => setTick(t => t + 1);
    listeners.push(cb);
    return () => {
      listeners = listeners.filter(l => l !== cb);
    };
  }, []);

  return globalState;
}

// ==================== Budget Actions ====================

function distributeBudget(total: number, categories: BudgetCategory[]): BudgetCategory[] {
  const step = 100;
  const normalizedTotal = Math.max(0, Math.round(total / step) * step);

  if (normalizedTotal <= 0) {
    return categories.map(c => ({ ...c, allocated: 0 }));
  }

  const count = categories.length;
  const base = Math.floor(normalizedTotal / count / step) * step;
  let remainder = normalizedTotal - base * count;

  return categories.map((c, index) => {
    let alloc = base;
    if (index === 0) {
      alloc += remainder;
    }
    return { ...c, allocated: Math.max(0, alloc) };
  });
}

export function setTotalBudget(total: number, scaleStages = true) {
  const categories = globalState.budget.categories;
  const oldTotal = globalState.budget.total;
  const allZero = categories.every(c => c.allocated === 0);
  const normalizedTotal = Math.max(0, Math.round(total / 100) * 100);
  let newCategories = categories;

  if (normalizedTotal > 0) {
    if (allZero) {
      // Initial setup with no allocations yet — distribute evenly
      newCategories = distributeBudget(normalizedTotal, categories);
    } else if (scaleStages && oldTotal > 0 && oldTotal !== normalizedTotal) {
      // Manual total change: proportionally scale existing allocations
      let distributed = 0;
      const scaled = categories.map((c, i) => {
        if (i === categories.length - 1) {
          const alloc = Math.round((normalizedTotal - distributed) / 100) * 100;
          return { ...c, allocated: Math.max(0, alloc) };
        }
        const ratio = c.allocated / oldTotal;
        const alloc = Math.round((normalizedTotal * ratio) / 100) * 100;
        distributed += alloc;
        return { ...c, allocated: Math.max(0, alloc) };
      });
      newCategories = scaled;
    }
    // scaleStages=false: stage-driven change, keep allocations as-is
  } else {
    // Total set to 0 — clear all allocations
    newCategories = categories.map(c => ({ ...c, allocated: 0 }));
  }

  globalState = { ...globalState, budget: { ...globalState.budget, total: normalizedTotal, categories: newCategories } };
  recalculateBudget();
  notify();
  persist();

  // Sync total + all category allocations to backend
  if (isAuthenticated()) {
    const catPayload = newCategories.map(c => ({
      id: c.id,
      allocated: c.allocated,
      name: c.name,
      color: c.color,
    }));
    apiUpdateBudgetWithCategories(globalState.activeProjectId, normalizedTotal, catPayload).catch(() => {});
  }
}

export function setCategoryAllocation(categoryId: string, allocated: number) {
  const categories = globalState.budget.categories.map(c =>
    c.id === categoryId ? { ...c, allocated } : c
  );
  globalState = { ...globalState, budget: { ...globalState.budget, categories } };
  recalculateBudget();
  notify();
  persist();

  if (isAuthenticated()) {
    apiUpdateCategoryAllocation(globalState.activeProjectId, _bkCatId(categoryId), allocated).catch(() => {});
  }
}

/** Atomically adjust two adjacent category allocations (for slider drag, §4.2.2) */
export function adjustAdjacentBudgets(leftId: string, rightId: string, newLeft: number, newRight: number) {
  const categories = globalState.budget.categories.map(c => {
    if (c.id === leftId) return { ...c, allocated: newLeft };
    if (c.id === rightId) return { ...c, allocated: newRight };
    return c;
  });
  globalState = { ...globalState, budget: { ...globalState.budget, categories } };
  recalculateBudget();
  notify();
  persist();

  if (isAuthenticated()) {
    const pid = globalState.activeProjectId;
    Promise.all([
      apiUpdateCategoryAllocation(pid, _bkCatId(leftId), newLeft),
      apiUpdateCategoryAllocation(pid, _bkCatId(rightId), newRight),
    ]).catch(() => {});
  }
}

function recalculateBudget() {
  const categories = globalState.budget.categories;
  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
  globalState.budget.spent = totalSpent;
}

export function getBudgetRemaining(): number {
  return globalState.budget.total - globalState.budget.spent;
}

export function getBudgetUsageRate(): number {
  if (globalState.budget.total <= 0) return 0;
  return Math.round((globalState.budget.spent / globalState.budget.total) * 100);
}

// ==================== Todo Actions ====================

export function addTodo(title: string, stageId: string, dueDate?: string) {
  const todo: Todo = {
    id: `todo_${Date.now()}`,
    projectId: globalState.activeProjectId,
    title,
    stageId,
    dueDate,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  globalState = { ...globalState, todos: [...globalState.todos, todo] };
  notify();
  persist();
}

export function toggleTodo(todoId: string) {
  const todos = globalState.todos.map(t =>
    t.id === todoId ? { ...t, completed: !t.completed } : t
  );
  globalState = { ...globalState, todos };
  notify();
  persist();
}

export function getProjectTodos(): Todo[] {
  return globalState.todos.filter(t => t.projectId === globalState.activeProjectId);
}

export function deleteTodo(todoId: string) {
  const todos = globalState.todos.filter(t => t.id !== todoId);
  globalState = { ...globalState, todos };
  notify();
  persist();
}

export function updateTodo(todoId: string, updates: Partial<Todo>) {
  const todos = globalState.todos.map(t =>
    t.id === todoId ? { ...t, ...updates } : t
  );
  globalState = { ...globalState, todos };
  notify();
  persist();
}

// ==================== Purchase Actions ====================

export function togglePurchaseRef(itemId: string) {
  const purchaseReferences = globalState.purchaseReferences.map(stage => ({
    ...stage,
    subs: stage.subs.map(sub => ({
      ...sub,
      items: sub.items.map(item =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      ),
    })),
  }));

  const selectedIds = new Set(globalState.selectedPurchaseIds);
  if (selectedIds.has(itemId)) {
    selectedIds.delete(itemId);
  } else {
    selectedIds.add(itemId);
  }

  globalState = {
    ...globalState,
    purchaseReferences,
    selectedPurchaseIds: Array.from(selectedIds),
  };
  notify();
  persist();

  // Sync to backend if authenticated
  if (isAuthenticated()) {
    import('../api/purchase').then(({ togglePurchaseSelection }) => {
      togglePurchaseSelection(globalState.activeProjectId, itemId).catch(() => {});
    });
  }
}

export function addCustomPurchaseItem(name: string, stageParent: string, qty: number, spec?: string, subgroupName?: string, unit?: string) {
  const id = `p_custom_${Date.now()}`;
  const purchaseReferences = globalState.purchaseReferences.map(stage => {
    if (stage.parent !== stageParent) return stage;
    return {
      ...stage,
      subs: stage.subs.map((sub, i) => {
        // If subgroupName is provided, find the matching subgroup
        const isTargetSub = subgroupName ? sub.name === subgroupName : i === 0;
        if (isTargetSub) {
          return {
            ...sub,
            items: [...sub.items, { id, name, spec: spec || '', qty, unit: unit || '个', selected: true }],
          };
        }
        return sub;
      }),
    };
  });

  globalState = {
    ...globalState,
    purchaseReferences,
    selectedPurchaseIds: [...globalState.selectedPurchaseIds, id],
  };
  notify();
  persist();

  // Sync to backend if authenticated
  if (isAuthenticated()) {
    import('../api/purchase').then(({ addCustomPurchaseItem: apiAdd }) => {
      apiAdd(globalState.activeProjectId, {
        name,
        stage_parent: stageParent,
        subgroup_name: subgroupName,
        spec: spec || '',
        qty,
        unit: unit || '个',
      }).catch(() => {});
    });
  }
}

export function deletePurchaseRefItem(itemId: string) {
  // Find the item to get its stage parent (for possible backend sync)
  let stageParent = '';
  const purchaseReferences = globalState.purchaseReferences.map(stage => {
    const newSubs = stage.subs.map(sub => {
      const found = sub.items.find(item => item.id === itemId);
      if (found) stageParent = stage.parent;
      return {
        ...sub,
        items: sub.items.filter(item => item.id !== itemId),
      };
    });
    return { ...stage, subs: newSubs };
  });
  const selectedPurchaseIds = globalState.selectedPurchaseIds.filter(id => id !== itemId);

  globalState = { ...globalState, purchaseReferences, selectedPurchaseIds };
  notify();
  persist();

  // Sync to backend if authenticated
  if (isAuthenticated()) {
    import('../api/purchase').then(({ deletePurchaseItem: apiDelete }) => {
      apiDelete(globalState.activeProjectId, itemId).catch(() => {});
    });
  }
}

export function updatePurchaseRefQty(itemId: string, qty: number) {
  const purchaseReferences = globalState.purchaseReferences.map(stage => ({
    ...stage,
    subs: stage.subs.map(sub => ({
      ...sub,
      items: sub.items.map(item =>
        item.id === itemId ? { ...item, qty } : item
      ),
    })),
  }));
  globalState = { ...globalState, purchaseReferences };
  notify();
  persist();
}

/** Load selected purchases from backend */
export async function loadSelectedPurchasesFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const { fetchSelectedPurchases } = await import('../api/purchase');
    const selectedIds = await fetchSelectedPurchases(globalState.activeProjectId);
    if (selectedIds.length > 0) {
      // Merge with local: backend is authoritative for existing items
      const localOnlyIds = globalState.selectedPurchaseIds.filter(
        id => id.startsWith('p_custom_')
      );
      const merged = [...new Set([...selectedIds, ...localOnlyIds])];
      // Also mark items as selected in references
      const purchaseReferences = globalState.purchaseReferences.map(stage => ({
        ...stage,
        subs: stage.subs.map(sub => ({
          ...sub,
          items: sub.items.map(item => ({
            ...item,
            selected: merged.includes(item.id),
          })),
        })),
      }));
      globalState = {
        ...globalState,
        selectedPurchaseIds: merged,
        purchaseReferences,
      };
      notify();
      persist();
    }
  } catch {
    // Backend unreachable, keep local data
  }
}

/** Load purchase references from backend, falling back to local mockData */
export async function loadPurchaseReferencesFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const { fetchPurchaseReferences } = await import('../api/purchase');
    const remoteRefs = await fetchPurchaseReferences();
    if (remoteRefs && remoteRefs.length > 0) {
      // Add selected state from local selectedPurchaseIds
      const selectedSet = new Set(globalState.selectedPurchaseIds);
      const enriched = remoteRefs.map(stage => ({
        ...stage,
        subs: stage.subs.map(sub => ({
          ...sub,
          items: sub.items.map(item => ({
            ...item,
            selected: selectedSet.has(item.id),
          })),
        })),
      }));
      globalState = { ...globalState, purchaseReferences: enriched };
      notify();
      persist();
    }
  } catch {
    // Backend unreachable, keep local mockData
  }
}

// ── Purchased status ──

export function togglePurchased(itemId: string) {
  const set = new Set(globalState.purchasedItemIds);
  if (set.has(itemId)) set.delete(itemId);
  else set.add(itemId);
  globalState = { ...globalState, purchasedItemIds: Array.from(set) };
  notify();
  persist();

  if (isAuthenticated()) {
    import('../api/purchase').then(({ togglePurchasedItem }) => {
      togglePurchasedItem(globalState.activeProjectId, itemId).catch(() => {});
    });
  }
}

export function isItemPurchased(itemId: string): boolean {
  return globalState.purchasedItemIds.includes(itemId);
}

/** Load purchased items from backend */
export async function loadPurchasedFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const { fetchPurchasedItems } = await import('../api/purchase');
    const purIds = await fetchPurchasedItems(globalState.activeProjectId);
    globalState = { ...globalState, purchasedItemIds: purIds };
    notify();
    persist();
  } catch { /* backend unreachable */ }
}

// ── Add purchase item to compare ──

export function addPurchaseToCompare(item: {
  itemId: string;
  name: string;
  spec?: string;
  stageParent: string;
  qty: number;
}) {
  // Optimistic local: find or create category, create model
  let cat = globalState.priceCategories.find(c => c.name === item.stageParent);
  if (!cat) {
    cat = addPriceCategory(item.stageParent, '📦');
    cat = globalState.priceCategories.find(c => c.name === item.stageParent)!;
  }
  addPriceModel(cat.id, item.name, item.spec || '', '', item.qty);

  // Sync to backend
  if (isAuthenticated()) {
    import('../api/purchase').then(({ addPurchaseToCompareApi }) => {
      addPurchaseToCompareApi(globalState.activeProjectId, {
        item_id: item.itemId,
        item_name: item.name,
        spec: item.spec || '',
        category_name: item.stageParent,
        quantity: item.qty,
      }).catch(() => {});
    });
  }
}

// ==================== Expense Actions ====================

function _bkCatId(frontendCatId: string): string {
  return `${globalState.activeProjectId}_${frontendCatId}`;
}

export function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>) {
  const newExpense: Expense = {
    ...expense,
    id: `exp_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const expenses = [newExpense, ...globalState.expenses];
  const recentExpenses = expenses.slice(0, 5);

  // Update category spent
  const categories = globalState.budget.categories.map(c =>
    c.id === expense.categoryId ? { ...c, spent: c.spent + expense.amount } : c
  );

  globalState = {
    ...globalState,
    expenses,
    recentExpenses,
    budget: { ...globalState.budget, categories },
  };
  recalculateBudget();
  notify();
  persist();

  // Sync to backend
  if (isAuthenticated()) {
    createExpenseApi(globalState.activeProjectId, {
      title: newExpense.title,
      amount: newExpense.amount,
      category_id: newExpense.categoryId,
      sub_category_id: newExpense.subCategoryId,
      stage_id: newExpense.stageId,
      date: newExpense.date,
      status: newExpense.status,
      payer: newExpense.payer,
      note: newExpense.note,
    }).catch(() => {});
  }
}

export function deleteExpense(expenseId: string) {
  const expense = globalState.expenses.find(e => e.id === expenseId);
  if (!expense) return;

  const expenses = globalState.expenses.filter(e => e.id !== expenseId);
  const recentExpenses = expenses.slice(0, 5);

  const categories = globalState.budget.categories.map(c =>
    c.id === expense.categoryId ? { ...c, spent: Math.max(0, c.spent - expense.amount) } : c
  );

  globalState = {
    ...globalState,
    expenses,
    recentExpenses,
    budget: { ...globalState.budget, categories },
  };
  recalculateBudget();
  notify();
  persist();

  if (isAuthenticated()) {
    deleteExpenseApi(globalState.activeProjectId, expenseId).catch(() => {});
  }
}

export function updateExpenseStatus(expenseId: string, status: Expense['status']) {
  const expenses = globalState.expenses.map(e =>
    e.id === expenseId ? { ...e, status } : e
  );
  globalState = { ...globalState, expenses };
  notify();
  persist();

  if (isAuthenticated()) {
    updateExpenseApi(globalState.activeProjectId, expenseId, { status }).catch(() => {});
  }
}

export function updateExpense(expenseId: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>) {
  const old = globalState.expenses.find(e => e.id === expenseId);
  if (!old) return;

  const expenses = globalState.expenses.map(e =>
    e.id === expenseId ? { ...e, ...updates } : e
  );
  const recentExpenses = expenses.slice(0, 5);

  let categories = globalState.budget.categories;
  if (updates.amount !== undefined || updates.categoryId !== undefined) {
    const newAmount = updates.amount ?? old.amount;
    const newCatId = updates.categoryId ?? old.categoryId;
    categories = categories.map(c => {
      let spent = c.spent;
      if (c.id === old.categoryId) spent -= old.amount;
      if (c.id === newCatId) spent += newAmount;
      return { ...c, spent: Math.max(0, spent) };
    });
  }

  globalState = { ...globalState, expenses, recentExpenses, budget: { ...globalState.budget, categories } };
  recalculateBudget();
  notify();
  persist();

  if (isAuthenticated()) {
    const payload: any = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;
    if (updates.subCategoryId !== undefined) payload.sub_category_id = updates.subCategoryId;
    if (updates.stageId !== undefined) payload.stage_id = updates.stageId;
    if (updates.date !== undefined) payload.date = updates.date;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.payer !== undefined) payload.payer = updates.payer;
    if (updates.note !== undefined) payload.note = updates.note;
    updateExpenseApi(globalState.activeProjectId, expenseId, payload).catch(() => {});
  }
}

// ==================== Price Category Actions ====================

export function addPriceCategory(name: string, icon?: string) {
  const category: PriceCategory = {
    id: `pc_${Date.now()}`,
    name,
    icon: icon || '📦',
    models: [],
  };
  globalState = { ...globalState, priceCategories: [...globalState.priceCategories, category] };
  notify();
  persist();
  return category;
}

export function deletePriceCategory(categoryId: string) {
  globalState = {
    ...globalState,
    priceCategories: globalState.priceCategories.filter(c => c.id !== categoryId),
  };
  notify();
  persist();
}

export function addPriceModel(categoryId: string, name: string, spec?: string, note?: string, quantity?: number) {
  const model: PriceModel = {
    id: `pm_${Date.now()}`,
    name,
    spec: spec || '',
    note: note || '',
    quantity: quantity || 1,
    channelQuotes: [],
  };
  const priceCategories = globalState.priceCategories.map(c =>
    c.id === categoryId ? { ...c, models: [...c.models, model] } : c
  );
  globalState = { ...globalState, priceCategories };
  notify();
  persist();
  return model;
}

export function deletePriceModel(categoryId: string, modelId: string) {
  const priceCategories = globalState.priceCategories.map(c =>
    c.id === categoryId ? { ...c, models: c.models.filter(m => m.id !== modelId) } : c
  );
  globalState = { ...globalState, priceCategories };
  notify();
  persist();
}

export function addChannelQuote(modelId: string, channel: string, price?: number, url?: string) {
  const quote: ChannelQuote = {
    id: `ch_${Date.now()}`,
    channel,
    price,
    url,
    updatedAt: new Date().toISOString(),
  };
  const priceCategories = globalState.priceCategories.map(c => ({
    ...c,
    models: c.models.map(m =>
      m.id === modelId ? { ...m, channelQuotes: [...m.channelQuotes, quote] } : m
    ),
  }));
  globalState = { ...globalState, priceCategories };
  notify();
  persist();
  return quote;
}

export function deleteChannelQuote(modelId: string, quoteId: string) {
  const priceCategories = globalState.priceCategories.map(c => ({
    ...c,
    models: c.models.map(m =>
      m.id === modelId ? { ...m, channelQuotes: m.channelQuotes.filter(q => q.id !== quoteId) } : m
    ),
  }));
  globalState = { ...globalState, priceCategories };
  notify();
  persist();
}

export function toggleModelSync(modelId: string) {
  const set = new Set(globalState.syncedModelIds);
  const isSyncing = !set.has(modelId);
  if (isSyncing) set.add(modelId);
  else set.delete(modelId);
  globalState = { ...globalState, syncedModelIds: Array.from(set) };
  notify();
  persist();

  // Sync to backend (also triggers auto-purchase of matching items)
  if (isAuthenticated()) {
    import('../api/compare').then(({ toggleModelSyncApi }) => {
      toggleModelSyncApi(globalState.activeProjectId, modelId)
        .then((res) => {
          if (res.auto_purchased > 0) {
            loadPurchasedFromBackend();
          }
        })
        .catch(() => {});
    });
  }
}

export function isModelSynced(modelId: string): boolean {
  return globalState.syncedModelIds.includes(modelId);
}

export function getTotalChannelCount(): number {
  let count = 0;
  globalState.priceCategories.forEach(c => {
    c.models.forEach(m => {
      count += m.channelQuotes.length;
    });
  });
  return count;
}

// ==================== Flow Actions ====================

export function setFlowType(flowType: 'new' | 'old') {
  globalState = { ...globalState, flowType, flowCustomOrder: null };
  notify();
  persist();
}

export function setFlowCustomOrder(order: string[] | null) {
  globalState = { ...globalState, flowCustomOrder: order };
  notify();
  persist();
}

export function toggleFlowStepDone(stepId: string) {
  const doneSet = new Set(globalState.flowDoneStepIds);
  if (doneSet.has(stepId)) {
    doneSet.delete(stepId);
  } else {
    doneSet.add(stepId);
  }
  globalState = { ...globalState, flowDoneStepIds: Array.from(doneSet) };
  notify();
  persist();

  // Sync to backend if authenticated
  syncFlowToBackend();
}

async function syncFlowToBackend() {
  if (!isAuthenticated()) return;
  try {
    await updateFlowProgress(globalState.activeProjectId, {
      flow_type: globalState.flowType,
      done_step_ids: globalState.flowDoneStepIds,
      custom_order: globalState.flowCustomOrder,
    });
  } catch {
    // Silently fail — local state is still correct
  }
}

/** Load flow progress from backend, merging with local state */
export async function loadFlowFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const remote = await fetchFlowProgress(globalState.activeProjectId);
    // Merge: remote is authoritative for flow_type, done_step_ids, custom_order
    globalState = {
      ...globalState,
      flowType: (remote.flow_type as 'new' | 'old') || globalState.flowType,
      flowDoneStepIds: remote.done_step_ids || [],
      flowCustomOrder: remote.custom_order || null,
    };
    notify();
    persist();
  } catch {
    // Silently fail — backend may be unreachable
  }
}

/** Load budget and expenses from backend, merging with local state */
export async function loadBudgetAndExpensesFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;

  const pid = globalState.activeProjectId;

  try {
    // Load budget
    const budgetData = await fetchBudget(pid);
    // Map backend category IDs (proj_xxx_hard) to frontend IDs (hard)
    const prefix = `${pid}_`;
    const categories = budgetData.categories.map(c => ({
      ...c,
      id: c.id.startsWith(prefix) ? c.id.slice(prefix.length) : c.id,
    }));
    // Preserve existing category IDs if backend returns different set
    const existingIds = new Set(globalState.budget.categories.map(c => c.id));
    const mergedCategories = categories.length > 0
      ? categories.map(c => ({
          ...c,
          // Use existing spent from backend, fall back to local
          spent: c.spent || (globalState.budget.categories.find(lc => lc.id === c.id)?.spent || 0),
        }))
      : globalState.budget.categories;

    globalState = {
      ...globalState,
      budget: {
        total: budgetData.total,
        categories: mergedCategories,
      },
    };
    recalculateBudget();
    notify();
    persist();
  } catch {
    // Backend unreachable, keep local data
  }

  try {
    // Load expenses
    const remoteExpenses = await fetchExpenses(pid);
    if (remoteExpenses.length > 0) {
      // Merge: backend data is authoritative, but keep local-only items
      const remoteIds = new Set(remoteExpenses.map(e => e.id));
      const localOnly = globalState.expenses.filter(e => !remoteIds.has(e.id) && !e.id.startsWith('exp_'));
      const merged = [...remoteExpenses, ...localOnly];
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      globalState = {
        ...globalState,
        expenses: merged,
        recentExpenses: merged.slice(0, 5),
      };
      // Recalculate budget spent from backend data
      _recalcSpentFromExpenses();
      notify();
      persist();
    }
  } catch {
    // Backend unreachable, keep local data
  }
}

function _recalcSpentFromExpenses() {
  const totals: Record<string, number> = {};
  globalState.expenses.forEach(e => {
    if (e.status === 'paid' || e.status === 'prepaid') {
      totals[e.categoryId] = (totals[e.categoryId] || 0) + e.amount;
    }
  });
  globalState.budget.categories = globalState.budget.categories.map(c => ({
    ...c,
    spent: totals[c.id] || 0,
  }));
  recalculateBudget();
}

// ==================== Stage Notes Actions ====================

export function getStageNotes(stageId: string): StageNote[] {
  return globalState.stageNotes[stageId] || [];
}

export async function addStageNote(stageId: string, content: string): Promise<void> {
  if (!content.trim()) return;

  if (isAuthenticated()) {
    try {
      const note = await apiCreateStageNote(globalState.activeProjectId, stageId, content);
      const existing = globalState.stageNotes[stageId] || [];
      globalState = {
        ...globalState,
        stageNotes: { ...globalState.stageNotes, [stageId]: [note, ...existing] },
      };
      notify();
      persist();
      return;
    } catch {
      // Backend unreachable — fall back to local-only
    }
  }

  // Local-only (offline or backend unreachable)
  const note: StageNote = {
    id: `note_${Date.now()}`,
    project_id: globalState.activeProjectId,
    stage_id: stageId,
    content: content.trim(),
    created_at: new Date().toISOString(),
  };
  const existing = globalState.stageNotes[stageId] || [];
  globalState = {
    ...globalState,
    stageNotes: { ...globalState.stageNotes, [stageId]: [note, ...existing] },
  };
  notify();
  persist();
}

export async function updateStageNote(stageId: string, noteId: string, content: string): Promise<void> {
  if (!content.trim()) return;

  if (isAuthenticated()) {
    try {
      const updated = await apiEditStageNote(globalState.activeProjectId, stageId, noteId, content);
      const existing = globalState.stageNotes[stageId] || [];
      globalState = {
        ...globalState,
        stageNotes: {
          ...globalState.stageNotes,
          [stageId]: existing.map(n => n.id === noteId ? updated : n),
        },
      };
      notify();
      persist();
      return;
    } catch {
      // Backend unreachable — fall back to local-only
    }
  }

  // Local-only (offline or backend unreachable)
  const existing = globalState.stageNotes[stageId] || [];
  globalState = {
    ...globalState,
    stageNotes: {
      ...globalState.stageNotes,
      [stageId]: existing.map(n => n.id === noteId ? { ...n, content: content.trim() } : n),
    },
  };
  notify();
  persist();
}

export async function removeStageNote(stageId: string, noteId: string): Promise<void> {
  if (isAuthenticated()) {
    try {
      await apiDeleteStageNote(globalState.activeProjectId, stageId, noteId);
    } catch {
      // Backend unreachable — continue with local removal
    }
  }

  const existing = globalState.stageNotes[stageId] || [];
  globalState = {
    ...globalState,
    stageNotes: {
      ...globalState.stageNotes,
      [stageId]: existing.filter(n => n.id !== noteId),
    },
  };
  notify();
  persist();
}

export async function loadStageNotes(stageId: string): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const notes = await fetchStageNotes(globalState.activeProjectId, stageId);
    globalState = {
      ...globalState,
      stageNotes: { ...globalState.stageNotes, [stageId]: notes },
    };
    notify();
    persist();
  } catch {
    // Silently fail — backend may be unreachable
  }
}

// ==================== Custom Flow Steps Actions ====================

/** Convert backend FlowStageRaw[] to frontend FlowStep[] */
function _convertBackendStages(rawStages: FlowStageRaw[]): FlowStep[] {
  return rawStages.map(raw => ({
    id: raw.stage_key,
    type: raw.flow_type as 'new' | 'old',
    order: raw.sort_order,
    title: raw.title,
    days: raw.days,
    desc: raw.desc,
    standards: raw.resources.filter(r => r.resource_type === 'standard').map(r => ({ id: r.id, title: r.title, type: 'standard' as const })),
    acceptance: raw.resources.filter(r => r.resource_type === 'acceptance').map(r => ({ id: r.id, title: r.title, type: 'acceptance' as const })),
    articles: raw.resources.filter(r => r.resource_type === 'article').map(r => ({ id: r.id, title: r.title, type: 'article' as const })),
    pitfalls: raw.resources.filter(r => r.resource_type === 'pitfall').map(r => ({ id: r.id, title: r.title, type: 'pitfall' as const })),
    isCustom: false,
  }));
}

/** Load flow stages from backend and store them */
export async function loadFlowStagesFromBackend(flowType: 'new' | 'old'): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const raw = await fetchFlowStages(flowType);
    const steps = _convertBackendStages(raw);
    globalState = {
      ...globalState,
      flowStepsFromBackend: { ...globalState.flowStepsFromBackend, [flowType]: steps },
    };
    notify();
    persist();
  } catch {
    // Backend unreachable — fall back to mockData
  }
}

/** Merge custom steps into the built-in flow step list */
export function getOrderedFlowSteps(flowType: 'new' | 'old'): FlowStep[] {
  // Use backend data if available, otherwise fall back to hardcoded mockData
  const backendSteps = globalState.flowStepsFromBackend[flowType];
  const baseSteps: FlowStep[] = (backendSteps && backendSteps.length > 0)
    ? backendSteps
    : (flowType === 'new' ? FLOW_STEPS_NEW : FLOW_STEPS_OLD);
  const customOrder = globalState.flowCustomOrder;

  // Build list: base steps + custom steps converted to FlowStep format
  const customAsFlowSteps: FlowStep[] = globalState.customFlowSteps
    .filter(cs => cs.flow_type === flowType)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(cs => ({
      id: cs.id,
      type: flowType,
      order: cs.sort_order,
      title: cs.title,
      days: cs.days || '自定义',
      desc: cs.desc || '',
      standards: [],
      acceptance: [],
      articles: [],
      pitfalls: [],
      isCustom: true,
    }));

  // Combine all steps
  const allSteps = [...baseSteps, ...customAsFlowSteps];

  if (customOrder && customOrder.length > 0) {
    const stepMap = new Map(allSteps.map(s => [s.id, s]));
    const ordered: FlowStep[] = customOrder.map(id => stepMap.get(id)).filter((s): s is FlowStep => !!s);
    const orderedIds = new Set(customOrder);
    allSteps.forEach(s => { if (!orderedIds.has(s.id)) ordered.push(s); });
    return ordered;
  }
  return allSteps;
}

export async function addCustomFlowStep(
  flowType: string, title: string, days: string, desc: string, sortOrder: number
): Promise<CustomFlowStep | null> {
  if (isAuthenticated()) {
    try {
      const step = await apiCreateCustomStep(globalState.activeProjectId, {
        flow_type: flowType,
        title,
        days,
        desc,
        sort_order: sortOrder,
      });
      globalState = {
        ...globalState,
        customFlowSteps: [...globalState.customFlowSteps, step],
      };
      notify();
      persist();
      return step;
    } catch {
      // Backend unreachable — fall back to local-only
    }
  }

  // Local-only (offline or backend unreachable)
  const step: CustomFlowStep = {
    id: `custom_${Date.now()}`,
    project_id: globalState.activeProjectId,
    flow_type: flowType,
    title,
    days,
    desc,
    sort_order: sortOrder,
    created_at: new Date().toISOString(),
  };
  globalState = {
    ...globalState,
    customFlowSteps: [...globalState.customFlowSteps, step],
  };
  notify();
  persist();
  return step;
}

export async function removeCustomFlowStep(stepId: string): Promise<void> {
  if (isAuthenticated()) {
    try {
      await apiDeleteCustomStep(globalState.activeProjectId, stepId);
    } catch {
      // Backend unreachable — continue with local removal
    }
  }

  // Remove from custom steps
  const customFlowSteps = globalState.customFlowSteps.filter(s => s.id !== stepId);
  // Also remove from done_step_ids and custom_order
  const flowDoneStepIds = globalState.flowDoneStepIds.filter(id => id !== stepId);
  const flowCustomOrder = globalState.flowCustomOrder
    ? globalState.flowCustomOrder.filter(id => id !== stepId)
    : globalState.flowCustomOrder;

  globalState = {
    ...globalState,
    customFlowSteps,
    flowDoneStepIds,
    flowCustomOrder,
  };
  notify();
  persist();
}

export async function loadCustomFlowSteps(): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const steps = await fetchCustomSteps(globalState.activeProjectId, globalState.flowType);
    globalState = {
      ...globalState,
      customFlowSteps: steps,
    };
    notify();
    persist();
  } catch {
    // Silently fail — backend may be unreachable
  }
}

// ==================== Project Actions ====================

export function switchProject(projectId: string) {
  // Save current project state
  const currentStates = { ...globalState.projectStates };
  currentStates[globalState.activeProjectId] = {
    budget: {
      total: globalState.budget.total,
      categories: globalState.budget.categories.map(c => ({ id: c.id, name: c.name, color: c.color, allocated: c.allocated, spent: c.spent })),
    },
    flowDoneStepIds: [...globalState.flowDoneStepIds],
  };

  // Load target project state (or defaults)
  const target = currentStates[projectId];
  const targetBudget = target?.budget || { total: 0, categories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ id: c.id, name: c.name, color: c.color, allocated: 0, spent: 0 })) };
  const targetFlowDone = target?.flowDoneStepIds || [];

  globalState = {
    ...globalState,
    activeProjectId: projectId,
    projectStates: currentStates,
    budget: { ...globalState.budget, total: targetBudget.total, categories: targetBudget.categories },
    flowDoneStepIds: targetFlowDone,
  };
  notify();
  persist();
}

export function addProject(name: string) {
  const project = {
    id: `proj_${Date.now()}`,
    name,
    ownerName: '我',
    createdAt: new Date().toISOString(),
    currentStageId: 'stage_prepare',
  };
  globalState = {
    ...globalState,
    projects: [...globalState.projects, project],
    activeProjectId: project.id,
  };
  notify();
  persist();
}

// ==================== Data Export/Import ====================

export function exportAllData(): string {
  return JSON.stringify(globalState, null, 2);
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (data && typeof data === 'object') {
      globalState = { ...getInitialState(), ...data };
      notify();
      persist();
      return true;
    }
  } catch {
    // Invalid JSON
  }
  return false;
}

export function resetAllData() {
  globalState = getInitialState();
  notify();
  persist();
}

// ==================== Server Sync / Migration ====================

const MIGRATED_USERS_KEY = 'xiaozhuangjia_migrated_users';

function getMigratedUsers(): string[] {
  try {
    const raw = localStorage.getItem(MIGRATED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markUserMigrated(userId: string) {
  const users = getMigratedUsers();
  if (!users.includes(userId)) {
    users.push(userId);
    localStorage.setItem(MIGRATED_USERS_KEY, JSON.stringify(users));
  }
}

/** Push local data to server for a newly logged-in user.
 *  Only migrates once per user to avoid overwriting server data
 *  (pushState replaces all server data, so we only do it on first login). */
export async function migrateLocalDataToServer(userId?: string): Promise<void> {
  if (!isAuthenticated()) return;

  // Only migrate if there's local data to push
  const hasLocalData = globalState.expenses.length > 0;
  if (!hasLocalData) return;

  // Only migrate once per user (per device)
  if (userId) {
    const migratedUsers = getMigratedUsers();
    if (migratedUsers.includes(userId)) {
      // Already migrated — just sync from server instead
      await syncFromServerAfterLogin();
      return;
    }
  }

  try {
    // Push full local state to server (replaces any existing server data)
    await pushState(globalState.activeProjectId, globalState);
    if (userId) markUserMigrated(userId);
    // Reload from server to get the authoritative merged state
    await loadBudgetAndExpensesFromBackend();
    await loadFlowFromBackend();
  } catch {
    // Server unreachable — data stays local, will sync on next mutation
  }
}

/** Call after login to pull server data and merge with local */
export async function syncFromServerAfterLogin(): Promise<void> {
  if (!isAuthenticated()) return;

  try {
    await loadBudgetAndExpensesFromBackend();
    await loadFlowFromBackend();
    await loadPurchaseReferencesFromBackend();
    await loadSelectedPurchasesFromBackend();
    await loadPurchasedFromBackend();
  } catch {
    // Server unreachable — keep local data
  }
}

// ==================== Computed Helpers ====================

export function getCompletedStageCount(): number {
  const flowSteps = getOrderedFlowSteps('new');
  return globalState.flowDoneStepIds.filter(id =>
    flowSteps.some(s => s.id === id)
  ).length;
}

export function getTotalStageCount(flowType: 'new' | 'old' = 'new'): number {
  const baseCount = flowType === 'new' ? 22 : 9;
  const customCount = globalState.customFlowSteps.filter(cs => cs.flow_type === flowType).length;
  return baseCount + customCount;
}

export function getFirstUndoneStepId(): string {
  const flowSteps = getOrderedFlowSteps(globalState.flowType);
  const doneSet = new Set(globalState.flowDoneStepIds);
  const firstUndone = flowSteps.find(s => !doneSet.has(s.id));
  return firstUndone?.id || flowSteps[0]?.id || 'design';
}

export function getCurrentStageName(): string {
  const stage = globalState.stages.find(s => s.id === getFirstUndoneStepId());
  return stage?.name || '设计与开工准备';
}

// ==================== Expense SubCategory Actions ====================

export function addSubCategory(name: string, categoryId: string): ExpenseSubCategory {
  const sub: ExpenseSubCategory = {
    id: `sub_${Date.now()}`,
    name: name.trim(),
    categoryId,
  };
  globalState = {
    ...globalState,
    expenseSubCategories: [...globalState.expenseSubCategories, sub],
  };
  notify();
  persist();
  return sub;
}

export function deleteSubCategory(subId: string) {
  globalState = {
    ...globalState,
    expenseSubCategories: globalState.expenseSubCategories.filter(s => s.id !== subId),
  };
  notify();
  persist();
}

export function renameSubCategory(subId: string, name: string) {
  globalState = {
    ...globalState,
    expenseSubCategories: globalState.expenseSubCategories.map(s =>
      s.id === subId ? { ...s, name: name.trim() } : s
    ),
  };
  notify();
  persist();
}

export function moveSubCategory(subId: string, toCategoryId: string) {
  globalState = {
    ...globalState,
    expenseSubCategories: globalState.expenseSubCategories.map(s =>
      s.id === subId ? { ...s, categoryId: toCategoryId } : s
    ),
  };
  notify();
  persist();
}

export function getSubCategoriesByCategory(categoryId: string): ExpenseSubCategory[] {
  return globalState.expenseSubCategories.filter(s => s.categoryId === categoryId);
}

// ==================== Expense Group Actions ====================

export function setGroupVisibility(groupId: string, visible: boolean) {
  globalState = {
    ...globalState,
    expenseGroups: globalState.expenseGroups.map(g =>
      g.id === groupId ? { ...g, visible } : g
    ),
  };
  notify();
  persist();
}

export function renameGroup(groupId: string, name: string) {
  globalState = {
    ...globalState,
    expenseGroups: globalState.expenseGroups.map(g =>
      g.id === groupId ? { ...g, name: name.trim() } : g
    ),
  };
  notify();
  persist();
}

export function addGroup(name: string, color: string): ExpenseGroup {
  const group: ExpenseGroup = {
    id: `grp_${Date.now()}`,
    name: name.trim(),
    color,
    visible: true,
  };
  globalState = {
    ...globalState,
    expenseGroups: [...globalState.expenseGroups, group],
  };
  notify();
  persist();
  return group;
}

export function deleteGroup(groupId: string) {
  // Move subcategories in this group to "other" or first available group
  const firstGroup = globalState.expenseGroups.find(g => g.id !== groupId);
  const targetId = firstGroup?.id || 'hard';
  const updatedSubs = globalState.expenseSubCategories.map(s =>
    s.categoryId === groupId ? { ...s, categoryId: targetId } : s
  );
  globalState = {
    ...globalState,
    expenseGroups: globalState.expenseGroups.filter(g => g.id !== groupId),
    expenseSubCategories: updatedSubs,
  };
  notify();
  persist();
}

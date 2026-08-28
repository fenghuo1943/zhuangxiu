import { useState, useEffect, useCallback } from 'react';
import type { AppState, Todo, TodoSubItem, BudgetCategory, Expense, PurchaseItem, CompareItem, PriceModel, ChannelQuote, FlowStep, StageNote, CustomFlowStep, ExpenseSubCategory, ExpenseGroup, PurchaseReferenceItem } from './types';
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
import { getAuthState } from '../api/useAuth';
import {
  fetchExpenses, createExpenseApi, updateExpenseApi, deleteExpenseApi,
} from '../api/expenses';
import {
  fetchBudget, updateBudgetWithCategories as apiUpdateBudgetWithCategories,
  updateCategoryAllocation as apiUpdateCategoryAllocation,
} from '../api/budget';
import { pushState, listProjects } from '../api/sync';
import {
  fetchSubCategories as apiFetchSubCategories,
  createSubCategory as apiCreateSubCategory,
  updateSubCategory as apiUpdateSubCategory,
  deleteSubCategoryApi,
} from '../api/subcategories';

/** Guard: throws if user is not logged in. Call at the top of every mutation. */
function assertLoggedIn(): void {
  if (!getAuthState().isLoggedIn) {
    throw new Error('请先登录后再操作');
  }
}

const STORAGE_KEY = 'xiaozhuangjia_state_v1';

/** Normalize a single compare item from storage (handles both backend "quotes" and frontend "channelQuotes" formats) */
function _normalizeStoredCompareItem(item: any): CompareItem {
  return {
    item_id: item.item_id,
    item_name: item.item_name,
    spec: item.spec,
    qty: item.qty,
    unit: item.unit,
    stage_parent: item.stage_parent,
    subgroup_name: item.subgroup_name,
    category_id: item.category_id,
    sub_category_id: item.sub_category_id,
    models: (item.models || []).map((m: any) => ({
      id: m.id,
      item_id: m.item_id,
      project_id: m.project_id,
      name: m.name,
      spec: m.spec,
      note: m.note,
      quantity: m.quantity,
      best_quote_id: m.best_quote_id,
      channelQuotes: (m.channelQuotes || m.quotes || []).map((q: any) => ({
        id: q.id,
        channel: q.channel,
        price: q.price,
        url: q.url,
        note: q.note,
        updatedAt: q.updatedAt || q.updated_at,
      })),
    })),
  };
}

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
        budget: parsed.budget || { total: 0, spent: 0, categories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, allocated: 0, spent: 0, unpaid_spent: 0 })) },
        todos: parsed.todos || [],
        purchaseItems: parsed.purchaseItems || [],
        purchaseReferences: parsed.purchaseReferences || PURCHASE_REFERENCES,
        selectedPurchaseIds: parsed.selectedPurchaseIds || [],
        purchasedItemIds: parsed.purchasedItemIds || [],
        purchasedExpenseMap: parsed.purchasedExpenseMap || {},
        selectedExpenseMap: parsed.selectedExpenseMap || {},
        expenses: parsed.expenses || [],
        recentExpenses: parsed.recentExpenses || [],
        flowType: parsed.flowType || 'new',
        flowDoneStepIds: parsed.flowDoneStepIds || [],
        flowCustomOrder: parsed.flowCustomOrder || null,
        stageNotes: parsed.stageNotes || {},
        customFlowSteps: parsed.customFlowSteps || [],
        flowStepsFromBackend: parsed.flowStepsFromBackend || {},
        syncedModelIds: parsed.syncedModelIds || [],
        bestQuoteIds: parsed.bestQuoteIds || {},
        compareItems: (parsed.compareItems || []).map(_normalizeStoredCompareItem),
        projectCompareItemIds: parsed.projectCompareItemIds || [],
        projectStates: parsed.projectStates || {},
        showUnpaid: parsed.showUnpaid ?? false,
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
    budget: { total: 0, spent: 0, categories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, allocated: 0, spent: 0, unpaid_spent: 0 })) },
    todos: [],
    purchaseItems: [],
    purchaseReferences: PURCHASE_REFERENCES,
    selectedPurchaseIds: [],
    purchasedItemIds: [],
    purchasedExpenseMap: {},
    selectedExpenseMap: {},
    expenses: [],
    recentExpenses: [],
    flowType: 'new',
    flowDoneStepIds: [],
    flowCustomOrder: null,
    stageNotes: {},
    customFlowSteps: [],
    flowStepsFromBackend: {},
    syncedModelIds: [],
    bestQuoteIds: {},
    compareItems: [],
    projectCompareItemIds: [],
    projectStates: {},
    showUnpaid: false,
    expenseSubCategories: DEFAULT_SUB_CATEGORIES,
    expenseGroups: DEFAULT_EXPENSE_GROUPS,
  };
}

let globalState: AppState = getInitialState();
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach(l => l());
}

// 防止多次并发触发整个同步流程（例如多个组件在短时间内调用 syncFromServerAfterLogin）
let syncInitPromise: Promise<void> | null = null;

// 防止 loadFlowFromBackend 并发调用
let flowLoadPromise: Promise<void> | null = null;

// 防止 loadCustomFlowSteps 并发调用
let customFlowLoadPromise: Promise<void> | null = null;

// 防止 loadFlowStagesFromBackend 并发调用（按 flowType 分别保护）
let flowStagesLoadPromises: Record<string, Promise<void> | null> = {};

// 防止 loadBudgetAndExpensesFromBackend 并发调用
let budgetExpensesLoadPromise: Promise<void> | null = null;

// 防止 loadCompareItemsFromBackend 并发调用
let compareItemsLoadPromise: Promise<void> | null = null;

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
  assertLoggedIn();
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
  assertLoggedIn();
  const categories = globalState.budget.categories.map(c =>
    c.id === categoryId ? { ...c, allocated } : c
  );
  globalState = { ...globalState, budget: { ...globalState.budget, categories } };
  recalculateBudget();
  notify();
  persist();

  if (isAuthenticated()) {
    const cat = globalState.budget.categories.find(c => c.id === categoryId);
    apiUpdateCategoryAllocation(globalState.activeProjectId, _bkCatId(categoryId), allocated, cat?.name, cat?.color).catch(() => {});
  }
}

/** Atomically adjust two adjacent category allocations (for slider drag, §4.2.2) */
export function adjustAdjacentBudgets(leftId: string, rightId: string, newLeft: number, newRight: number) {
  assertLoggedIn();
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
    const leftCat = globalState.budget.categories.find(c => c.id === leftId);
    const rightCat = globalState.budget.categories.find(c => c.id === rightId);
    Promise.all([
      apiUpdateCategoryAllocation(pid, _bkCatId(leftId), newLeft, leftCat?.name, leftCat?.color),
      apiUpdateCategoryAllocation(pid, _bkCatId(rightId), newRight, rightCat?.name, rightCat?.color),
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

export function toggleShowUnpaid() {
  globalState = { ...globalState, showUnpaid: !globalState.showUnpaid };
  notify();
  persist();
}

// ==================== Todo Actions ====================

export function addTodo(title: string, stageId: string, flowStepId?: string, plannedStartDate?: string) {
  assertLoggedIn();
  const todo: Todo = {
    id: `todo_${Date.now()}`,
    projectId: globalState.activeProjectId,
    title,
    stageId,
    flowStepId,
    plannedStartDate,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  globalState = { ...globalState, todos: [...globalState.todos, todo] };
  notify();
  persist();
}

export function toggleTodo(todoId: string) {
  assertLoggedIn();
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
  assertLoggedIn();
  const todos = globalState.todos.filter(t => t.id !== todoId);
  globalState = { ...globalState, todos };
  notify();
  persist();

  // Sync to backend if authenticated
  if (isAuthenticated()) {
    import('../api/client').then(({ apiDelete }) => {
      apiDelete(`/api/projects/${globalState.activeProjectId}/todos/${todoId}`).catch(() => {});
    });
  }
}

export function updateTodo(todoId: string, updates: Partial<Todo>) {
  assertLoggedIn();
  const todos = globalState.todos.map(t =>
    t.id === todoId ? { ...t, ...updates } : t
  );
  globalState = { ...globalState, todos };
  notify();
  persist();
}

export function addTodoSubItem(todoId: string, title: string) {
  assertLoggedIn();
  const subItem: TodoSubItem = {
    id: `sub_${Date.now()}`,
    title,
    completed: false,
  };
  const todos = globalState.todos.map(t => {
    if (t.id === todoId) {
      return { ...t, subItems: [...(t.subItems || []), subItem] };
    }
    return t;
  });
  globalState = { ...globalState, todos };
  notify();
  persist();
}

export function toggleTodoSubItem(todoId: string, subItemId: string) {
  assertLoggedIn();
  const todos = globalState.todos.map(t => {
    if (t.id === todoId && t.subItems) {
      return {
        ...t,
        subItems: t.subItems.map(s =>
          s.id === subItemId ? { ...s, completed: !s.completed } : s
        ),
      };
    }
    return t;
  });
  globalState = { ...globalState, todos };
  notify();
  persist();
}

export function deleteTodoSubItem(todoId: string, subItemId: string) {
  assertLoggedIn();
  const todos = globalState.todos.map(t => {
    if (t.id === todoId && t.subItems) {
      return { ...t, subItems: t.subItems.filter(s => s.id !== subItemId) };
    }
    return t;
  });
  globalState = { ...globalState, todos };
  notify();
  persist();
}

export function reorderTodos(fromIndex: number, toIndex: number) {
  assertLoggedIn();
  const projectTodos = globalState.todos.filter(t => t.projectId === globalState.activeProjectId);
  const otherTodos = globalState.todos.filter(t => t.projectId !== globalState.activeProjectId);

  // 获取当前排序或按创建时间排序
  const sortedTodos = [...projectTodos].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // 移除要移动的元素
  const [movedTodo] = sortedTodos.splice(fromIndex, 1);
  // 插入到新位置
  sortedTodos.splice(toIndex, 0, movedTodo);

  // 更新 order 字段
  const updatedProjectTodos = sortedTodos.map((t, index) => ({
    ...t,
    order: index,
  }));

  globalState = { ...globalState, todos: [...otherTodos, ...updatedProjectTodos] };
  notify();
  persist();
}

// ==================== Purchase Actions ====================

export function togglePurchaseRef(itemId: string, deleteExpense: boolean = false) {
  assertLoggedIn();
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
  const isRemoving = selectedIds.has(itemId);
  if (isRemoving) {
    selectedIds.delete(itemId);
    // 处理关联的待购账单
    const expenseId = globalState.selectedExpenseMap[itemId];
    if (deleteExpense && expenseId) {
      // 删除关联的未支付账单
      const expense = globalState.expenses.find(e => e.id === expenseId);
      if (expense) {
        const expenses = globalState.expenses.filter(e => e.id !== expenseId);
        const categories = globalState.budget.categories.map(c => {
          if (c.id !== expense.categoryId) return c;
          if (expense.status === 'paid' || expense.status === 'prepaid') {
            return { ...c, spent: Math.max(0, c.spent - expense.amount) };
          } else if (expense.status === 'unpaid') {
            return { ...c, unpaid_spent: Math.max(0, c.unpaid_spent - expense.amount) };
          }
          return c;
        });
        globalState = {
          ...globalState,
          expenses,
          recentExpenses: expenses.slice(0, 5),
          budget: { ...globalState.budget, categories },
        };
        recalculateBudget();
        // Sync expense deletion to backend
        if (isAuthenticated()) {
          import('../api/expenses').then(({ deleteExpenseApi }) => {
            deleteExpenseApi(globalState.activeProjectId, expenseId).catch(() => {});
          });
        }
      }
    }
    // 清理映射
    if (expenseId) {
      const selectedExpenseMap = { ...globalState.selectedExpenseMap };
      delete selectedExpenseMap[itemId];
      globalState = { ...globalState, selectedExpenseMap };
    }
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
      togglePurchaseSelection(globalState.activeProjectId, itemId, deleteExpense).catch(() => {});
    });
  }
}

export function addCustomPurchaseItem(name: string, stageParent: string, qty: number, spec?: string, subgroupName?: string, unit?: string, categoryId?: string, subCategoryId?: string, price?: number): string {
  assertLoggedIn();
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
            items: [...sub.items, { id, name, spec: spec || '', qty, unit: unit || '个', selected: true, category_id: categoryId || null, sub_category_id: subCategoryId || null, price: price ?? null }],
          };
        }
        return sub;
      }),
    };
  });

  // 若设置了价格，自动创建一笔未支付账单
  let expenseId: string | null = null;
  let expenses = globalState.expenses;
  if (price !== undefined && price > 0) {
    const today = new Date().toISOString().slice(0, 10);
    expenseId = `exp_${Date.now()}`;
    const noteParts: string[] = [];
    if (spec) noteParts.push(spec);
    if (qty && unit) noteParts.push(`${qty}${unit}`);
    else if (qty) noteParts.push(String(qty));
    const newExpense: Expense = {
      id: expenseId,
      projectId: globalState.activeProjectId,
      title: name,
      amount: price,
      categoryId: categoryId || 'hard',
      subCategoryId: subCategoryId || undefined,
      date: today,
      status: 'unpaid',
      note: noteParts.join('，') || '',
      createdAt: new Date().toISOString(),
    };
    expenses = [newExpense, ...globalState.expenses];
  }

  const selectedExpenseMap = { ...globalState.selectedExpenseMap };
  if (expenseId) {
    selectedExpenseMap[id] = expenseId;
  }

  globalState = {
    ...globalState,
    purchaseReferences,
    selectedPurchaseIds: [...globalState.selectedPurchaseIds, id],
    selectedExpenseMap,
    expenses,
    recentExpenses: expenses.slice(0, 5),
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
        category_id: categoryId || null,
        sub_category_id: subCategoryId || null,
        price,
      }).then((result) => {
        // 用后端返回的 expense_id 更新本地映射和账单 ID
        if (result.expense_id && expenseId && result.expense_id !== expenseId) {
          const newId = result.expense_id;
          const map = { ...globalState.selectedExpenseMap };
          map[id] = newId;
          // 同步更新账单列表中的 ID
          const updatedExpenses = globalState.expenses.map(e =>
            e.id === expenseId ? { ...e, id: newId } : e
          );
          globalState = {
            ...globalState,
            selectedExpenseMap: map,
            expenses: updatedExpenses,
            recentExpenses: updatedExpenses.slice(0, 5),
          };
          notify();
          persist();
        } else if (result.expense_id) {
          const map = { ...globalState.selectedExpenseMap };
          map[id] = result.expense_id;
          globalState = { ...globalState, selectedExpenseMap: map };
          notify();
          persist();
        }
      }).catch(() => {});
    });
  }
  return id;
}

export function deletePurchaseRefItem(itemId: string, deleteExpense: boolean = false) {
  assertLoggedIn();
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

  // 处理关联的待购账单
  const expenseId = globalState.selectedExpenseMap[itemId];
  let expenses = globalState.expenses;
  let categories = globalState.budget.categories;
  const selectedExpenseMap = { ...globalState.selectedExpenseMap };

  if (deleteExpense && expenseId) {
    const expense = globalState.expenses.find(e => e.id === expenseId);
    if (expense) {
      expenses = expenses.filter(e => e.id !== expenseId);
      categories = categories.map(c => {
        if (c.id !== expense.categoryId) return c;
        if (expense.status === 'paid' || expense.status === 'prepaid') {
          return { ...c, spent: Math.max(0, c.spent - expense.amount) };
        } else if (expense.status === 'unpaid') {
          return { ...c, unpaid_spent: Math.max(0, c.unpaid_spent - expense.amount) };
        }
        return c;
      });
    }
  }
  if (expenseId) {
    delete selectedExpenseMap[itemId];
  }

  // Also clean up purchasedExpenseMap if present
  const purchasedExpenseMap = { ...globalState.purchasedExpenseMap };
  if (purchasedExpenseMap[itemId]) {
    delete purchasedExpenseMap[itemId];
  }

  globalState = {
    ...globalState,
    purchaseReferences,
    selectedPurchaseIds,
    selectedExpenseMap,
    purchasedExpenseMap,
    expenses,
    recentExpenses: expenses.slice(0, 5),
    budget: { ...globalState.budget, categories },
  };
  recalculateBudget();
  notify();
  persist();

  // Sync to backend if authenticated
  if (isAuthenticated()) {
    import('../api/purchase').then(({ deletePurchaseItem: apiDelete }) => {
      apiDelete(globalState.activeProjectId, itemId, deleteExpense).catch(() => {});
    });
  }
}

export function updatePurchaseRefQty(itemId: string, qty: number) {
  assertLoggedIn();
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

export function updatePurchaseRefItem(itemId: string, updates: { name?: string; spec?: string; qty?: number; unit?: string }) {
  assertLoggedIn();
  const purchaseReferences = globalState.purchaseReferences.map(stage => ({
    ...stage,
    subs: stage.subs.map(sub => ({
      ...sub,
      items: sub.items.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
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
    const items = await fetchSelectedPurchases(globalState.activeProjectId);
    const selectedIds = items.map(it => it.item_id);
    // Build selectedExpenseMap from backend data
    const selectedExpenseMap: Record<string, string> = {};
    for (const it of items) {
      if (it.expense_id) {
        selectedExpenseMap[it.item_id] = it.expense_id;
      }
    }
    // Merge with local: keep custom items that still exist in purchaseReferences
    const existingRefIds = new Set<string>();
    for (const stage of globalState.purchaseReferences) {
      for (const sub of stage.subs) {
        for (const item of sub.items) {
          existingRefIds.add(item.id);
        }
      }
    }
    const localOnlyIds = globalState.selectedPurchaseIds.filter(
      id => id.startsWith('p_custom_') && existingRefIds.has(id)
    );
    const mergedIds = [...new Set([...selectedIds, ...localOnlyIds])];
    // Merge expense maps (backend is authoritative for items it knows about)
    const mergedExpenseMap = { ...globalState.selectedExpenseMap, ...selectedExpenseMap };
    // Also mark items as selected in references
    const purchaseReferences = globalState.purchaseReferences.map(stage => ({
      ...stage,
      subs: stage.subs.map(sub => ({
        ...sub,
        items: sub.items.map(item => ({
          ...item,
          selected: mergedIds.includes(item.id),
        })),
      })),
    }));
    globalState = {
      ...globalState,
      selectedPurchaseIds: mergedIds,
      selectedExpenseMap: mergedExpenseMap,
      purchaseReferences,
    };
    notify();
    persist();
  } catch {
    // Backend unreachable, keep local data
  }
}

/** Load purchase references from backend, falling back to local mockData */
export async function loadPurchaseReferencesFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const { fetchPurchaseReferences } = await import('../api/purchase');
    const remoteRefs = await fetchPurchaseReferences(globalState.activeProjectId);
    if (remoteRefs) {
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

/** Get item info from purchaseReferences by item ID */
export function getPurchaseRefItem(itemId: string): PurchaseReferenceItem | undefined {
  for (const stage of globalState.purchaseReferences) {
    for (const sub of stage.subs) {
      const found = sub.items.find(it => it.id === itemId);
      if (found) return found;
    }
  }
  return undefined;
}

/** Check if an item is ready to be purchased (has price and category).
 *  Returns what's missing so the UI can prompt the user.
 *
 *  价格检测优先级：
 *  1. SelectedPurchase.expense_id → 待购时自动创建的未支付账单金额
 *  2. bestQuoteIds + compareItems → 比价页面选中的最优报价
 *  3. PurchaseRefItem.price → 项目专属物品手动设置的价格（向后兼容）
 */
export function checkPurchaseReadiness(itemId: string): {
  needsPrice: boolean;
  needsCategory: boolean;
  itemName: string;
  itemSpec: string;
  existingPrice: number | null;
  existingCategoryId: string | null;
} {
  const item = getPurchaseRefItem(itemId);

  // 1. 检查是否有待购账单（通过 SelectedPurchase.expense_id）
  const expenseId = globalState.selectedExpenseMap[itemId];
  let existingPrice: number | null = null;
  if (expenseId) {
    const expense = globalState.expenses.find(e => e.id === expenseId);
    if (expense) {
      existingPrice = expense.amount;
    }
  }

  // 2. 若没有待购账单，检查比价最优报价（报价为单价，转换为总价）
  if (existingPrice == null) {
    const bestPrice = getItemBestPrice(itemId);
    if (bestPrice !== null) {
      existingPrice = bestPrice * (item?.qty || 1);
    }
  }

  // 3. 向后兼容：检查物品自带价格（项目专属物品，已经是总价）
  if (existingPrice == null) {
    existingPrice = item?.price ?? null;
  }

  const existingCategoryId = item?.category_id ?? null;
  return {
    needsPrice: existingPrice == null,
    needsCategory: !existingCategoryId,
    itemName: item?.name || '',
    itemSpec: item?.spec || '',
    existingPrice,
    existingCategoryId,
  };
}

/** Get an item's display price with its source, for UI price display and editing.
 *  Returns null price if no price data exists for this item.
 *
 *  Resolution order:
 *  1. Expense.amount (via SelectedPurchase.expense_id or PurchasedItem.expense_id)
 *  2. Best quote price (via compareItems + bestQuoteIds)
 */
export type PriceSource = 'quote' | 'expense' | null;

export function getItemPriceWithSource(itemId: string): {
  price: number | null;
  source: PriceSource;
  sourceLabel: string;
} {
  // 1. Check expense (unpaid from 待购 or paid from 已购)
  const expenseId =
    globalState.selectedExpenseMap[itemId] ||
    globalState.purchasedExpenseMap[itemId];
  if (expenseId) {
    const expense = globalState.expenses.find(e => e.id === expenseId);
    if (expense) {
      const label = expense.status === 'paid' || expense.status === 'prepaid'
        ? '实际支付'
        : '待购预算';
      return { price: expense.amount, source: 'expense', sourceLabel: label };
    }
  }

  // 2. Check best quote price from compare page
  const bestPrice = getItemBestPrice(itemId);
  if (bestPrice !== null) {
    return { price: bestPrice, source: 'quote', sourceLabel: '比价' };
  }

  return { price: null, source: null, sourceLabel: '' };
}

/** Get the expense ID associated with a purchased item (if any) */
export function getPurchasedExpenseId(itemId: string): string | null {
  return globalState.purchasedExpenseMap[itemId] || null;
}

/** Get the expense ID associated with a selected (待购) item (if any — only when price was set) */
export function getSelectedExpenseId(itemId: string): string | null {
  return globalState.selectedExpenseMap[itemId] || null;
}

/** Purchase an item with price and category — auto-creates an expense record.
 *  If the item already has an unpaid expense (from 待购 with price),
 *  that expense is updated to "paid" status instead of creating a new one.
 *  Call this AFTER resolving any missing price/category via UI modals. */
export function purchaseItem(itemId: string, price: number, categoryId: string): string {
  const item = getPurchaseRefItem(itemId);

  // 1. Update purchaseReferences with price and category_id
  const purchaseReferences = globalState.purchaseReferences.map(stage => ({
    ...stage,
    subs: stage.subs.map(sub => ({
      ...sub,
      items: sub.items.map(it =>
        it.id === itemId ? { ...it, price, category_id: categoryId } : it
      ),
    })),
  }));

  // 2. Add to purchasedItemIds
  const purchasedItemIds = [...globalState.purchasedItemIds, itemId];

  // 3. Check if there's already an unpaid expense from 待购
  const existingExpenseId = globalState.selectedExpenseMap[itemId];
  let expenseId: string;
  let expenses = globalState.expenses;
  let categories = globalState.budget.categories;

  if (existingExpenseId) {
    // ── 已有待购账单：更新状态为已支付 ──
    expenseId = existingExpenseId;
    const oldExpense = globalState.expenses.find(e => e.id === expenseId);
    expenses = globalState.expenses.map(e => {
      if (e.id === expenseId) {
        const noteParts: string[] = [];
        if (item?.spec) noteParts.push(item.spec);
        if (item?.qty && item?.unit) noteParts.push(`${item.qty}${item.unit}`);
        else if (item?.qty) noteParts.push(String(item.qty));
        return {
          ...e,
          status: 'paid' as const,
          amount: price,
          categoryId: categoryId,
          subCategoryId: item?.sub_category_id || e.subCategoryId,
          note: noteParts.join('，') || e.note,
        };
      }
      return e;
    });

    // 更新预算：之前是 unpaid（未计入），现在计入
    if (oldExpense && oldExpense.status === 'unpaid') {
      categories = categories.map(c => {
        if (c.id === categoryId) {
          return { ...c, spent: c.spent + price, unpaid_spent: Math.max(0, c.unpaid_spent - oldExpense.amount) };
        }
        return c;
      });
    } else if (oldExpense) {
      // 之前已计入，调整金额和分类
      categories = categories.map(c => {
        let spent = c.spent;
        if (c.id === oldExpense.categoryId) spent = Math.max(0, spent - oldExpense.amount);
        if (c.id === categoryId) spent += price;
        return { ...c, spent };
      });
    }

    // 清理 selectedExpenseMap
    const selectedExpenseMap = { ...globalState.selectedExpenseMap };
    delete selectedExpenseMap[itemId];
    globalState = { ...globalState, selectedExpenseMap };
  } else {
    // ── 没有待购账单：创建新账单（原有逻辑）──
    const today = new Date().toISOString().slice(0, 10);
    expenseId = `exp_${Date.now()}`;
    const noteParts: string[] = [];
    if (item?.spec) noteParts.push(item.spec);
    if (item?.qty && item?.unit) noteParts.push(`${item.qty}${item.unit}`);
    else if (item?.qty) noteParts.push(String(item.qty));
    const newExpense: Expense = {
      id: expenseId,
      projectId: globalState.activeProjectId,
      title: item?.name || '',
      amount: price,
      categoryId: categoryId,
      subCategoryId: item?.sub_category_id || undefined,
      date: today,
      status: 'paid',
      note: noteParts.join('，') || '',
      createdAt: new Date().toISOString(),
    };
    expenses = [newExpense, ...globalState.expenses];

    // Update budget category spent
    categories = categories.map(c =>
      c.id === categoryId ? { ...c, spent: c.spent + price } : c
    );
  }

  const recentExpenses = expenses.slice(0, 5);

  // 4. Track expense mapping
  const purchasedExpenseMap = { ...globalState.purchasedExpenseMap, [itemId]: expenseId };

  globalState = {
    ...globalState,
    purchaseReferences,
    purchasedItemIds,
    purchasedExpenseMap,
    expenses,
    recentExpenses,
    budget: { ...globalState.budget, categories },
  };
  recalculateBudget();
  notify();
  persist();

  // 5. Sync to backend
  if (isAuthenticated()) {
    import('../api/purchase').then(({ togglePurchasedItem }) => {
      togglePurchasedItem(globalState.activeProjectId, itemId, {
        price,
        category_id: categoryId,
      }).catch(() => {});
    });
  }

  return expenseId;
}

/** Unpurchase an item, optionally deleting the associated expense record.
 *
 *  deleteExpense=true  → 删除关联账单（用于"移出清单"）
 *  deleteExpense=false → 移回待购：账单状态改为 unpaid，保留到 selectedExpenseMap
 */
export function unpurchaseItem(itemId: string, deleteExpense: boolean) {
  // 检查物品是否确实在已购清单中
  const wasPurchased = globalState.purchasedItemIds.includes(itemId);
  if (!wasPurchased) {
    // 不在已购清单中 —— 只做本地清理，不调后端（避免触发后端的"添加已购"路径）
    const purchasedExpenseMap = { ...globalState.purchasedExpenseMap };
    delete purchasedExpenseMap[itemId];
    globalState = { ...globalState, purchasedExpenseMap };
    notify();
    persist();
    return;
  }

  // Remove from purchasedItemIds
  const purchasedItemIds = globalState.purchasedItemIds.filter(id => id !== itemId);

  // Handle expense
  let expenses = globalState.expenses;
  let categories = globalState.budget.categories;
  const expenseId = globalState.purchasedExpenseMap[itemId];
  let selectedExpenseMap = { ...globalState.selectedExpenseMap };

  if (deleteExpense && expenseId) {
    // ── 删除账单 ──
    const expense = globalState.expenses.find(e => e.id === expenseId);
    if (expense) {
      expenses = expenses.filter(e => e.id !== expenseId);
      categories = categories.map(c =>
        c.id === expense.categoryId ? { ...c, spent: Math.max(0, c.spent - expense.amount) } : c
      );
    }
  } else if (!deleteExpense && expenseId) {
    // ── 移回待购：账单状态改为未支付，保留到 selectedExpenseMap ──
    const expense = globalState.expenses.find(e => e.id === expenseId);
    if (expense) {
      // 从预算中减去（已支付 → 未支付）
      if (expense.status === 'paid' || expense.status === 'prepaid') {
        categories = categories.map(c =>
          c.id === expense.categoryId
            ? { ...c, spent: Math.max(0, c.spent - expense.amount), unpaid_spent: c.unpaid_spent + expense.amount }
            : c
        );
      }
      // 更新账单状态
      expenses = expenses.map(e =>
        e.id === expenseId ? { ...e, status: 'unpaid' as const } : e
      );
      // 移到待购账单映射
      selectedExpenseMap = { ...selectedExpenseMap, [itemId]: expenseId };
    }
  }

  // Remove from purchased expense map
  const purchasedExpenseMap = { ...globalState.purchasedExpenseMap };
  delete purchasedExpenseMap[itemId];

  globalState = {
    ...globalState,
    purchasedItemIds,
    purchasedExpenseMap,
    selectedExpenseMap,
    expenses,
    recentExpenses: expenses.slice(0, 5),
    budget: { ...globalState.budget, categories },
  };
  recalculateBudget();
  notify();
  persist();

  // Sync to backend
  if (isAuthenticated()) {
    import('../api/purchase').then(({ togglePurchasedItem }) => {
      togglePurchasedItem(globalState.activeProjectId, itemId, {
        delete_expense: deleteExpense,
      }).catch(() => {});
    });
  }
}

/** Simple toggle (backward compat — for marking purchased without expense flow) */
export function togglePurchased(itemId: string) {
  assertLoggedIn();
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

/** 在比价页面将物品添加到待购清单。仅在物品不在待购清单中时生效。 */
export function addCompareToSelected(itemId: string) {
  assertLoggedIn();
  if (globalState.selectedPurchaseIds.includes(itemId)) return; // 已在待购

  globalState = {
    ...globalState,
    selectedPurchaseIds: [...globalState.selectedPurchaseIds, itemId],
  };
  notify();
  persist();

  // 同步到后端
  if (isAuthenticated()) {
    import('../api/purchase').then(({ togglePurchaseSelection }) => {
      togglePurchaseSelection(globalState.activeProjectId, itemId).catch(() => {});
    });
  }
}

/** Load purchased items from backend */
export async function loadPurchasedFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const { fetchPurchasedItems } = await import('../api/purchase');
    const items = await fetchPurchasedItems(globalState.activeProjectId);
    const purchasedItemIds = items.map(it => it.item_id);
    const purchasedExpenseMap: Record<string, string> = {};
    for (const it of items) {
      if (it.expense_id) {
        purchasedExpenseMap[it.item_id] = it.expense_id;
      }
    }
    // Merge with existing local map (keep local-only entries)
    const mergedMap = { ...globalState.purchasedExpenseMap, ...purchasedExpenseMap };
    globalState = { ...globalState, purchasedItemIds, purchasedExpenseMap: mergedMap };
    notify();
    persist();
  } catch { /* backend unreachable */ }
}

/** Load project compare item IDs from backend */
export async function loadProjectCompareIdsFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const { fetchProjectCompareIds } = await import('../api/purchase');
    const ids = await fetchProjectCompareIds(globalState.activeProjectId);
    globalState = { ...globalState, projectCompareItemIds: ids };
    notify();
    persist();
  } catch { /* backend unreachable */ }
}

/** Load full compare items (with models & quotes) from backend */
export async function loadCompareItemsFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;

  // 如果已有加载在进行中，直接返回该 Promise（防止并发调用）
  if (compareItemsLoadPromise) {
    return compareItemsLoadPromise;
  }

  compareItemsLoadPromise = (async () => {
    try {
      const { fetchCompareItems } = await import('../api/compare');
      const items = await fetchCompareItems(globalState.activeProjectId);
      const normalizedItems = items.map(_normalizeStoredCompareItem);

      // 从后端数据重建 bestQuoteIds（持久化的最优报价选择，跨客户端同步）
      const bestQuoteIds: Record<string, string> = { ...globalState.bestQuoteIds };
      for (const ci of normalizedItems) {
        for (const model of ci.models) {
          if (model.best_quote_id) {
            bestQuoteIds[model.id] = model.best_quote_id;
          }
        }
      }

      globalState = {
        ...globalState,
        compareItems: normalizedItems,
        bestQuoteIds,
      };
      notify();
      persist();
    } catch { /* backend unreachable */ }
    finally {
      compareItemsLoadPromise = null;
    }
  })();

  return compareItemsLoadPromise;
}

// ── Add purchase item to compare ──

export function addPurchaseToCompare(item: {
  itemId: string;
  name: string;
  spec?: string;
  stageParent: string;
  qty: number;
}) {
  assertLoggedIn();
  // Add to projectCompareItemIds
  if (!globalState.projectCompareItemIds.includes(item.itemId)) {
    globalState = {
      ...globalState,
      projectCompareItemIds: [...globalState.projectCompareItemIds, item.itemId],
    };
  }
  // Set needs_compare flag on the purchase reference item
  const purchaseReferences = globalState.purchaseReferences.map(stage => ({
    ...stage,
    subs: stage.subs.map(sub => ({
      ...sub,
      items: sub.items.map(it =>
        it.id === item.itemId ? { ...it, needs_compare: true } : it
      ),
    })),
  }));
  globalState = { ...globalState, purchaseReferences };
  notify();
  persist();

  // Sync to backend
  if (isAuthenticated()) {
    import('../api/purchase').then(({ toggleItemCompare }) => {
      toggleItemCompare(globalState.activeProjectId, item.itemId).catch(() => {});
    });
  }
}

// ==================== Expense Actions ====================

function _categoryKey(categoryId: string): string {
  return categoryId.split('_').pop() || categoryId;
}

function _bkCatId(frontendCatId: string): string {
  // Budget APIs accept the frontend key.  This prevents a legacy scoped ID
  // from being prefixed a second time by the backend.
  return _categoryKey(frontendCatId);
}

export function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>) {
  assertLoggedIn();
  const newExpense: Expense = {
    ...expense,
    id: `exp_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const expenses = [newExpense, ...globalState.expenses];
  const recentExpenses = expenses.slice(0, 5);

  // Update category spent (paid/prepaid go to spent, unpaid goes to unpaid_spent)
  const categories = globalState.budget.categories.map(c => {
    if (c.id !== expense.categoryId) return c;
    if (expense.status === 'paid' || expense.status === 'prepaid') {
      return { ...c, spent: c.spent + expense.amount };
    } else if (expense.status === 'unpaid') {
      return { ...c, unpaid_spent: c.unpaid_spent + expense.amount };
    }
    return c;
  });

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
      sub_category_id: newExpense.subCategoryId || null,
      stage_id: newExpense.stageId || null,
      date: newExpense.date,
      status: newExpense.status,
      payer: newExpense.payer || null,
      note: newExpense.note || null,
    }).catch(() => {});
  }
}

export function deleteExpense(expenseId: string) {
  assertLoggedIn();
  const expense = globalState.expenses.find(e => e.id === expenseId);
  if (!expense) return;

  const expenses = globalState.expenses.filter(e => e.id !== expenseId);
  const recentExpenses = expenses.slice(0, 5);

  const categories = globalState.budget.categories.map(c => {
    if (c.id !== expense.categoryId) return c;
    if (expense.status === 'paid' || expense.status === 'prepaid') {
      return { ...c, spent: Math.max(0, c.spent - expense.amount) };
    } else if (expense.status === 'unpaid') {
      return { ...c, unpaid_spent: Math.max(0, c.unpaid_spent - expense.amount) };
    }
    return c;
  });

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
  assertLoggedIn();
  const oldExpense = globalState.expenses.find(e => e.id === expenseId);
  if (!oldExpense) return;

  const expenses = globalState.expenses.map(e =>
    e.id === expenseId ? { ...e, status } : e
  );

  // Move amounts between spent and unpaid_spent if status category changed
  const oldIsPaid = oldExpense.status === 'paid' || oldExpense.status === 'prepaid';
  const newIsPaid = status === 'paid' || status === 'prepaid';
  const oldIsUnpaid = oldExpense.status === 'unpaid';
  const newIsUnpaid = status === 'unpaid';

  let categories = globalState.budget.categories;
  if (oldIsPaid && newIsUnpaid) {
    // paid → unpaid: move from spent to unpaid_spent
    categories = categories.map(c =>
      c.id === oldExpense.categoryId
        ? { ...c, spent: Math.max(0, c.spent - oldExpense.amount), unpaid_spent: c.unpaid_spent + oldExpense.amount }
        : c
    );
  } else if (oldIsUnpaid && newIsPaid) {
    // unpaid → paid: move from unpaid_spent to spent
    categories = categories.map(c =>
      c.id === oldExpense.categoryId
        ? { ...c, unpaid_spent: Math.max(0, c.unpaid_spent - oldExpense.amount), spent: c.spent + oldExpense.amount }
        : c
    );
  }

  globalState = { ...globalState, expenses, budget: { ...globalState.budget, categories } };
  recalculateBudget();
  notify();
  persist();

  if (isAuthenticated()) {
    updateExpenseApi(globalState.activeProjectId, expenseId, { status }).catch(() => {});
  }
}

export function updateExpense(expenseId: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>) {
  assertLoggedIn();
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
    const isPaid = old.status === 'paid' || old.status === 'prepaid';
    categories = categories.map(c => {
      let spent = c.spent;
      let unpaid = c.unpaid_spent;
      if (c.id === old.categoryId) {
        if (isPaid) spent -= old.amount;
        else if (old.status === 'unpaid') unpaid -= old.amount;
      }
      if (c.id === newCatId) {
        if (isPaid) spent += newAmount;
        else if (old.status === 'unpaid') unpaid += newAmount;
      }
      return { ...c, spent: Math.max(0, spent), unpaid_spent: Math.max(0, unpaid) };
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
    if (updates.subCategoryId !== undefined) payload.sub_category_id = updates.subCategoryId || null;
    if (updates.stageId !== undefined) payload.stage_id = updates.stageId || null;
    if (updates.date !== undefined) payload.date = updates.date;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.payer !== undefined) payload.payer = updates.payer || null;
    if (updates.note !== undefined) payload.note = updates.note || null;
    updateExpenseApi(globalState.activeProjectId, expenseId, payload).catch(() => {});
  }
}

// ==================== Compare Item Actions ====================

/** Get all compare items (items with needs_compare + their models) */
export function getCompareItems(): CompareItem[] {
  return globalState.compareItems;
}

/** 在比价页面快速添加物品——本地乐观更新 + 后端通过比价 API 同步 */
export function addCompareItem(itemName: string, stageParent: string, subgroupName: string, qty: number, spec?: string, unit?: string, categoryId?: string, subCategoryId?: string): CompareItem {
  assertLoggedIn();
  // 生成本地临时 ID，等后端返回后再替换为真实 ID
  const tempId = `p_compare_${Date.now()}`;

  // 更新本地 purchaseReferences：添加临时物品
  const purchaseReferences = globalState.purchaseReferences.map(stage => {
    if (stage.parent !== stageParent) return stage;
    return {
      ...stage,
      subs: stage.subs.map(sub => {
        if (sub.name !== subgroupName) return sub;
        return {
          ...sub,
          items: [...sub.items, {
            id: tempId, name: itemName, spec: spec || '',
            qty, unit: unit || '个', selected: true, needs_compare: true,
            category_id: categoryId || null, sub_category_id: subCategoryId || null,
          }],
        };
      }),
    };
  });

  const ci: CompareItem = {
    item_id: tempId,
    item_name: itemName,
    spec: spec || '',
    qty,
    unit: unit || '个',
    stage_parent: stageParent,
    subgroup_name: subgroupName,
    category_id: categoryId || null,
    sub_category_id: subCategoryId || null,
    models: [],
  };

  globalState = {
    ...globalState,
    purchaseReferences,
    compareItems: [...globalState.compareItems, ci],
    selectedPurchaseIds: [...globalState.selectedPurchaseIds, tempId],
    projectCompareItemIds: [...globalState.projectCompareItemIds, tempId],
  };
  notify();
  persist();

  // 通过比价 API 同步到后端（创建物品 + 加入比价 + 加入待购，一次完成）
  if (isAuthenticated()) {
    import('../api/compare').then(({ addCompareItemApi }) => {
      addCompareItemApi(globalState.activeProjectId, {
        name: itemName, stage_parent: stageParent,
        subgroup_name: subgroupName, qty, spec: spec || '', unit: unit || '个',
        category_id: categoryId || null, sub_category_id: subCategoryId || null,
      }).then((backendItem) => {
        // 用后端返回的真实 ID 替换临时 ID
        _replaceCompareTempId(tempId, backendItem.item_id);
      }).catch(() => {});
    });
  }

  return ci;
}

/** 用后端返回的真实 ID 替换本地临时 ID */
function _replaceCompareTempId(oldId: string, newId: string) {
  // 替换 purchaseReferences 中的 ID
  const purchaseReferences = globalState.purchaseReferences.map(stage => ({
    ...stage,
    subs: stage.subs.map(sub => ({
      ...sub,
      items: sub.items.map(it => it.id === oldId ? { ...it, id: newId } : it),
    })),
  }));

  // 替换 compareItems 中的 item_id
  const compareItems = globalState.compareItems.map(c =>
    c.item_id === oldId ? { ...c, item_id: newId } : c
  );

  // 替换 ID 列表
  const selectedPurchaseIds = globalState.selectedPurchaseIds.map(id => id === oldId ? newId : id);
  const projectCompareItemIds = globalState.projectCompareItemIds.map(id => id === oldId ? newId : id);

  globalState = {
    ...globalState,
    purchaseReferences,
    compareItems,
    selectedPurchaseIds,
    projectCompareItemIds,
  };
  notify();
  persist();
}

/** Remove item from compare (set needs_compare=false) */
export function removeCompareItem(itemId: string) {
  assertLoggedIn();
  globalState = {
    ...globalState,
    compareItems: globalState.compareItems.filter(c => c.item_id !== itemId),
    projectCompareItemIds: globalState.projectCompareItemIds.filter(id => id !== itemId),
  };
  // Also unset needs_compare on purchase reference
  const purchaseReferences = globalState.purchaseReferences.map(stage => ({
    ...stage,
    subs: stage.subs.map(sub => ({
      ...sub,
      items: sub.items.map(it =>
        it.id === itemId ? { ...it, needs_compare: false } : it
      ),
    })),
  }));
  globalState = { ...globalState, purchaseReferences };
  notify();
  persist();

  // Sync to backend, then reload full compare items
  if (isAuthenticated()) {
    import('../api/purchase').then(({ toggleItemCompare }) => {
      toggleItemCompare(globalState.activeProjectId, itemId)
        .then(() => loadCompareItemsFromBackend())
        .catch(() => {});
    });
  }
}

export function addPriceModel(itemId: string, name: string, spec?: string, note?: string, quantity?: number) {
  assertLoggedIn();
  const tempId = `pm_${Date.now()}`;
  const model: PriceModel = {
    id: tempId,
    item_id: itemId,
    name,
    spec: spec || '',
    note: note || '',
    quantity: quantity || 1,
    channelQuotes: [],
  };
  const compareItems = globalState.compareItems.map(c =>
    c.item_id === itemId ? { ...c, models: [...c.models, model] } : c
  );
  globalState = { ...globalState, compareItems };
  notify();
  persist();

  // Sync to backend if authenticated
  if (isAuthenticated()) {
    import('../api/compare').then(({ createModelApi }) => {
      createModelApi(globalState.activeProjectId, itemId, {
        name, spec: spec || '', note: note || '', quantity: quantity || 1,
      }).then((backendModel) => {
        // Replace temp model with backend-returned model (real ID)
        const updatedCompareItems = globalState.compareItems.map(c => ({
          ...c,
          models: c.models.map(m =>
            m.id === tempId ? {
              id: backendModel.id,
              item_id: backendModel.item_id || itemId,
              project_id: backendModel.project_id,
              name: backendModel.name,
              spec: backendModel.spec || '',
              note: backendModel.note || '',
              quantity: backendModel.quantity || 1,
              best_quote_id: backendModel.best_quote_id,
              channelQuotes: (backendModel.quotes || []).map((q: any) => ({
                id: q.id,
                channel: q.channel,
                price: q.price,
                url: q.url,
                note: q.note,
                updatedAt: q.updated_at,
              })),
            } : m
          ),
        }));
        globalState = { ...globalState, compareItems: updatedCompareItems };
        notify();
        persist();
      }).catch(() => {});
    });
  }

  return model;
}

export function deletePriceModel(itemId: string, modelId: string) {
  assertLoggedIn();
  const compareItems = globalState.compareItems.map(c =>
    c.item_id === itemId ? { ...c, models: c.models.filter(m => m.id !== modelId) } : c
  );
  globalState = { ...globalState, compareItems };
  notify();
  persist();

  // Sync to backend if authenticated
  if (isAuthenticated()) {
    import('../api/client').then(({ apiDelete }) => {
      apiDelete(`/api/projects/${globalState.activeProjectId}/compare/models/${modelId}`).catch(() => {});
    });
  }
}

export function updatePriceModel(modelId: string, updates: { name?: string; spec?: string; note?: string }) {
  assertLoggedIn();
  const compareItems = globalState.compareItems.map(c => ({
    ...c,
    models: c.models.map(m =>
      m.id === modelId ? { ...m, ...updates } : m
    ),
  }));
  globalState = { ...globalState, compareItems };
  notify();
  persist();
}

export function addChannelQuote(modelId: string, channel: string, price?: number, note?: string, url?: string) {
  assertLoggedIn();
  const tempId = `ch_${Date.now()}`;
  const quote: ChannelQuote = {
    id: tempId,
    channel,
    price,
    note,
    url,
    updatedAt: new Date().toISOString(),
  };
  const compareItems = globalState.compareItems.map(c => ({
    ...c,
    models: c.models.map(m =>
      m.id === modelId ? { ...m, channelQuotes: [...(m.channelQuotes || []), quote] } : m
    ),
  }));
  globalState = { ...globalState, compareItems };
  notify();
  persist();

  // Sync to backend if authenticated
  if (isAuthenticated()) {
    import('../api/compare').then(({ createQuoteApi }) => {
      createQuoteApi(globalState.activeProjectId, modelId, {
        channel, price, url, note,
      }).then((backendQuote) => {
        // Replace temp quote with backend-returned quote (real ID)
        const updatedCompareItems = globalState.compareItems.map(c => ({
          ...c,
          models: c.models.map(m =>
            m.id === modelId ? {
              ...m,
              channelQuotes: (m.channelQuotes || []).map(q =>
                q.id === tempId ? {
                  id: backendQuote.id,
                  channel: backendQuote.channel,
                  price: backendQuote.price ?? undefined,
                  url: backendQuote.url ?? undefined,
                  note: backendQuote.note ?? undefined,
                  updatedAt: backendQuote.updated_at ?? undefined,
                } : q
              ),
            } : m
          ),
        }));
        globalState = { ...globalState, compareItems: updatedCompareItems };
        notify();
        persist();
      }).catch(() => {});
    });
  }

  return quote;
}

export function deleteChannelQuote(modelId: string, quoteId: string) {
  assertLoggedIn();
  const compareItems = globalState.compareItems.map(c => ({
    ...c,
    models: c.models.map(m =>
      m.id === modelId ? { ...m, channelQuotes: (m.channelQuotes || []).filter(q => q.id !== quoteId) } : m
    ),
  }));
  const bestQuoteIds = { ...globalState.bestQuoteIds };
  if (bestQuoteIds[modelId] === quoteId) delete bestQuoteIds[modelId];
  globalState = { ...globalState, compareItems, bestQuoteIds };
  notify();
  persist();

  // Sync to backend if authenticated
  if (isAuthenticated()) {
    import('../api/client').then(({ apiDelete }) => {
      apiDelete(`/api/projects/${globalState.activeProjectId}/compare/quotes/${quoteId}`).catch(() => {});
    });
  }
}

export function updateChannelQuote(quoteId: string, updates: { channel?: string; price?: number; note?: string }) {
  assertLoggedIn();
  const compareItems = globalState.compareItems.map(c => ({
    ...c,
    models: c.models.map(m => ({
      ...m,
      channelQuotes: (m.channelQuotes || []).map(q =>
        q.id === quoteId ? { ...q, ...updates } : q
      ),
    })),
  }));
  globalState = { ...globalState, compareItems };
  notify();
  persist();
}

export function selectBestQuote(modelId: string, quoteId: string | null) {
  assertLoggedIn();
  const bestQuoteIds = { ...globalState.bestQuoteIds };
  let expenses = globalState.expenses;
  let selectedExpenseMap = { ...globalState.selectedExpenseMap };

  if (quoteId === null) {
    delete bestQuoteIds[modelId];
  } else {
    // Find the item ID and quote price for this model
    let itemId: string | null = null;
    let quotePrice: number | null = null;
    let quoteChannel: string | undefined;
    for (const ci of globalState.compareItems) {
      for (const m of ci.models) {
        if (m.id === modelId) {
          itemId = ci.item_id;
          const quote = m.channelQuotes.find(q => q.id === quoteId);
          if (quote && quote.price !== undefined && quote.price !== null) {
            quotePrice = quote.price;
            quoteChannel = quote.channel;
          }
          break;
        }
      }
      if (itemId) break;
    }

    // Clear best quotes from all other models in the same item (one-best-per-item)
    if (itemId) {
      for (const ci of globalState.compareItems) {
        if (ci.item_id === itemId) {
          for (const m of ci.models) {
            if (m.id !== modelId) delete bestQuoteIds[m.id];
          }
          break;
        }
      }
    }
    bestQuoteIds[modelId] = quoteId;

    // ── 若物品在待购清单中且有报价价格，创建/更新未支付账单 ──
    // 通过 SelectedPurchase.expense_id 关联，checkPurchaseReadiness 据此判断是否需要输入价格
    if (itemId && quotePrice !== null && globalState.selectedPurchaseIds.includes(itemId)) {
      const existingExpenseId = selectedExpenseMap[itemId];
      if (existingExpenseId) {
        // 已有待购账单 → 更新金额
        expenses = expenses.map(e =>
          e.id === existingExpenseId ? { ...e, amount: quotePrice } : e
        );
      } else {
        // 没有待购账单 → 创建新的未支付账单
        const item = getPurchaseRefItem(itemId);
        const today = new Date().toISOString().slice(0, 10);
        const expenseId = `exp_${Date.now()}`;
        const noteParts: string[] = [];
        if (item?.spec) noteParts.push(item.spec);
        if (item?.qty && item?.unit) noteParts.push(`${item.qty}${item.unit}`);
        else if (item?.qty) noteParts.push(String(item.qty));
        const newExpense: Expense = {
          id: expenseId,
          projectId: globalState.activeProjectId,
          title: item?.name || '',
          amount: quotePrice,
          categoryId: item?.category_id || 'hard',
          subCategoryId: item?.sub_category_id || undefined,
          date: today,
          status: 'unpaid',
          note: noteParts.join('，') || '',
          createdAt: new Date().toISOString(),
        };
        expenses = [newExpense, ...expenses];
        selectedExpenseMap = { ...selectedExpenseMap, [itemId]: expenseId };
      }
    }
  }

  globalState = {
    ...globalState,
    bestQuoteIds,
    expenses,
    recentExpenses: expenses.slice(0, 5),
    selectedExpenseMap,
  };
  notify();
  persist();

  if (isAuthenticated()) {
    import('../api/compare').then(({ setBestQuoteApi }) => {
      setBestQuoteApi(globalState.activeProjectId, modelId, quoteId).catch(() => {});
    });
  }
}

/** Update an item's price, cascading to the correct source based on binding state.
 *  - Has best quote -> updates ChannelQuote.price (syncs Expense)
 *  - Has expense, no quote -> updates Expense.amount
 *  - Neither -> creates unpaid Expense
 */
export async function updateItemPrice(itemId: string, price: number): Promise<void> {
  assertLoggedIn();
  // price 统一为总价，直接存入账单
  const expenseId =
    globalState.selectedExpenseMap[itemId] ||
    globalState.purchasedExpenseMap[itemId];

  const ci = globalState.compareItems.find(c => c.item_id === itemId);
  let bestQuoteId: string | null = null;
  if (ci) {
    for (const m of ci.models) {
      if (m.best_quote_id) { bestQuoteId = m.best_quote_id; break; }
    }
  }

  let expenses = globalState.expenses;
  let selectedExpenseMap = { ...globalState.selectedExpenseMap };
  let compareItems = globalState.compareItems;
  let categories = globalState.budget.categories;

  if (bestQuoteId) {
    compareItems = compareItems.map(c => ({
      ...c,
      models: c.models.map(m => ({
        ...m,
        channelQuotes: (m.channelQuotes || []).map(q =>
          q.id === bestQuoteId ? { ...q, price } : q
        ),
      })),
    }));
    if (expenseId) {
      const oldExpense = expenses.find(e => e.id === expenseId);
      expenses = expenses.map(e => {
        if (e.id === expenseId) {
          if (oldExpense && (oldExpense.status === 'paid' || oldExpense.status === 'prepaid')) {
            const diff = price - oldExpense.amount;
            categories = categories.map(cat =>
              cat.id === `${globalState.activeProjectId}_${e.categoryId}`
                ? { ...cat, spent: Math.max(0, cat.spent + diff) }
                : cat
            );
          }
          return { ...e, amount: price };
        }
        return e;
      });
    }
  } else if (expenseId) {
    const oldExpense = expenses.find(e => e.id === expenseId);
    expenses = expenses.map(e => {
      if (e.id === expenseId) {
        if (oldExpense && (oldExpense.status === 'paid' || oldExpense.status === 'prepaid')) {
          const diff = price - oldExpense.amount;
          categories = categories.map(cat =>
            cat.id === `${globalState.activeProjectId}_${e.categoryId}`
              ? { ...cat, spent: Math.max(0, cat.spent + diff) }
              : cat
          );
        }
        return { ...e, amount: price };
      }
      return e;
    });
  } else if (globalState.selectedPurchaseIds.includes(itemId)) {
    const item = getPurchaseRefItem(itemId);
    const newExpId = `exp_${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    const newExpense: Expense = {
      id: newExpId,
      projectId: globalState.activeProjectId,
      title: item?.name || '',
      amount: price,
      categoryId: item?.category_id || 'hard',
      subCategoryId: item?.sub_category_id || undefined,
      date: today,
      status: 'unpaid',
      note: item?.spec || '',
      createdAt: new Date().toISOString(),
    };
    expenses = [newExpense, ...expenses];
    selectedExpenseMap = { ...selectedExpenseMap, [itemId]: newExpId };
  }

  globalState = {
    ...globalState, expenses,
    recentExpenses: expenses.slice(0, 5),
    compareItems, selectedExpenseMap,
    budget: { ...globalState.budget, categories },
  };
  notify();
  persist();

  if (isAuthenticated()) {
    import('../api/purchase').then(({ updateItemPrice: apiUpdatePrice }) => {
      apiUpdatePrice(globalState.activeProjectId, itemId, price).catch(() => {});
    });
  }
}

export function getBestQuotePrice(modelId: string): number | null {
  const quoteId = globalState.bestQuoteIds[modelId];
  if (!quoteId) return null;
  for (const ci of globalState.compareItems) {
    for (const m of ci.models) {
      if (m.id === modelId) {
        const quote = (m.channelQuotes || []).find(q => q.id === quoteId);
        return quote?.price ?? null;
      }
    }
  }
  return null;
}

export function getModelPriceRange(modelId: string): { min: number; max: number } | null {
  const prices: number[] = [];
  for (const ci of globalState.compareItems) {
    for (const m of ci.models) {
      if (m.id === modelId) {
        for (const q of (m.channelQuotes || [])) {
          if (q.price !== undefined && q.price !== null) prices.push(q.price);
        }
      }
    }
  }
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function getModelDisplayPrice(modelId: string): string | null {
  const best = getBestQuotePrice(modelId);
  if (best !== null) return `¥${best.toLocaleString()}`;
  const range = getModelPriceRange(modelId);
  if (range) return range.min === range.max ? `¥${range.min.toLocaleString()}` : `¥${range.min.toLocaleString()}~${range.max.toLocaleString()}`;
  return null;
}

/** Get display price for an item: best quote from any selected model, otherwise overall min~max. */
export function getItemDisplayPrice(itemId: string): string | null {
  const ci = globalState.compareItems.find(c => c.item_id === itemId);
  if (!ci) return null;

  let bestPrice: number | null = null;
  const allPrices: number[] = [];
  for (const m of ci.models) {
    const bp = getBestQuotePrice(m.id);
    if (bp !== null) {
      if (bestPrice === null || bp < bestPrice) bestPrice = bp;
    }
    for (const q of (m.channelQuotes || [])) {
      if (q.price !== undefined && q.price !== null) allPrices.push(q.price);
    }
  }
  if (bestPrice !== null) return `¥${bestPrice.toLocaleString()}`;
  if (allPrices.length === 0) return null;
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  return min === max ? `¥${min.toLocaleString()}` : `¥${min.toLocaleString()}~${max.toLocaleString()}`;
}

export function toggleModelSync(modelId: string) {
  assertLoggedIn();
  const set = new Set(globalState.syncedModelIds);
  const isSyncing = !set.has(modelId);
  if (isSyncing) set.add(modelId);
  else set.delete(modelId);
  globalState = { ...globalState, syncedModelIds: Array.from(set) };

  // Note: toggleModelSync 只管理 syncedModelIds（同步标记）和 SyncedModel 表。
  // PurchasedItem 和 Expense（账单）的创建/修改由 purchaseItem / unpurchaseItem 负责，
  // 通过 /api/projects/{id}/purchase/purchased/{item_id} 端点处理。
  // 这避免了两个后端端点同时操作 PurchasedItem 导致的竞态条件。

  notify();
  persist();

  if (isAuthenticated()) {
    import('../api/compare').then(({ toggleModelSyncApi }) => {
      toggleModelSyncApi(globalState.activeProjectId, modelId)
        .catch(() => {});
    });
  }
}

export function isModelSynced(modelId: string): boolean {
  return globalState.syncedModelIds.includes(modelId);
}

// ── Purchase-comparison helpers (based on needs_compare flag) ──

export function isItemInComparison(itemId: string): boolean {
  // Check both projectCompareItemIds (from backend) and local compareItems
  if (globalState.projectCompareItemIds.includes(itemId)) return true;
  if (globalState.compareItems.some(c => c.item_id === itemId)) return true;
  // Fallback: check needs_compare flag on reference items (backward compat)
  return globalState.purchaseReferences.some(stage =>
    stage.subs.some(sub =>
      sub.items.some(item => item.id === itemId && item.needs_compare === true)
    )
  );
}

export function getItemBestPrice(itemId: string): number | null {
  const ci = globalState.compareItems.find(c => c.item_id === itemId);
  if (!ci) return null;
  let bestPrice: number | null = null;
  for (const model of ci.models) {
    const bp = getBestQuotePrice(model.id);
    if (bp !== null && (bestPrice === null || bp < bestPrice)) {
      bestPrice = bp;
    }
  }
  return bestPrice;
}

export function getItemBestChannel(itemId: string): string | undefined {
  const ci = globalState.compareItems.find(c => c.item_id === itemId);
  if (!ci) return undefined;
  for (const model of ci.models) {
    const quoteId = globalState.bestQuoteIds[model.id];
    if (quoteId) {
      const quote = (model.channelQuotes || []).find(q => q.id === quoteId);
      if (quote) return quote.channel;
    }
  }
  return undefined;
}

export function getTotalChannelCount(): number {
  let count = 0;
  globalState.compareItems.forEach(ci => {
    ci.models.forEach(m => {
      count += (m.channelQuotes || []).length;
    });
  });
  return count;
}

// ==================== Flow Actions ====================

export function setFlowType(flowType: 'new' | 'old') {
  assertLoggedIn();
  globalState = { ...globalState, flowType, flowCustomOrder: null };
  notify();
  persist();
}

export function setFlowCustomOrder(order: string[] | null) {
  assertLoggedIn();
  globalState = { ...globalState, flowCustomOrder: order };
  notify();
  persist();
}

export function toggleFlowStepDone(stepId: string) {
  assertLoggedIn();
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

  // 如果已有加载在进行中，直接返回该 Promise（防止并发调用）
  if (flowLoadPromise) {
    return flowLoadPromise;
  }

  flowLoadPromise = (async () => {
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
    } finally {
      flowLoadPromise = null;
    }
  })();

  return flowLoadPromise;
}

/** Load budget and expenses from backend, merging with local state */
export async function loadBudgetAndExpensesFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;

  // 如果已有加载在进行中，直接返回该 Promise（防止并发调用）
  if (budgetExpensesLoadPromise) {
    return budgetExpensesLoadPromise;
  }

  budgetExpensesLoadPromise = (async () => {
    const pid = globalState.activeProjectId;

    try {
      // Load budget
      const budgetData = await fetchBudget(pid);
      // Frontend state must only contain keys such as "hard" and "equipment".
      const categories = budgetData.categories.map(c => ({
        ...c,
        id: _categoryKey(c.id),
      }));
      // Deduplicate categories by ID (keep last occurrence to prefer newer data)
      const seen = new Set<string>();
      const dedupedCategories = categories.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      // Preserve existing category IDs if backend returns different set
      const existingIds = new Set(globalState.budget.categories.map(c => c.id));
      const mergedCategories = dedupedCategories.length > 0
        ? dedupedCategories.map(c => ({
            ...c,
            // Use existing spent from backend, fall back to local
            spent: c.spent || (globalState.budget.categories.find(lc => lc.id === c.id)?.spent || 0),
            unpaid_spent: c.unpaid_spent || (globalState.budget.categories.find(lc => lc.id === c.id)?.unpaid_spent || 0),
          }))
        : globalState.budget.categories;

      globalState = {
        ...globalState,
        budget: {
          total: budgetData.total,
          spent: mergedCategories.reduce((s, c) => s + c.spent, 0),
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
      // Load expenses — backend is authoritative (handles deletions from other devices)
      const remoteExpenses = await fetchExpenses(pid);
      // Merge: keep local-only items that don't have the standard exp_ prefix
      // (old-format items or items created while offline).
      // Items with exp_ prefix that are absent from remote were deleted elsewhere.
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
    } catch {
      // Backend unreachable, keep local data
    } finally {
      budgetExpensesLoadPromise = null;
    }
  })();

  return budgetExpensesLoadPromise;
}

function _recalcSpentFromExpenses() {
  const totals: Record<string, number> = {};
  const unpaidTotals: Record<string, number> = {};
  globalState.expenses.forEach(e => {
    if (e.status === 'paid' || e.status === 'prepaid') {
      totals[e.categoryId] = (totals[e.categoryId] || 0) + e.amount;
    } else if (e.status === 'unpaid') {
      unpaidTotals[e.categoryId] = (unpaidTotals[e.categoryId] || 0) + e.amount;
    }
  });
  globalState.budget.categories = globalState.budget.categories.map(c => ({
    ...c,
    spent: totals[c.id] || 0,
    unpaid_spent: unpaidTotals[c.id] || 0,
  }));
  recalculateBudget();
}

// ==================== Stage Notes Actions ====================

export function getStageNotes(stageId: string): StageNote[] {
  return globalState.stageNotes[stageId] || [];
}

export async function addStageNote(stageId: string, content: string): Promise<void> {
  assertLoggedIn();
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
  assertLoggedIn();
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
  assertLoggedIn();
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

  // 如果已有相同 flowType 的加载在进行中，直接返回该 Promise（防止并发调用）
  if (flowStagesLoadPromises[flowType]) {
    return flowStagesLoadPromises[flowType]!;
  }

  flowStagesLoadPromises[flowType] = (async () => {
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
    } finally {
      flowStagesLoadPromises[flowType] = null;
    }
  })();

  return flowStagesLoadPromises[flowType]!;
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
  assertLoggedIn();
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
  assertLoggedIn();
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

  // 如果已有加载在进行中，直接返回该 Promise（防止并发调用）
  if (customFlowLoadPromise) {
    return customFlowLoadPromise;
  }

  customFlowLoadPromise = (async () => {
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
    } finally {
      customFlowLoadPromise = null;
    }
  })();

  return customFlowLoadPromise;
}

// ==================== Project Actions ====================

export function switchProject(projectId: string) {
  assertLoggedIn();
  // Save current project state
  const currentStates = { ...globalState.projectStates };
  currentStates[globalState.activeProjectId] = {
    budget: {
      total: globalState.budget.total,
      categories: globalState.budget.categories.map(c => ({ id: c.id, name: c.name, color: c.color, allocated: c.allocated, spent: c.spent, unpaid_spent: c.unpaid_spent })),
    },
    flowDoneStepIds: [...globalState.flowDoneStepIds],
  };

  // Load target project state (or defaults)
  const target = currentStates[projectId];
  const targetBudget = target?.budget || { total: 0, categories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ id: c.id, name: c.name, color: c.color, allocated: 0, spent: 0, unpaid_spent: 0 })) };
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
  assertLoggedIn();
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
  if (!hasLocalData) {
    // No local data to push — just pull existing server data into frontend state
    await syncFromServerAfterLogin();
    return;
  }

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

/** Strip ONE per-user scope suffix from a server project ID.
 *  The backend scopes IDs as "p1_b3c9f40b" (rawId + _ + 8 hex chars). */
function descopeProjectId(serverId: string): string {
  return serverId.replace(/_[0-9a-f]{8}$/, '');
}

/** Recursively strip scope suffixes until we reach the root (original) ID.
 *  E.g. p1_b3c9f40b_b3c9f40b → p1_b3c9f40b → p1 */
function getRootId(id: string): string {
  let prev = id;
  let next = descopeProjectId(prev);
  while (next !== prev) {
    prev = next;
    next = descopeProjectId(next);
  }
  return prev;
}

/** Sync project list from server — removes locally-cached projects that were deleted
 *  elsewhere, and adds projects created on other clients.  Server project IDs are
 *  descoped before comparison/storage so the local state always holds clean IDs.
 *
 *  Garbage multi-scoped IDs (e.g. p1_b3c9f40b_b3c9f40b created by the old bug) are
 *  collapsed: when several server projects share the same recursive-root ID, only the
 *  one with the shortest ID is kept. */
async function syncProjectsFromBackend(): Promise<void> {
  try {
    const serverProjects = await listProjects();
    const localProjects = globalState.projects;

    // Step 1 — dedup server projects by root ID.
    //   Several projects may be re-scoped copies of the same original (old bug).
    //   Keep only the shortest-ID entry for each root.
    const byRoot = new Map<string, typeof serverProjects[0]>();
    for (const sp of serverProjects) {
      const root = getRootId(sp.id);
      const existing = byRoot.get(root);
      if (!existing || sp.id.length < existing.id.length) {
        byRoot.set(root, sp);
      }
    }

    // Step 2 — normalise to descoped (single-strip) IDs for comparison
    const serverByBaseId = new Map<string, typeof serverProjects[0]>();
    for (const [, sp] of byRoot) {
      const baseId = descopeProjectId(sp.id);
      if (!serverByBaseId.has(baseId)) serverByBaseId.set(baseId, sp);
    }
    const localBaseIds = new Set(localProjects.map(p => descopeProjectId(p.id)));

    // Projects deleted on server
    const deletedBaseIds = new Set(
      [...localBaseIds].filter(id => !serverByBaseId.has(id))
    );

    // Projects created elsewhere
    const newBaseIds = new Set(
      [...serverByBaseId.keys()].filter(id => !localBaseIds.has(id))
    );

    if (deletedBaseIds.size === 0 && newBaseIds.size === 0) return;

    let projects = localProjects.filter(
      p => !deletedBaseIds.has(descopeProjectId(p.id))
    );

    for (const baseId of newBaseIds) {
      const sp = serverByBaseId.get(baseId)!;
      projects.push({
        id: baseId,
        name: sp.name,
        ownerName: '我',
        createdAt: new Date().toISOString(),
        currentStageId: 'stage_prepare',
      });
    }

    if (projects.length === 0) {
      projects = [{
        id: 'p1',
        name: '新家装修',
        ownerName: '我',
        createdAt: new Date().toISOString(),
        currentStageId: 'stage_prepare',
      }];
    }

    let activeProjectId = descopeProjectId(globalState.activeProjectId);
    if (deletedBaseIds.has(activeProjectId) || !projects.some(p => p.id === activeProjectId)) {
      activeProjectId = projects[0].id;
    }

    globalState = { ...globalState, projects, activeProjectId };
    persist();
  } catch {
    // Server unreachable — keep local data
  }
}

/** Call after login to pull server data and merge with local */
export async function syncFromServerAfterLogin(): Promise<void> {
  if (!isAuthenticated()) return;

  // 如果已有进行中的同步，直接复用同一个 Promise，避免重复并发请求
  if (syncInitPromise) return syncInitPromise;

  syncInitPromise = (async () => {
    try {
      await syncProjectsFromBackend();
      await loadBudgetAndExpensesFromBackend();
      await loadFlowFromBackend();
      await loadPurchaseReferencesFromBackend();
      await loadSelectedPurchasesFromBackend();
      await loadPurchasedFromBackend();
      await loadProjectCompareIdsFromBackend();
      await loadCompareItemsFromBackend();
      await loadSubCategoriesFromBackend();  // 加载子分类（默认+项目专属）
    } catch {
      // Server unreachable — keep local data
    } finally {
      syncInitPromise = null;
    }
  })();

  return syncInitPromise;
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

/**
 * 从后端加载子分类（默认分类 + 当前项目专属分类）
 * 合并后替换本地 state.expenseSubCategories
 */
export async function loadSubCategoriesFromBackend(): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const projectId = globalState.activeProjectId || 'p1';
    const subs = await apiFetchSubCategories(projectId);
    globalState = {
      ...globalState,
      expenseSubCategories: subs,
    };
    notify();
    persist();
  } catch (e) {
    console.error('Failed to load subcategories from backend:', e);
  }
}

export function addSubCategory(name: string, categoryId: string): ExpenseSubCategory {
  assertLoggedIn();
  const projectId = globalState.activeProjectId || 'p1';

  // 乐观更新本地 state
  const tempId = `sub_${Date.now()}`;
  const sub: ExpenseSubCategory = {
    id: tempId,
    name: name.trim(),
    categoryId,
    isDefault: false,
  };
  globalState = {
    ...globalState,
    expenseSubCategories: [...globalState.expenseSubCategories, sub],
  };
  notify();
  persist();

  // 异步同步到后端
  apiCreateSubCategory(projectId, name, categoryId)
    .then(created => {
      // 用后端返回的真实 ID 替换临时 ID
      globalState = {
        ...globalState,
        expenseSubCategories: globalState.expenseSubCategories.map(s =>
          s.id === tempId ? { ...s, id: created.id } : s
        ),
      };
      notify();
      persist();
    })
    .catch(e => {
      console.error('Failed to create subcategory on backend:', e);
      // 回滚：移除临时添加的子分类
      globalState = {
        ...globalState,
        expenseSubCategories: globalState.expenseSubCategories.filter(s => s.id !== tempId),
      };
      notify();
      persist();
    });

  return sub;
}

export function deleteSubCategory(subId: string): { success: boolean; error?: string } {
  assertLoggedIn();
  const projectId = globalState.activeProjectId || 'p1';
  const sub = globalState.expenseSubCategories.find(s => s.id === subId);

  // 检查是否为默认分类
  if (sub?.isDefault) {
    return { success: false, error: '默认分类不允许删除' };
  }

  // 乐观更新本地 state
  globalState = {
    ...globalState,
    expenseSubCategories: globalState.expenseSubCategories.filter(s => s.id !== subId),
  };
  notify();
  persist();

  // 异步同步到后端
  deleteSubCategoryApi(projectId, subId)
    .catch(e => {
      console.error('Failed to delete subcategory on backend:', e);
      // 回滚：重新添加被删除的子分类
      if (sub) {
        globalState = {
          ...globalState,
          expenseSubCategories: [...globalState.expenseSubCategories, sub],
        };
        notify();
        persist();
      }
    });

  return { success: true };
}

export function renameSubCategory(subId: string, name: string): { success: boolean; error?: string } {
  assertLoggedIn();
  const projectId = globalState.activeProjectId || 'p1';
  const sub = globalState.expenseSubCategories.find(s => s.id === subId);

  if (!sub) {
    return { success: false, error: '子分类不存在' };
  }

  // 乐观更新本地 state
  globalState = {
    ...globalState,
    expenseSubCategories: globalState.expenseSubCategories.map(s =>
      s.id === subId ? { ...s, name: name.trim() } : s
    ),
  };
  notify();
  persist();

  // 异步同步到后端
  apiUpdateSubCategory(projectId, subId, { name })
    .catch(e => {
      console.error('Failed to rename subcategory on backend:', e);
      // 回滚：恢复原名称
      globalState = {
        ...globalState,
        expenseSubCategories: globalState.expenseSubCategories.map(s =>
          s.id === subId ? { ...s, name: sub.name } : s
        ),
      };
      notify();
      persist();
    });

  return { success: true };
}

export function moveSubCategory(subId: string, toCategoryId: string): { success: boolean; error?: string } {
  assertLoggedIn();
  const projectId = globalState.activeProjectId || 'p1';
  const sub = globalState.expenseSubCategories.find(s => s.id === subId);

  if (!sub) {
    return { success: false, error: '子分类不存在' };
  }

  // 乐观更新本地 state
  globalState = {
    ...globalState,
    expenseSubCategories: globalState.expenseSubCategories.map(s =>
      s.id === subId ? { ...s, categoryId: toCategoryId } : s
    ),
  };
  notify();
  persist();

  // 异步同步到后端
  apiUpdateSubCategory(projectId, subId, { categoryId: toCategoryId })
    .catch(e => {
      console.error('Failed to move subcategory on backend:', e);
      // 回滚：恢复原分类
      globalState = {
        ...globalState,
        expenseSubCategories: globalState.expenseSubCategories.map(s =>
          s.id === subId ? { ...s, categoryId: sub.categoryId } : s
        ),
      };
      notify();
      persist();
    });

  return { success: true };
}

export function getSubCategoriesByCategory(categoryId: string): ExpenseSubCategory[] {
  return globalState.expenseSubCategories.filter(s => s.categoryId === categoryId);
}

// ==================== Expense Group Actions ====================

export function setGroupVisibility(groupId: string, visible: boolean) {
  assertLoggedIn();
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
  assertLoggedIn();
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
  assertLoggedIn();
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
  assertLoggedIn();
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

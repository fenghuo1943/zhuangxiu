import { useState, useEffect, useCallback } from 'react';
import type { AppState, Todo, BudgetCategory, Expense, PurchaseItem, PriceCategory, PriceModel, ChannelQuote, FlowStep } from './types';
import {
  DEFAULT_STAGES,
  DEFAULT_BUDGET_CATEGORIES,
  FLOW_STEPS_NEW,
  FLOW_STEPS_OLD,
  PURCHASE_REFERENCES,
} from './mockData';

const STORAGE_KEY = 'xiaozhuangjia_state_v1';

function getInitialState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure backward compatibility
      return {
        projects: parsed.projects || [{ id: 'p1', name: '新家装修', ownerName: '我', createdAt: new Date().toISOString(), currentStageId: 'design' }],
        activeProjectId: parsed.activeProjectId || 'p1',
        stages: parsed.stages || DEFAULT_STAGES,
        budget: parsed.budget || { total: 0, spent: 0, categories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, allocated: 0, spent: 0 })) },
        todos: parsed.todos || [],
        purchaseItems: parsed.purchaseItems || [],
        purchaseReferences: parsed.purchaseReferences || PURCHASE_REFERENCES,
        selectedPurchaseIds: parsed.selectedPurchaseIds || [],
        expenses: parsed.expenses || [],
        recentExpenses: parsed.recentExpenses || [],
        flowType: parsed.flowType || 'new',
        flowDoneStepIds: parsed.flowDoneStepIds || [],
        flowCustomOrder: parsed.flowCustomOrder || null,
        syncedModelIds: parsed.syncedModelIds || [],
        priceCategories: parsed.priceCategories || [],
        projectStates: parsed.projectStates || {},
      };
    }
  } catch {
    // localStorage corrupted, use defaults
  }

  return {
    projects: [{ id: 'p1', name: '新家装修', ownerName: '我', createdAt: new Date().toISOString(), currentStageId: 'design' }],
    activeProjectId: 'p1',
    stages: DEFAULT_STAGES,
    budget: { total: 0, spent: 0, categories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, allocated: 0, spent: 0 })) },
    todos: [],
    purchaseItems: [],
    purchaseReferences: PURCHASE_REFERENCES,
    selectedPurchaseIds: [],
    expenses: [],
    recentExpenses: [],
    flowType: 'new',
    flowDoneStepIds: [],
    flowCustomOrder: null,
    syncedModelIds: [],
    priceCategories: [],
    projectStates: {},
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

export function setTotalBudget(total: number) {
  globalState = { ...globalState, budget: { ...globalState.budget, total } };
  recalculateBudget();
  notify();
  persist();
}

export function setCategoryAllocation(categoryId: string, allocated: number) {
  const categories = globalState.budget.categories.map(c =>
    c.id === categoryId ? { ...c, allocated } : c
  );
  globalState = { ...globalState, budget: { ...globalState.budget, categories } };
  recalculateBudget();
  notify();
  persist();
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
}

export function addCustomPurchaseItem(name: string, stageParent: string, qty: number) {
  const id = `p_custom_${Date.now()}`;
  const purchaseReferences = globalState.purchaseReferences.map(stage => {
    if (stage.parent !== stageParent) return stage;
    return {
      ...stage,
      subs: stage.subs.map((sub, i) => {
        if (i === 0) {
          return {
            ...sub,
            items: [...sub.items, { id, name, spec: '', qty, unit: '个', selected: true }],
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
}

export function deletePurchaseRefItem(itemId: string) {
  const purchaseReferences = globalState.purchaseReferences.map(stage => ({
    ...stage,
    subs: stage.subs.map(sub => ({
      ...sub,
      items: sub.items.filter(item => item.id !== itemId),
    })),
  }));
  const selectedPurchaseIds = globalState.selectedPurchaseIds.filter(id => id !== itemId);

  globalState = { ...globalState, purchaseReferences, selectedPurchaseIds };
  notify();
  persist();
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

// ==================== Expense Actions ====================

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
}

export function updateExpenseStatus(expenseId: string, status: Expense['status']) {
  const expenses = globalState.expenses.map(e =>
    e.id === expenseId ? { ...e, status } : e
  );
  globalState = { ...globalState, expenses };
  notify();
  persist();
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
  if (set.has(modelId)) set.delete(modelId);
  else set.add(modelId);
  globalState = { ...globalState, syncedModelIds: Array.from(set) };
  notify();
  persist();
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

export function getOrderedFlowSteps(flowType: 'new' | 'old'): FlowStep[] {
  const baseSteps: FlowStep[] = flowType === 'new' ? FLOW_STEPS_NEW : FLOW_STEPS_OLD;
  const customOrder = globalState.flowCustomOrder;

  if (customOrder && customOrder.length > 0) {
    const stepMap = new Map(baseSteps.map((s: FlowStep) => [s.id, s]));
    const ordered: FlowStep[] = customOrder.map(id => stepMap.get(id)).filter((s): s is FlowStep => !!s);
    const orderedIds = new Set(customOrder);
    baseSteps.forEach((s: FlowStep) => { if (!orderedIds.has(s.id)) ordered.push(s); });
    return ordered;
  }
  return baseSteps;
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
    currentStageId: 'design',
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

// ==================== Computed Helpers ====================

export function getCompletedStageCount(): number {
  const flowSteps = FLOW_STEPS_NEW;
  return globalState.flowDoneStepIds.filter(id =>
    flowSteps.some(s => s.id === id)
  ).length;
}

export function getTotalStageCount(flowType: 'new' | 'old' = 'new'): number {
  return flowType === 'new' ? 22 : 9;
}

export function getFirstUndoneStepId(): string {
  const flowSteps = globalState.flowType === 'new' ? FLOW_STEPS_NEW : [];
  const doneSet = new Set(globalState.flowDoneStepIds);
  const firstUndone = flowSteps.find(s => !doneSet.has(s.id));
  return firstUndone?.id || flowSteps[0]?.id || 'design';
}

export function getCurrentStageName(): string {
  const stage = globalState.stages.find(s => s.id === getFirstUndoneStepId());
  return stage?.name || '设计与开工准备';
}

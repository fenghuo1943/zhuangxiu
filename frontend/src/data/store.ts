import { useState, useEffect, useCallback } from 'react';
import type { AppState, Todo, BudgetCategory, Expense, PurchaseItem, PriceCategory, PriceModel, ChannelQuote, FlowStep, StageNote, CustomFlowStep } from './types';
import {
  DEFAULT_STAGES,
  DEFAULT_BUDGET_CATEGORIES,
  FLOW_STEPS_NEW,
  FLOW_STEPS_OLD,
  PURCHASE_REFERENCES,
} from './mockData';
import { isAuthenticated } from '../api/client';
import {
  fetchFlowProgress, updateFlowProgress, toggleStepDone as apiToggleStepDone,
  fetchStageNotes, createStageNote as apiCreateStageNote,
  editStageNote as apiEditStageNote, deleteStageNote as apiDeleteStageNote,
  fetchCustomSteps, createCustomStep as apiCreateCustomStep,
  updateCustomStep as apiUpdateCustomStep, deleteCustomStep as apiDeleteCustomStep,
} from '../api/flow';

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
        stageNotes: parsed.stageNotes || {},
        customFlowSteps: parsed.customFlowSteps || [],
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
    stageNotes: {},
    customFlowSteps: [],
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

export function setTotalBudget(total: number) {
  const categories = globalState.budget.categories;
  const oldTotal = globalState.budget.total;
  const allZero = categories.every(c => c.allocated === 0);
  const normalizedTotal = Math.max(0, Math.round(total / 100) * 100);
  let newCategories = categories;

  if (normalizedTotal > 0) {
    if (oldTotal > 0 && oldTotal !== normalizedTotal && !allZero) {
      // Proportionally scale existing allocations to the new total
      let distributed = 0;
      const scaled = categories.map((c, i) => {
        if (i === categories.length - 1) {
          // Last category gets the remainder to avoid rounding gaps
          const alloc = Math.round((normalizedTotal - distributed) / 100) * 100;
          return { ...c, allocated: Math.max(0, alloc) };
        }
        const ratio = c.allocated / oldTotal;
        const alloc = Math.round((normalizedTotal * ratio) / 100) * 100;
        distributed += alloc;
        return { ...c, allocated: Math.max(0, alloc) };
      });
      newCategories = scaled;
    } else {
      newCategories = distributeBudget(normalizedTotal, categories);
    }
  } else {
    // Total set to 0 — clear all allocations
    newCategories = categories.map(c => ({ ...c, allocated: 0 }));
  }

  globalState = { ...globalState, budget: { ...globalState.budget, total: normalizedTotal, categories: newCategories } };
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
    // Silently fail
  }
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
      // Fall through to local-only
    }
  }

  // Local-only fallback
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
      // Fall through to local-only
    }
  }

  // Local-only fallback
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
      // Continue with local removal
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
    // Silently fail
  }
}

// ==================== Custom Flow Steps Actions ====================

/** Merge custom steps into the built-in flow step list */
export function getOrderedFlowSteps(flowType: 'new' | 'old'): FlowStep[] {
  const baseSteps: FlowStep[] = flowType === 'new' ? FLOW_STEPS_NEW : FLOW_STEPS_OLD;
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
      // Fall through to local-only
    }
  }

  // Local-only fallback
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
      // Continue with local removal
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
    // Silently fail
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

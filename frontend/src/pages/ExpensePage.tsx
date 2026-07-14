import React, { useState, useMemo, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  useStore, addExpense, deleteExpense, updateExpenseStatus, updateExpense,
  getSubCategoriesByCategory, renameGroup, deleteSubCategory,
  addSubCategory, renameSubCategory, moveSubCategory,
  loadBudgetAndExpensesFromBackend,
} from '../data/store';
import type { Expense } from '../data/types';
import {
  IconPlus, IconDollar, IconCheck, IconTrash, IconX,
  IconDownload, IconUpload, IconChevronDown, IconSearch, IconEdit,
} from '../components/common/Icons';
import { DEFAULT_STAGES } from '../data/mockData';

const CATEGORY_NAMES: Record<string, string> = {
  hard: '硬装工程', material: '主材选购', equipment: '设备系统',
  soft: '软装家电', service: '服务杂项',
};

const CATEGORY_COLORS: Record<string, string> = {
  hard: '#e45b3f', material: '#5f9f77', equipment: '#5c7fa8',
  soft: '#be7b2f', service: '#9b928b',
};

const STATUS_OPTIONS: { value: Expense['status'] | 'all'; label: string }[] = [
  { value: 'all', label: '全部账单' },
  { value: 'paid', label: '已支付' },
  { value: 'prepaid', label: '预付款' },
  { value: 'unpaid', label: '未支付' },
];

const STATUS_LABELS: Record<string, string> = {
  paid: '已支付', prepaid: '预付款', unpaid: '未支付', refunded: '已退款',
};

// CSV helpers
const CSV_HEADER = '标题,金额,分类,日期,状态,备注';
const CATEGORY_ID_TO_NAME: Record<string, string> = CATEGORY_NAMES;
const CATEGORY_NAME_TO_ID: Record<string, string> = {
  '硬装工程': 'hard', '主材选购': 'material', '设备系统': 'equipment',
  '软装家电': 'soft', '服务杂项': 'service',
};
const STATUS_NAME_TO_ID: Record<string, Expense['status']> = {
  '已支付': 'paid', '预付款': 'prepaid', '未支付': 'unpaid', '已退款': 'refunded',
};

function exportCSV(expenses: Expense[]): void {
  // BOM for Excel UTF-8 compatibility
  const BOM = '﻿';
  const rows = [CSV_HEADER];
  expenses.forEach(e => {
    const catName = CATEGORY_ID_TO_NAME[e.categoryId] || e.categoryId;
    const statusLabel = STATUS_LABELS[e.status] || e.status;
    const note = (e.note || '').replace(/"/g, '""');
    const title = e.title.replace(/"/g, '""');
    rows.push(`"${title}",${e.amount},"${catName}","${e.date}","${statusLabel}","${note}"`);
  });
  const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `记账数据_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

interface CsvError { line: number; text: string; reason: string }

function parseCSV(text: string): { data: Array<Partial<Expense>>; errors: CsvError[] } {
  const errors: CsvError[] = [];
  const data: Array<Partial<Expense>> = [];

  // Remove BOM if present
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim());

  if (lines.length === 0) {
    errors.push({ line: 0, text: '', reason: '文件为空' });
    return { data, errors };
  }

  // Validate header
  const header = lines[0].trim();
  if (!header.includes('标题') && !header.includes('金额')) {
    errors.push({ line: 1, text: header, reason: '表头缺少"标题"和"金额"列，请使用标准CSV格式' });
    return { data, errors };
  }

  // Parse header to find column positions
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = false;
        } else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { result.push(current.trim()); current = ''; }
        else current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 2) {
      errors.push({ line: lineNum, text: lines[i], reason: '列数不足' });
      continue;
    }

    const title = fields[0];
    const amountStr = fields[1];
    const categoryStr = fields[2] || '';
    const dateStr = fields[3] || '';
    const statusStr = fields[4] || '';
    const note = fields[5] || '';

    if (!title) { errors.push({ line: lineNum, text: lines[i], reason: '标题不能为空' }); continue; }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) { errors.push({ line: lineNum, text: lines[i], reason: `金额无效: "${amountStr}"` }); continue; }

    const categoryId = CATEGORY_NAME_TO_ID[categoryStr] || 'hard';
    const date = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : new Date().toISOString().slice(0, 10);
    const status = STATUS_NAME_TO_ID[statusStr] || 'paid';

    data.push({ title, amount, categoryId, date, status, note, projectId: '' });
  }

  return { data, errors };
}

const ExpensePage: React.FC = () => {
  const state = useStore();
  const [statusFilter, setStatusFilter] = useState<Expense['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['hard', 'material', 'equipment', 'soft', 'service']));
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [undoToast, setUndoToast] = useState<{ id: string; expense: Expense } | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [importPreview, setImportPreview] = useState<{ data: Array<Partial<Expense>>; errors: CsvError[] } | null>(null);

  // Form state (shared by add and edit)
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('hard');
  const [formStatus, setFormStatus] = useState<Expense['status']>('paid');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formNote, setFormNote] = useState('');
  const [formStage, setFormStage] = useState('');
  const [formSubCategory, setFormSubCategory] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'stats' | 'bills' | 'group'>('stats');

  // Load budget & expenses from backend on mount
  useEffect(() => {
    loadBudgetAndExpensesFromBackend();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setFormTitle(''); setFormAmount(''); setFormCategory('hard');
    setFormStatus('paid'); setFormDate(new Date().toISOString().slice(0, 10)); setFormNote(''); setFormStage('');
    setFormSubCategory('');
    setShowModal(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingId(exp.id);
    setFormTitle(exp.title);
    setFormAmount(String(exp.amount));
    setFormCategory(exp.categoryId);
    setFormStatus(exp.status);
    setFormDate(exp.date);
    setFormNote(exp.note || '');
    setFormStage(exp.stageId || '');
    setFormSubCategory(exp.subCategoryId || '');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); };

  const handleSave = () => {
    if (!formTitle.trim() || !formAmount || parseFloat(formAmount) <= 0) return;
    const base = {
      title: formTitle.trim(),
      amount: parseFloat(formAmount),
      categoryId: formCategory,
      date: formDate,
      status: formStatus,
      note: formNote.trim() || undefined,
      stageId: formStage || undefined,
      subCategoryId: formSubCategory || undefined,
    };
    if (editingId) {
      updateExpense(editingId, base);
    } else {
      addExpense({ ...base, projectId: state.activeProjectId });
    }
    closeModal();
  };

  const filteredExpenses = useMemo(() => {
    let list = state.expenses;
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || (e.note && e.note.toLowerCase().includes(q)));
    }
    if (subCategoryFilter) {
      list = list.filter(e => e.subCategoryId === subCategoryFilter);
    }
    return list;
  }, [state.expenses, statusFilter, searchQuery, subCategoryFilter]);

  const totalSpent = useMemo(() => filteredExpenses.reduce((sum, e) => sum + e.amount, 0), [filteredExpenses]);

  const expensesByCategory = useMemo(() => {
    const grouped: Record<string, Expense[]> = {};
    ['hard', 'material', 'equipment', 'soft', 'service'].forEach(cid => {
      grouped[cid] = filteredExpenses.filter(e => e.categoryId === cid);
    });
    return grouped;
  }, [filteredExpenses]);

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          let imported = 0;
          data.forEach((item: any) => {
            if (item.title && item.amount && item.categoryId) {
              addExpense({
                projectId: state.activeProjectId,
                title: item.title,
                amount: Number(item.amount),
                categoryId: item.categoryId,
                date: item.date || new Date().toISOString().slice(0, 10),
                status: item.status || 'paid',
                note: item.note,
              });
              imported++;
            }
          });
          setImportMsg({ type: 'success', text: `JSON: 成功导入 ${imported} 条记录` });
        } else {
          setImportMsg({ type: 'error', text: 'JSON 格式不正确，需要数组格式' });
        }
      } catch {
        setImportMsg({ type: 'error', text: '文件解析失败，请检查格式' });
      }
    };
    input.click();
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,text/csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const { data, errors } = parseCSV(text);
        if (data.length === 0 && errors.length > 0) {
          setImportMsg({ type: 'error', text: `CSV 解析失败: ${errors[0]?.reason || '无有效数据'}` });
        } else {
          setImportPreview({ data, errors });
        }
      } catch {
        setImportMsg({ type: 'error', text: 'CSV 文件读取失败' });
      }
    };
    input.click();
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(state.expenses, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `记账数据_${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    exportCSV(state.expenses);
  };

  const handleDeleteWithUndo = (exp: Expense) => {
    deleteExpense(exp.id);
    setDeleteConfirm(null);
    setUndoToast({ id: exp.id, expense: exp });
    const timer = setTimeout(() => setUndoToast(null), 5000);
    if (undoTimer) clearTimeout(undoTimer);
    setUndoTimer(timer);
  };

  const handleUndoDelete = () => {
    if (!undoToast) return;
    addExpense({
      projectId: state.activeProjectId,
      title: undoToast.expense.title,
      amount: undoToast.expense.amount,
      categoryId: undoToast.expense.categoryId,
      date: undoToast.expense.date,
      status: undoToast.expense.status,
      note: undoToast.expense.note,
      stageId: undoToast.expense.stageId,
    });
    setUndoToast(null);
    if (undoTimer) clearTimeout(undoTimer);
  };

  const toggleCat = (catId: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const formatAmount = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <AppShell currentPage="expense">
      <div className="expense-page">
        {/* Summary Cards */}
        <div className="expense-summary-row">
          <div className="card expense-total-card">
            <div className="card-bd">
              <span className="expense-total-label">
                <IconDollar size={18} /> 总支出
              </span>
              <b className="expense-total-value">¥{formatAmount(totalSpent)}</b>
              <span className="expense-total-sub">{filteredExpenses.length} 笔记录</span>
            </div>
          </div>

          {['hard', 'material', 'equipment', 'soft', 'service'].map(cid => {
            const catExpenses = expensesByCategory[cid] || [];
            const catTotal = catExpenses.reduce((s, e) => s + e.amount, 0);
            return (
              <div key={cid} className="card expense-cat-card">
                <div className="card-bd">
                  <span className="expense-cat-label" style={{ color: CATEGORY_COLORS[cid] }}>
                    <span className="expense-cat-dot" style={{ background: CATEGORY_COLORS[cid] }} />
                    {CATEGORY_NAMES[cid]}
                  </span>
                  <b className="expense-cat-value">¥{formatAmount(catTotal)}</b>
                  <span className="expense-cat-count">{catExpenses.length} 笔</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* View Switcher */}
        <div className="view-switcher">
          <div className="toolbar-row">
            <div className="tabs">
              <button
                className={`tab ${activeView === 'stats' ? 'active' : ''}`}
                onClick={() => setActiveView('stats')}
              >
                分类统计
              </button>
              <button
                className={`tab ${activeView === 'bills' ? 'active' : ''}`}
                onClick={() => setActiveView('bills')}
              >
                全部账单
              </button>
            </div>
          </div>
          <button
            className={`icon-btn icon-btn--settings ${activeView === 'group' ? 'active' : ''}`}
            onClick={() => setActiveView('group')}
            title="分组设置"
            aria-label="分组设置"
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z" />
              <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5h.1a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>

        {activeView === 'bills' && (
          <div className="expense-toolbar">
            <div className="expense-filters">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`filter-btn ${statusFilter === opt.value ? 'active' : ''}`}
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="expense-search">
              <IconSearch size={14} />
              <input
                className="input"
                placeholder="搜索记账记录..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: 180, paddingLeft: 32 }}
              />
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, whiteSpace: 'nowrap' }}
              onClick={() => setExpandedCats(new Set(['hard', 'material', 'equipment', 'soft', 'service']))}
            >
              全部展开
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, whiteSpace: 'nowrap' }}
              onClick={() => setExpandedCats(new Set())}
            >
              全部折叠
            </button>
            <div className="expense-actions">
              {/* Export dropdown */}
              <div className="export-dropdown" style={{ position: 'relative' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setShowExportMenu(!showExportMenu)}>
                  <IconDownload size={14} /> 导出 ▾
                </button>
                {showExportMenu && (
                  <div className="export-menu" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 200, marginTop: 4, background: '#fff', border: '1px solid var(--fresh-line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(55,42,31,.12)', overflow: 'hidden', minWidth: 140 }}>
                    <button className="export-menu-item" onClick={() => { handleExportCSV(); setShowExportMenu(false); }}>📊 导出 CSV (Excel)</button>
                    <button className="export-menu-item" onClick={() => { handleExportJSON(); setShowExportMenu(false); }}>📋 导出 JSON</button>
                  </div>
                )}
              </div>
              <button className="btn btn-outline btn-sm" onClick={handleImportJSON} title="导入 JSON">
                <IconUpload size={14} /> 导入 JSON
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleImportCSV} title="导入 CSV">
                <IconUpload size={14} /> 导入 CSV
              </button>
              <button className="btn btn-primary btn-sm" onClick={openAddModal}>
                <IconPlus size={14} /> 记一笔
              </button>
            </div>
          </div>
        )}

        {importMsg && (
          <div className={`backup-msg ${importMsg.type}`} style={{ marginBottom: 12 }}>
            {importMsg.text}
            <button className="icon-btn" style={{ marginLeft: 8 }} onClick={() => setImportMsg(null)}>
              <IconX size={12} />
            </button>
          </div>
        )}

        {/* Settings / Group Management */}
        {activeView === 'group' ? (
          <div className="expense-view-panel">
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.55 }}>
                  点选小分类后点击目标大分类即可移入，也可以直接拖拽小分类到目标大分类。
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ flexShrink: 0 }}
                  onClick={() => {
                    const name = prompt('输入新小项名称:');
                    if (name && name.trim()) {
                      const catId = state.expenseGroups[0]?.id || 'hard';
                      addSubCategory(name.trim(), catId);
                    }
                  }}
                >
                  添加小项
                </button>
              </div>
            </div>

            {selectedSubId && (
              <div className="group-select-hint">
                <span>
                  已选中「{state.expenseSubCategories.find(s => s.id === selectedSubId)?.name || '未知'}」
                  — 点击目标分组即可移入
                </span>
                <button onClick={() => setSelectedSubId(null)} title="取消选择">✕</button>
              </div>
            )}

            <div className="group-area">
              {state.expenseGroups.map(group => {
                const subs = state.expenseSubCategories.filter(s => s.categoryId === group.id);
                const color = CATEGORY_COLORS[group.id] || group.color;
                const isDragOver = dragOverGroupId === group.id;
                return (
                  <div
                    key={group.id}
                    className={`group-box${isDragOver ? ' drag-over' : ''}`}
                    onClick={() => {
                      if (selectedSubId) {
                        moveSubCategory(selectedSubId, group.id);
                        setSelectedSubId(null);
                      }
                    }}
                    onDragOver={e => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverGroupId(group.id);
                    }}
                    onDragLeave={() => setDragOverGroupId(null)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOverGroupId(null);
                      const subId = e.dataTransfer.getData('text/plain');
                      if (subId) {
                        moveSubCategory(subId, group.id);
                      }
                    }}
                  >
                    <div className="group-hd">
                      <input
                        className="group-name-input"
                        value={group.name}
                        onChange={e => renameGroup(group.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                      <span style={{ fontSize: 11, color: '#999' }}>{subs.length}项</span>
                    </div>
                    <div className="group-bd">
                      {subs.length === 0 && !isDragOver ? (
                        <div className="group-empty">拖到这里</div>
                      ) : (
                        subs.map(sub => {
                          const isSelected = selectedSubId === sub.id;
                          return (
                            <div
                              key={sub.id}
                              className={`group-tag${isSelected ? ' selected' : ''}`}
                              style={{
                                background: isSelected ? `${color}18` : `${color}08`,
                                border: `1px solid ${isSelected ? color : `${color}25`}`,
                                color: color,
                                boxShadow: isSelected ? `0 0 0 2px ${color}30` : undefined,
                              }}
                              draggable
                              onDragStart={e => {
                                e.dataTransfer.setData('text/plain', sub.id);
                                e.dataTransfer.effectAllowed = 'move';
                                setSelectedSubId(null);
                              }}
                              onDragEnd={() => setDragOverGroupId(null)}
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedSubId(isSelected ? null : sub.id);
                              }}
                            >
                              <svg viewBox="0 0 24 24" className="fresh-svg" aria-hidden="true">
                                <circle cx="12" cy="12" r="3.5" />
                              </svg>
                              <span>{sub.name}</span>
                              <button
                                className="group-tag-del"
                                title="删除"
                                onClick={e => {
                                  e.stopPropagation();
                                  if (confirm(`删除小项「${sub.name}」?`)) {
                                    if (selectedSubId === sub.id) setSelectedSubId(null);
                                    deleteSubCategory(sub.id);
                                  }
                                }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        ) : activeView === 'stats' ? (
          /* ---- Stats View: big-stat list ---- */
          <div className="big-stat-list">
            {['hard', 'material', 'equipment', 'soft', 'service'].map(cid => {
              const catExpenses = expensesByCategory[cid] || [];
              const catTotal = catExpenses.reduce((s, e) => s + e.amount, 0);
              const budgetCat = state.budget.categories.find(c => c.id === cid);
              const allocated = budgetCat?.allocated || 0;
              const pct = allocated > 0 ? Math.round((catTotal / allocated) * 100) : 0;
              const barPct = Math.min(pct, 100);
              const color = CATEGORY_COLORS[cid];
              return (
                <div key={cid} className="big-stat">
                  <div className="big-stat-dot" style={{ background: color }} />
                  <span className="big-stat-name">{CATEGORY_NAMES[cid]}</span>
                  <div className="big-stat-bar">
                    <div
                      className="big-stat-fill"
                      style={{ width: `${barPct}%`, background: color }}
                    />
                  </div>
                  <span className="big-stat-amount" style={{ color }}>
                    ¥{formatAmount(catTotal)}
                  </span>
                  <span className="big-stat-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {filteredExpenses.length === 0 ? (
              <div className="card">
                <div className="card-bd">
                  <div className="empty-state">
                    <div className="empty-state-icon">💰</div>
                    <p className="empty-state-title">暂无记录</p>
                    <p className="empty-state-desc">
                      {searchQuery ? '未找到匹配的记账记录' : '还没有记账记录，点击"记一笔"开始记录'}
                    </p>
                    {!searchQuery && (
                      <div className="empty-state-action">
                        <button className="btn btn-primary" onClick={openAddModal}>
                          <IconPlus size={14} /> 记一笔
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="expense-accordion">
                {['hard', 'material', 'equipment', 'soft', 'service'].map(cid => {
                  const catExpenses = expensesByCategory[cid] || [];
                  if (catExpenses.length === 0) return null;
                  const isOpen = expandedCats.has(cid);
                  const catTotal = catExpenses.reduce((s, e) => s + e.amount, 0);
                  return (
                    <div key={cid} className={`expense-cat-group ${isOpen ? 'open' : ''}`}>
                      <div
                        className="expense-cat-header"
                        onClick={() => toggleCat(cid)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isOpen}
                      >
                        <div className="expense-cat-header-left">
                          <span className="expense-cat-dot" style={{ background: CATEGORY_COLORS[cid] }} />
                          <strong>{CATEGORY_NAMES[cid]}</strong>
                          <span className="badge badge-default">{catExpenses.length} 笔</span>
                        </div>
                        <div className="expense-cat-header-right">
                          <b>¥{formatAmount(catTotal)}</b>
                          <span className={`expense-cat-chevron ${isOpen ? 'open' : ''}`}>
                            <IconChevronDown size={16} />
                          </span>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="expense-cat-body">
                          {/* SubCategory chips */}
                          {(() => {
                            const subIds = [...new Set(catExpenses.map(e => e.subCategoryId).filter(Boolean))];
                            if (subIds.length === 0) return null;
                            return (
                              <div className="expense-stage-chips">
                                {subIds.map(sid => {
                                  const sub = state.expenseSubCategories.find(s => s.id === sid);
                                  const isActive = subCategoryFilter === sid;
                                  return (
                                    <button
                                      key={sid!}
                                      className={`expense-stage-chip ${isActive ? 'active' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); setSubCategoryFilter(isActive ? '' : sid!); }}
                                    >
                                      {sub?.name || sid}
                                      {isActive && <IconX size={10} />}
                                    </button>
                                  );
                                })}
                                {subCategoryFilter && (
                                  <button className="expense-stage-chip clear" onClick={(e) => { e.stopPropagation(); setSubCategoryFilter(''); }}>
                                    清除筛选
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                          {catExpenses.map(exp => (
                            <div key={exp.id} className={`expense-item ${deleteConfirm === exp.id ? 'deleting' : ''}`}>
                              <div className="expense-item-main">
                                <div className="expense-item-info">
                                  <span className="expense-item-title">
                                    {exp.title}
                                    {exp.subCategoryId && (() => {
                                      const sub = state.expenseSubCategories.find(s => s.id === exp.subCategoryId);
                                      return sub ? <span className="expense-item-sub-tag">{sub.name}</span> : null;
                                    })()}
                                  </span>
                                  <div className="expense-item-meta-row">
                                    <span className="expense-item-date">{exp.date}</span>
                                    {exp.stageId && (() => {
                                      const s = DEFAULT_STAGES.find(st => st.id === exp.stageId);
                                      return s ? <span className="expense-item-stage-tag">{s.name}</span> : null;
                                    })()}
                                  </div>
                                  {exp.note && <span className="expense-item-note">{exp.note}</span>}
                                </div>
                                <div className="expense-item-right">
                                  <b className="expense-item-amount">¥{formatAmount(exp.amount)}</b>
                                  <span className={`badge ${exp.status === 'paid' ? 'badge-success' : exp.status === 'unpaid' ? 'badge-danger' : 'badge-warning'}`}>
                                    {STATUS_LABELS[exp.status] || exp.status}
                                  </span>
                                </div>
                              </div>
                              <div className="expense-item-actions">
                                <select
                                  className="input"
                                  value={exp.status}
                                  onChange={e => updateExpenseStatus(exp.id, e.target.value as Expense['status'])}
                                  style={{ fontSize: 11, padding: '2px 6px' }}
                                >
                                  <option value="paid">已支付</option>
                                  <option value="prepaid">预付款</option>
                                  <option value="unpaid">未支付</option>
                                </select>
                                <button className="fresh-icon-btn" title="编辑" onClick={() => openEditModal(exp)}>
                                  <IconEdit size={14} />
                                </button>
                                {deleteConfirm === exp.id ? (
                                  <>
                                    <button className="btn btn-sm" style={{ color: '#EF4444', fontSize: 11 }} onClick={() => handleDeleteWithUndo(exp)}>
                                      确认
                                    </button>
                                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setDeleteConfirm(null)}>
                                      取消
                                    </button>
                                  </>
                                ) : (
                                  <button className="fresh-icon-btn" title="删除" onClick={() => setDeleteConfirm(exp.id)}>
                                    <IconTrash size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Add / Edit Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  {editingId ? <IconEdit size={18} /> : <IconDollar size={18} />}
                  {editingId ? '编辑记账' : '新增记账'}
                </h3>
                <button className="icon-btn" onClick={closeModal}>
                  <IconX size={16} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>项目名称</label>
                  <input className="input" style={{ width: '100%' }} value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="例如：水电材料费" />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>金额 (元)</label>
                    <input className="input" style={{ width: '100%' }} type="number" min="0" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>分类</label>
                    <select className="input" style={{ width: '100%' }} value={formCategory} onChange={e => { setFormCategory(e.target.value); setFormSubCategory(''); }}>
                      {Object.entries(CATEGORY_NAMES).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>子分类 (可选)</label>
                    <select className="input" style={{ width: '100%' }} value={formSubCategory} onChange={e => setFormSubCategory(e.target.value)}>
                      <option value="">不选择</option>
                      {getSubCategoriesByCategory(formCategory).map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>日期</label>
                    <input className="input" style={{ width: '100%' }} type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>状态</label>
                    <select className="input" style={{ width: '100%' }} value={formStatus} onChange={e => setFormStatus(e.target.value as Expense['status'])}>
                      <option value="paid">已支付</option>
                      <option value="prepaid">预付款</option>
                      <option value="unpaid">未支付</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>备注</label>
                    <input className="input" style={{ width: '100%' }} value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="可选备注" />
                  </div>
                </div>
                <div className="form-group">
                  <label>关联阶段 (可选)</label>
                  <select className="input" style={{ width: '100%' }} value={formStage} onChange={e => setFormStage(e.target.value)}>
                    <option value="">不关联</option>
                    {DEFAULT_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={closeModal}>取消</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!formTitle.trim() || !formAmount}>
                  <IconCheck size={16} /> {editingId ? '保存修改' : '确认添加'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Undo Toast */}
        {undoToast && (
          <div className="toast success">
            <span>已删除「{undoToast.expense.title}」</span>
            <button onClick={handleUndoDelete}>撤销</button>
            <button onClick={() => { setUndoToast(null); if (undoTimer) clearTimeout(undoTimer); }} style={{ border: 'none', padding: '4px 6px' }}>✕</button>
          </div>
        )}

        {/* Import Preview Modal */}
        {importPreview && (
          <div className="modal-overlay" onClick={() => setImportPreview(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(640px, 100%)', maxHeight: '80vh' }}>
              <div className="modal-header">
                <h3>📋 导入预览</h3>
                <button className="icon-btn" onClick={() => setImportPreview(null)}><IconX size={16} /></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {importPreview.errors.length > 0 && (
                  <div className="backup-msg error" style={{ marginBottom: 10 }}>
                    ⚠️ {importPreview.errors.length} 行数据有误，将跳过
                  </div>
                )}
                <table className="import-preview-table">
                  <thead><tr><th>标题</th><th>金额</th><th>分类</th><th>日期</th><th>状态</th></tr></thead>
                  <tbody>
                    {importPreview.data.map((row, i) => (
                      <tr key={i} className={!row.title || !row.amount ? 'row-error' : ''}>
                        <td>{row.title || <em style={{ color: '#EF4444' }}>缺失</em>}</td>
                        <td>{row.amount ? `¥${row.amount.toLocaleString()}` : '--'}</td>
                        <td>{CATEGORY_NAMES[row.categoryId || 'hard']}</td>
                        <td>{row.date || '--'}</td>
                        <td>{STATUS_LABELS[row.status || 'paid']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importPreview.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#EF4444', marginBottom: 2 }}>第{e.line}行: {e.reason}</div>
                ))}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setImportPreview(null)}>取消</button>
                <button className="btn btn-primary" onClick={() => {
                  let imported = 0;
                  importPreview.data.forEach(item => {
                    if (item.title && item.amount) {
                      addExpense({ projectId: state.activeProjectId, title: item.title, amount: item.amount, categoryId: item.categoryId || 'hard', date: item.date || new Date().toISOString().slice(0, 10), status: item.status || 'paid', note: item.note || undefined });
                      imported++;
                    }
                  });
                  setImportMsg({ type: 'success', text: `成功导入 ${imported} 条记录` });
                  setImportPreview(null);
                }} disabled={importPreview.data.filter(d => d.title && d.amount).length === 0}>
                  <IconCheck size={16} /> 确认导入 ({importPreview.data.filter(d => d.title && d.amount).length} 条)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile FAB */}
        <button className="fab" onClick={openAddModal} title="记一笔">
          <IconPlus size={24} />
        </button>
      </div>
    </AppShell>
  );
};

export default ExpensePage;

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import {
  useStore, addSubCategory, deleteSubCategory, renameSubCategory, moveSubCategory,
  renameGroup, loadSubCategoriesFromBackend,
} from '../data/store';
import { batchUpdateCategories } from '../api/purchase';
import type { BatchCategoryItem } from '../api/purchase';
import { useAuth } from '../api/useAuth';

const CATEGORY_NAMES: Record<string, string> = {
  hard: '硬装工程', material: '主材选购', equipment: '设备系统',
  soft: '软装家电', service: '服务杂项',
};

const CATEGORY_COLORS: Record<string, string> = {
  hard: '#e45b3f', material: '#5f9f77', equipment: '#5c7fa8',
  soft: '#be7b2f', service: '#9b928b',
};

type TabType = 'expense' | 'purchase';

const CategoryManagePage: React.FC = () => {
  const state = useStore();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.is_admin === true;

  const [activeTab, setActiveTab] = useState<TabType>('expense');

  // ── 账单子分类管理状态 ──
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  // ── 采购物品分类管理状态 ──
  const [catDirty, setCatDirty] = useState<Record<string, { category_id: string; sub_category_id: string }>>({});
  const [catMsg, setCatMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [catExpandedStages, setCatExpandedStages] = useState<Set<string>>(new Set());

  const budgetCategories = state.budget.categories;
  const expenseSubCategories = state.expenseSubCategories;

  // 页面挂载时从后端加载子分类
  useEffect(() => {
    loadSubCategoriesFromBackend();
  }, []);

  // Build flat item list from purchase references
  const allPurchaseItems = useMemo(() => {
    const items: { id: string; name: string; spec?: string; stageParent: string; subgroupName: string; category_id: string | null; sub_category_id: string | null; isCustom: boolean }[] = [];
    state.purchaseReferences.forEach(stage => {
      stage.subs.forEach(sub => {
        sub.items.forEach(item => {
          const isCustom = item.id.startsWith('p_custom_');
          items.push({
            id: item.id,
            name: item.name,
            spec: item.spec,
            stageParent: stage.parent,
            subgroupName: sub.name,
            category_id: item.category_id || null,
            sub_category_id: item.sub_category_id || null,
            isCustom,
          });
        });
      });
    });
    return items;
  }, [state.purchaseReferences]);

  // Group items by stage for display
  const itemsByStage = useMemo(() => {
    const map = new Map<string, typeof allPurchaseItems>();
    allPurchaseItems.forEach(item => {
      const list = map.get(item.stageParent) || [];
      list.push(item);
      map.set(item.stageParent, list);
    });
    return map;
  }, [allPurchaseItems]);

  // ── 采购物品分类管理逻辑 ──
  const getItemCat = (itemId: string, field: 'category_id' | 'sub_category_id') => {
    if (catDirty[itemId]) return catDirty[itemId][field];
    const item = allPurchaseItems.find(i => i.id === itemId);
    return item ? (item[field] || '') : '';
  };

  const canEdit = (itemId: string) => {
    if (isAdmin) return true;
    return allPurchaseItems.find(i => i.id === itemId)?.isCustom === true;
  };

  const setItemCat = (itemId: string, field: 'category_id' | 'sub_category_id', value: string) => {
    setCatDirty(prev => {
      const existing = prev[itemId] || {
        category_id: getItemCat(itemId, 'category_id'),
        sub_category_id: getItemCat(itemId, 'sub_category_id'),
      };
      return { ...prev, [itemId]: { ...existing, [field]: value } };
    });
  };

  const dirtyCount = Object.keys(catDirty).length;

  const handleSaveCategories = async () => {
    if (dirtyCount === 0) return;
    setCatSaving(true);
    setCatMsg(null);
    try {
      const items: BatchCategoryItem[] = Object.entries(catDirty).map(([item_id, vals]) => ({
        item_id,
        category_id: vals.category_id || null,
        sub_category_id: vals.sub_category_id || null,
      }));
      const res = await batchUpdateCategories(items);
      setCatMsg({ type: 'success', text: `✅ 已更新 ${res.updated} 个物品` + (res.skipped > 0 ? `，${res.skipped} 个被跳过（权限不足）` : '') });
      setCatDirty({});
      const { loadPurchaseReferencesFromBackend } = await import('../data/store');
      await loadPurchaseReferencesFromBackend();
    } catch (e: any) {
      setCatMsg({ type: 'error', text: `❌ 保存失败：${e?.message || '请先登录'}` });
    } finally {
      setCatSaving(false);
    }
  };

  // ── 渲染账单子分类管理 ──
  const renderExpenseSubCategoryManager = () => (
    <div className="expense-view-panel">
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.55 }}>
            点选小分类后点击目标大分类即可移入，也可以直接拖拽小分类到目标大分类。
            <br />
            <span style={{ fontSize: 11, color: '#999' }}>
              💡 标记为"默认"的分类为系统预设，所有项目可见且不可删除；其他分类为当前项目专属。
            </span>
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
                  name={`group-rename-${group.id}`}
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
                    const isDefault = sub.isDefault;
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
                        draggable={!isDefault}
                        onDragStart={e => {
                          if (isDefault) return;
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
                        {isDefault && (
                          <span
                            style={{
                              fontSize: 9,
                              padding: '1px 4px',
                              borderRadius: 3,
                              background: `${color}20`,
                              color: color,
                              marginLeft: 4,
                            }}
                          >
                            默认
                          </span>
                        )}
                        {!isDefault && (
                          <button
                            className="group-tag-del"
                            title="删除"
                            onClick={e => {
                              e.stopPropagation();
                              if (confirm(`删除小项「${sub.name}」?`)) {
                                if (selectedSubId === sub.id) setSelectedSubId(null);
                                const result = deleteSubCategory(sub.id);
                                if (!result.success) {
                                  alert(result.error || '删除失败');
                                }
                              }
                            }}
                          >
                            ×
                          </button>
                        )}
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
  );

  // ── 渲染采购物品分类管理 ──
  const renderPurchaseCategoryManager = () => (
    <div style={{ padding: '0 4px' }}>
      <p style={{ marginBottom: 12, fontSize: 12, color: '#666' }}>
        {isAdmin
          ? '👑 管理员 — 可修改所有物品的分类'
          : '👤 普通用户 — 仅可修改自己添加的物品分类（橙色高亮），种子物品只读'}
        · 选择分类后点击底部「保存修改」按钮生效。
      </p>

      {allPurchaseItems.length === 0 ? (
        <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 20 }}>暂无采购物品数据</p>
      ) : (
        <>
          {Array.from(itemsByStage.entries()).map(([stageName, items]) => {
            const stageOpen = catExpandedStages.has(stageName);
            const stageDirtyCount = items.filter(it => catDirty[it.id]).length;
            return (
              <div key={stageName} style={{ marginBottom: 6 }}>
                <div
                  onClick={() => setCatExpandedStages(prev => {
                    const next = new Set(prev);
                    if (next.has(stageName)) next.delete(stageName);
                    else next.add(stageName);
                    return next;
                  })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    background: '#f8f9fa', borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: 10, transition: 'transform .2s', transform: stageOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  <span>{stageName}</span>
                  <span style={{ fontWeight: 400, color: '#999', fontSize: 11 }}>({items.length} 项)</span>
                  {stageDirtyCount > 0 && (
                    <span style={{ fontSize: 10, background: '#FFF3CD', color: '#856404', padding: '1px 6px', borderRadius: 4 }}>{stageDirtyCount} 已修改</span>
                  )}
                </div>
                {stageOpen && (
                  <div style={{ marginTop: 4 }}>
                    {items.map(item => {
                      const editable = canEdit(item.id);
                      const catId = getItemCat(item.id, 'category_id');
                      const subCatId = getItemCat(item.id, 'sub_category_id');
                      const subs = expenseSubCategories.filter(s => s.categoryId === catId);
                      return (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px 3px 24px',
                          fontSize: 12, borderBottom: '1px solid #f0f0f0',
                          opacity: editable ? 1 : 0.55,
                        }}>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                            {item.spec && <span style={{ color: '#999', marginLeft: 4 }}>{item.spec}</span>}
                            {item.isCustom && <span style={{ fontSize: 9, background: '#FFF3CD', color: '#856404', padding: '0 4px', borderRadius: 3, marginLeft: 4 }}>自定义</span>}
                          </span>
                          <span style={{ width: 70, fontSize: 10, color: '#999', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subgroupName}</span>
                          {editable ? (
                            <>
                              <select
                                name={`item-category-${item.id}`}
                                value={catId}
                                onChange={e => setItemCat(item.id, 'category_id', e.target.value)}
                                style={{ fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #ddd', maxWidth: 90 }}
                              >
                                <option value="">--</option>
                                {budgetCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <select
                                name={`item-subcategory-${item.id}`}
                                value={subCatId}
                                onChange={e => setItemCat(item.id, 'sub_category_id', e.target.value)}
                                style={{ fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #ddd', maxWidth: 90 }}
                              >
                                <option value="">--</option>
                                {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </>
                          ) : (
                            <>
                              <span style={{ width: 90, fontSize: 10, color: '#bbb', textAlign: 'center' }}>
                                {budgetCategories.find(c => c.id === catId)?.name || '--'}
                              </span>
                              <span style={{ width: 90, fontSize: 10, color: '#bbb', textAlign: 'center' }}>
                                {subs.find(s => s.id === subCatId)?.name || '--'}
                              </span>
                              <span style={{ fontSize: 9, color: '#ccc' }} title="仅管理员可修改种子物品分类">🔒</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Save bar */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
            <button
              className="btn btn-primary"
              disabled={dirtyCount === 0 || catSaving}
              onClick={handleSaveCategories}
            >
              {catSaving ? '保存中...' : `保存修改 (${dirtyCount})`}
            </button>
            {dirtyCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setCatDirty({})}>撤销全部修改</button>
            )}
            {catMsg && (
              <span style={{ fontSize: 12, color: catMsg.type === 'success' ? '#48bb78' : '#e45b3f' }}>
                {catMsg.text}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <AppShell currentPage="account">
      <div className="placeholder-page">
        {/* Page Header */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-bd" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/account')}
                style={{ padding: '4px 8px' }}
              >
                ← 返回
              </button>
              <h2 style={{ margin: 0, fontSize: 18 }}>📂 分类管理</h2>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-bd" style={{ padding: '8px 16px' }}>
            <div style={{ display: 'flex', gap: 4, background: '#f5f5f5', borderRadius: 8, padding: 4 }}>
              <button
                onClick={() => setActiveTab('expense')}
                style={{
                  flex: 1, padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
                  background: activeTab === 'expense' ? '#fff' : 'transparent',
                  color: activeTab === 'expense' ? '#333' : '#666',
                  boxShadow: activeTab === 'expense' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                💰 账单子分类
              </button>
              <button
                onClick={() => setActiveTab('purchase')}
                style={{
                  flex: 1, padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
                  background: activeTab === 'purchase' ? '#fff' : 'transparent',
                  color: activeTab === 'purchase' ? '#333' : '#666',
                  boxShadow: activeTab === 'purchase' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                📦 采购物品分类
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="card">
          <div className="card-bd" style={{ padding: '16px' }}>
            {activeTab === 'expense' ? renderExpenseSubCategoryManager() : renderPurchaseCategoryManager()}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default CategoryManagePage;

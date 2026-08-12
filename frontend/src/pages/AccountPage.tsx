import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useStore, exportAllData, importAllData, resetAllData } from '../data/store';
import { useAuth } from '../api/useAuth';
import { isAuthenticated } from '../api/client';
import { batchUpdateCategories } from '../api/purchase';
import type { BatchCategoryItem } from '../api/purchase';
import { IconDownload, IconUpload, IconTrash, IconTools } from '../components/common/Icons';

const AccountPage: React.FC = () => {
  const state = useStore();
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const project = state.projects.find(p => p.id === state.activeProjectId);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Category editor state
  const [catEditorOpen, setCatEditorOpen] = useState(false);
  const [catDirty, setCatDirty] = useState<Record<string, { category_id: string; sub_category_id: string }>>({});
  const [catMsg, setCatMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [catExpandedStages, setCatExpandedStages] = useState<Set<string>>(new Set());

  const isAdmin = user?.is_admin === true;
  const budgetCategories = state.budget.categories;
  const expenseSubCategories = state.expenseSubCategories;

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

  // Get effective category for an item (dirty value or original)
  const getItemCat = (itemId: string, field: 'category_id' | 'sub_category_id') => {
    if (catDirty[itemId]) return catDirty[itemId][field];
    const item = allPurchaseItems.find(i => i.id === itemId);
    return item ? (item[field] || '') : '';
  };

  // Check if item is editable by current user
  const canEdit = (itemId: string) => {
    if (isAdmin) return true;
    return allPurchaseItems.find(i => i.id === itemId)?.isCustom === true;
  };

  // Set dirty category for an item
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
      // Reload purchase references to reflect changes
      const { loadPurchaseReferencesFromBackend } = await import('../data/store');
      await loadPurchaseReferencesFromBackend();
    } catch (e: any) {
      setCatMsg({ type: 'error', text: `❌ 保存失败：${e?.message || '请先登录'}` });
    } finally {
      setCatSaving(false);
    }
  };

  const handleExport = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `装修手记_全部数据_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportMsg({ type: 'success', text: '数据已导出' });
    setTimeout(() => setImportMsg(null), 2000);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const ok = importAllData(text);
        if (ok) {
          setImportMsg({ type: 'success', text: '导入成功，页面刷新中' });
          setTimeout(() => window.location.reload(), 1000);
        } else {
          setImportMsg({ type: 'error', text: '数据格式不正确' });
        }
      } catch {
        setImportMsg({ type: 'error', text: '文件读取失败' });
      }
    };
    input.click();
  };

  const handleReset = () => {
    resetAllData();
    setShowResetConfirm(false);
    setImportMsg({ type: 'success', text: '已重置，页面刷新中' });
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <AppShell currentPage="account">
      <div className="placeholder-page">
        {/* Auth Status Card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-bd" style={{ padding: 24 }}>
            {isLoggedIn && user ? (
              <div style={{ textAlign: 'center' }}>
                <div className="empty-state-icon" style={{ fontSize: 48 }}>👤</div>
                <p className="empty-state-title" style={{ marginBottom: 4 }}>
                  {user.username}
                  {user.is_admin && (
                    <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: 11 }}>👑 管理员</span>
                  )}
                </p>
                <p className="empty-state-desc" style={{ marginBottom: 16 }}>
                  {user.email}<br />
                  {user.is_admin ? '✅ 管理员账号 — 可编辑所有知识文章' : '👤 普通账号 — 仅可查看文章'}<br />
                  注册时间：{new Date(user.created_at).toLocaleDateString('zh-CN')}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="btn btn-outline" onClick={handleLogout}>
                    退出登录
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="empty-state-icon" style={{ fontSize: 48 }}>🔐</div>
                <p className="empty-state-title">未登录</p>
                <p className="empty-state-desc" style={{ marginBottom: 16 }}>
                  登录后可将数据同步到云端，与账号关联。<br />
                  未登录时数据仅保存在本地浏览器。
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Link to="/login" className="btn btn-primary">登录</Link>
                  <Link to="/register" className="btn btn-outline">注册</Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Project Info Card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-bd" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>📋 项目信息</h3>
            <p className="empty-state-desc" style={{ margin: 0, textAlign: 'left' }}>
              当前项目：{project?.name || '未选择'}<br />
              项目ID：{state.activeProjectId}<br />
              记账总数：{state.expenses.length} 笔<br />
              预算总额：¥{state.budget.total.toLocaleString('zh-CN')}
            </p>
          </div>
        </div>

        {/* Category Editor Card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>📦 采购物品分类管理</h3>
            {!catEditorOpen ? (
              <button className="btn btn-primary btn-sm" onClick={() => setCatEditorOpen(true)}>
                打开编辑器
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setCatEditorOpen(false)}>
                收起
              </button>
            )}
          </div>
          {catEditorOpen && (
            <div className="card-bd" style={{ padding: '8px 16px 16px' }}>
              <p className="card-subtitle" style={{ marginBottom: 12, fontSize: 12 }}>
                {isAdmin
                  ? '👑 管理员 — 可修改所有物品的分类'
                  : '👤 普通用户 — 仅可修改自己添加的物品分类（橙色高亮），种子物品只读'}
                · 选择分类后点击底部「保存修改」按钮生效。
              </p>

              {allPurchaseItems.length === 0 ? (
                <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 20 }}>暂无采购物品数据</p>
              ) : (
                <>
                  {/* Stage headers */}
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
          )}
        </div>

        {/* Tools Entry Card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <Link to="/tools" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 20, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-light, #EEF2FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <IconTools size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 2px', fontSize: 15 }}>🛠️ 工具箱</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>辅助计算与实用工具</p>
            </div>
            <span style={{ fontSize: 18, color: 'var(--color-text-muted)' }}>→</span>
          </Link>
        </div>

        {/* Data Management Card */}
        <div className="card">
          <div className="card-hd"><h3>💾 数据管理</h3></div>
          <div className="card-bd">
            <p className="card-subtitle" style={{ marginBottom: 12 }}>
              {isAuthenticated()
                ? '✅ 已登录 — 数据自动同步到云端，与账号关联'
                : '📱 离线模式 — 数据仅保存在本地浏览器'
              }
              <br />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                本地存储键：xiaozhuangjia_state_v1 · 更新时间：{new Date().toLocaleString('zh-CN')}
              </span>
            </p>
            <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>所有数据保存在浏览器本地存储中。建议定期导出备份。</p>
            <div className="backup-actions">
              <button className="btn btn-outline" onClick={handleExport}><IconDownload size={16} /> 导出全部数据</button>
              <button className="btn btn-outline" onClick={handleImport}><IconUpload size={16} /> 导入数据</button>
              {!showResetConfirm ? (
                <button className="btn btn-outline" style={{ color: '#EF4444', borderColor: '#FECACA' }} onClick={() => setShowResetConfirm(true)}><IconTrash size={16} /> 重置所有数据</button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>确定重置？不可恢复。</span>
                  <button className="btn btn-sm" style={{ background: '#EF4444', color: '#fff' }} onClick={handleReset}>确认</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowResetConfirm(false)}>取消</button>
                </div>
              )}
            </div>
            {importMsg && <div className={`backup-msg ${importMsg.type}`} style={{ marginTop: 10 }}>{importMsg.text}</div>}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default AccountPage;

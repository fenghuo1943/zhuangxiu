import React, { useState, useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  useStore, togglePurchaseRef, addCustomPurchaseItem,
  deletePurchaseRefItem, updatePurchaseRefQty,
} from '../data/store';
import {
  IconShopping, IconSearch, IconPlus, IconTrash, IconCheck,
  IconChevronDown, IconX,
} from '../components/common/Icons';

const PurchasePage: React.FC = () => {
  const state = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set(state.purchaseReferences.map(p => p.parent)));
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [quickName, setQuickName] = useState('');
  const [quickStage, setQuickStage] = useState(state.purchaseReferences[0]?.parent || '');
  const [quickQty, setQuickQty] = useState('1');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filter by search
  const filteredRefs = useMemo(() => {
    if (!searchQuery.trim()) return state.purchaseReferences;
    const q = searchQuery.trim().toLowerCase();
    return state.purchaseReferences.map(stage => ({
      ...stage,
      subs: stage.subs.map(sub => ({
        ...sub,
        items: sub.items.filter(item =>
          item.name.toLowerCase().includes(q) || (item.spec && item.spec.toLowerCase().includes(q))
        ),
      })).filter(sub => sub.items.length > 0),
    })).filter(stage => stage.subs.length > 0);
  }, [state.purchaseReferences, searchQuery]);

  // Stats
  const totalItems = useMemo(() => {
    return state.purchaseReferences.reduce((sum, s) =>
      sum + s.subs.reduce((ss, sub) => ss + sub.items.length, 0), 0
    );
  }, [state.purchaseReferences]);

  const toggleParent = (parent: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parent)) next.delete(parent);
      else next.add(parent);
      return next;
    });
  };

  const toggleSub = (subKey: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      if (next.has(subKey)) next.delete(subKey);
      else next.add(subKey);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedParents(new Set(state.purchaseReferences.map(p => p.parent)));
    const allSubs: string[] = [];
    state.purchaseReferences.forEach(s => s.subs.forEach(sub => {
      allSubs.push(`${s.parent}__${sub.name}`);
    }));
    setExpandedSubs(new Set(allSubs));
  };

  const collapseAll = () => {
    setExpandedParents(new Set());
    setExpandedSubs(new Set());
  };

  const handleQuickAdd = () => {
    if (!quickName.trim() || !quickStage) return;
    addCustomPurchaseItem(quickName.trim(), quickStage, parseInt(quickQty) || 1);
    setQuickName('');
    setQuickQty('1');
  };

  const handleDelete = (itemId: string) => {
    deletePurchaseRefItem(itemId);
    setDeleteConfirm(null);
  };

  const isSelected = (itemId: string) => state.selectedPurchaseIds.includes(itemId);

  return (
    <AppShell currentPage="purchase">
      <div className="purchase-page">
        {/* Header */}
        <div className="purchase-header">
          <div className="purchase-header-content">
            <span className="eyebrow">
              <IconShopping size={14} /> 采购参考库
            </span>
            <h1>按阶段浏览参考物品，同步到待购清单</h1>
            <p>勾选后会同步到首页待购清单，您也可以在首页直接查看和管理已选物品。</p>
          </div>
          <div className="purchase-header-stats">
            <div className="flow-stat">
              <span className="flow-stat-label">参考物品总数</span>
              <b className="flow-stat-value">{totalItems}</b>
            </div>
            <div className="flow-stat">
              <span className="flow-stat-label">已选待购</span>
              <b className="flow-stat-value" style={{ color: 'var(--fresh-coral)' }}>{state.selectedPurchaseIds.length}</b>
            </div>
            <div className="flow-stat">
              <a href="/" className="more-link">去首页查看待购清单 →</a>
            </div>
          </div>
        </div>

        {/* Search & Quick Add */}
        <div className="purchase-toolbar">
          <div className="purchase-search">
            <IconSearch size={14} />
            <input
              className="input"
              placeholder="搜索材料名称..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 32, width: 220 }}
            />
            {searchQuery && (
              <button className="icon-btn" onClick={() => setSearchQuery('')}>
                <IconX size={14} />
              </button>
            )}
          </div>
          <div className="purchase-quick-add">
            <input
              className="input"
              placeholder="自定义物品名称"
              value={quickName}
              onChange={e => setQuickName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
              style={{ width: 150 }}
            />
            <select className="input" value={quickStage} onChange={e => setQuickStage(e.target.value)}>
              {state.purchaseReferences.map(s => (
                <option key={s.parent} value={s.parent}>{s.parent}</option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min="1"
              value={quickQty}
              onChange={e => setQuickQty(e.target.value)}
              style={{ width: 60 }}
              title="数量"
            />
            <button className="btn btn-primary btn-sm" onClick={handleQuickAdd} disabled={!quickName.trim()}>
              <IconPlus size={14} /> 添加
            </button>
          </div>
          <div className="purchase-actions">
            <button className="btn btn-ghost btn-sm" onClick={expandAll}>全部展开</button>
            <button className="btn btn-ghost btn-sm" onClick={collapseAll}>全部折叠</button>
          </div>
        </div>

        {/* Results count for search */}
        {searchQuery && (
          <div className="purchase-search-result">
            <span>搜索 "{searchQuery}" 的结果</span>
          </div>
        )}

        {/* Stage Accordion */}
        {filteredRefs.length === 0 ? (
          <div className="card">
            <div className="card-bd">
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <p className="empty-state-title">暂无符合条件的参考材料</p>
                <p className="empty-state-desc">尝试其他关键词，或添加自定义物品</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="purchase-accordion">
            {filteredRefs.map(stage => {
              const isParentOpen = expandedParents.has(stage.parent);
              const stageTotal = stage.subs.reduce((sum, sub) => sum + sub.items.length, 0);
              const stageSelected = stage.subs.reduce((sum, sub) =>
                sum + sub.items.filter(i => isSelected(i.id)).length, 0
              );
              return (
                <div key={stage.parent} className={`purchase-stage ${isParentOpen ? 'open' : ''}`}>
                  <div
                    className="purchase-stage-header"
                    onClick={() => toggleParent(stage.parent)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isParentOpen}
                  >
                    <div className="purchase-stage-header-left">
                      <span className="purchase-stage-chevron">
                        <IconChevronDown size={18} />
                      </span>
                      <strong>{stage.parent}</strong>
                      <span className="badge badge-default">{stageSelected}/{stageTotal} 已选</span>
                    </div>
                  </div>
                  {isParentOpen && (
                    <div className="purchase-stage-body">
                      {stage.subs.map(sub => {
                        const subKey = `${stage.parent}__${sub.name}`;
                        const isSubOpen = expandedSubs.has(subKey);
                        return (
                          <div key={subKey} className={`purchase-subgroup ${isSubOpen ? 'open' : ''}`}>
                            <div
                              className="purchase-subgroup-header"
                              onClick={() => toggleSub(subKey)}
                              role="button"
                              tabIndex={0}
                            >
                              <span className="purchase-stage-chevron small">
                                <IconChevronDown size={14} />
                              </span>
                              <span>{sub.name}</span>
                              <span className="badge badge-default">{sub.items.length} 项</span>
                            </div>
                            {isSubOpen && (
                              <div className="purchase-items">
                                {sub.items.map(item => (
                                  <div
                                    key={item.id}
                                    className={`purchase-item-row ${isSelected(item.id) ? 'selected' : ''}`}
                                  >
                                    <label className="purchase-item-check">
                                      <input
                                        type="checkbox"
                                        checked={isSelected(item.id)}
                                        onChange={() => togglePurchaseRef(item.id)}
                                      />
                                    </label>
                                    <div className="purchase-item-info">
                                      <span className="purchase-item-name">{item.name}</span>
                                      {item.spec && <span className="purchase-item-spec">{item.spec}</span>}
                                    </div>
                                    <div className="purchase-item-right">
                                      <input
                                        className="input"
                                        type="number"
                                        min="1"
                                        value={item.qty}
                                        onChange={e => updatePurchaseRefQty(item.id, parseInt(e.target.value) || 1)}
                                        style={{ width: 54, textAlign: 'center', padding: '3px 4px', fontSize: 12 }}
                                      />
                                      <span className="purchase-item-unit">{item.unit || '个'}</span>
                                      <span className={`badge ${isSelected(item.id) ? 'badge-success' : 'badge-default'}`}>
                                        {isSelected(item.id) ? '已选' : '参考'}
                                      </span>
                                      {deleteConfirm === item.id ? (
                                        <span className="purchase-delete-confirm">
                                          <button className="btn btn-sm" style={{ color: '#EF4444', fontSize: 10, padding: '2px 6px' }} onClick={() => handleDelete(item.id)}>
                                            确认删除
                                          </button>
                                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setDeleteConfirm(null)}>
                                            取消
                                          </button>
                                        </span>
                                      ) : (
                                        <button className="fresh-icon-btn" title="删除" onClick={() => setDeleteConfirm(item.id)}>
                                          <IconTrash size={13} />
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default PurchasePage;

import React, { useState, useMemo, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  useStore, togglePurchaseRef, addCustomPurchaseItem,
  deletePurchaseRefItem, updatePurchaseRefQty, isItemPurchased,
  togglePurchased, toggleModelSync, getBestQuotePrice, updatePurchaseRefItem,
} from '../data/store';
import type { PurchaseReferenceStage, PurchaseReferenceSubgroup, PurchaseReferenceItem } from '../data/types';

// ── Stage icon config ──────────────────────────────────────────────
const STAGE_ICONS: Record<number, { id: string; tone: string }> = {
  0: { id: 'prep', tone: '' },
  1: { id: 'bolt', tone: 'tone-blue' },
  2: { id: 'grid', tone: 'tone-amber' },
  3: { id: 'hammer', tone: 'tone-green' },
  4: { id: 'paint', tone: '' },
  5: { id: 'package', tone: 'tone-blue' },
  6: { id: 'sofa', tone: 'tone-green' },
};

// ── Inline SVG icons (matching reference HTML) ─────────────────────

const IconCart = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5h2l1.5 9h8.8l1.5-6.5H8"/><circle cx="10" cy="18.5" r="1"/><circle cx="17" cy="18.5" r="1"/>
  </svg>
);

const IconChevron = ({ size = 16, open }: { size?: number; open?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
    <path d="m9 6 6 6-6 6"/>
  </svg>
);

const IconPrep = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h5M8.5 18h4"/>
  </svg>
);

const IconBolt = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="m13 2-8 12h7l-1 8 8-12h-7z"/>
  </svg>
);

const IconGrid = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/>
  </svg>
);

const IconHammer = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="m14 5 5 5M12.5 6.5l3-3 5 5-3 3M13 9 5.5 20.5l-2-2L15 7"/>
  </svg>
);

const IconPaint = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h12v6H4zM8 11v3h5v7M13 21h3"/>
  </svg>
);

const IconPackage = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 7 8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10M8 5l8 4"/>
  </svg>
);

const IconSofa = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 12V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4M4 11a2 2 0 0 0-2 2v5h20v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-2-2zM5 18v2M19 18v2"/>
  </svg>
);

const stageIconComponents: Record<string, React.FC<{ size?: number }>> = {
  prep: IconPrep, bolt: IconBolt, grid: IconGrid, hammer: IconHammer,
  paint: IconPaint, package: IconPackage, sofa: IconSofa,
};

const PurchasePage: React.FC = () => {
  const state = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  // Quick-add state
  const [quickName, setQuickName] = useState('');
  const [quickStage, setQuickStage] = useState('0_0');
  const [quickQty, setQuickQty] = useState('1');

  // Shopping card
  const [shoppingListView, setShoppingListView] = useState<'pending' | 'purchased'>('pending');
  const [editingShoppingId, setEditingShoppingId] = useState<string | null>(null);
  const [editShoppingName, setEditShoppingName] = useState('');
  const [editShoppingSpec, setEditShoppingSpec] = useState('');
  const [editShoppingQty, setEditShoppingQty] = useState('');

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 1600);
  }, []);

  // ── Stats ──
  const { totalItems, selectedItems } = useMemo(() => {
    let total = 0, selected = 0;
    state.purchaseReferences.forEach(s =>
      s.subs.forEach(sub => sub.items.forEach(it => {
        total++;
        if (state.selectedPurchaseIds.includes(it.id)) selected++;
      }))
    );
    return { totalItems: total, selectedItems: selected };
  }, [state.purchaseReferences, state.selectedPurchaseIds]);

  // ── Filtered data for search ──
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

  // ── Search result matches count ──
  const searchMatchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    return filteredRefs.reduce((sum, s) =>
      sum + s.subs.reduce((ss, sub) => ss + sub.items.length, 0), 0
    );
  }, [filteredRefs, searchQuery]);

  // ── Shopping list data ──
  const shoppingItems = useMemo(() => {
    const items: { itemId: string; name: string; spec?: string; qty: number; unit?: string; stageParent: string }[] = [];
    state.purchaseReferences.forEach(stage => {
      stage.subs.forEach(sub => {
        sub.items.forEach(item => {
          if (state.selectedPurchaseIds.includes(item.id)) {
            items.push({
              itemId: item.id,
              name: item.name,
              spec: item.spec,
              qty: item.qty,
              unit: item.unit,
              stageParent: stage.parent,
            });
          }
        });
      });
    });
    return items;
  }, [state.purchaseReferences, state.selectedPurchaseIds]);

  const syncedPriceModels = useMemo(() => {
    const models: { modelId: string; modelName: string; spec?: string; catName: string; price?: number; channel?: string; note?: string }[] = [];
    state.priceCategories.forEach(cat => {
      cat.models.forEach(model => {
        if (state.syncedModelIds.includes(model.id)) {
          const bestPrice = getBestQuotePrice(model.id);
          const bestQuoteId = state.bestQuoteIds[model.id];
          const bestQuote = bestQuoteId ? model.channelQuotes.find(q => q.id === bestQuoteId) : null;
          models.push({
            modelId: model.id,
            modelName: model.name,
            spec: model.spec,
            catName: cat.name,
            price: bestPrice ?? undefined,
            channel: bestQuote?.channel,
            note: model.note,
          });
        }
      });
    });
    return models;
  }, [state.priceCategories, state.syncedModelIds, state.bestQuoteIds]);

  // Match synced models to shopping items by name (for price display)
  const shoppingItemsWithPrice = useMemo(() => {
    return shoppingItems.map(item => {
      // Try to find a matching synced model by name
      const match = syncedPriceModels.find(m =>
        m.modelName === item.name ||
        m.catName === item.name ||
        m.modelName.includes(item.name) ||
        item.name.includes(m.modelName)
      );
      return { ...item, matchedPrice: match?.price, matchedChannel: match?.channel, matchedModelId: match?.modelId };
    });
  }, [shoppingItems, syncedPriceModels]);

  // Unmatched synced models (no corresponding shopping item)
  const unmatchedSyncedModels = useMemo(() => {
    return syncedPriceModels.filter(m =>
      !shoppingItems.some(item =>
        m.modelName === item.name ||
        m.catName === item.name ||
        m.modelName.includes(item.name) ||
        item.name.includes(m.modelName)
      )
    );
  }, [syncedPriceModels, shoppingItems]);

  const totalEstimatedCost = useMemo(() => {
    let total = 0;
    shoppingItemsWithPrice.forEach(item => {
      if (item.matchedPrice) {
        total += item.matchedPrice * item.qty;
      }
    });
    unmatchedSyncedModels.forEach(m => {
      if (m.price) total += m.price;
    });
    return total;
  }, [shoppingItemsWithPrice, unmatchedSyncedModels]);

  // Separate cost for pending vs purchased
  const pendingCost = useMemo(() => {
    let total = 0;
    shoppingItemsWithPrice.forEach(item => {
      if (!state.purchasedItemIds.includes(item.itemId) && item.matchedPrice) {
        total += item.matchedPrice * item.qty;
      }
    });
    unmatchedSyncedModels.forEach(m => {
      if (m.price) total += m.price;
    });
    return total;
  }, [shoppingItemsWithPrice, unmatchedSyncedModels, state.purchasedItemIds]);

  const purchasedCost = useMemo(() => {
    let total = 0;
    shoppingItemsWithPrice.forEach(item => {
      if (state.purchasedItemIds.includes(item.itemId) && item.matchedPrice) {
        total += item.matchedPrice * item.qty;
      }
    });
    return total;
  }, [shoppingItemsWithPrice, state.purchasedItemIds]);

  const displayCost = shoppingListView === 'pending' ? pendingCost : purchasedCost;

  const totalShoppingCount = shoppingItems.length + unmatchedSyncedModels.length;
  const pendingShoppingCount = shoppingItems.filter(it => !isItemPurchased(it.itemId)).length;
  const purchasedShoppingCount = shoppingItems.filter(it => isItemPurchased(it.itemId)).length;

  // ── Toggle functions ──
  const toggleParent = (pi: number) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(pi)) next.delete(pi); else next.add(pi);
      return next;
    });
  };

  const toggleSub = (key: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const allParents = new Set(state.purchaseReferences.map((_, i) => i));
    const allSubs = new Set<string>();
    state.purchaseReferences.forEach((s, pi) =>
      s.subs.forEach((_, si) => allSubs.add(`${pi}_${si}`))
    );
    setExpandedParents(allParents);
    setExpandedSubs(allSubs);
  };

  const collapseAll = () => {
    setExpandedParents(new Set());
    setExpandedSubs(new Set());
  };

  // ── Item actions ──
  const handleToggle = (itemId: string) => {
    togglePurchaseRef(itemId);
    const isNowSelected = !state.selectedPurchaseIds.includes(itemId);
    showToast(isNowSelected ? '已加入首页待购清单' : '已从待购清单移除');
  };

  const handleQtyChange = (itemId: string, val: string) => {
    updatePurchaseRefQty(itemId, Math.max(0, parseInt(val) || 0));
  };

  const handleDelete = (itemId: string, itemName: string) => {
    if (!window.confirm(`确定从采购库删除「${itemName}」？`)) return;
    deletePurchaseRefItem(itemId);
    showToast('已从采购库删除');
  };

  // ── Quick-add ──
  const handleQuickAdd = () => {
    if (!quickName.trim()) return;
    const [pi, si] = quickStage.split('_').map(Number);
    const stage = state.purchaseReferences[pi];
    const sub = stage?.subs[si];
    if (!stage || !sub) return;
    addCustomPurchaseItem(
      quickName.trim(), stage.parent,
      Math.max(1, parseInt(quickQty) || 1),
      '', sub.name, '个'
    );
    setQuickName('');
    setQuickQty('1');
    // Auto-expand target
    setExpandedParents(prev => new Set(prev).add(pi));
    setExpandedSubs(prev => new Set(prev).add(`${pi}_${si}`));
    showToast('已添加到首页待购清单');
  };

  // ── Custom add within subgroup ──
  const [customInputs, setCustomInputs] = useState<Record<string, { name: string; spec: string; qty: string }>>({});
  const getCustomInput = (key: string) =>
    customInputs[key] || { name: '', spec: '', qty: '1' };
  const setCustomInput = (key: string, field: string, value: string) => {
    setCustomInputs(prev => ({
      ...prev,
      [key]: { ...getCustomInput(key), [field]: value },
    }));
  };

  const handleCustomAdd = (pi: number, si: number) => {
    const key = `${pi}_${si}`;
    const input = getCustomInput(key);
    if (!input.name.trim()) return;
    const stage = state.purchaseReferences[pi];
    const sub = stage?.subs[si];
    if (!stage || !sub) return;
    addCustomPurchaseItem(
      input.name.trim(), stage.parent,
      Math.max(1, parseInt(input.qty) || 1),
      input.spec.trim(), sub.name, '个'
    );
    setCustomInput(key, 'name', '');
    setCustomInput(key, 'spec', '');
    setCustomInput(key, 'qty', '1');
    showToast('已添加到首页待购清单');
  };

  // ── Quick-stage options ──
  const quickStageOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    state.purchaseReferences.forEach((stage, pi) => {
      stage.subs.forEach((sub, si) => {
        options.push({
          value: `${pi}_${si}`,
          label: `${stage.parent} / ${sub.name}`,
        });
      });
    });
    return options;
  }, [state.purchaseReferences]);

  const isSelected = (itemId: string) => state.selectedPurchaseIds.includes(itemId);

  return (
    <AppShell currentPage="purchase">
      <div className="purchase-page-v2">
        {/* ── Page title ── */}
        <div className="purchase-page-title-row">
          <span className="purchase-stage-icon">
            <IconCart size={20} />
          </span>
          <h1>采购参考库</h1>
        </div>
        <p className="purchase-subtitle">按装修阶段整理需要采购的物品，勾选后自动同步到首页待购清单。</p>

        {/* ── Tip ── */}
        <div className="purchase-tip">
          <strong>使用方法：</strong>浏览各阶段物品参考，勾选你需要购买的项目，主页会同步显示待购状态。
        </div>

        {/* ── Summary bar ── */}
        <div className="purchase-summary">
          <div className="purchase-summary-left">
            <div className="purchase-summary-item">
              <div className="purchase-summary-value" style={{ color: '#e45b3f' }}>{totalItems}</div>
              <div className="purchase-summary-label">参考物品</div>
            </div>
            <div className="purchase-summary-item">
              <div className="purchase-summary-value" style={{ color: '#48bb78' }}>{selectedItems}</div>
              <div className="purchase-summary-label">已选待购</div>
            </div>
            <div className="purchase-summary-item">
              <div className="purchase-summary-value" style={{ color: '#e45b3f' }}>{pendingShoppingCount}</div>
              <div className="purchase-summary-label">当前待购</div>
            </div>
            <div className="purchase-summary-item">
              <div className="purchase-summary-value" style={{ color: '#999' }}>{purchasedShoppingCount}</div>
              <div className="purchase-summary-label">当前已购</div>
            </div>
          </div>
        </div>

        {/* ── 待购清单卡片 ── */}
        <div className="purchase-shopping-card">
          <div className="purchase-shopping-hd">
            <div className="purchase-shopping-hd-left">
              <span className="purchase-shopping-icon">🛒</span>
              <div>
                <h2 className="purchase-shopping-title">我的待购清单</h2>
                <span className="purchase-shopping-sub">
                  {totalShoppingCount > 0
                    ? `${pendingShoppingCount} 待购 / ${purchasedShoppingCount} 已购`
                    : '暂无待购物品'}
                </span>
              </div>
            </div>
            <div className="purchase-shopping-hd-center">
              <div className="purchase-shopping-toggle">
                <button
                  type="button"
                  className={`purchase-shopping-toggle-btn${shoppingListView === 'pending' ? ' active' : ''}`}
                  onClick={() => setShoppingListView('pending')}
                >
                  待购{pendingShoppingCount > 0 ? ` (${pendingShoppingCount})` : ''}
                </button>
                <button
                  type="button"
                  className={`purchase-shopping-toggle-btn${shoppingListView === 'purchased' ? ' active' : ''}`}
                  onClick={() => setShoppingListView('purchased')}
                >
                  已购{purchasedShoppingCount > 0 ? ` (${purchasedShoppingCount})` : ''}
                </button>
              </div>
            </div>
            <div className="purchase-shopping-hd-right">
              {displayCost > 0 && (
                <span className="purchase-shopping-total">
                  {shoppingListView === 'pending' ? '预估总计' : '已购总计'} <strong>¥{displayCost.toLocaleString()}</strong>
                </span>
              )}
              <a href="/compare" className="purchase-shopping-link">去比价 →</a>
            </div>
          </div>

          <div className="purchase-shopping-bd">
            {totalShoppingCount === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>📋</div>
                <div style={{ fontSize: 13 }}>在下方采购参考库中勾选物品，即可加入待购清单</div>
              </div>
            ) : (
              <>
                {/* Selected items from purchase references */}
                {shoppingItems.length > 0 && (
                  <div className="purchase-shopping-section">
                    {(() => {
                      // Group by stage, filter by current view
                      const grouped = new Map<string, typeof shoppingItemsWithPrice>();
                      const displayItems = shoppingListView === 'pending'
                        ? shoppingItemsWithPrice.filter(it => !isItemPurchased(it.itemId))
                        : shoppingItemsWithPrice.filter(it => isItemPurchased(it.itemId));
                      displayItems.forEach(item => {
                        const list = grouped.get(item.stageParent) || [];
                        list.push(item);
                        grouped.set(item.stageParent, list);
                      });
                      if (displayItems.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: '#999' }}>
                            {shoppingListView === 'pending' ? (
                              <>
                                🎉 全部已购！
                                {purchasedShoppingCount > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ marginLeft: 8 }}
                                    onClick={() => setShoppingListView('purchased')}
                                  >查看已购</button>
                                )}
                              </>
                            ) : (
                              <>
                                📦 暂无已购物品
                                {pendingShoppingCount > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ marginLeft: 8 }}
                                    onClick={() => setShoppingListView('pending')}
                                  >返回待购</button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      }
                      return Array.from(grouped.entries()).map(([stageName, items]) => (
                        <div key={stageName} className="purchase-shopping-group">
                          <div className="purchase-shopping-group-label">{stageName}</div>
                          {items.map(item => {
                            const purchased = isItemPurchased(item.itemId);
                            const isEditing = editingShoppingId === item.itemId;
                            return (
                              <div key={item.itemId} className={`purchase-shopping-row${purchased ? ' purchased' : ''}${isEditing ? ' editing' : ''}`}>
                                {isEditing ? (
                                  <div className="purchase-shopping-edit-row" onClick={e => e.stopPropagation()}>
                                    <input
                                      className="input"
                                      value={editShoppingName}
                                      onChange={e => setEditShoppingName(e.target.value)}
                                      placeholder="名称"
                                      style={{ width: 100, fontSize: 12, padding: '3px 6px' }}
                                    />
                                    <input
                                      className="input"
                                      value={editShoppingSpec}
                                      onChange={e => setEditShoppingSpec(e.target.value)}
                                      placeholder="规格"
                                      style={{ width: 80, fontSize: 12, padding: '3px 6px' }}
                                    />
                                    <input
                                      className="input"
                                      type="number"
                                      min="1"
                                      value={editShoppingQty}
                                      onChange={e => setEditShoppingQty(e.target.value)}
                                      placeholder="数量"
                                      style={{ width: 56, fontSize: 12, padding: '3px 6px' }}
                                    />
                                    <button
                                      className="btn btn-primary btn-xs"
                                      onClick={() => {
                                        const newQty = Math.max(1, parseInt(editShoppingQty) || 1);
                                        updatePurchaseRefItem(item.itemId, {
                                          name: editShoppingName.trim() || item.name,
                                          spec: editShoppingSpec.trim(),
                                          qty: newQty,
                                        });
                                        setEditingShoppingId(null);
                                        showToast('已更新');
                                      }}
                                      style={{ fontSize: 10, padding: '3px 8px' }}
                                    >确定</button>
                                    <button
                                      className="btn btn-ghost btn-xs"
                                      onClick={() => setEditingShoppingId(null)}
                                      style={{ fontSize: 10, padding: '3px 8px' }}
                                    >取消</button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="purchase-shopping-row-info">
                                      <span className="purchase-shopping-row-name">
                                        {purchased && <span style={{ color: '#48bb78', marginRight: 4 }}>✓</span>}
                                        {item.name}
                                      </span>
                                      {item.spec && <span className="purchase-shopping-row-spec">{item.spec}</span>}
                                      <span className="purchase-shopping-row-qty">×{item.qty}{item.unit || '个'}</span>
                                      {item.matchedPrice && (
                                        <span className="purchase-shopping-row-price">
                                          ¥{item.matchedPrice.toLocaleString()}
                                          {item.matchedChannel && <span className="purchase-shopping-row-channel"> ({item.matchedChannel})</span>}
                                        </span>
                                      )}
                                    </div>
                                    <div className="purchase-shopping-row-actions">
                                      <button
                                        className="fresh-icon-btn"
                                        title="编辑"
                                        onClick={() => {
                                          setEditingShoppingId(item.itemId);
                                          setEditShoppingName(item.name);
                                          setEditShoppingSpec(item.spec || '');
                                          setEditShoppingQty(String(item.qty));
                                        }}
                                      >
                                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                      </button>
                                      {!purchased ? (
                                        <button
                                          className="fresh-icon-btn"
                                          title="标记已购买"
                                          onClick={() => {
                                            togglePurchased(item.itemId);
                                            showToast('已标记为购买');
                                          }}
                                        >
                                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                                        </button>
                                      ) : (
                                        <button
                                          className="fresh-icon-btn"
                                          title="取消已购"
                                          style={{ color: '#e45b3f' }}
                                          onClick={() => {
                                            togglePurchased(item.itemId);
                                            showToast('已取消已购标记');
                                          }}
                                        >
                                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                                        </button>
                                      )}
                                      <button
                                        className="fresh-icon-btn"
                                        title="移出清单"
                                        onClick={() => handleToggle(item.itemId)}
                                  >
                                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
                                  </button>
                                </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* Unmatched synced models from compare page — only in pending view */}
                {shoppingListView === 'pending' && unmatchedSyncedModels.length > 0 && (
                  <div className="purchase-shopping-section">
                    <div className="purchase-shopping-group-label" style={{ color: '#5c7fa8' }}>
                      📊 来自比价同步
                    </div>
                    {unmatchedSyncedModels.map(m => (
                      <div key={m.modelId} className="purchase-shopping-row">
                        <div className="purchase-shopping-row-info">
                          <span className="purchase-shopping-row-name">
                            <span style={{ color: '#5c7fa8', marginRight: 4 }}>⚡</span>
                            {m.modelName}
                          </span>
                          {m.spec && <span className="purchase-shopping-row-spec">{m.spec}</span>}
                          <span className="purchase-shopping-row-cat" style={{ fontSize: 11, color: '#999', background: '#f0f0f0', padding: '1px 6px', borderRadius: 3 }}>
                            {m.catName}
                          </span>
                          {m.price && (
                            <span className="purchase-shopping-row-price">
                              ¥{m.price.toLocaleString()}
                              {m.channel && <span className="purchase-shopping-row-channel"> ({m.channel})</span>}
                            </span>
                          )}
                        </div>
                        <div className="purchase-shopping-row-actions">
                          <button
                            className="fresh-icon-btn"
                            title="取消同步"
                            onClick={() => toggleModelSync(m.modelId)}
                          >
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Search ── */}
        <div style={{ marginBottom: 14 }}>
          <input
            className="input"
            type="text"
            placeholder="搜索材料名称..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', fontSize: 13 }}
          />
        </div>

        {/* ── Search results count ── */}
        {searchQuery.trim() && (
          <div style={{ fontSize: 12, color: '#666', marginBottom: 12, marginTop: -8 }}>
            找到 {searchMatchCount} 个结果
          </div>
        )}

        {/* ── Quick-add ── */}
        <div className="purchase-quick-add-v2">
          <input
            type="text"
            placeholder="直接添加待购物品，例如：浴室柜"
            value={quickName}
            onChange={e => setQuickName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
          />
          <select value={quickStage} onChange={e => setQuickStage(e.target.value)}>
            {quickStageOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={quickQty}
            onChange={e => setQuickQty(e.target.value)}
            placeholder="数量"
          />
          <button className="btn btn-primary" type="button" onClick={handleQuickAdd}>添加</button>
        </div>

        {/* ── Bulk actions ── */}
        <div className="purchase-bulk-actions">
          <button type="button" onClick={expandAll}>全部展开</button>
          <button type="button" onClick={collapseAll}>全部折叠</button>
        </div>

        {/* ── Stage cards ── */}
        <div className="purchase-cards">
          {filteredRefs.length === 0 && searchQuery.trim() ? (
            <div style={{ textAlign: 'center', color: '#999', padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
              <div>未找到相关材料</div>
            </div>
          ) : (
            filteredRefs.map((stage, pi) => {
              const iconCfg = STAGE_ICONS[pi] || { id: 'prep', tone: '' };
              const IconComp = stageIconComponents[iconCfg.id] || IconPrep;
              const isParentOpen = searchQuery.trim() ? true : expandedParents.has(pi);

              let pTotal = 0, pSelected = 0;
              stage.subs.forEach(sub => sub.items.forEach(it => {
                pTotal++;
                if (isSelected(it.id)) pSelected++;
              }));

              return (
                <div key={stage.parent} className="purchase-parent-card">
                  <div
                    className="purchase-parent-header"
                    onClick={() => !searchQuery.trim() && toggleParent(pi)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="purchase-parent-left">
                      <div className={`purchase-stage-icon ${iconCfg.tone}`}>
                        <IconComp size={18} />
                      </div>
                      <div className="purchase-parent-info">
                        <div className="purchase-parent-name">{stage.parent}</div>
                        <div className="purchase-parent-count">{pSelected}/{pTotal} 已选入待购</div>
                      </div>
                    </div>
                    <span className="purchase-arrow">
                      <IconChevron size={16} open={isParentOpen} />
                    </span>
                  </div>

                  {isParentOpen && (
                    <div className="purchase-parent-body">
                      {stage.subs.map((sub, si) => {
                        const subKey = `${pi}_${si}`;
                        const isSubOpen = searchQuery.trim() ? true : expandedSubs.has(subKey);
                        const sSelected = sub.items.filter(it => isSelected(it.id)).length;

                        return (
                          <div key={subKey} className="purchase-sub-card">
                            <div
                              className="purchase-sub-header"
                              onClick={() => !searchQuery.trim() && toggleSub(subKey)}
                              role="button"
                              tabIndex={0}
                            >
                              <div className="purchase-sub-left">
                                <span className="purchase-sub-dot" />
                                <span className="purchase-sub-name">{sub.name}</span>
                                <span className="purchase-sub-count">{sSelected}/{sub.items.length}</span>
                              </div>
                              <span className="purchase-arrow">
                                <IconChevron size={14} open={isSubOpen} />
                              </span>
                            </div>

                            {isSubOpen && (
                              <div className="purchase-sub-body">
                                {sub.items.map(item => (
                                  <div
                                    key={item.id}
                                    className={`purchase-ref-item ${isSelected(item.id) ? 'selected' : ''}`}
                                    onClick={(e) => {
                                      if ((e.target as HTMLElement).closest('input,button')) return;
                                      handleToggle(item.id);
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected(item.id)}
                                      onChange={() => handleToggle(item.id)}
                                      onClick={e => e.stopPropagation()}
                                    />
                                    <span className="purchase-ref-name">{item.name}</span>
                                    <span className="purchase-ref-spec">{item.spec || ''}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.qty}
                                      onChange={e => handleQtyChange(item.id, e.target.value)}
                                      onClick={e => e.stopPropagation()}
                                      className="purchase-ref-qty-input"
                                    />
                                    <span className="purchase-ref-unit">{item.unit || '个'}</span>
                                    <span className={`purchase-ref-tag ${isSelected(item.id) ? 'tag-selected' : 'tag-default'}`}>
                                      {isSelected(item.id) ? '已选' : '参考'}
                                    </span>
                                    {isItemPurchased(item.id) && (
                                      <span className="purchase-ref-tag tag-purchased">已购</span>
                                    )}
                                    <button
                                      type="button"
                                      className="purchase-ref-delete"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item.id, item.name);
                                      }}
                                    >
                                      删除
                                    </button>
                                  </div>
                                ))}

                                {/* ── Custom item add within subgroup ── */}
                                {!searchQuery.trim() && (
                                  <div className="purchase-add-custom">
                                    <input
                                      type="text"
                                      placeholder="自定义物品"
                                      value={getCustomInput(subKey).name}
                                      onChange={e => setCustomInput(subKey, 'name', e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCustomAdd(pi, si)}
                                    />
                                    <input
                                      type="text"
                                      placeholder="规格"
                                      value={getCustomInput(subKey).spec}
                                      onChange={e => setCustomInput(subKey, 'spec', e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCustomAdd(pi, si)}
                                      style={{ width: 80 }}
                                    />
                                    <input
                                      type="number"
                                      placeholder="数量"
                                      value={getCustomInput(subKey).qty}
                                      onChange={e => setCustomInput(subKey, 'qty', e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCustomAdd(pi, si)}
                                      style={{ width: 50 }}
                                    />
                                    <button className="btn btn-primary btn-sm" type="button" onClick={() => handleCustomAdd(pi, si)}>
                                      添加
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      <div
        className="purchase-toast"
        style={{
          display: toastVisible ? 'block' : 'none',
          opacity: toastVisible ? 1 : 0,
        }}
      >
        {toastMsg}
      </div>
    </AppShell>
  );
};

export default PurchasePage;

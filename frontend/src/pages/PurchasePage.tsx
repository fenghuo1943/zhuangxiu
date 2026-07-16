import React, { useState, useMemo, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  useStore, togglePurchaseRef, addCustomPurchaseItem,
  deletePurchaseRefItem, updatePurchaseRefQty, isItemPurchased,
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
          </div>
          <a className="purchase-go-link" href="/">去首页查看待购清单 →</a>
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

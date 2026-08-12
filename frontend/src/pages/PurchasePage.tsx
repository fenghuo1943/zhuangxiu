import React, { useState, useMemo, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  useStore, togglePurchaseRef, addCustomPurchaseItem,
  deletePurchaseRefItem, updatePurchaseRefQty, isItemPurchased,
  toggleModelSync, getBestQuotePrice, updatePurchaseRefItem,
  addPurchaseToCompare, isItemInComparison, getItemBestPrice,
  getItemBestChannel,
  checkPurchaseReadiness, purchaseItem, getPurchasedExpenseId, unpurchaseItem,
  getSelectedExpenseId, getItemPriceWithSource, updateItemPrice,
} from '../data/store';
import { DEFAULT_BUDGET_CATEGORIES } from '../data/mockData';
import type { PurchaseReferenceStage, PurchaseReferenceSubgroup, PurchaseReferenceItem } from '../data/types';
import { getItemCategory } from '../utils/categoryMapping';

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
  const [quickCategory, setQuickCategory] = useState('');
  const [quickSubCategory, setQuickSubCategory] = useState('');
  const [quickPrice, setQuickPrice] = useState('');

  // Shopping card
  const [shoppingListView, setShoppingListView] = useState<'pending' | 'purchased'>('pending');
  const [filterStage, setFilterStage] = useState('');
  const [filterSubgroup, setFilterSubgroup] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [editingShoppingId, setEditingShoppingId] = useState<string | null>(null);
  const [editShoppingName, setEditShoppingName] = useState('');
  const [editShoppingSpec, setEditShoppingSpec] = useState('');
  const [editShoppingQty, setEditShoppingQty] = useState('');

  // Price editing
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');

  // ── Purchase-with-expense modal state ──
  const [purchaseModal, setPurchaseModal] = useState<{
    itemId: string;
    itemName: string;
    itemSpec: string;
    needsPrice: boolean;
    needsCategory: boolean;
    existingPrice: number | null;
    existingCategoryId: string | null;
  } | null>(null);
  const [purchaseModalPrice, setPurchaseModalPrice] = useState('');
  const [purchaseModalCategory, setPurchaseModalCategory] = useState('');

  // ── Unpurchase confirmation modal ──
  const [unpurchaseModal, setUnpurchaseModal] = useState<{
    itemId: string;
    itemName: string;
    hasExpense: boolean;
  } | null>(null);

  // ── Remove-from-list modal (for purchased items with expense) ──
  const [removeModal, setRemoveModal] = useState<{
    itemId: string;
    itemName: string;
    isPurchased: boolean;
    hasExpense: boolean;
  } | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    const items: { itemId: string; name: string; spec?: string; qty: number; unit?: string; stageParent: string; subgroupName?: string }[] = [];
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
              subgroupName: sub.name,
            });
          }
        });
      });
    });
    return items;
  }, [state.purchaseReferences, state.selectedPurchaseIds]);

  // Filter helpers
  const stagesForFilter = state.purchaseReferences.map(s => s.parent);
  const filteredSubgroups = filterStage
    ? state.purchaseReferences.find(s => s.parent === filterStage)?.subs.map(sub => sub.name) || []
    : [];
  const filteredSubCategories = filterCategory
    ? state.expenseSubCategories.filter(s => s.categoryId === filterCategory)
    : [];

  // Filter shopping items by stage AND category
  const filteredShoppingItems = useMemo(() => {
    let items = shoppingItems;
    // Stage filter
    if (filterStage) {
      items = items.filter(item => {
        if (item.stageParent !== filterStage) return false;
        if (filterSubgroup && item.subgroupName !== filterSubgroup) return false;
        return true;
      });
    }
    // Category filter
    if (filterCategory) {
      items = items.filter(item => {
        const cat = getItemCategory(item);
        if (!cat) return false;
        if (cat.categoryId !== filterCategory) return false;
        if (filterSubCategory && cat.subCategoryId !== filterSubCategory) return false;
        return true;
      });
    }
    return items;
  }, [shoppingItems, filterStage, filterSubgroup, filterCategory, filterSubCategory]);

  const syncedPriceModels = useMemo(() => {
    const models: { modelId: string; modelName: string; spec?: string; catName: string; price?: number; channel?: string; note?: string; purchaseItemId?: string | null }[] = [];
    state.compareItems.forEach(item => {
      item.models.forEach(model => {
        if (state.syncedModelIds.includes(model.id)) {
          const bestPrice = getBestQuotePrice(model.id);
          const bestQuoteId = state.bestQuoteIds[model.id];
          const bestQuote = bestQuoteId ? (model.channelQuotes || []).find(q => q.id === bestQuoteId) : null;
          models.push({
            modelId: model.id,
            modelName: model.name,
            spec: model.spec,
            catName: item.item_name,
            price: bestPrice ?? undefined,
            channel: bestQuote?.channel,
            note: model.note,
            purchaseItemId: item.item_id,
          });
        }
      });
    });
    return models;
  }, [state.compareItems, state.syncedModelIds, state.bestQuoteIds]);

  // Match compare items to shopping items by FK (primary) or name (fallback)
  const shoppingItemsWithPrice = useMemo(() => {
    return filteredShoppingItems.map(item => {
      // First try FK-based lookup via compareItems
      const ci = state.compareItems.find(c => c.item_id === item.itemId);
      // Fallback: try name matching against all compareItems
      const matchedCi = ci || state.compareItems.find(c =>
        c.item_name === item.name ||
        c.item_name.includes(item.name) ||
        item.name.includes(c.item_name)
      );
      if (matchedCi) {
        let bestPrice: number | null = null;
        let bestChannel: string | undefined;
        let bestModelId: string | undefined;
        for (const model of matchedCi.models) {
          const bp = getBestQuotePrice(model.id);
          if (bp !== null && (bestPrice === null || bp < bestPrice)) {
            bestPrice = bp;
            const bestQuoteId = state.bestQuoteIds[model.id];
            if (bestQuoteId) {
              bestChannel = (model.channelQuotes || []).find(q => q.id === bestQuoteId)?.channel;
            }
            bestModelId = model.id;
          }
        }
        // Price source: expense takes priority over quote for display
        // 统一以总价显示：账单金额已是总价，报价需要 ×数量转换为总价
        const expenseId = state.selectedExpenseMap[item.itemId];
        const expPrice = expenseId ? state.expenses.find(e => e.id === expenseId)?.amount : undefined;
        const quoteTotalPrice = bestPrice != null ? bestPrice * item.qty : undefined;
        const displayPrice = expPrice ?? quoteTotalPrice ?? undefined;
        const priceSource: string = expPrice ? 'expense' : (bestPrice ? 'quote' : '');
        const priceSourceLabel = expPrice ? '待购预算' : (bestPrice ? '比价' : '');
        return { ...item, matchedPrice: displayPrice, matchedChannel: bestChannel, matchedModelId: bestModelId, hasComparison: true, comparisonItemId: matchedCi.item_id, expenseId, priceSource, priceSourceLabel };
      }

      // Fallback: try expense-based price (from selectedExpenseMap or purchasedExpenseMap)
      // 账单金额已是总价，直接使用
      const expId = state.selectedExpenseMap[item.itemId] || state.purchasedExpenseMap[item.itemId];
      if (expId) {
        const expense = state.expenses.find(e => e.id === expId);
        if (expense) {
          const label = expense.status === 'paid' || expense.status === 'prepaid' ? '实际支付' : '待购预算';
          return { ...item, matchedPrice: expense.amount, matchedChannel: undefined, matchedModelId: undefined, hasComparison: false, expenseId: expId, priceSource: 'expense', priceSourceLabel: label };
        }
      }

      // Last fallback: try fuzzy name matching via syncedPriceModels for backward compat
      const match = syncedPriceModels.find(m =>
        m.modelName === item.name ||
        m.catName === item.name ||
        m.modelName.includes(item.name) ||
        item.name.includes(m.modelName)
      );
      return { ...item, matchedPrice: match?.price, matchedChannel: match?.channel, matchedModelId: match?.modelId, hasComparison: false, priceSource: '', priceSourceLabel: '' };
    });
  }, [filteredShoppingItems, state.compareItems, state.syncedModelIds, state.bestQuoteIds, syncedPriceModels, state.selectedExpenseMap, state.purchasedExpenseMap, state.expenses]);

  // Unmatched synced models — only those without FK link
  const unmatchedSyncedModels = useMemo(() => {
    return syncedPriceModels.filter(m => {
      // If the model's category has a purchase_item_id linked to a shopping item, it's matched
      if (m.purchaseItemId && filteredShoppingItems.some(item => item.itemId === m.purchaseItemId)) return false;
      // Also check fuzzy name match
      return !filteredShoppingItems.some(item =>
        m.modelName === item.name ||
        m.catName === item.name ||
        m.modelName.includes(item.name) ||
        item.name.includes(m.modelName)
      );
    });
  }, [syncedPriceModels, filteredShoppingItems]);

  // matchedPrice 统一为总价（报价已×数量，账单金额本身即总价），直接求和即可
  const totalEstimatedCost = useMemo(() => {
    let total = 0;
    shoppingItemsWithPrice.forEach(item => {
      if (item.matchedPrice) {
        total += item.matchedPrice;
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
        total += item.matchedPrice;
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
        total += item.matchedPrice;
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
    const selExpenseId = getSelectedExpenseId(itemId);
    const purExpenseId = getPurchasedExpenseId(itemId);
    const hasExpense = !!(selExpenseId || purExpenseId);
    if (hasExpense) {
      // 有待购或已购账单，询问是否同步删除
      const billType = purExpenseId ? '已支付' : '未支付';
      if (!window.confirm(`确定从采购库删除「${itemName}」？\n\n该物品有一笔关联的${billType}账单，是否同步删除账单？`)) {
        return; // 用户取消
      }
      // 用户确认：同步删除账单（含待购和已购账单）
      if (purExpenseId) {
        // 先取消已购并删除账单
        unpurchaseItem(itemId, true);
      }
      deletePurchaseRefItem(itemId, true);
      showToast('已从采购库删除（含关联账单）');
    } else {
      if (!window.confirm(`确定从采购库删除「${itemName}」？`)) return;
      deletePurchaseRefItem(itemId);
      showToast('已从采购库删除');
    }
  };

  // ── Quick-add ──
  const handleQuickAdd = () => {
    if (!quickName.trim()) return;
    const [pi, si] = quickStage.split('_').map(Number);
    const stage = state.purchaseReferences[pi];
    const sub = stage?.subs[si];
    if (!stage || !sub) return;
    const price = quickPrice ? parseFloat(quickPrice) : undefined;
    addCustomPurchaseItem(
      quickName.trim(), stage.parent,
      Math.max(1, parseInt(quickQty) || 1),
      '', sub.name, '个',
      quickCategory || undefined,
      quickSubCategory || undefined,
      price && price > 0 ? price : undefined,
    );
    setQuickName('');
    setQuickQty('1');
    setQuickCategory('');
    setQuickSubCategory('');
    setQuickPrice('');
    // Auto-expand target
    setExpandedParents(prev => new Set(prev).add(pi));
    setExpandedSubs(prev => new Set(prev).add(`${pi}_${si}`));
    showToast(price && price > 0 ? '已添加到待购清单（含未支付账单）' : '已添加到首页待购清单');
  };

  // ── Custom add within subgroup ──
  const [customInputs, setCustomInputs] = useState<Record<string, { name: string; spec: string; qty: string; category: string; subCategory: string; price: string }>>({});
  const getCustomInput = (key: string) =>
    customInputs[key] || { name: '', spec: '', qty: '1', category: '', subCategory: '', price: '' };
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
    const price = input.price ? parseFloat(input.price) : undefined;
    addCustomPurchaseItem(
      input.name.trim(), stage.parent,
      Math.max(1, parseInt(input.qty) || 1),
      input.spec.trim(), sub.name, '个',
      input.category || undefined,
      input.subCategory || undefined,
      price && price > 0 ? price : undefined,
    );
    setCustomInput(key, 'name', '');
    setCustomInput(key, 'spec', '');
    setCustomInput(key, 'qty', '1');
    setCustomInput(key, 'category', '');
    setCustomInput(key, 'subCategory', '');
    setCustomInput(key, 'price', '');
    showToast(price && price > 0 ? '已添加到待购清单（含未支付账单）' : '已添加到首页待购清单');
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
              <div>
                <h2 className="purchase-shopping-title">待购清单</h2>
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
              <span className="purchase-shopping-total" style={displayCost === 0 ? { visibility: 'hidden' } : undefined}>
                {shoppingListView === 'pending' ? '预估总计' : '已购总计'} <strong>¥{displayCost.toLocaleString()}</strong>
              </span>
              <a href="/compare" className="purchase-shopping-link">去比价 →</a>
            </div>
          </div>

          {/* Filter bar — stage + category combined */}
          <div className="purchase-shopping-filter" style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--fresh-border)', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Stage filter */}
            <select
              name="filterStage"
              value={filterStage}
              onChange={e => { setFilterStage(e.target.value); setFilterSubgroup(''); }}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--fresh-border)', background: 'var(--fresh-surface)' }}
            >
              <option value="">全部阶段</option>
              {stagesForFilter.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {filterStage && (
              <select
                name="filterSubgroup"
                value={filterSubgroup}
                onChange={e => setFilterSubgroup(e.target.value)}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--fresh-border)', background: 'var(--fresh-surface)' }}
              >
                <option value="">全部子分组</option>
                {filteredSubgroups.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {/* Category filter */}
            <select
              name="filterCategory"
              value={filterCategory}
              onChange={e => { setFilterCategory(e.target.value); setFilterSubCategory(''); }}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--fresh-border)', background: 'var(--fresh-surface)' }}
            >
              <option value="">全部分类</option>
              {state.budget.categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            {filterCategory && (
              <select
                name="filterSubCategory"
                value={filterSubCategory}
                onChange={e => setFilterSubCategory(e.target.value)}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--fresh-border)', background: 'var(--fresh-surface)' }}
              >
                <option value="">全部子分类</option>
                {filteredSubCategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            )}
            {(filterCategory || filterStage) && (
              <span style={{ fontSize: 11, color: 'var(--fresh-muted)', display: 'flex', alignItems: 'center' }}>
                筛选结果: {filteredShoppingItems.length} 项
              </span>
            )}
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
                        // Check if it's due to active filter
                        if ((filterCategory || filterStage) && filteredShoppingItems.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: '#999' }}>
                              📋 没有符合筛选条件的物品
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ marginLeft: 8 }}
                                onClick={() => { setFilterCategory(''); setFilterSubCategory(''); }}
                              >清除筛选</button>
                            </div>
                          );
                        }
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
                                      name={`purchase-edit-name-${item.itemId}`}
                                      className="input"
                                      value={editShoppingName}
                                      onChange={e => setEditShoppingName(e.target.value)}
                                      placeholder="名称"
                                      style={{ width: 100, fontSize: 12, padding: '3px 6px' }}
                                    />
                                    <input
                                      name={`purchase-edit-spec-${item.itemId}`}
                                      className="input"
                                      value={editShoppingSpec}
                                      onChange={e => setEditShoppingSpec(e.target.value)}
                                      placeholder="规格"
                                      style={{ width: 80, fontSize: 12, padding: '3px 6px' }}
                                    />
                                    <input
                                      name={`purchase-edit-qty-${item.itemId}`}
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
                                      {/* Price display with source badge and inline edit */}
                                      {editingPriceItemId === item.itemId ? (
                                        <span className="purchase-shopping-row-price" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                          ¥<input
                                            name={`purchase-edit-price-${item.itemId}`}
                                            type="number"
                                            className="purchase-price-input"
                                            value={editingPriceValue}
                                            onChange={e => setEditingPriceValue(e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                const p = parseFloat(editingPriceValue);
                                                if (p > 0) {
                                                  updateItemPrice(item.itemId, p);
                                                  showToast(`价格已更新: ¥${p.toLocaleString()}`);
                                                }
                                                setEditingPriceItemId(null);
                                              } else if (e.key === 'Escape') {
                                                setEditingPriceItemId(null);
                                              }
                                            }}
                                            onBlur={() => {
                                              const p = parseFloat(editingPriceValue);
                                              if (p > 0) {
                                                updateItemPrice(item.itemId, p);
                                                showToast(`价格已更新: ¥${p.toLocaleString()}`);
                                              }
                                              setEditingPriceItemId(null);
                                            }}
                                            autoFocus
                                            style={{ width: 80, padding: '2px 6px', border: '1px solid #4a90d9', borderRadius: 4, fontSize: 13 }}
                                          />
                                        </span>
                                      ) : item.matchedPrice ? (
                                        <span
                                          className="purchase-shopping-row-price"
                                          title="点击修改价格"
                                          onClick={() => {
                                            setEditingPriceItemId(item.itemId);
                                            setEditingPriceValue(String(item.matchedPrice));
                                          }}
                                          style={{ cursor: 'pointer' }}
                                        >
                                          ¥{item.matchedPrice.toLocaleString()}
                                          {item.matchedChannel && <span className="purchase-shopping-row-channel"> ({item.matchedChannel})</span>}
                                          {(item as any).priceSourceLabel && (
                                            <span className="price-source-tag" style={{ fontSize: 10, color: '#888', background: '#f0f0f0', padding: '0 4px', borderRadius: 3, marginLeft: 4 }}>
                                              {(item as any).priceSourceLabel}
                                            </span>
                                          )}
                                        </span>
                                      ) : (
                                        <span
                                          className="purchase-shopping-row-price purchase-shopping-row-price--empty"
                                          title="点击设置价格"
                                          onClick={() => {
                                            setEditingPriceItemId(item.itemId);
                                            setEditingPriceValue('');
                                          }}
                                          style={{ cursor: 'pointer', color: '#bbb', fontStyle: 'italic' }}
                                        >
                                          设置价格
                                        </span>
                                      )}
                                    </div>
                                    <div className="purchase-shopping-row-actions">
                                      {isItemInComparison(item.itemId) ? (
                                        <a
                                          className="fresh-icon-btn"
                                          title="查看比价"
                                          href="/compare"
                                          style={{ color: '#48bb78' }}
                                        >
                                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                                        </a>
                                      ) : (
                                        <button
                                          className="fresh-icon-btn"
                                          title="添加至比价"
                                          onClick={() => {
                                            addPurchaseToCompare({
                                              itemId: item.itemId,
                                              name: item.name,
                                              spec: item.spec,
                                              stageParent: item.stageParent,
                                              qty: item.qty,
                                            });
                                            showToast(`已添加「${item.name}」到比价`);
                                          }}
                                        >
                                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                                        </button>
                                      )}
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
                                            const readiness = checkPurchaseReadiness(item.itemId);
                                            if (readiness.needsPrice || readiness.needsCategory) {
                                              setPurchaseModal({
                                                itemId: item.itemId,
                                                itemName: readiness.itemName,
                                                itemSpec: readiness.itemSpec,
                                                needsPrice: readiness.needsPrice,
                                                needsCategory: readiness.needsCategory,
                                                existingPrice: readiness.existingPrice,
                                                existingCategoryId: readiness.existingCategoryId,
                                              });
                                              setPurchaseModalPrice(readiness.existingPrice != null ? String(readiness.existingPrice) : '');
                                              setPurchaseModalCategory(readiness.existingCategoryId || 'hard');
                                            } else {
                                              purchaseItem(item.itemId, readiness.existingPrice!, readiness.existingCategoryId!);
                                              showToast(`已标记购买：${readiness.itemName}`);
                                            }
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
                                            const expenseId = getPurchasedExpenseId(item.itemId);
                                            setUnpurchaseModal({
                                              itemId: item.itemId,
                                              itemName: item.name,
                                              hasExpense: !!expenseId,
                                            });
                                          }}
                                        >
                                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                                        </button>
                                      )}
                                      <button
                                        className="fresh-icon-btn"
                                        title="移出清单"
                                        onClick={() => {
                                          const isPur = isItemPurchased(item.itemId);
                                          const purExpId = isPur ? getPurchasedExpenseId(item.itemId) : null;
                                          const selExpId = !isPur ? getSelectedExpenseId(item.itemId) : null;
                                          if (isPur || selExpId) {
                                            // Has linked expense: ask about expense deletion
                                            setRemoveModal({
                                              itemId: item.itemId,
                                              itemName: item.name,
                                              isPurchased: isPur,
                                              hasExpense: !!purExpId || !!selExpId,
                                            });
                                          } else {
                                            // No linked expense: just remove from list
                                            handleToggle(item.itemId);
                                          }
                                        }}
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
            name="purchaseSearch"
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
            name="purchaseQuickName"
            className="purchase-quick-name"
            type="text"
            placeholder="添加待购物品，例如：浴室柜"
            value={quickName}
            onChange={e => setQuickName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
            style={{ minWidth: 0 }}
          />
          <select name="purchaseQuickStage" className="purchase-quick-stage" value={quickStage} onChange={e => setQuickStage(e.target.value)}>
            {quickStageOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="purchase-quick-cat-group">
            <select
              name="purchaseQuickCategory"
              value={quickCategory}
              onChange={e => { setQuickCategory(e.target.value); setQuickSubCategory(''); }}
              style={{ fontSize: 12 }}
              title="预算分类（可选）"
            >
              <option value="">分类(可选)</option>
              {state.budget.categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select
              name="purchaseQuickSubCategory"
              value={quickSubCategory}
              onChange={e => setQuickSubCategory(e.target.value)}
              style={{ fontSize: 12 }}
              title="子分类（可选）"
              disabled={!quickCategory}
            >
              <option value="">子分类(可选)</option>
              {state.expenseSubCategories.filter(s => s.categoryId === quickCategory).map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </span>
          <span className="purchase-quick-row">
            <input
              name="purchaseQuickQty"
              type="number"
              min="1"
              value={quickQty}
              onChange={e => setQuickQty(e.target.value)}
              placeholder="数量"
            />
            <input
              name="purchaseQuickPrice"
              type="number"
              min="0"
              step="0.01"
              value={quickPrice}
              onChange={e => setQuickPrice(e.target.value)}
              placeholder="价格(可选)"
              style={{ fontSize: 12 }}
              title="设置价格后将自动创建未支付账单"
            />
          </span>
          <button className="btn btn-primary purchase-quick-btn" type="button" onClick={handleQuickAdd}>添加</button>
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
                                      name={`purchase-select-${item.id}`}
                                      type="checkbox"
                                      checked={isSelected(item.id)}
                                      onChange={() => handleToggle(item.id)}
                                      onClick={e => e.stopPropagation()}
                                    />
                                    <span className="purchase-ref-name">{item.name}</span>
                                    <span className="purchase-ref-spec">{item.spec || ''}</span>
                                    <input
                                      name={`purchase-ref-qty-${item.id}`}
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
                                      name={`custom-add-name-${subKey}`}
                                      type="text"
                                      placeholder="自定义物品"
                                      value={getCustomInput(subKey).name}
                                      onChange={e => setCustomInput(subKey, 'name', e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCustomAdd(pi, si)}
                                    />
                                    <input
                                      name={`custom-add-spec-${subKey}`}
                                      type="text"
                                      placeholder="规格"
                                      value={getCustomInput(subKey).spec}
                                      onChange={e => setCustomInput(subKey, 'spec', e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCustomAdd(pi, si)}
                                      style={{ width: 80 }}
                                    />
                                    <input
                                      name={`custom-add-qty-${subKey}`}
                                      type="number"
                                      placeholder="数量"
                                      value={getCustomInput(subKey).qty}
                                      onChange={e => setCustomInput(subKey, 'qty', e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCustomAdd(pi, si)}
                                      style={{ width: 50 }}
                                    />
                                    <select
                                      name={`custom-add-category-${subKey}`}
                                      value={getCustomInput(subKey).category}
                                      onChange={e => setCustomInput(subKey, 'category', e.target.value)}
                                      style={{ fontSize: 11, maxWidth: 100 }}
                                      title="预算分类（可选）"
                                    >
                                      <option value="">分类</option>
                                      {state.budget.categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                      ))}
                                    </select>
                                    <input
                                      name={`custom-add-price-${subKey}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="价格"
                                      value={getCustomInput(subKey).price}
                                      onChange={e => setCustomInput(subKey, 'price', e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleCustomAdd(pi, si)}
                                      style={{ width: 70 }}
                                      title="设置价格后将自动创建未支付账单"
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

      {/* ── Purchase Modal (price + category input) ── */}
      {purchaseModal && (
        <div className="modal-overlay" onClick={() => setPurchaseModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(420px, 100%)' }}>
            <div className="modal-header">
              <h3>确认购买信息</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setPurchaseModal(null)} style={{ padding: '2px 8px', fontSize: 16 }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                将 <strong>{purchaseModal.itemName}</strong>
                {purchaseModal.itemSpec ? `（${purchaseModal.itemSpec}）` : ''} 添加至已购清单
              </p>
              {purchaseModal.needsPrice && (
                <div className="form-group">
                  <label>请输入价格 (¥)</label>
                  <input
                    name="purchaseModalPrice"
                    className="input"
                    type="number"
                    placeholder="0.00"
                    value={purchaseModalPrice}
                    onChange={e => setPurchaseModalPrice(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') {
                      const price = parseFloat(purchaseModalPrice);
                      const category = purchaseModalCategory || 'hard';
                      if (price > 0) {
                        purchaseItem(purchaseModal.itemId, price, category);
                        showToast(`已标记购买：${purchaseModal.itemName}`);
                        setPurchaseModal(null);
                      }
                    }}}
                    autoFocus
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              {purchaseModal.needsCategory && (
                <div className="form-group">
                  <label>请选择预算分类</label>
                  <select
                    name="purchaseModalCategory"
                    className="input"
                    value={purchaseModalCategory}
                    onChange={e => setPurchaseModalCategory(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {DEFAULT_BUDGET_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPurchaseModal(null)}>取消</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const price = parseFloat(purchaseModalPrice);
                  if (!price || price <= 0) {
                    showToast('请输入有效价格');
                    return;
                  }
                  const category = purchaseModal.needsCategory ? purchaseModalCategory : (purchaseModal.existingCategoryId || 'hard');
                  purchaseItem(purchaseModal.itemId, price, category);
                  showToast(`已标记购买：${purchaseModal.itemName}`);
                  setPurchaseModal(null);
                }}
              >
                确认购买
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unpurchase Confirmation Modal ── */}
      {unpurchaseModal && (
        <div className="modal-overlay" onClick={() => setUnpurchaseModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(400px, 100%)' }}>
            <div className="modal-header">
              <h3>移回待购</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setUnpurchaseModal(null)} style={{ padding: '2px 8px', fontSize: 16 }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                确定要将 <strong>{unpurchaseModal.itemName}</strong> 移回待购清单吗？
              </p>
              {unpurchaseModal.hasExpense && (
                <p style={{ fontSize: 13, color: '#5c7fa8', marginBottom: 12 }}>
                  ℹ 关联账单将自动改为<strong>未付款</strong>状态，账单不会被删除。
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setUnpurchaseModal(null)}>取消</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  unpurchaseItem(unpurchaseModal.itemId, false);
                  showToast(`已移回待购：${unpurchaseModal.itemName}`);
                  setUnpurchaseModal(null);
                }}
              >
                确认移回待购
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove from List Modal (purchased or pending items with expense) ── */}
      {removeModal && (
        <div className="modal-overlay" onClick={() => setRemoveModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(400px, 100%)' }}>
            <div className="modal-header">
              <h3>移出清单</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setRemoveModal(null)} style={{ padding: '2px 8px', fontSize: 16 }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                将 <strong>{removeModal.itemName}</strong> 移出清单{removeModal.isPurchased ? '将同时取消已购标记' : ''}。
              </p>
              {removeModal.hasExpense && (
                <p style={{ fontSize: 13, color: '#e45b3f', marginBottom: 8 }}>
                  该物品有关联的记账记录（{removeModal.isPurchased ? '已支付' : '未支付'}），是否同步删除账单？
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRemoveModal(null)}>取消</button>
              {removeModal.hasExpense && (
                <button
                  className="btn btn-primary"
                  style={{ background: '#e45b3f', borderColor: '#e45b3f' }}
                  onClick={() => {
                    if (removeModal.isPurchased) {
                      unpurchaseItem(removeModal.itemId, true);
                    }
                    togglePurchaseRef(removeModal.itemId, true);
                    showToast(`已移出并删除账单：${removeModal.itemName}`);
                    setRemoveModal(null);
                  }}
                >
                  是，删除账单
                </button>
              )}
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (removeModal.isPurchased) {
                    unpurchaseItem(removeModal.itemId, false);
                  }
                  togglePurchaseRef(removeModal.itemId, false);
                  showToast(`已移出清单：${removeModal.itemName}`);
                  setRemoveModal(null);
                }}
              >
                {removeModal.hasExpense ? '否，仅移出' : '确认移出'}
              </button>
            </div>
          </div>
        </div>
      )}

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

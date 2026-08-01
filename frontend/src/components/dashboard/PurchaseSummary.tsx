import React, { useState } from 'react';
import { useStore, togglePurchaseRef, addPurchaseToCompare, isItemPurchased, checkPurchaseReadiness, purchaseItem, getPurchasedExpenseId, unpurchaseItem } from '../../data/store';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconShopping, IconCompare, IconTrash, IconCheck, IconPlus } from '../common/Icons';
import { DEFAULT_BUDGET_CATEGORIES } from '../../data/mockData';

function showToast(msg: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 1600);
}

interface SelectedItemInfo {
  itemId: string;
  name: string;
  spec?: string;
  qty: number;
  unit?: string;
  stageParent: string;
}

export const PurchaseSummary: React.FC = () => {
  const state = useStore();
  const [showPurchased, setShowPurchased] = useState(false);

  // ── Purchase modal state ──
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

  // Collect all selected items with their stage info
  const selectedItems: SelectedItemInfo[] = [];
  state.purchaseReferences.forEach(stage => {
    stage.subs.forEach(sub => {
      sub.items.forEach(item => {
        if (state.selectedPurchaseIds.includes(item.id)) {
          selectedItems.push({
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

  const pendingItems = selectedItems.filter(it => !isItemPurchased(it.itemId));
  const purchasedItems = selectedItems.filter(it => isItemPurchased(it.itemId));
  const totalSelected = selectedItems.length;

  const [removeModal, setRemoveModal] = useState<{
    itemId: string;
    itemName: string;
    isPurchased: boolean;
    hasExpense: boolean;
  } | null>(null);

  const handleRemove = (itemId: string, name: string) => {
    const isPur = isItemPurchased(itemId);
    const expId = isPur ? getPurchasedExpenseId(itemId) : null;
    if (isPur) {
      setRemoveModal({ itemId, itemName: name, isPurchased: true, hasExpense: !!expId });
    } else {
      togglePurchaseRef(itemId);
      showToast('已从待购清单移除');
    }
  };

  const handleAddToCompare = (item: SelectedItemInfo) => {
    addPurchaseToCompare({
      itemId: item.itemId,
      name: item.name,
      spec: item.spec,
      stageParent: item.stageParent,
      qty: item.qty,
    });
    showToast(`已添加「${item.name}」到比价系统`);
  };

  const handleTogglePurchased = (itemId: string, name: string, spec?: string) => {
    const readiness = checkPurchaseReadiness(itemId);
    if (readiness.needsPrice || readiness.needsCategory) {
      setPurchaseModal({
        itemId,
        itemName: readiness.itemName || name,
        itemSpec: readiness.itemSpec || spec || '',
        needsPrice: readiness.needsPrice,
        needsCategory: readiness.needsCategory,
        existingPrice: readiness.existingPrice,
        existingCategoryId: readiness.existingCategoryId,
      });
      setPurchaseModalPrice(readiness.existingPrice != null ? String(readiness.existingPrice) : '');
      setPurchaseModalCategory(readiness.existingCategoryId || 'hard');
    } else {
      purchaseItem(itemId, readiness.existingPrice!, readiness.existingCategoryId!);
      showToast(`「${name}」已标记为已购买`);
    }
  };

  // Group items by stage parent for display
  const grouped = new Map<string, SelectedItemInfo[]>();
  const displayItems = showPurchased ? selectedItems : [...pendingItems, ...purchasedItems];
  displayItems.forEach(item => {
    const list = grouped.get(item.stageParent) || [];
    list.push(item);
    grouped.set(item.stageParent, list);
  });

  const renderItemRow = (item: SelectedItemInfo) => {
    const purchased = isItemPurchased(item.itemId);
    return (
      <div key={item.itemId} className={`purchase-summary-item${purchased ? ' purchased' : ''}`}>
        <div className="purchase-summary-item-info">
          <span className="purchase-summary-item-name">
            {purchased && <IconCheck size={12} />}
            {item.name}
          </span>
          {item.spec && <span className="purchase-summary-item-spec">{item.spec}</span>}
          <span className="purchase-summary-item-qty">×{item.qty}{item.unit || '个'}</span>
        </div>
        <div className="purchase-summary-item-actions">
          {!purchased && (
            <>
              <button
                className="fresh-icon-btn"
                title="添加至比价"
                onClick={() => handleAddToCompare(item)}
              >
                <IconCompare size={13} />
              </button>
              <button
                className="fresh-icon-btn"
                title="标记已购买"
                onClick={() => handleTogglePurchased(item.itemId, item.name, item.spec)}
              >
                <IconCheck size={13} />
              </button>
            </>
          )}
          <button
            className="fresh-icon-btn"
            title="移除"
            onClick={() => handleRemove(item.itemId, item.name)}
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="card-title-row">
            <span className="iconbox iconbox-green">
              <IconShopping size={16} />
            </span>
            <h3>待购清单</h3>
          </div>
          <div className="card-title-row" style={{ gap: 8 }}>
            {totalSelected > 0 && (
              <span className="badge badge-default">
                {pendingItems.length} 待购 / {purchasedItems.length} 已购
              </span>
            )}
            <a href="/purchase" className="more-link">采购参考库</a>
          </div>
        </CardHeader>
        <CardBody>
          {totalSelected === 0 ? (
            <div className="empty-state" style={{ padding: '16px 0' }}>
              <div className="empty-state-icon">🛒</div>
              <p className="empty-state-title">暂无待购材料</p>
              <p className="empty-state-desc">可以从采购参考库添加</p>
            </div>
          ) : (
            <>
              {/* Pending items */}
              {pendingItems.length === 0 && purchasedItems.length > 0 ? (
                <div className="empty-state" style={{ padding: '12px 0' }}>
                  <div className="empty-state-icon">🎉</div>
                  <p className="empty-state-title">全部已购</p>
                  <p className="empty-state-desc">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowPurchased(!showPurchased)}
                    >
                      {showPurchased ? '隐藏' : '查看'}已购物品
                    </button>
                  </p>
                </div>
              ) : (
                <div className="purchase-summary-list">
                  {Array.from(grouped.entries()).map(([stageName, items]) => (
                    <div key={stageName} className="purchase-summary-group">
                      <div className="purchase-summary-group-label">{stageName}</div>
                      {items.map(renderItemRow)}
                    </div>
                  ))}
                </div>
              )}

              {/* Purchased toggle */}
              {purchasedItems.length > 0 && pendingItems.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8, fontSize: 11 }}
                  onClick={() => setShowPurchased(!showPurchased)}
                >
                  {showPurchased ? '隐藏' : '查看'} {purchasedItems.length} 件已购物品
                </button>
              )}
            </>
          )}
        </CardBody>
      </Card>

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

      {/* ── Remove from List Modal (purchased items) ── */}
      {removeModal && (
        <div className="modal-overlay" onClick={() => setRemoveModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(400px, 100%)' }}>
            <div className="modal-header">
              <h3>移出清单</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setRemoveModal(null)} style={{ padding: '2px 8px', fontSize: 16 }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                将 <strong>{removeModal.itemName}</strong> 移出清单将同时取消已购标记。
              </p>
              {removeModal.hasExpense && (
                <p style={{ fontSize: 13, color: '#e45b3f', marginBottom: 8 }}>
                  该物品有关联的记账记录，是否同步删除账单？
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
                    unpurchaseItem(removeModal.itemId, true);
                    togglePurchaseRef(removeModal.itemId);
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
                  unpurchaseItem(removeModal.itemId, false);
                  togglePurchaseRef(removeModal.itemId);
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
    </>
  );
};

export default PurchaseSummary;

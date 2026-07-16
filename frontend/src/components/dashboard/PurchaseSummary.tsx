import React, { useState } from 'react';
import { useStore, togglePurchaseRef, addPurchaseToCompare, togglePurchased, isItemPurchased } from '../../data/store';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconShopping, IconCompare, IconTrash, IconCheck, IconPlus } from '../common/Icons';

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

  const handleRemove = (itemId: string) => {
    togglePurchaseRef(itemId);
    showToast('已从待购清单移除');
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

  const handleTogglePurchased = (itemId: string, name: string) => {
    togglePurchased(itemId);
    if (!isItemPurchased(itemId)) {
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
                onClick={() => handleTogglePurchased(item.itemId, item.name)}
              >
                <IconCheck size={13} />
              </button>
            </>
          )}
          <button
            className="fresh-icon-btn"
            title="移除"
            onClick={() => handleRemove(item.itemId)}
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
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
          <a href="/purchase" className="more-link">采购参考库 →</a>
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
  );
};

export default PurchaseSummary;

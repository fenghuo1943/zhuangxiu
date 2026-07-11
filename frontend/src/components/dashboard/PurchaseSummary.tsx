import React from 'react';
import { useStore } from '../../data/store';
import { Card, CardHeader, CardBody } from '../common/Card';
import { EmptyState } from '../common/EmptyState';
import { IconShopping } from '../common/Icons';

export const PurchaseSummary: React.FC = () => {
  const state = useStore();
  const selectedCount = state.selectedPurchaseIds.length + state.syncedModelIds.length;

  return (
    <Card>
      <CardHeader>
        <div className="card-title-row">
          <span className="iconbox iconbox-green">
            <IconShopping size={16} />
          </span>
          <h3>待购清单</h3>
        </div>
        <a href="/purchase" className="more-link">采购参考库 →</a>
      </CardHeader>
      <CardBody>
        {selectedCount === 0 ? (
          <EmptyState
            icon="🛒"
            title="暂无待购材料"
            description="可以从采购参考库添加"
          />
        ) : (
          <div className="purchase-summary-list">
            <p className="purchase-count">
              共 <strong>{selectedCount}</strong> 项待购材料
            </p>
            <a href="/purchase" className="btn btn-outline btn-sm" style={{ marginTop: 8 }}>
              查看待购清单
            </a>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default PurchaseSummary;

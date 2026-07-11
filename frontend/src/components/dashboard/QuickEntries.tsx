import React from 'react';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconMap, IconShopping, IconWrench, IconLayout } from '../common/Icons';

const entries = [
  { id: 'flow', label: '装修流程', desc: '按阶段推进装修', href: '/flow', icon: IconMap, color: 'coral' },
  { id: 'purchase', label: '采购清单', desc: '管理采购材料', href: '/purchase', icon: IconShopping, color: 'green' },
  { id: 'tools', label: '实用工具', desc: '装修计算与查询', href: '/tools', icon: IconWrench, color: 'blue' },
];

export const QuickEntries: React.FC = () => (
  <Card>
    <CardHeader>
      <div className="card-title-row">
        <span className="iconbox iconbox-coral">
          <IconLayout size={16} />
        </span>
        <h3>常用入口</h3>
      </div>
    </CardHeader>
    <CardBody>
      <div className="tool-grid">
        {entries.map(entry => {
          const Icon = entry.icon;
          return (
            <a key={entry.id} href={entry.href} className="tool">
              <span className={`iconbox iconbox-${entry.color}`}>
                <Icon size={18} />
              </span>
              <strong>{entry.label}</strong>
              <span>{entry.desc}</span>
            </a>
          );
        })}
      </div>
    </CardBody>
  </Card>
);

export default QuickEntries;

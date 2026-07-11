import React from 'react';
import AppShell from '../components/layout/AppShell';
import { IconBell } from '../components/common/Icons';

const NoticesPage: React.FC = () => (
  <AppShell currentPage="notices">
    <div className="placeholder-page">
      <div className="card" style={{ textAlign: 'center', padding: 60 }}>
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <p className="empty-state-title">暂无公告</p>
          <p className="empty-state-desc">装修相关的系统公告和更新通知将在这里显示。</p>
        </div>
      </div>
    </div>
  </AppShell>
);

export default NoticesPage;

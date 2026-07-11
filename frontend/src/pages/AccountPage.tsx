import React from 'react';
import AppShell from '../components/layout/AppShell';
import { useStore } from '../data/store';
import { IconUser } from '../components/common/Icons';

const AccountPage: React.FC = () => {
  const state = useStore();
  const project = state.projects.find(p => p.id === state.activeProjectId);

  return (
    <AppShell currentPage="account">
      <div className="placeholder-page">
        <div className="card">
          <div className="card-bd" style={{ textAlign: 'center', padding: 40 }}>
            <div className="empty-state-icon" style={{ fontSize: 48 }}>👤</div>
            <p className="empty-state-title">账号设置</p>
            <p className="empty-state-desc">
              当前项目：{project?.name || '未选择'}<br />
              账号管理和云同步功能将在后续版本中提供。
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default AccountPage;

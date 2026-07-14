import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useStore } from '../data/store';
import { useAuth } from '../api/useAuth';
import { isAuthenticated } from '../api/client';

const AccountPage: React.FC = () => {
  const state = useStore();
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const project = state.projects.find(p => p.id === state.activeProjectId);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <AppShell currentPage="account">
      <div className="placeholder-page">
        {/* Auth Status Card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-bd" style={{ padding: 24 }}>
            {isLoggedIn && user ? (
              <div style={{ textAlign: 'center' }}>
                <div className="empty-state-icon" style={{ fontSize: 48 }}>👤</div>
                <p className="empty-state-title" style={{ marginBottom: 4 }}>{user.username}</p>
                <p className="empty-state-desc" style={{ marginBottom: 16 }}>
                  {user.email}<br />
                  注册时间：{new Date(user.created_at).toLocaleDateString('zh-CN')}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="btn btn-outline" onClick={handleLogout}>
                    退出登录
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="empty-state-icon" style={{ fontSize: 48 }}>🔐</div>
                <p className="empty-state-title">未登录</p>
                <p className="empty-state-desc" style={{ marginBottom: 16 }}>
                  登录后可将数据同步到云端，与账号关联。<br />
                  未登录时数据仅保存在本地浏览器。
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Link to="/login" className="btn btn-primary">登录</Link>
                  <Link to="/register" className="btn btn-outline">注册</Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Project Info Card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-bd" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>📋 项目信息</h3>
            <p className="empty-state-desc" style={{ margin: 0, textAlign: 'left' }}>
              当前项目：{project?.name || '未选择'}<br />
              项目ID：{state.activeProjectId}<br />
              记账总数：{state.expenses.length} 笔<br />
              预算总额：¥{state.budget.total.toLocaleString('zh-CN')}
            </p>
          </div>
        </div>

        {/* Data Info Card */}
        <div className="card">
          <div className="card-bd" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>💾 数据状态</h3>
            <p className="empty-state-desc" style={{ margin: 0, textAlign: 'left' }}>
              {isAuthenticated()
                ? '✅ 已登录 — 数据自动同步到云端，与账号关联'
                : '📱 离线模式 — 数据仅保存在本地浏览器'
              }<br />
              本地存储键：xiaozhuangjia_state_v1<br />
              数据更新时间：{new Date().toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default AccountPage;

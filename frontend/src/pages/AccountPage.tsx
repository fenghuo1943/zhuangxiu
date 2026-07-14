import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useStore, exportAllData, importAllData, resetAllData } from '../data/store';
import { useAuth } from '../api/useAuth';
import { isAuthenticated } from '../api/client';
import { IconDownload, IconUpload, IconTrash } from '../components/common/Icons';

const AccountPage: React.FC = () => {
  const state = useStore();
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const project = state.projects.find(p => p.id === state.activeProjectId);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleExport = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `装修手记_全部数据_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportMsg({ type: 'success', text: '数据已导出' });
    setTimeout(() => setImportMsg(null), 2000);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const ok = importAllData(text);
        if (ok) {
          setImportMsg({ type: 'success', text: '导入成功，页面刷新中' });
          setTimeout(() => window.location.reload(), 1000);
        } else {
          setImportMsg({ type: 'error', text: '数据格式不正确' });
        }
      } catch {
        setImportMsg({ type: 'error', text: '文件读取失败' });
      }
    };
    input.click();
  };

  const handleReset = () => {
    resetAllData();
    setShowResetConfirm(false);
    setImportMsg({ type: 'success', text: '已重置，页面刷新中' });
    setTimeout(() => window.location.reload(), 1000);
  };

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

        {/* Data Management Card */}
        <div className="card">
          <div className="card-hd"><h3>💾 数据管理</h3></div>
          <div className="card-bd">
            <p className="card-subtitle" style={{ marginBottom: 12 }}>
              {isAuthenticated()
                ? '✅ 已登录 — 数据自动同步到云端，与账号关联'
                : '📱 离线模式 — 数据仅保存在本地浏览器'
              }
              <br />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                本地存储键：xiaozhuangjia_state_v1 · 更新时间：{new Date().toLocaleString('zh-CN')}
              </span>
            </p>
            <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>所有数据保存在浏览器本地存储中。建议定期导出备份。</p>
            <div className="backup-actions">
              <button className="btn btn-outline" onClick={handleExport}><IconDownload size={16} /> 导出全部数据</button>
              <button className="btn btn-outline" onClick={handleImport}><IconUpload size={16} /> 导入数据</button>
              {!showResetConfirm ? (
                <button className="btn btn-outline" style={{ color: '#EF4444', borderColor: '#FECACA' }} onClick={() => setShowResetConfirm(true)}><IconTrash size={16} /> 重置所有数据</button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>确定重置？不可恢复。</span>
                  <button className="btn btn-sm" style={{ background: '#EF4444', color: '#fff' }} onClick={handleReset}>确认</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowResetConfirm(false)}>取消</button>
                </div>
              )}
            </div>
            {importMsg && <div className={`backup-msg ${importMsg.type}`} style={{ marginTop: 10 }}>{importMsg.text}</div>}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default AccountPage;

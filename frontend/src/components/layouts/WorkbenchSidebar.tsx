/**
 * 侧栏工作台 - 左侧导航栏
 * 包含品牌、项目切换、导航分组、账号入口
 */
import React from 'react';
import { useStore, switchProject } from '../../data/store';
import { useAuth } from '../../api/useAuth';
import { IconHome, IconUser, IconPlus } from '../common/Icons';
import { workspaceItems, toolItems, NavItem } from './workbenchNavigation';

interface WorkbenchSidebarProps {
  currentPage: string;
}

const NavGroup: React.FC<{ title: string; items: NavItem[]; currentPage: string }> = ({ title, items, currentPage }) => (
  <div className="wb-nav-group">
    <div className="wb-nav-group-title">{title}</div>
    {items.map(item => (
      <a
        key={item.id}
        href={item.href}
        className={`wb-nav-item${currentPage === item.id ? ' active' : ''}`}
        aria-current={currentPage === item.id ? 'page' : undefined}
      >
        <span className="wb-nav-icon">{item.icon}</span>
        <span className="wb-nav-label">{item.label}</span>
      </a>
    ))}
  </div>
);

const WorkbenchSidebar: React.FC<WorkbenchSidebarProps> = ({ currentPage }) => {
  const state = useStore();
  const { isLoggedIn, user } = useAuth();

  return (
    <aside className="wb-sidebar">
      {/* 品牌 */}
      <div className="wb-brand">
        <a href="/" className="wb-brand-link">
          <span className="wb-brand-icon">
            <IconHome size={20} />
          </span>
          <span className="wb-brand-text">
            装修手记
            <small>清晰装修管家</small>
          </span>
        </a>
      </div>

      {/* 项目切换器 */}
      <div className="wb-project">
        <select
          className="wb-project-select"
          value={state.activeProjectId}
          onChange={(e) => switchProject(e.target.value)}
          title="切换项目"
        >
          {state.projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="wb-project-add" title="新建项目">
          <IconPlus size={14} />
        </button>
      </div>

      {/* 导航区域 */}
      <nav className="wb-nav">
        <NavGroup title="装修工作区" items={workspaceItems} currentPage={currentPage} />
        <NavGroup title="辅助工具" items={toolItems} currentPage={currentPage} />
      </nav>

      {/* 底部：账号与同步状态 */}
      <div className="wb-bottom">
        {isLoggedIn ? (
          <a href="/account" className="wb-user-link" title={user?.username || '账号'}>
            <IconUser size={16} />
            <span className="wb-user-name">{user?.username || '我的'}</span>
          </a>
        ) : (
          <a href="/login" className="wb-user-link wb-login-link" title="登录">
            <IconUser size={16} />
            <span className="wb-user-name">登录</span>
          </a>
        )}
      </div>
    </aside>
  );
};

export default WorkbenchSidebar;

import React from 'react';
import { useStore } from '../../data/store';
import { IconHome, IconShopping, IconCompare, IconExpense, IconFlow, IconTools, IconBell, IconUser, IconPlus } from '../common/Icons';
import { switchProject } from '../../data/store';
import { useAuth } from '../../api/useAuth';

interface DesktopHeaderProps {
  currentPage: string;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({ currentPage }) => {
  const state = useStore();
  const { isLoggedIn, user } = useAuth();

  const navItems = [
    { id: 'home', label: '首页', href: '/', icon: <IconHome size={16} /> },
    { id: 'purchase', label: '采购', href: '/purchase', icon: <IconShopping size={16} /> },
    { id: 'compare', label: '比价', href: '/compare', icon: <IconCompare size={16} /> },
    { id: 'expense', label: '记账', href: '/expense', icon: <IconExpense size={16} /> },
    { id: 'flow', label: '流程', href: '/flow', icon: <IconFlow size={16} /> },
    { id: 'tools', label: '工具', href: '/tools', icon: <IconTools size={16} /> },
  ];

  return (
    <nav className="fresh-navbar">
      {/* Brand */}
      <a href="/" className="fresh-brand">
        <span className="fresh-iconbox">
          <IconHome size={18} />
        </span>
        <span>
          小装家
          <small>清晰装修管家</small>
        </span>
      </a>

      {/* Navigation Links */}
      <div className="fresh-navlinks">
        {navItems.map(item => (
          <a
            key={item.id}
            href={item.href}
            className={currentPage === item.id ? 'active' : ''}
          >
            {item.icon}
            {item.label}
          </a>
        ))}
      </div>

      {/* Right Actions */}
      <div className="fresh-nav-actions">
        {/* Project Selector */}
        <select
          className="project-select"
          value={state.activeProjectId}
          onChange={(e) => switchProject(e.target.value)}
          title="切换项目"
        >
          {state.projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* New Project */}
        <button className="fresh-notice-link" title="新建项目">
          <IconPlus size={16} />
        </button>

        {/* Notices */}
        <a href="/notices" className="fresh-notice-link" title="公告">
          <IconBell size={16} />
        </a>

        {/* Account / Login */}
        {isLoggedIn ? (
          <a href="/account" className="fresh-user-link" title={user?.username || '账号'}>
            <IconUser size={16} />
          </a>
        ) : (
          <a href="/login" className="fresh-user-link" title="登录" style={{ background: 'var(--fresh-green)', boxShadow: '0 12px 26px rgba(95,159,119,.18)' }}>
            <IconUser size={16} /> 登录
          </a>
        )}
      </div>
    </nav>
  );
};

export default DesktopHeader;

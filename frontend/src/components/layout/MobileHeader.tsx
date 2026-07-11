import React from 'react';
import { useStore } from '../../data/store';
import { IconHome, IconBell, IconUser } from '../common/Icons';
import { switchProject } from '../../data/store';

interface MobileHeaderProps {
  currentPage: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ currentPage }) => {
  const state = useStore();

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

      {/* Right Actions */}
      <div className="fresh-nav-actions">
        {/* Project Name */}
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

        {/* Notices */}
        <a href="/notices" className="fresh-notice-link" title="公告">
          <IconBell size={16} />
        </a>

        {/* Account */}
        <a href="/account" className="fresh-user-link" title="账号">
          <IconUser size={16} />
        </a>
      </div>
    </nav>
  );
};

export default MobileHeader;

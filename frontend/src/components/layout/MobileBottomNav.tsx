import React, { useState } from 'react';
import { IconHome, IconShopping, IconCompare, IconExpense, IconMenu, IconFlow, IconBook, IconUser } from '../common/Icons';

interface MobileBottomNavProps {
  currentPage: string;
}

// 底部常驻导航（保持 5 项），末项「更多」为弹层入口
const navItems = [
  { id: 'home', label: '首页', href: '/', icon: IconHome },
  { id: 'purchase', label: '采购', href: '/purchase', icon: IconShopping },
  { id: 'compare', label: '比价', href: '/compare', icon: IconCompare },
  { id: 'expense', label: '记账', href: '/expense', icon: IconExpense },
  { id: 'more', label: '更多', href: '#more', icon: IconMenu },
];

// 更多弹层菜单项 —— 后续新增入口只需往此数组追加
const moreItems = [
  { id: 'flow', label: '流程', href: '/flow', icon: IconFlow },
  { id: 'tips', label: '装修技巧', href: '/tips', icon: IconBook },
  { id: 'account', label: '我的', href: '/account', icon: IconUser },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPage }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreItems.some(item => item.id === currentPage);

  return (
    <>
      <nav className="fresh-mobile-nav" aria-label="底部导航">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = item.id === 'more' ? moreActive : currentPage === item.id;
          return (
            <a
              key={item.id}
              href={item.href}
              className={isActive ? 'active' : ''}
              aria-current={isActive ? 'page' : undefined}
              onClick={item.id === 'more' ? (e) => { e.preventDefault(); setMoreOpen(v => !v); } : undefined}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      {moreOpen && (
        <div className="more-overlay" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={e => e.stopPropagation()}>
            <p className="more-sheet-title">更多功能</p>
            {moreItems.map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className={`more-sheet-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="more-sheet-icon"><Icon size={18} /></span>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

export default MobileBottomNav;

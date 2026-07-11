import React from 'react';
import { IconHome, IconShopping, IconCompare, IconExpense, IconTools } from '../common/Icons';

interface MobileBottomNavProps {
  currentPage: string;
}

const navItems = [
  { id: 'home', label: '首页', href: '/', icon: IconHome },
  { id: 'purchase', label: '采购', href: '/purchase', icon: IconShopping },
  { id: 'compare', label: '比价', href: '/compare', icon: IconCompare },
  { id: 'expense', label: '记账', href: '/expense', icon: IconExpense },
  { id: 'tools', label: '工具', href: '/tools', icon: IconTools },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPage }) => (
  <nav className="fresh-mobile-nav" aria-label="底部导航">
    {navItems.map(item => {
      const Icon = item.icon;
      const isActive = currentPage === item.id;
      return (
        <a
          key={item.id}
          href={item.href}
          className={isActive ? 'active' : ''}
          aria-current={isActive ? 'page' : undefined}
        >
          <Icon size={20} />
          <span>{item.label}</span>
        </a>
      );
    })}
  </nav>
);

export default MobileBottomNav;

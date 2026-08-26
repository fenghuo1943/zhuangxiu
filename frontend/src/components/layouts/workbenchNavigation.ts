/**
 * 侧栏工作台导航配置
 * 唯一导航配置源，供 WorkbenchSidebar 消费
 */
import React from 'react';
import { IconHome, IconFlow, IconShopping, IconExpense, IconCompare, IconBook, IconUser, IconTools } from '../common/Icons';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  group: 'workspace' | 'tools';
}

export const workbenchNavItems: NavItem[] = [
  // 装修工作区
  { id: 'home', label: '今日总览', href: '/', icon: React.createElement(IconHome, { size: 18 }), group: 'workspace' },
  { id: 'flow', label: '装修流程', href: '/flow', icon: React.createElement(IconFlow, { size: 18 }), group: 'workspace' },
  { id: 'purchase', label: '采购清单', href: '/purchase', icon: React.createElement(IconShopping, { size: 18 }), group: 'workspace' },
  { id: 'expense', label: '装修记账', href: '/expense', icon: React.createElement(IconExpense, { size: 18 }), group: 'workspace' },
  { id: 'compare', label: '比价选品', href: '/compare', icon: React.createElement(IconCompare, { size: 18 }), group: 'workspace' },
  // 辅助工具
  { id: 'tools', label: '实用工具', href: '/tools', icon: React.createElement(IconTools, { size: 18 }), group: 'tools' },
  { id: 'tips', label: '装修技巧', href: '/tips', icon: React.createElement(IconBook, { size: 18 }), group: 'tools' },
  { id: 'account', label: '我的', href: '/account', icon: React.createElement(IconUser, { size: 18 }), group: 'tools' },
];

export const workspaceItems = workbenchNavItems.filter(i => i.group === 'workspace');
export const toolItems = workbenchNavItems.filter(i => i.group === 'tools');

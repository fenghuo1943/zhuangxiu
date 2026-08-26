import React from 'react';
import { useTheme } from '../components/theme/ThemeProvider';
import AppShell from '../components/layout/AppShell';
import {
  ReminderCard,
  StageRoute,
  ProgressCard,
  BudgetPanel,
  TodoPanel,
  TodayFocus,
  PurchaseSummary,
  ExpenseSummary,
  GuideCard,
  QuickEntries,
  BackupPanel,
} from '../components/dashboard';
import DefaultHomeLayout from '../components/layouts/DefaultHomeLayout';
import DesktopFocusHomeLayout from '../components/layouts/DesktopFocusHomeLayout';
import MobileCompactHomeLayout from '../components/layouts/MobileCompactHomeLayout';

const HomePage: React.FC = () => {
  const { preference } = useTheme();
  const isMobile = window.innerWidth < 768;

  // 根据布局ID选择对应的布局组件
  const layoutId = isMobile ? preference.mobileLayout : preference.desktopLayout;

  const renderLayout = () => {
    switch (layoutId) {
      case 'desktop-focus':
        return <DesktopFocusHomeLayout />;
      case 'mobile-compact':
        return <MobileCompactHomeLayout />;
      case 'desktop-default':
      case 'mobile-default':
      default:
        return <DefaultHomeLayout />;
    }
  };

  return (
    <AppShell currentPage="home">
      {renderLayout()}
    </AppShell>
  );
};

export default HomePage;

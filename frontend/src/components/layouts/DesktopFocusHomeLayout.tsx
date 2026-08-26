/**
 * 桌面端专注工作台布局
 * 特点：待办、预算等高频工作组件前置
 */
import React from 'react';
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
} from '../dashboard';

const DesktopFocusHomeLayout: React.FC = () => {
  return (
    <div className="home-pro">
      {/* Hero / Reminder + TodayFocus */}
      <section className="hero">
        <ReminderCard />
        <TodayFocus />
      </section>

      {/* 高频工作组件前置：待办 + 预算 */}
      <section className="live-widgets">
        <TodoPanel />
        <BudgetPanel />
      </section>

      {/* 进度 + 流程 + 指南 */}
      <section className="live-widgets">
        <ProgressCard />
        <StageRoute />
        <GuideCard />
      </section>

      {/* 侧边栏：采购 + 支出 + 快捷入口 + 备份 */}
      <section className="layout">
        <aside className="stack">
          <PurchaseSummary />
          <ExpenseSummary />
          <QuickEntries />
          <BackupPanel />
        </aside>
      </section>
    </div>
  );
};

export default DesktopFocusHomeLayout;

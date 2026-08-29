/**
 * 移动端紧凑清单布局
 * 特点：待办、待购、近期支出等移动端高频信息前置
 */
import React from 'react';
import {
  ReminderCard,
  ProgressCard,
  BudgetPanel,
  TodayFocus,
  PurchaseSummary,
  ExpenseSummary,
  GuideCard,
  QuickEntries,
  BackupPanel,
} from '../dashboard';

const MobileCompactHomeLayout: React.FC = () => {
  return (
    <div className="home-pro">
      {/* Hero / Reminder + TodayFocus */}
      <section className="hero">
        <ReminderCard />
        <TodayFocus />
      </section>

      {/* 高频信息前置：待购 + 支出（已隐藏待办） */}
      <section className="live-widgets">
        <PurchaseSummary />
        <ExpenseSummary />
      </section>

      {/* 进度（已隐藏阶段路线） */}
      <section className="live-widgets">
        <ProgressCard />
      </section>

      {/* 其他组件 */}
      <section className="layout">
        <div className="stack home-main-stack">
          <BudgetPanel />
          <GuideCard />
        </div>
        <aside className="stack">
          <QuickEntries />
          <BackupPanel />
        </aside>
      </section>
    </div>
  );
};

export default MobileCompactHomeLayout;

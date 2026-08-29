/**
 * 默认首页布局
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

const DefaultHomeLayout: React.FC = () => {
  const isMobile = window.innerWidth < 768;

  return (
    <div className="home-pro">
      {/* Hero / Reminder + TodayFocus */}
      <section className="hero">
        <ReminderCard />
        <TodayFocus />
      </section>

      {/* Progress + Timeline + Guide */}
      <section className="live-widgets">
        <div className="hide-mobile">
          <ProgressCard />
        </div>
        <StageRoute />
        <div className="hide-mobile">
          <GuideCard />
        </div>
      </section>

      {/* Main Layout: Left (Budget + Todo) | Right (Sidebar) */}
      <section className="layout">
        <div className="stack home-main-stack">
          <BudgetPanel />
          <TodoPanel />
        </div>
        <aside className="stack">
          <PurchaseSummary />
          {!isMobile && <ExpenseSummary />}
          <QuickEntries />
          <BackupPanel />
        </aside>
      </section>
    </div>
  );
};

export default DefaultHomeLayout;

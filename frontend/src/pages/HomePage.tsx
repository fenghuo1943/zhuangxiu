import React from 'react';
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

const HomePage: React.FC = () => {
  return (
    <AppShell currentPage="home">
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
            <ExpenseSummary />
            <QuickEntries />
            <BackupPanel />
          </aside>
        </section>
      </div>
    </AppShell>
  );
};

export default HomePage;

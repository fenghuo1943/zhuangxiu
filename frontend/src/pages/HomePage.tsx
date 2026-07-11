import React from 'react';
import AppShell from '../components/layout/AppShell';
import {
  ReminderCard,
  StageRoute,
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
        {/* Hero / Reminder Section */}
        <section className="hero">
          <ReminderCard />
        </section>

        {/* Progress Timeline */}
        <section className="live-widgets">
          <StageRoute />
        </section>

        {/* Main Layout: Left (Budget + Todo) | Right (Sidebar) */}
        <section className="layout">
          <div className="stack home-main-stack">
            <BudgetPanel />
            <TodoPanel />
          </div>
          <aside className="stack">
            <TodayFocus />
            <PurchaseSummary />
            <ExpenseSummary />
            <GuideCard />
            <QuickEntries />
            <BackupPanel />
          </aside>
        </section>
      </div>
    </AppShell>
  );
};

export default HomePage;

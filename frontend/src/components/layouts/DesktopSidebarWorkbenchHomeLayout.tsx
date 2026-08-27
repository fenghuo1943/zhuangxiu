/**
 * 侧栏工作台首页布局
 * 特点：行动优先的项目工作台
 * - 首屏 7:5 双栏：问候/当前阶段/快捷入口 + 最近待办
 * - 装修进度 + 阶段路线 同一行
 * - 预算设置与阶段分配(2/3) + 待购清单与记账概览(1/3)
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
} from '../dashboard';

const DesktopSidebarWorkbenchHomeLayout: React.FC = () => {
  return (
    <div className="wb-home">
      {/* 首屏 7:5 双栏：问候/阶段/快捷 + 今日优先 */}
      <section className="wb-home-hero">
        <div className="wb-home-hero-main">
          <ReminderCard />
        </div>
        <div className="wb-home-hero-side">
          <TodayFocus />
        </div>
      </section>

      {/* 装修进度 + 阶段路线 同一行 */}
      <section className="wb-home-progress-route">
        <ProgressCard />
        <StageRoute />
      </section>

      {/* 预算设置与阶段分配(2/3) + 待购清单与记账概览(1/3) */}
      <section className="wb-home-budget-side">
        <div className="wb-home-budget-main">
          <BudgetPanel />
          <TodoPanel />
        </div>
        <div className="wb-home-budget-side-stack">
          <PurchaseSummary />
          <ExpenseSummary />
        </div>
      </section>
    </div>
  );
};

export default DesktopSidebarWorkbenchHomeLayout;

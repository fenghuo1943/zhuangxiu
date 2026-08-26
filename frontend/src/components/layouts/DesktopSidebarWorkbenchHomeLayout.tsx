/**
 * 侧栏工作台首页布局
 * 特点：行动优先的项目工作台
 * - 首屏 7:5 双栏：问候/当前阶段/快捷入口 + 最近待办
 * - 装修进度 + 阶段路线 同一行
 * - 三项核心指标：预算/待办/采购
 * - 最近动态
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

      {/* 三项核心指标 */}
      <section className="wb-home-metrics-three">
        <div className="wb-metric-card">
          <BudgetPanel />
        </div>
        <div className="wb-metric-card">
          <TodoPanel />
        </div>
        <div className="wb-metric-card">
          <PurchaseSummary />
        </div>
      </section>

      {/* 最近动态 */}
      <section className="wb-home-bottom">
        <div className="wb-home-bottom-main">
          <ExpenseSummary />
        </div>
      </section>
    </div>
  );
};

export default DesktopSidebarWorkbenchHomeLayout;

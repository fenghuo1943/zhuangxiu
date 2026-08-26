/**
 * 侧栏工作台首页布局
 * 特点：行动优先的项目工作台
 * - 首屏 7:5 双栏：问候/当前阶段/快捷入口 + 今日优先事项
 * - 四项核心指标
 * - 下方 8:4 双栏：施工路线/进度 + 最近动态
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

      {/* 四项核心指标 */}
      <section className="wb-home-metrics">
        <div className="wb-metric-card">
          <ProgressCard />
        </div>
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

      {/* 下方 8:4 双栏：施工路线 + 最近动态 */}
      <section className="wb-home-bottom">
        <div className="wb-home-bottom-main">
          <StageRoute />
        </div>
        <div className="wb-home-bottom-side">
          <ExpenseSummary />
        </div>
      </section>
    </div>
  );
};

export default DesktopSidebarWorkbenchHomeLayout;

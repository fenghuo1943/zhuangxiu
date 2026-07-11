import React from 'react';
import { useStore, getBudgetRemaining, getBudgetUsageRate } from '../../data/store';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconStar, IconDollar, IconShopping, IconCheck } from '../common/Icons';

export const TodayFocus: React.FC = () => {
  const state = useStore();
  const remaining = getBudgetRemaining();
  const usageRate = getBudgetUsageRate();
  const pendingTodos = state.todos.filter(t => t.projectId === state.activeProjectId && !t.completed).length;
  const pendingPurchase = state.selectedPurchaseIds.length + state.syncedModelIds.length;
  const hasBudget = state.budget.total > 0;
  const recentExpense = state.recentExpenses[0];
  const priorityItem = hasBudget ? null : '设置总预算';

  return (
    <>
      {/* Desktop: Full TodayFocus */}
      <Card className="today-focus-card desktop-only">
        <CardHeader>
          <div className="card-title-row">
            <span className="iconbox iconbox-amber">
              <IconStar size={16} />
            </span>
            <h3>今日重点</h3>
          </div>
        </CardHeader>
        <CardBody>
          {priorityItem && (
            <div className="focus-priority">
              <span className="focus-label">优先处理</span>
              <p className="focus-text">{priorityItem}</p>
            </div>
          )}
          <div className="focus-stats">
            <div className="focus-stat">
              <span>待办</span>
              <b>{pendingTodos}</b>
            </div>
            <div className="focus-stat">
              <span>待购</span>
              <b>{pendingPurchase}</b>
            </div>
            <div className="focus-stat">
              <span>预算余额</span>
              <b>¥{hasBudget ? remaining.toLocaleString() : '--'}</b>
            </div>
            <div className="focus-stat">
              <span>使用率</span>
              <b>{usageRate}%</b>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Mobile: 3 Summary Cards */}
      <div className="mobile-summary-cards">
        <div className="metric-card mobile-metric-budget">
          <span><IconDollar size={14} /> 预算余额</span>
          <b>¥{hasBudget ? remaining.toLocaleString() : '--'}</b>
          <em>{hasBudget ? `使用率 ${usageRate}%` : '未设置预算'}</em>
        </div>
        <div className="metric-card mobile-metric-todo">
          <span><IconCheck size={14} /> 待办 / 待购</span>
          <b>{pendingTodos} / {pendingPurchase}</b>
          <em>项待处理 / 项待采购</em>
        </div>
        <div className="metric-card mobile-metric-expense">
          <span><IconDollar size={14} /> 最近支出</span>
          <b>{recentExpense ? `¥${recentExpense.amount.toLocaleString()}` : '--'}</b>
          <em>{recentExpense ? recentExpense.title : '暂无记录'}</em>
        </div>
      </div>
    </>
  );
};

export default TodayFocus;

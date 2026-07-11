import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, getBudgetRemaining } from '../../data/store';
import { IconPlus, IconDollar, IconMap, IconClock } from '../common/Icons';

export const ReminderCard: React.FC = () => {
  const state = useStore();
  const navigate = useNavigate();
  const remaining = getBudgetRemaining();

  const hasBudget = state.budget.total > 0;
  const pendingTodos = state.todos.filter(t => t.projectId === state.activeProjectId && !t.completed).length;
  const currentStage = state.stages.find(s => s.id === state.projects.find(p => p.id === state.activeProjectId)?.currentStageId);

  const reminderText = hasBudget
    ? `当前阶段：${currentStage?.name || '设计与开工准备'}，预算余额 ¥${remaining.toLocaleString()}`
    : `总预算还没有设置，先在"预算设置与阶段分配"里填好总预算，再看余额和使用率。`;

  return (
    <section className="hero-card">
      <div className="hero-main">
        <div className="hero-content">
          <span className="eyebrow">今日提醒</span>
          <h1>今日装修提醒</h1>
          <p>{reminderText}</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => {
              document.getElementById('todoText')?.focus();
            }}>
              <IconPlus size={16} />
              新增待办
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/expense')}>
              <IconDollar size={16} />
              记一笔
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/flow')}>
              <IconMap size={16} />
              看流程
            </button>
          </div>
        </div>
        <div className="home-illus" aria-hidden="true">
          <div className="illus-icon">
            <IconClock size={64} />
          </div>
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="side-state">
        <div className="state-card">
          <span>待办事项</span>
          <b>{pendingTodos}</b>
          <small>项待处理</small>
        </div>
        <div className="state-card">
          <span>待购材料</span>
          <b>{state.selectedPurchaseIds.length + state.syncedModelIds.length}</b>
          <small>项待采购</small>
        </div>
        <div className="state-card">
          <span>预算余额</span>
          <b>¥{hasBudget ? remaining.toLocaleString() : '--'}</b>
          <small>{hasBudget ? `使用率 ${Math.round((state.budget.spent / state.budget.total) * 100)}%` : '未设置'}</small>
        </div>
      </div>
    </section>
  );
};

export default ReminderCard;

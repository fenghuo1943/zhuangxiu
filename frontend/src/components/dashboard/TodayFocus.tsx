import React, { useState } from 'react';
import { useStore, toggleTodo, getOrderedFlowSteps, getFirstUndoneStepId } from '../../data/store';
import type { Todo } from '../../data/types';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconStar, IconCheck, IconCalendar } from '../common/Icons';
import { TodoDetail } from './TodoDetail';

export const TodayFocus: React.FC = () => {
  const state = useStore();
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  const topPendingTodos = state.todos
    .filter(t => t.projectId === state.activeProjectId && !t.completed)
    .slice(0, 3);

  const flowSteps = getOrderedFlowSteps(state.flowType);
  const currentStepId = getFirstUndoneStepId();

  const scrollToTodos = () => {
    document.getElementById('homeTodoCard')?.scrollIntoView({ behavior: 'smooth' });
  };

  // 格式化日期为中文格式
  const formatDateCN = (date: string): string => {
    const parts = date.split('-');
    if (parts.length < 2) return date;
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    return `${month}月${day}日`;
  };

  // 获取待办日期状态
  const getTodoDateStatus = (todo: Todo): 'overdue' | 'active' | 'upcoming' | 'none' => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const end = todo.plannedEndDate;
    const start = todo.plannedStartDate;

    if (end) {
      const endDate = new Date(end);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < today) return 'overdue';
    }

    if (start) {
      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
      if (startDate > today) return 'upcoming';
    }

    if (start || end) return 'active';

    return 'none';
  };

  // 获取日期状态对应的颜色
  const getDateStatusColor = (status: 'overdue' | 'active' | 'upcoming' | 'none'): string => {
    switch (status) {
      case 'overdue': return '#e45b3f';
      case 'active': return '#5f9f77';
      case 'upcoming': return '#d4a843';
      case 'none': return 'var(--fresh-subtle)';
    }
  };

  // 格式化日期范围显示
  const formatDateRange = (todo: Todo): { text: string; color: string } => {
    const start = todo.plannedStartDate;
    const end = todo.plannedEndDate;
    const status = getTodoDateStatus(todo);
    const color = getDateStatusColor(status);

    if (!start && !end) return { text: '无截止日期', color };
    if (start && !end) return { text: `${formatDateCN(start)}-未定`, color };
    if (!start && end) return { text: `未定-${formatDateCN(end)}`, color };
    return { text: `${formatDateCN(start)}-${formatDateCN(end)}`, color };
  };

  return (
    <>
      {/* Desktop: Full TodayFocus */}
      <Card className="today-focus-card desktop-only">
        <CardHeader>
          <div className="card-title-row">
            <span className="iconbox iconbox-amber">
              <IconStar size={16} />
            </span>
            <h3>最近待办</h3>
          </div>
          <button className="btn btn-outline btn-sm" onClick={scrollToTodos}>
            全部待办
          </button>
        </CardHeader>
        <CardBody>
          {topPendingTodos.length > 0 ? (
            <div className="focus-todo-list">
              {topPendingTodos.map(todo => {
                const stage = state.stages.find(s => s.id === todo.stageId);
                const flowStep = todo.flowStepId ? flowSteps.find(s => s.id === todo.flowStepId) : null;
                return (
                  <div key={todo.id} className="fresh-todo">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                      aria-label={`标记${todo.title}为${todo.completed ? '未完成' : '已完成'}`}
                    />
                    <div
                      className="fresh-todo-content"
                      onClick={() => setSelectedTodo(todo)}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="fresh-todo-title">{todo.title}</span>
                      <div className="fresh-todo-meta">
                        {stage && <span className="fresh-todo-stage" style={{ color: 'var(--fresh-subtle)' }}>{stage.name}</span>}
                        {flowStep && <span className="fresh-todo-flow-step" style={{ color: 'var(--fresh-coral)' }}>#{flowStep.order} {flowStep.title}</span>}
                        <span className="fresh-todo-date" style={{ color: formatDateRange(todo).color }}>
                          <IconCalendar size={12} />
                          {formatDateRange(todo).text}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="focus-empty">
              <IconCheck size={14} />
              <span>暂无待办事项</span>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Mobile: 3 Summary Cards */}
      <div className="mobile-summary-cards">
        {topPendingTodos.length > 0 ? (
          topPendingTodos.map(todo => {
            const stage = state.stages.find(s => s.id === todo.stageId);
            return (
              <div key={todo.id} className="metric-card" onClick={() => setSelectedTodo(todo)} style={{ cursor: 'pointer' }}>
                <div className="metric-card-body">
                  <div className="metric-card-header">
                    <span className="iconbox iconbox-amber">
                      <IconCheck size={14} />
                    </span>
                    <span>待办事项</span>
                  </div>
                  <b>{todo.title}</b>
                  {stage && <span style={{ fontSize: 12, color: 'var(--fresh-subtle)' }}>{stage.name}</span>}
                </div>
              </div>
            );
          })
        ) : (
          <div className="metric-card">
            <div className="metric-card-body">
              <div className="metric-card-header">
                <span className="iconbox iconbox-amber">
                  <IconCheck size={14} />
                </span>
                <span>待办事项</span>
              </div>
              <b>暂无待办</b>
            </div>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedTodo && (
        <TodoDetail todo={selectedTodo} onClose={() => setSelectedTodo(null)} />
      )}
    </>
  );
};

export default TodayFocus;

import React from 'react';
import { useStore } from '../../data/store';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconStar, IconCheck } from '../common/Icons';

export const TodayFocus: React.FC = () => {
  const state = useStore();
  const topPendingTodos = state.todos
    .filter(t => t.projectId === state.activeProjectId && !t.completed)
    .slice(0, 3);

  const scrollToTodos = () => {
    document.getElementById('homeTodoCard')?.scrollIntoView({ behavior: 'smooth' });
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
              {topPendingTodos.map(todo => (
                <div key={todo.id} className="focus-todo-item">
                  <IconCheck size={14} className="focus-todo-icon" />
                  <span className="focus-todo-text">{todo.title}</span>
                </div>
              ))}
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
          topPendingTodos.map(todo => (
            <div key={todo.id} className="metric-card">
              <div className="metric-card-body">
                <div className="metric-card-header">
                  <span className="iconbox iconbox-amber">
                    <IconCheck size={14} />
                  </span>
                  <span>待办事项</span>
                </div>
                <b>{todo.title}</b>
              </div>
            </div>
          ))
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
    </>
  );
};

export default TodayFocus;

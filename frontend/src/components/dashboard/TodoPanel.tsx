import React, { useState } from 'react';
import { useStore, addTodo, toggleTodo, deleteTodo } from '../../data/store';
import { Card, CardHeader, CardBody } from '../common/Card';
import { EmptyState } from '../common/EmptyState';
import { IconCheck, IconTrash, IconPlus, IconCalendar } from '../common/Icons';

type TodoMode = 'detailed' | 'simple';

export const TodoPanel: React.FC = () => {
  const state = useStore();
  const [mode, setMode] = useState<TodoMode>('detailed');
  const [newTitle, setNewTitle] = useState('');
  const [newStageId, setNewStageId] = useState('design');
  const [newDueDate, setNewDueDate] = useState('');

  const projectTodos = state.todos.filter(t => t.projectId === state.activeProjectId);
  const pendingTodos = projectTodos.filter(t => !t.completed);
  const completedTodos = projectTodos.filter(t => t.completed);

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    addTodo(title, newStageId, newDueDate || undefined);
    setNewTitle('');
    setNewDueDate('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  const currentStage = state.stages;

  return (
    <Card id="homeTodoCard">
      <CardHeader>
        <div className="card-title-row">
          <span className="iconbox iconbox-green">
            <IconCheck size={16} />
          </span>
          <div>
            <h3>待办事项</h3>
            <span className="card-subtitle">{pendingTodos.length} 项待处理</span>
          </div>
        </div>
        <div className="card-header-actions">
          <div className="mode-switch">
            <button
              className={`mode-btn ${mode === 'detailed' ? 'active' : ''}`}
              onClick={() => setMode('detailed')}
            >
              详细
            </button>
            <button
              className={`mode-btn ${mode === 'simple' ? 'active' : ''}`}
              onClick={() => setMode('simple')}
            >
              简洁
            </button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {/* Add Todo Form */}
        <div className="todo-add-row">
          <input
            id="todoText"
            type="text"
            className="input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="新增待办..."
          />
          {mode === 'detailed' && (
            <>
              <select
                className="input todo-stage-select"
                value={newStageId}
                onChange={(e) => setNewStageId(e.target.value)}
              >
                {currentStage.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                type="date"
                className="input todo-date-input"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
            </>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>
            <IconPlus size={14} />
            添加
          </button>
        </div>

        {/* Todo List */}
        {projectTodos.length === 0 ? (
          <EmptyState
            icon="📝"
            title="今天还没有待办"
            description="可以先添加一项"
          />
        ) : (
          <div id="todoList" className="todo-list">
            {/* Pending */}
            {pendingTodos.map(todo => {
              const stage = state.stages.find(s => s.id === todo.stageId);
              return (
                <div key={todo.id} className={`fresh-todo ${todo.completed ? 'done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                    aria-label={`标记${todo.title}为${todo.completed ? '未完成' : '已完成'}`}
                  />
                  <div className="fresh-todo-content">
                    <span className="fresh-todo-title">{todo.title}</span>
                    <div className="fresh-todo-meta">
                      {stage && <span className="fresh-todo-stage" style={{ color: 'var(--fresh-subtle)' }}>{stage.name}</span>}
                      {todo.dueDate && (
                        <span className="fresh-todo-date" style={{ color: 'var(--fresh-subtle)' }}>
                          <IconCalendar size={12} />
                          {todo.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="fresh-actions">
                    <button
                      className="fresh-icon-btn"
                      onClick={() => deleteTodo(todo.id)}
                      aria-label={`删除${todo.title}`}
                      title="删除"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Completed */}
            {completedTodos.length > 0 && (
              <>
                <div className="todo-section-divider">
                  <span>已完成 ({completedTodos.length})</span>
                </div>
                {completedTodos.map(todo => (
                  <div key={todo.id} className="fresh-todo done">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                      aria-label={`取消${todo.title}的完成状态`}
                    />
                    <div className="fresh-todo-content">
                      <span className="fresh-todo-title">{todo.title}</span>
                    </div>
                    <div className="fresh-actions">
                      <button
                        className="fresh-icon-btn"
                        onClick={() => deleteTodo(todo.id)}
                        aria-label={`删除${todo.title}`}
                        title="删除"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default TodoPanel;

import React, { useState, useCallback, useRef } from 'react';
import { useStore, addTodo, toggleTodo, deleteTodo, reorderTodos, getOrderedFlowSteps, getFirstUndoneStepId } from '../../data/store';
import type { Todo } from '../../data/types';
import { Card, CardHeader, CardBody } from '../common/Card';
import { EmptyState } from '../common/EmptyState';
import { IconCheck, IconTrash, IconCalendar, IconDrag, IconPlus, IconSearch } from '../common/Icons';
import { TodoDetail } from './TodoDetail';

type TodoMode = 'detailed' | 'simple';

export const TodoPanel: React.FC = () => {
  const state = useStore();
  const [mode, setMode] = useState<TodoMode>('detailed');
  const [newTitle, setNewTitle] = useState('');
  const [newStageId, setNewStageId] = useState('stage_prepare');
  const [newFlowStepId, setNewFlowStepId] = useState(getFirstUndoneStepId());
  const [newStartDate, setNewStartDate] = useState('');
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isMobileAddOpen, setIsMobileAddOpen] = useState(false);

  // 筛选状态
  const [filterStageId, setFilterStageId] = useState<string>('all');
  const [filterFlowStepId, setFilterFlowStepId] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const projectTodos = state.todos.filter(t => t.projectId === state.activeProjectId);

  // 筛选后的待办列表
  const filteredTodos = projectTodos.filter(t => {
    // 筛选分类
    if (filterStageId !== 'all' && t.stageId !== filterStageId) return false;
    // 筛选阶段路线
    if (filterFlowStepId !== 'all' && t.flowStepId !== filterFlowStepId) return false;
    // 筛选关键词
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      if (!t.title.toLowerCase().includes(keyword)) return false;
    }
    return true;
  });

  const pendingTodos = filteredTodos.filter(t => !t.completed).sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const completedTodos = filteredTodos.filter(t => t.completed);

  const flowSteps = getOrderedFlowSteps(state.flowType);
  const currentStepId = getFirstUndoneStepId();

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    addTodo(title, newStageId, newFlowStepId || undefined, newStartDate || undefined);
    setNewTitle('');
    setNewStartDate('');
    setIsMobileAddOpen(false);
  };

  // 格式化日期为中文格式 (MM-DD -> X月X日)
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

    // 有结束日期且已过期
    if (end) {
      const endDate = new Date(end);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < today) return 'overdue';
    }

    // 有开始日期且今天之后才开始
    if (start) {
      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
      if (startDate > today) return 'upcoming';
    }

    // 有开始或结束日期，且在进行中
    if (start || end) return 'active';

    return 'none';
  };

  // 获取日期状态对应的颜色
  const getDateStatusColor = (status: 'overdue' | 'active' | 'upcoming' | 'none'): string => {
    switch (status) {
      case 'overdue': return '#e45b3f'; // 红色 - 已过期
      case 'active': return '#5f9f77'; // 绿色 - 进行中
      case 'upcoming': return '#d4a843'; // 黄色 - 未开始
      case 'none': return 'var(--fresh-subtle)'; // 灰色 - 无日期
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
    return { text: `${formatDateCN(start!)}-${formatDateCN(end!)}`, color };
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  // 拖拽处理函数
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      reorderTodos(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex]);

  const currentStage = state.stages;

  return (
    <Card id="homeTodoCard">
      <CardHeader>
        <div className="card-title-row todo-card-title-row">
          <div className="todo-title-group">
            <span className="iconbox iconbox-green">
              <IconCheck size={16} />
            </span>
            <div>
              <h3>待办事项</h3>
              <span className="card-subtitle">{pendingTodos.length} 项待处理</span>
            </div>
          </div>
          <div className="todo-header-right">
            <div className="todo-search-box">
              <IconSearch size={14} className="todo-search-icon" />
              <input
                type="text"
                className="input todo-search-input"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索待办..."
                aria-label="搜索待办事项"
              />
            </div>
            <button
              type="button"
              className="mobile-todo-add-trigger"
              aria-label="新增待办"
              title="新增待办"
              onClick={() => setIsMobileAddOpen(true)}
            >
              <IconPlus size={18} />
            </button>
          </div>
        </div>
        <div className="card-header-actions">
          <div className="todo-filters">
            <select
              className="input todo-filter-select"
              value={filterStageId}
              onChange={(e) => setFilterStageId(e.target.value)}
              title="筛选分类"
            >
              <option value="all">全部分类</option>
              {state.stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              className="input todo-filter-select"
              value={filterFlowStepId}
              onChange={(e) => setFilterFlowStepId(e.target.value)}
              title="筛选阶段"
            >
              <option value="all">全部阶段</option>
              {flowSteps.map(step => (
                <option key={step.id} value={step.id}>
                  {step.order}. {step.title}
                </option>
              ))}
            </select>
          </div>
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
          <div className="todo-mobile-search mobile-only">
            <div className="todo-search-box" style={{ display: 'block', width: '100%' }}>
              <IconSearch size={14} className="todo-search-icon" />
              <input
                type="text"
                className="input todo-search-input"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索待办..."
                aria-label="搜索待办事项"
              />
            </div>
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
                name="todoStage"
                value={newStageId}
                onChange={(e) => setNewStageId(e.target.value)}
              >
                {currentStage.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                className="input todo-flow-step-select"
                name="todoFlowStep"
                value={newFlowStepId}
                onChange={(e) => setNewFlowStepId(e.target.value)}
                title="选择阶段路线"
              >
                <option value="">不关联阶段</option>
                {flowSteps.map(step => (
                  <option key={step.id} value={step.id}>
                    {step.order}. {step.title}{step.id === currentStepId ? ' (当前)' : ''}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="input todo-date-input"
                name="todoStartDate"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                title="计划开始日期"
              />
            </>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleAdd} style={{ textAlign: 'center' }}>
            添加
          </button>
        </div>

        {isMobileAddOpen && (
          <div className="mobile-todo-modal" onClick={() => setIsMobileAddOpen(false)}>
            <div className="mobile-todo-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-todo-modal-header">
                <h4>新增待办</h4>
                <button
                  type="button"
                  className="mobile-todo-close"
                  aria-label="关闭"
                  onClick={() => setIsMobileAddOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="mobile-todo-form">
                <input
                  type="text"
                  className="input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="待办内容"
                  autoFocus
                />
                {mode === 'detailed' && (
                  <>
                    <select
                      className="input todo-stage-select"
                      name="mobileTodoStage"
                      value={newStageId}
                      onChange={(e) => setNewStageId(e.target.value)}
                    >
                      {currentStage.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select
                      className="input todo-flow-step-select"
                      name="mobileTodoFlowStep"
                      value={newFlowStepId}
                      onChange={(e) => setNewFlowStepId(e.target.value)}
                    >
                      <option value="">不关联阶段</option>
                      {flowSteps.map(step => (
                        <option key={step.id} value={step.id}>
                          {step.order}. {step.title}{step.id === currentStepId ? ' (当前)' : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className="input todo-date-input"
                      name="mobileTodoStartDate"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                    />
                  </>
                )}
                <button className="btn btn-primary" onClick={handleAdd}>
                  添加
                </button>
              </div>
            </div>
          </div>
        )}

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
            {pendingTodos.map((todo, index) => {
              const stage = state.stages.find(s => s.id === todo.stageId);
              const flowStep = todo.flowStepId ? flowSteps.find(s => s.id === todo.flowStepId) : null;
              return (
                <div
                  key={todo.id}
                  className={`fresh-todo ${todo.completed ? 'done' : ''} ${dragIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div
                    className="fresh-drag-handle"
                    title="拖拽排序"
                  >
                    <IconDrag size={14} />
                  </div>
                  <input
                    type="checkbox"
                    name={`todo-complete-${todo.id}`}
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
                {completedTodos.map(todo => {
                  const stage = state.stages.find(s => s.id === todo.stageId);
                  const flowStep = todo.flowStepId ? flowSteps.find(s => s.id === todo.flowStepId) : null;
                  return (
                    <div key={todo.id} className="fresh-todo done">
                      <input
                        type="checkbox"
                        name={`todo-complete-${todo.id}`}
                        checked={todo.completed}
                        onChange={() => toggleTodo(todo.id)}
                        aria-label={`取消${todo.title}的完成状态`}
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
              </>
            )}
          </div>
        )}
      </CardBody>

      {/* 详情弹窗 */}
      {selectedTodo && (
        <TodoDetail todo={selectedTodo} onClose={() => setSelectedTodo(null)} />
      )}
    </Card>
  );
};

export default TodoPanel;

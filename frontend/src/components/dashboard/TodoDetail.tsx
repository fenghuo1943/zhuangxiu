import React, { useState, useRef, useEffect } from 'react';
import { useStore, updateTodo, addTodoSubItem, toggleTodoSubItem, deleteTodoSubItem, getOrderedFlowSteps } from '../../data/store';
import type { Todo, TodoSubItem } from '../../data/types';
import { IconX, IconPlus, IconTrash } from '../common/Icons';

interface TodoDetailProps {
  todo: Todo;
  onClose: () => void;
}

export const TodoDetail: React.FC<TodoDetailProps> = ({ todo, onClose }) => {
  const state = useStore();
  const [stageId, setStageId] = useState(todo.stageId);
  const [flowStepId, setFlowStepId] = useState(todo.flowStepId || '');
  const [description, setDescription] = useState(todo.description || '');
  const [plannedStartDate, setPlannedStartDate] = useState(todo.plannedStartDate || '');
  const [plannedEndDate, setPlannedEndDate] = useState(todo.plannedEndDate || '');
  const [actualStartDate, setActualStartDate] = useState(todo.actualStartDate || '');
  const [actualEndDate, setActualEndDate] = useState(todo.actualEndDate || '');
  const [subItems, setSubItems] = useState<TodoSubItem[]>(todo.subItems || []);
  const [newSubItemTitle, setNewSubItemTitle] = useState('');
  const subInputRef = useRef<HTMLInputElement>(null);

  const flowSteps = getOrderedFlowSteps(state.flowType);

  // 点击外部关闭
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleAddSubItem = () => {
    const title = newSubItemTitle.trim();
    if (!title) return;
    const newSubItem: TodoSubItem = {
      id: `sub_${Date.now()}`,
      title,
      completed: false,
    };
    setSubItems([...subItems, newSubItem]);
    setNewSubItemTitle('');
    subInputRef.current?.focus();
  };

  const handleSubKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddSubItem();
  };

  const handleToggleSubItem = (subItemId: string) => {
    setSubItems(subItems.map(s =>
      s.id === subItemId ? { ...s, completed: !s.completed } : s
    ));
  };

  const handleDeleteSubItem = (subItemId: string) => {
    setSubItems(subItems.filter(s => s.id !== subItemId));
  };

  const handleSave = () => {
    updateTodo(todo.id, {
      stageId,
      flowStepId: flowStepId || undefined,
      description: description || undefined,
      plannedStartDate: plannedStartDate || undefined,
      plannedEndDate: plannedEndDate || undefined,
      actualStartDate: actualStartDate || undefined,
      actualEndDate: actualEndDate || undefined,
      subItems: subItems.length > 0 ? subItems : undefined,
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="todo-detail-overlay" ref={overlayRef} onKeyDown={handleKeyDown}>
      <div className="todo-detail-modal">
        {/* 头部：名称 + 关闭按钮 */}
        <div className="todo-detail-header">
          <h3 className="todo-detail-title">{todo.title}</h3>
          <button className="todo-detail-close" onClick={onClose} title="关闭">
            <IconX size={18} />
          </button>
        </div>

        {/* 分类和阶段 */}
        <div className="todo-detail-row">
          <div className="todo-detail-field">
            <label>分类</label>
            <select
              className="input"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
            >
              {state.stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="todo-detail-field">
            <label>阶段路线</label>
            <select
              className="input"
              value={flowStepId}
              onChange={(e) => setFlowStepId(e.target.value)}
            >
              <option value="">不关联</option>
              {flowSteps.map(step => (
                <option key={step.id} value={step.id}>
                  {step.order}. {step.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 补充说明 */}
        <div className="todo-detail-section">
          <label>补充说明</label>
          <textarea
            className="input todo-detail-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="输入补充说明..."
            rows={3}
          />
        </div>

        {/* 日期 */}
        <div className="todo-detail-section">
          <label>日期</label>
          <div className="todo-detail-dates">
            <div className="todo-detail-date-field">
              <span>计划开始</span>
              <input
                type="date"
                className="input"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
              />
            </div>
            <div className="todo-detail-date-field">
              <span>计划结束</span>
              <input
                type="date"
                className="input"
                value={plannedEndDate}
                onChange={(e) => setPlannedEndDate(e.target.value)}
              />
            </div>
            <div className="todo-detail-date-field">
              <span>实际开始</span>
              <input
                type="date"
                className="input"
                value={actualStartDate}
                onChange={(e) => setActualStartDate(e.target.value)}
              />
            </div>
            <div className="todo-detail-date-field">
              <span>实际结束</span>
              <input
                type="date"
                className="input"
                value={actualEndDate}
                onChange={(e) => setActualEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 子项 */}
        <div className="todo-detail-section">
          <label>子项</label>
          <div className="todo-detail-subitems">
            {subItems.map(subItem => (
              <div key={subItem.id} className="todo-detail-subitem">
                <input
                  type="checkbox"
                  checked={subItem.completed}
                  onChange={() => handleToggleSubItem(subItem.id)}
                  aria-label={`标记${subItem.title}为${subItem.completed ? '未完成' : '已完成'}`}
                />
                <span className={subItem.completed ? 'done' : ''}>{subItem.title}</span>
                <button
                  className="todo-detail-subitem-delete"
                  onClick={() => handleDeleteSubItem(subItem.id)}
                  aria-label={`删除${subItem.title}`}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
            <div className="todo-detail-subitem-add">
              <input
                ref={subInputRef}
                type="text"
                className="input"
                value={newSubItemTitle}
                onChange={(e) => setNewSubItemTitle(e.target.value)}
                onKeyDown={handleSubKeyDown}
                placeholder="添加子项..."
              />
              <button className="btn btn-sm btn-primary" onClick={handleAddSubItem}>
                <IconPlus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="todo-detail-footer">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
};

export default TodoDetail;

import React, { useState, useCallback, useEffect } from 'react';
import type { FlowStep, FlowResource } from '../../data/types';
import { useStore, toggleFlowStepDone, getStageNotes, addStageNote, updateStageNote, removeStageNote, loadStageNotes } from '../../data/store';
import { IconCheck, IconChevronDown, IconBook, IconShield, IconStar, IconAlert, IconEdit } from '../common/Icons';

interface FlowStepCardProps {
  step: FlowStep;
  isExpanded: boolean;
  onToggle: () => void;
  onResourceClick: (resource: FlowResource) => void;
}

const resourceLabel: Record<string, string> = {
  standard: '施工标准',
  acceptance: '验收标准',
  article: '攻略文章',
  pitfall: '避坑指南',
};

const resourceIcon: Record<string, React.ReactNode> = {
  standard: <IconCheck size={14} />,
  acceptance: <IconShield size={14} />,
  article: <IconStar size={14} />,
  pitfall: <IconAlert size={14} />,
};

const resourceBadgeClass: Record<string, string> = {
  standard: 'badge-success',
  acceptance: 'badge-info',
  article: 'badge-warning',
  pitfall: 'badge-danger',
};

export const FlowStepCard: React.FC<FlowStepCardProps> = ({ step, isExpanded, onToggle, onResourceClick }) => {
  const state = useStore();
  const isDone = state.flowDoneStepIds.includes(step.id);
  const [noteInput, setNoteInput] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');

  const notes = getStageNotes(step.id);

  // Load notes from backend when expanded
  useEffect(() => {
    if (isExpanded) {
      loadStageNotes(step.id);
    }
  }, [isExpanded, step.id]);

  const resources = [
    ...step.standards.map(r => ({ ...r, group: 'standard' as const })),
    ...step.acceptance.map(r => ({ ...r, group: 'acceptance' as const })),
    ...step.articles.map(r => ({ ...r, group: 'article' as const })),
    ...step.pitfalls.map(r => ({ ...r, group: 'pitfall' as const })),
  ];

  const grouped: Record<string, typeof resources> = {};
  resources.forEach(r => {
    if (!grouped[r.group]) grouped[r.group] = [];
    grouped[r.group].push(r);
  });

  const handleAddNote = useCallback(async () => {
    if (!noteInput.trim()) return;
    await addStageNote(step.id, noteInput.trim());
    setNoteInput('');
  }, [noteInput, step.id]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    await removeStageNote(step.id, noteId);
  }, [step.id]);

  const handleStartEditNote = useCallback((noteId: string, content: string) => {
    setEditingNoteId(noteId);
    setEditNoteContent(content);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditNoteContent('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingNoteId || !editNoteContent.trim()) return;
    await updateStageNote(step.id, editingNoteId, editNoteContent.trim());
    setEditingNoteId(null);
    setEditNoteContent('');
  }, [editingNoteId, editNoteContent, step.id]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const handleNoteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  }, [handleAddNote]);

  return (
    <div className={`flow-step-card ${isDone ? 'done' : ''} ${isExpanded ? 'expanded' : ''}`} id={`step-${step.id}`}>
      <div className="flow-step-header" onClick={onToggle} role="button" tabIndex={0} aria-expanded={isExpanded}>
        <div className="flow-step-header-left">
          <span className="flow-step-num">{step.order}</span>
          <div className="flow-step-info">
            <strong className="flow-step-title">
              {step.title}
              {step.isCustom && <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: 10 }}>自定义</span>}
            </strong>
            <span className="flow-step-days">预计工期：{step.days}</span>
          </div>
        </div>
        <div className="flow-step-header-right">
          {isDone && <span className="badge badge-success">✓ 已完成</span>}
          {notes.length > 0 && (
            <span className="badge" style={{ background: '#f0e6dc', color: '#8b7355', marginRight: 4 }}>
              📝 {notes.length}
            </span>
          )}
          <span className={`flow-step-chevron ${isExpanded ? 'open' : ''}`}>
            <IconChevronDown size={18} />
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="flow-step-body">
          <p className="flow-step-desc">{step.desc}</p>

          {Object.keys(grouped).length > 0 ? (
            <div className="flow-resource-grid">
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="flow-resource-block">
                  <h4 className="flow-resource-title">
                    <span className={`badge ${resourceBadgeClass[group] || 'badge-default'}`}>
                      {resourceIcon[group]} {resourceLabel[group] || group}
                    </span>
                  </h4>
                  <ul className="flow-resource-list">
                    {items.map(item => (
                      <li
                        key={item.id}
                        className="flow-resource-item flow-resource-clickable"
                        onClick={(e) => { e.stopPropagation(); onResourceClick(item); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onResourceClick(item);
                          }
                        }}
                      >
                        <span className="flow-resource-item-icon">
                          {group === 'standard' && <IconBook size={14} />}
                          {group === 'acceptance' && <IconShield size={14} />}
                          {group === 'article' && <IconStar size={14} />}
                          {group === 'pitfall' && <IconAlert size={14} />}
                        </span>
                        <span>{item.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '16px 0' }}>
              <p className="empty-state-desc">该节点暂未关联扩展资料，请以施工与验收要点为准。</p>
            </div>
          )}

          {/* ===== Stage Notes Section ===== */}
          <div className="flow-notes-section">
            <button
              className="flow-notes-toggle"
              onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); }}
            >
              <span>📝 备注 ({notes.length})</span>
              <span className={`flow-step-chevron ${showNotes ? 'open' : ''}`}>
                <IconChevronDown size={14} />
              </span>
            </button>

            {showNotes && (
              <div className="flow-notes-body">
                {/* Existing notes */}
                {notes.length > 0 && (
                  <ul className="flow-notes-list">
                    {notes.map(note => (
                      <li key={note.id} className="flow-notes-item">
                        {editingNoteId === note.id ? (
                          /* Edit mode */
                          <div className="flow-notes-edit-row">
                            <input
                              type="text"
                              className="flow-notes-input"
                              value={editNoteContent}
                              onChange={e => setEditNoteContent(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              onClick={e => e.stopPropagation()}
                              autoFocus
                            />
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                              disabled={!editNoteContent.trim()}
                            >
                              保存
                            </button>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          /* View mode */
                          <>
                            <span className="flow-notes-content">{note.content}</span>
                            <span className="flow-notes-meta">
                              {new Date(note.created_at).toLocaleDateString('zh-CN')}
                            </span>
                            <button
                              className="flow-notes-edit-btn"
                              onClick={(e) => { e.stopPropagation(); handleStartEditNote(note.id, note.content); }}
                              title="编辑备注"
                            >
                              <IconEdit size={12} />
                            </button>
                            <button
                              className="flow-notes-delete"
                              onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                              title="删除备注"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add note input */}
                <div className="flow-notes-input-row">
                  <input
                    type="text"
                    className="flow-notes-input"
                    placeholder="添加备注... (Enter 提交)"
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={handleNoteKeyDown}
                    onClick={e => e.stopPropagation()}
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={(e) => { e.stopPropagation(); handleAddNote(); }}
                    disabled={!noteInput.trim()}
                  >
                    添加
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flow-step-footer">
            <button
              className={`btn ${isDone ? 'btn-outline' : 'btn-green'}`}
              onClick={(e) => { e.stopPropagation(); toggleFlowStepDone(step.id); }}
            >
              <IconCheck size={16} />
              {isDone ? '取消完成' : '标记完成'}
            </button>
            {step.isCustom && (
              <span style={{ fontSize: 12, color: 'var(--fresh-subtle)', marginLeft: 12 }}>
                自定义阶段 — 可在流程页面中删除
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowStepCard;

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import FlowHero from '../components/flow/FlowHero';
import FlowStepCard from '../components/flow/FlowStepCard';
import KnowledgeModal from '../components/flow/KnowledgeModal';
import type { FlowResource } from '../data/types';
import { useStore, setFlowCustomOrder, getOrderedFlowSteps, addCustomFlowStep, removeCustomFlowStep, loadCustomFlowSteps, loadFlowFromBackend, loadFlowStagesFromBackend } from '../data/store';
import { IconEdit, IconCheck, IconChevronUp, IconChevronDown, IconPlus } from '../components/common/Icons';

const FlowPage: React.FC = () => {
  const state = useStore();
  const orderedSteps = useMemo(() => getOrderedFlowSteps(state.flowType), [state.flowType, state.flowCustomOrder, state.customFlowSteps]);
  const doneSet = new Set(state.flowDoneStepIds);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStage, setNewStage] = useState({ title: '', days: '', desc: '' });
  const [selectedResource, setSelectedResource] = useState<FlowResource | null>(null);

  // Load flow data from backend on mount
  useEffect(() => {
    loadFlowFromBackend();
    loadCustomFlowSteps();
    loadFlowStagesFromBackend('new');
    loadFlowStagesFromBackend('old');
  }, []);

  const firstUndoneId = useMemo(() => {
    const first = orderedSteps.find(s => !doneSet.has(s.id));
    return first?.id || orderedSteps[0]?.id;
  }, [orderedSteps, doneSet]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set([firstUndoneId]));

  useEffect(() => {
    setExpandedIds(new Set([firstUndoneId]));
  }, [state.flowType, firstUndoneId]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setExpandedIds(new Set(orderedSteps.map(s => s.id))), [orderedSteps]);
  const collapseAll = useCallback(() => setExpandedIds(new Set()), []);

  const scrollToStep = useCallback((id: string) => {
    const el = document.getElementById(`step-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setExpandedIds(prev => new Set([...prev, id]));
    }
  }, []);

  // Reorder handlers
  const moveStep = useCallback((index: number, direction: -1 | 1) => {
    const newOrder = orderedSteps.map(s => s.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setFlowCustomOrder(newOrder);
  }, [orderedSteps]);

  const startEditing = () => {
    if (!state.flowCustomOrder) {
      setFlowCustomOrder(orderedSteps.map(s => s.id));
    }
    setIsEditing(true);
  };

  const finishEditing = () => setIsEditing(false);

  const resetOrder = () => {
    setFlowCustomOrder(null);
    setIsEditing(false);
  };

  // Add custom stage
  const handleAddStage = useCallback(async () => {
    if (!newStage.title.trim()) return;
    const sortOrder = orderedSteps.length + 1;
    await addCustomFlowStep(state.flowType, newStage.title.trim(), newStage.days.trim(), newStage.desc.trim(), sortOrder);
    setNewStage({ title: '', days: '', desc: '' });
    setShowAddForm(false);
  }, [newStage, orderedSteps.length, state.flowType]);

  // Delete custom stage
  const handleDeleteCustom = useCallback(async (stepId: string) => {
    if (!confirm('确定要删除这个自定义阶段吗？')) return;
    await removeCustomFlowStep(stepId);
  }, []);

  // Custom step count
  const customCount = state.customFlowSteps.filter(cs => cs.flow_type === state.flowType).length;

  return (
    <AppShell currentPage="flow">
      <div className="flow-page">
        <FlowHero />

        <div className="flow-layout">
          {/* Left: Stage Navigation */}
          <aside className="flow-aside">
            <div className="aside-title">流程阶段</div>
            <div className="flow-bulk-actions">
              <button type="button" onClick={expandAll}>全部展开</button>
              <button type="button" onClick={collapseAll}>全部折叠</button>
            </div>
            <div className="stage-list">
              {orderedSteps.map((step, i) => {
                const isDone = doneSet.has(step.id);
                const isCurrent = step.id === firstUndoneId;
                return (
                  <button
                    key={step.id}
                    className={`stage-chip ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}
                    onClick={() => scrollToStep(step.id)}
                  >
                    <span className="stage-dot"></span>
                    <span>{String(i + 1).padStart(2, '0')} {step.title}{step.isCustom && ' *'}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right: Timeline */}
          <div className="flow-timeline-wrapper">
            {/* Edit Order Toolbar */}
            <div className="flow-edit-toolbar">
              {!isEditing ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-outline btn-sm" onClick={startEditing}>
                    <IconEdit size={14} /> 编辑顺序
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                    <IconPlus size={14} /> 插入阶段
                  </button>
                </div>
              ) : (
                <div className="flow-edit-actions">
                  <span className="flow-edit-hint">拖动或点击箭头调整阶段顺序</span>
                  <button className="btn btn-primary btn-sm" onClick={finishEditing}>
                    <IconCheck size={14} /> 完成
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={resetOrder}>
                    恢复默认
                  </button>
                </div>
              )}
            </div>

            {/* Add Custom Stage Form */}
            {showAddForm && (
              <div className="card" style={{ marginBottom: 16, border: '2px dashed var(--fresh-coral)' }}>
                <div className="card-bd" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--fresh-coral)' }}>
                    ✨ 插入自定义阶段
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="阶段名称（必填）"
                      value={newStage.title}
                      onChange={e => setNewStage({ ...newStage, title: e.target.value })}
                    />
                    <input
                      type="text"
                      className="input"
                      placeholder="预计工期，如：2-3天"
                      value={newStage.days}
                      onChange={e => setNewStage({ ...newStage, days: e.target.value })}
                    />
                    <textarea
                      className="input"
                      placeholder="阶段描述（可选）"
                      rows={2}
                      value={newStage.desc}
                      onChange={e => setNewStage({ ...newStage, desc: e.target.value })}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={handleAddStage} disabled={!newStage.title.trim()}>
                        添加阶段
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddForm(false); setNewStage({ title: '', days: '', desc: '' }); }}>
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flow-timeline">
              {orderedSteps.map((step, index) => (
                <div key={step.id} className={`flow-step-wrapper ${isEditing ? 'editing' : ''}`}>
                  {isEditing && (
                    <div className="flow-step-reorder">
                      <button
                        className="icon-btn"
                        disabled={index === 0}
                        onClick={() => moveStep(index, -1)}
                        title="上移"
                      >
                        <IconChevronUp size={16} />
                      </button>
                      <span className="flow-step-reorder-num">{index + 1}</span>
                      <button
                        className="icon-btn"
                        disabled={index === orderedSteps.length - 1}
                        onClick={() => moveStep(index, 1)}
                        title="下移"
                      >
                        <IconChevronDown size={16} />
                      </button>
                      {step.isCustom && (
                        <button
                          className="icon-btn"
                          onClick={() => handleDeleteCustom(step.id)}
                          title="删除此阶段"
                          style={{ color: 'var(--fresh-coral)', marginLeft: 4 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flow-step-card-wrap">
                    <FlowStepCard
                      step={step}
                      isExpanded={expandedIds.has(step.id)}
                      onToggle={() => toggleExpand(step.id)}
                      onResourceClick={(resource) => setSelectedResource(resource)}
                    />
                    {/* Show delete button for custom steps outside edit mode */}
                    {step.isCustom && !isEditing && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteCustom(step.id)}
                        style={{ marginTop: 4, color: 'var(--fresh-coral)', fontSize: 11 }}
                        title="删除自定义阶段"
                      >
                        删除此自定义阶段
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedResource && (
          <KnowledgeModal
            key={`${selectedResource.type}-${selectedResource.id}`}
            resource={selectedResource}
            onClose={() => setSelectedResource(null)}
          />
        )}
      </div>
    </AppShell>
  );
};

const IconCheckSmall: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default FlowPage;

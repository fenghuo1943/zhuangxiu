import React, { useState, useMemo, useCallback, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import FlowHero from '../components/flow/FlowHero';
import FlowStepCard from '../components/flow/FlowStepCard';
import { useStore, setFlowCustomOrder, getOrderedFlowSteps } from '../data/store';
import { FLOW_STEPS_NEW, FLOW_STEPS_OLD } from '../data/mockData';
import { IconEdit, IconCheck, IconChevronUp, IconChevronDown } from '../components/common/Icons';

const FlowPage: React.FC = () => {
  const state = useStore();
  const orderedSteps = useMemo(() => getOrderedFlowSteps(state.flowType), [state.flowType, state.flowCustomOrder]);
  const doneSet = new Set(state.flowDoneStepIds);
  const [isEditing, setIsEditing] = useState(false);

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
    // Initialize custom order from current display order
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

  return (
    <AppShell currentPage="flow">
      <div className="flow-page">
        <FlowHero />

        <div className="flow-layout">
          {/* Left: Stage Navigation */}
          <aside className="flow-aside">
            <div className="card">
              <div className="card-hd">
                <h3>流程阶段</h3>
                <div className="card-header-actions">
                  <button className="btn btn-ghost btn-sm" onClick={expandAll}>全部展开</button>
                  <button className="btn btn-ghost btn-sm" onClick={collapseAll}>全部折叠</button>
                </div>
              </div>
              <div className="card-bd">
                <div className="flow-stage-chips">
                  {orderedSteps.map((step, i) => {
                    const isDone = doneSet.has(step.id);
                    const isCurrent = step.id === firstUndoneId;
                    return (
                      <button
                        key={step.id}
                        className={`flow-stage-chip ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                        onClick={() => scrollToStep(step.id)}
                      >
                        <span className="flow-chip-num">{i + 1}</span>
                        <span className="flow-chip-name">{step.title}</span>
                        {isDone && <IconCheckSmall />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          {/* Right: Timeline */}
          <div className="flow-timeline-wrapper">
            {/* Edit Order Toolbar */}
            <div className="flow-edit-toolbar">
              {!isEditing ? (
                <button className="btn btn-outline btn-sm" onClick={startEditing}>
                  <IconEdit size={14} /> 编辑顺序
                </button>
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
                    </div>
                  )}
                  <div className="flow-step-card-wrap">
                    <FlowStepCard
                      step={step}
                      isExpanded={expandedIds.has(step.id)}
                      onToggle={() => toggleExpand(step.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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

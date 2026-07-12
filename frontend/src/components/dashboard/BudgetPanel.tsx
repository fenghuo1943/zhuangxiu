import React, { useState, useCallback, useMemo } from 'react';
import { useStore, setTotalBudget, setCategoryAllocation, getBudgetRemaining, getBudgetUsageRate, getFirstUndoneStepId } from '../../data/store';
import { FLOW_STEPS_NEW } from '../../data/mockData';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconPiggy } from '../common/Icons';

// Map budget categories to stages for stage-budget synergy
const CATEGORY_STAGE_MAP: Record<string, string[]> = {
  hard: ['design', 'demolish', 'wall-new', 'electric', 'pipe-sound', 'waterproof', 'tile', 'grout', 'protect', 'ceiling', 'wall-base', 'paint'],
  material: ['window', 'door', 'kitchen', 'custom', 'baseboard'],
  equipment: ['electric', 'kitchen', 'bath'],
  soft: ['light', 'curtain', 'furniture'],
  service: ['design', 'clean'],
};

// Quick-allocate percentages (common装修 budget ratios)
const QUICK_ALLOCATE_RATIOS: Record<string, number> = {
  hard: 0.30,
  material: 0.25,
  equipment: 0.15,
  soft: 0.20,
  service: 0.10,
};

export const BudgetPanel: React.FC = () => {
  const state = useStore();
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState(state.budget.total > 0 ? String(Math.round(state.budget.total)) : '');

  const remaining = getBudgetRemaining();
  const usageRate = getBudgetUsageRate();
  const hasBudget = state.budget.total > 0;
  const currentStepId = getFirstUndoneStepId();

  // Find which budget categories are relevant to the current stage
  const currentStageCategories = useMemo(() => {
    if (!currentStepId) return [];
    return state.budget.categories.filter(cat =>
      CATEGORY_STAGE_MAP[cat.id]?.includes(currentStepId)
    );
  }, [currentStepId, state.budget.categories]);

  // Find current stage name
  const currentStageName = useMemo(() => {
    const step = FLOW_STEPS_NEW.find(s => s.id === currentStepId);
    return step?.title || '';
  }, [currentStepId]);

  const handleTotalSave = useCallback(() => {
    const val = Math.round(parseFloat(totalInput) || 0);
    setTotalBudget(val);
    setEditingTotal(false);
  }, [totalInput]);

  const handleCategoryAllocation = useCallback((catId: string, value: string) => {
    const val = Math.round(parseFloat(value) || 0);
    setCategoryAllocation(catId, val);
  }, []);

  const handleQuickAllocate = useCallback(() => {
    const total = state.budget.total;
    if (total <= 0) return;
    state.budget.categories.forEach(cat => {
      const ratio = QUICK_ALLOCATE_RATIOS[cat.id] || 0.20;
      setCategoryAllocation(cat.id, Math.round(total * ratio));
    });
  }, [state.budget.total, state.budget.categories]);

  const totalAllocated = state.budget.categories.reduce((sum, c) => sum + c.allocated, 0);
  const overBudget = hasBudget && totalAllocated > state.budget.total;

  // Calculate spent as percentage of allocated for each category
  const getSpentPctOfAllocated = (cat: { allocated: number; spent: number }) => {
    if (cat.allocated <= 0) return 0;
    return Math.min(100, Math.round((cat.spent / cat.allocated) * 100));
  };

  return (
    <Card id="homeBudgetCard">
      <CardHeader>
        <div className="card-title-row">
          <span className="iconbox iconbox-coral">
            <IconPiggy size={16} />
          </span>
          <div>
            <h3>预算设置与阶段分配</h3>
          </div>
        </div>
        {hasBudget && (
          <button className="btn btn-ghost btn-sm" onClick={handleQuickAllocate} title="按常见装修预算比例自动分配">
            快速分配
          </button>
        )}
      </CardHeader>
      <CardBody>
        {/* Budget Summary */}
        <div className="budget-summary">
          <div className="budget-stat">
            <span className="budget-stat-label">总预算</span>
            {editingTotal ? (
              <div className="budget-edit-row">
                <input
                  type="number"
                  className="input budget-input"
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTotalSave()}
                  placeholder="输入总预算"
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={handleTotalSave}>确定</button>
                <button className="btn btn-outline btn-sm" onClick={() => { setEditingTotal(false); setTotalInput(String(Math.round(state.budget.total || 0))); }}>取消</button>
              </div>
            ) : (
              <b
                className={`budget-stat-value ${!hasBudget ? 'is-placeholder' : ''}`}
                onClick={() => { setTotalInput(String(Math.round(state.budget.total || 0))); setEditingTotal(true); }}
                style={{ cursor: 'pointer' }}
                title="点击设置总预算"
              >
                {hasBudget ? `¥${Math.round(state.budget.total).toLocaleString()}` : '点击设置'}
              </b>
            )}
          </div>
          <div className="budget-stat">
            <span className="budget-stat-label">已支出</span>
            <b className="budget-stat-value spent">¥{Math.round(state.budget.spent).toLocaleString()}</b>
          </div>
          <div className="budget-stat">
            <span className="budget-stat-label">剩余</span>
            <b className={`budget-stat-value ${remaining < 0 ? 'over' : ''}`}>
              ¥{Math.round(remaining).toLocaleString()}
            </b>
          </div>
          <div className="budget-stat">
            <span className="budget-stat-label">使用率</span>
            <b className="budget-stat-value">{usageRate}%</b>
          </div>
        </div>

        {/* Budget Progress Bar */}
        {hasBudget && (
          <div className="budget-bar-wrap">
            <div className="budget-bar">
              {state.budget.categories.map(cat => {
                const pct = state.budget.total > 0 ? (cat.spent / state.budget.total) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={cat.id}
                    className="budget-fill"
                    style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    title={`${cat.name}: ¥${Math.round(cat.spent).toLocaleString()}`}
                  />
                );
              })}
              {/* Allocated indicator overlay */}
              {state.budget.categories.map(cat => {
                const allocPct = state.budget.total > 0 ? (cat.allocated / state.budget.total) * 100 : 0;
                if (allocPct <= 0) return null;
                return (
                  <div
                    key={`${cat.id}-mark`}
                    className="budget-fill-mark"
                    style={{
                      left: `${state.budget.categories.slice(0, state.budget.categories.indexOf(cat)).reduce((s, c) => s + (c.allocated / state.budget.total) * 100, 0)}%`,
                      width: `${allocPct}%`,
                      borderColor: cat.color,
                    }}
                    title={`${cat.name} 预算分配: ¥${Math.round(cat.allocated).toLocaleString()}`}
                  />
                );
              })}
            </div>
            <div className="budget-bar-legend">
              {state.budget.categories.map(cat => (
                <span key={cat.id} className="budget-bar-legend-item">
                  <span className="budget-cat-dot" style={{ background: cat.color }} />
                  {cat.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Current Stage Budget Hint */}
        {hasBudget && currentStageCategories.length > 0 && (
          <div className="budget-stage-hint">
            <span className="budget-stage-hint-icon">📍</span>
            <span>
              当前阶段 <strong>{currentStageName}</strong> 对应预算分类：
              {currentStageCategories.map(cat => (
                <span key={cat.id} className="budget-stage-tag" style={{ borderColor: cat.color, color: cat.color }}>
                  {cat.name}
                </span>
              ))}
            </span>
          </div>
        )}

        {/* Category Allocation */}
        {hasBudget && (
          <div className="budget-categories">
            <div className="budget-cat-header">
              <span>分类预算分配</span>
              <div className="budget-cat-header-right">
                {overBudget && (
                  <span className="budget-warning">
                    ⚠️ 预算超支 ¥{Math.round(totalAllocated - state.budget.total).toLocaleString()}
                  </span>
                )}
                <span className="budget-cat-header-sum">
                  已分配 ¥{Math.round(totalAllocated).toLocaleString()} / ¥{Math.round(state.budget.total).toLocaleString()}
                </span>
              </div>
            </div>
            {state.budget.categories.map(cat => {
              const allocPct = state.budget.total > 0 ? (cat.allocated / state.budget.total) * 100 : 0;
              const spentPctOfAlloc = getSpentPctOfAllocated(cat);
              const isCurrentStage = currentStageCategories.some(sc => sc.id === cat.id);

              return (
                <div key={cat.id} className={`budget-cat-row${isCurrentStage ? ' current-stage' : ''}`}>
                  <div className="budget-cat-info">
                    <span className="budget-cat-dot" style={{ background: cat.color }} />
                    <span className="budget-cat-name">
                      {cat.name}
                      {isCurrentStage && <span className="budget-cat-current-badge">当前</span>}
                    </span>
                  </div>
                  <div className="budget-cat-bar-wrap">
                    <div className="budget-cat-bar">
                      {/* Allocated bar (full width background) */}
                      <div
                        className="budget-cat-fill allocated"
                        style={{ width: `${allocPct}%`, backgroundColor: cat.color }}
                      />
                      {/* Spent overlay (semi-transparent) */}
                      <div
                        className="budget-cat-fill spent-overlay"
                        style={{ width: `${spentPctOfAlloc}%`, backgroundColor: cat.color }}
                        title={`${cat.name}: 已支出 ¥${Math.round(cat.spent).toLocaleString()} / 已分配 ¥${Math.round(cat.allocated).toLocaleString()}`}
                      />
                    </div>
                  </div>
                  <input
                    type="number"
                    className={`input budget-cat-input${isCurrentStage ? ' highlight' : ''}`}
                    value={cat.allocated || ''}
                    onChange={(e) => handleCategoryAllocation(cat.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                  />
                  <span className="budget-cat-spent">
                    已花 ¥{Math.round(cat.spent).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!hasBudget && (
          <div className="empty-state budget-empty-state">
            <div className="empty-state-icon">💰</div>
            <p className="empty-state-title">预算尚未设置</p>
            <p className="empty-state-desc">点击上方总预算数字，输入您的装修总预算后，即可分配各阶段预算</p>
            <div className="empty-state-action">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setEditingTotal(true); }}
              >
                开始设置预算
              </button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default BudgetPanel;

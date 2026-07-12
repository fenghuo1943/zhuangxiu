import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  useStore, setTotalBudget, setCategoryAllocation, adjustAdjacentBudgets,
  getBudgetRemaining, getBudgetUsageRate,
} from '../../data/store';
import type { BudgetCategory } from '../../data/types';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconPiggy } from '../common/Icons';

// ==================== Constants ====================

const BUDGET_STEP = 100;

// ==================== BudgetSliderHandle ====================

interface SliderHandleProps {
  leftCat: BudgetCategory;
  rightCat: BudgetCategory;
  leftBoundary: number;
  totalBudget: number;
  barWidth: number;
}

const BudgetSliderHandle: React.FC<SliderHandleProps> = ({
  leftCat, rightCat, leftBoundary, totalBudget, barWidth,
}) => {
  const [dragging, setDragging] = useState(false);
  const [tooltip, setTooltip] = useState<{ left: number; right: number; x: number } | null>(null);
  const startRef = useRef<{ x: number; leftAlloc: number; rightAlloc: number } | null>(null);

  // Clamp and round to step
  const clampStep = (v: number) => Math.max(0, Math.round(v / BUDGET_STEP) * BUDGET_STEP);

  const onStart = useCallback((clientX: number) => {
    startRef.current = {
      x: clientX,
      leftAlloc: leftCat.allocated,
      rightAlloc: rightCat.allocated,
    };
    setDragging(true);
  }, [leftCat.allocated, rightCat.allocated]);

  const onMove = useCallback((clientX: number) => {
    if (!startRef.current || !barWidth || totalBudget <= 0) return;
    const { x: startX, leftAlloc, rightAlloc } = startRef.current;
    const deltaPx = clientX - startX;
    const deltaAmount = Math.round((deltaPx / barWidth) * totalBudget / BUDGET_STEP) * BUDGET_STEP;
    const combined = leftAlloc + rightAlloc;
    const newLeft = clampStep(Math.min(combined, Math.max(0, leftAlloc + deltaAmount)));
    const newRight = combined - newLeft;
    setTooltip({ left: newLeft, right: newRight, x: clientX });
  }, [barWidth, totalBudget]);

  const onEnd = useCallback((clientX: number) => {
    if (!startRef.current || !barWidth || totalBudget <= 0) {
      setDragging(false);
      setTooltip(null);
      startRef.current = null;
      return;
    }
    const { x: startX, leftAlloc, rightAlloc } = startRef.current;
    const deltaPx = clientX - startX;
    const deltaAmount = Math.round((deltaPx / barWidth) * totalBudget / BUDGET_STEP) * BUDGET_STEP;
    const combined = leftAlloc + rightAlloc;
    const newLeft = clampStep(Math.min(combined, Math.max(0, leftAlloc + deltaAmount)));
    const newRight = combined - newLeft;
    adjustAdjacentBudgets(leftCat.id, rightCat.id, newLeft, newRight);
    setDragging(false);
    setTooltip(null);
    startRef.current = null;
  }, [barWidth, totalBudget, leftCat.id, rightCat.id]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onStart(e.clientX);
  }, [onStart]);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX);
    const handleMouseUp = (e: MouseEvent) => onEnd(e.clientX);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, onMove, onEnd]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches[0];
    onStart(t.clientX);
  }, [onStart]);

  useEffect(() => {
    if (!dragging) return;
    const handleTouchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX); };
    const handleTouchEnd = (e: TouchEvent) => onEnd(e.changedTouches[0].clientX);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragging, onMove, onEnd]);

  // Keyboard support (§4.2.3)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const combined = leftCat.allocated + rightCat.allocated;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const newLeft = clampStep(Math.min(combined, Math.max(0, leftCat.allocated + dir * BUDGET_STEP)));
      const newRight = combined - newLeft;
      adjustAdjacentBudgets(leftCat.id, rightCat.id, newLeft, newRight);
    }
  }, [leftCat, rightCat]);

  return (
    <>
      <button
        className={`budget-slider-handle${dragging ? ' dragging' : ''}`}
        style={{
          left: `${(leftBoundary / totalBudget) * 100}%`,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onKeyDown={handleKeyDown}
        aria-label={`调整 ${leftCat.name} 和 ${rightCat.name} 的预算分配`}
        aria-valuemin={0}
        aria-valuemax={leftCat.allocated + rightCat.allocated}
        aria-valuenow={leftCat.allocated}
        role="slider"
      />
      {tooltip && (
        <div
          className="budget-slider-tooltip"
          style={{ left: `${(tooltip.left / totalBudget) * 100}%` }}
        >
          <span className="budget-slider-tooltip-item">
            {leftCat.name} ¥{tooltip.left.toLocaleString()}
          </span>
          <span className="budget-slider-tooltip-divider">|</span>
          <span className="budget-slider-tooltip-item">
            {rightCat.name} ¥{tooltip.right.toLocaleString()}
          </span>
        </div>
      )}
    </>
  );
};

// ==================== BudgetProgressBar ====================

interface ProgressBarProps {
  categories: BudgetCategory[];
  totalBudget: number;
}

const BudgetProgressBar: React.FC<ProgressBarProps> = ({ categories, totalBudget }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarWidth(el.clientWidth));
    ro.observe(el);
    setBarWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Filter out categories with zero allocation for display
  const displayCats = categories.filter(c => c.allocated > 0);
  const useCats = displayCats.length > 0 ? displayCats : categories;

  return (
    <div className="budget-bar-wrap" ref={barRef}>
      <div className="budget-bar budget-bar--interactive">
        {/* Segments */}
        {useCats.map(cat => {
          const pct = totalBudget > 0 ? (cat.allocated / totalBudget) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={cat.id}
              className="budget-bar-segment"
              style={{ width: `${pct}%`, backgroundColor: cat.color }}
              title={`${cat.name}: ¥${cat.allocated.toLocaleString()}`}
            />
          );
        })}
        {/* Slider handles between adjacent segments */}
        {useCats.slice(0, -1).map((cat, i) => {
          const leftBoundary = useCats
            .slice(0, i + 1)
            .reduce((sum, item) => sum + item.allocated, 0);
          return (
            <BudgetSliderHandle
              key={`slider-${cat.id}-${useCats[i + 1].id}`}
              leftCat={cat}
              rightCat={useCats[i + 1]}
              leftBoundary={leftBoundary}
              totalBudget={totalBudget}
              barWidth={barWidth}
            />
          );
        })}
      </div>
    </div>
  );
};

// ==================== PhaseBudgetBlock ====================

interface PhaseBlockProps {
  category: BudgetCategory;
  totalBudget: number;
  isCurrentStage?: boolean;
  onSave: (categoryId: string, newAmount: number) => void;
}

const PhaseBudgetBlock: React.FC<PhaseBlockProps> = ({ category, totalBudget, isCurrentStage, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(category.allocated));

  useEffect(() => {
    setInputVal(String(category.allocated));
  }, [category.allocated]);

  const pct = totalBudget > 0 ? (category.allocated / totalBudget) * 100 : 0;

  const handleSave = useCallback(() => {
    const val = Math.round(parseFloat(inputVal) || 0);
    const stepped = Math.round(val / BUDGET_STEP) * BUDGET_STEP;
    onSave(category.id, stepped);
    setEditing(false);
  }, [inputVal, category.id, onSave]);

  const handleCancel = useCallback(() => {
    setInputVal(String(category.allocated));
    setEditing(false);
  }, [category.allocated]);

  return (
    <div
      className={`budget-phase-block${isCurrentStage ? ' current' : ''}`}
      style={{ width: `${Math.max(pct, 8)}%` }}
    >
      <div className="budget-phase-block-bar" style={{ backgroundColor: category.color }} />
      <span className="budget-phase-dot" style={{ backgroundColor: category.color }} />
      <span className="budget-phase-name">{category.name}</span>
      {editing ? (
        <div className="budget-phase-edit">
          <input
            type="number"
            className="input budget-phase-input"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            onBlur={handleSave}
            autoFocus
            step={BUDGET_STEP}
          />
          <div className="budget-phase-edit-actions">
            <button className="btn btn-primary btn-sm" onMouseDown={handleSave}>✓</button>
            <button className="btn btn-outline btn-sm" onMouseDown={handleCancel}>✕</button>
          </div>
        </div>
      ) : (
        <b
          className="budget-phase-amount"
          onClick={() => { setInputVal(String(category.allocated)); setEditing(true); }}
          title="点击编辑该阶段预算"
        >
          ¥{(category.allocated / 10000) >= 1
            ? `${(category.allocated / 10000).toFixed(1)}万`
            : category.allocated.toLocaleString()}
        </b>
      )}
    </div>
  );
};

// ==================== Main BudgetPanel ====================

export const BudgetPanel: React.FC = () => {
  const state = useStore();
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState(
    state.budget.total > 0 ? String(Math.round(state.budget.total)) : ''
  );

  const remaining = getBudgetRemaining();
  const usageRate = getBudgetUsageRate();
  const hasBudget = state.budget.total > 0;

  const handleTotalSave = useCallback(() => {
    const val = Math.round(parseFloat(totalInput) || 0);
    const stepped = Math.round(val / BUDGET_STEP) * BUDGET_STEP || 0;
    setTotalBudget(stepped);
    setEditingTotal(false);
  }, [totalInput]);

  const handleCategoryAllocation = useCallback((catId: string, value: string) => {
    const val = Math.round(parseFloat(value) || 0);
    setCategoryAllocation(catId, Math.round(val / BUDGET_STEP) * BUDGET_STEP);
  }, []);

  const totalAllocated = state.budget.categories.reduce((sum, c) => sum + c.allocated, 0);
  const overBudget = hasBudget && totalAllocated > state.budget.total;

  const handlePhaseBudgetSave = useCallback((categoryId: string, requestedAmount: number) => {
    const cats = state.budget.categories;
    const catIdx = cats.findIndex(c => c.id === categoryId);
    if (catIdx === -1) return;

    const neighborIdx = catIdx < cats.length - 1 ? catIdx + 1 : catIdx - 1;
    if (neighborIdx < 0) return;

    const mainCat = cats[catIdx];
    const neighborCat = cats[neighborIdx];
    const combined = mainCat.allocated + neighborCat.allocated;
    const newAmount = Math.min(combined, Math.max(0, requestedAmount));
    const newNeighbor = combined - newAmount;

    if (catIdx < cats.length - 1) {
      adjustAdjacentBudgets(mainCat.id, neighborCat.id, newAmount, newNeighbor);
    } else {
      adjustAdjacentBudgets(neighborCat.id, mainCat.id, newNeighbor, newAmount);
    }
  }, [state.budget.categories]);

  // Spent as percentage of category's own allocation
  const getSpentPctOfAlloc = (cat: BudgetCategory) => {
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
      </CardHeader>
      <CardBody>
        {/* ===== Summary Stats (§4.1) ===== */}
        <div className="budget-summary">
          <div className="budget-stat">
            <span className="budget-stat-label">总预算</span>
            {editingTotal ? (
              <div className="budget-edit-row">
                <input
                  type="number"
                  className="input budget-input"
                  value={totalInput}
                  onChange={e => setTotalInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTotalSave()}
                  placeholder="输入总预算"
                  autoFocus
                  step={BUDGET_STEP}
                />
                <button className="btn btn-primary btn-sm" onClick={handleTotalSave}>确定</button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { setEditingTotal(false); setTotalInput(String(Math.round(state.budget.total || 0))); }}
                >
                  取消
                </button>
              </div>
            ) : (
              <b
                className={`budget-stat-value${!hasBudget ? ' is-placeholder' : ''}`}
                onClick={() => { setTotalInput(String(Math.round(state.budget.total || 0))); setEditingTotal(true); }}
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
            <b className={`budget-stat-value${remaining < 0 ? ' over' : ''}`}>
              ¥{Math.round(remaining).toLocaleString()}
            </b>
          </div>
          <div className="budget-stat">
            <span className="budget-stat-label">使用率</span>
            <b className="budget-stat-value">{usageRate}%</b>
          </div>
        </div>

        {hasBudget && (
          <>
            {/* ===== Progress Bar with Sliders (§4.2, §4.2.2) ===== */}
            <BudgetProgressBar
              categories={state.budget.categories}
              totalBudget={state.budget.total}
            />

            {/* ===== Phase Budget Blocks (§4.2.1) ===== */}
            <div className="budget-phase-blocks">
              {state.budget.categories.map(cat => (
                <PhaseBudgetBlock
                  key={cat.id}
                  category={cat}
                  totalBudget={state.budget.total}
                  onSave={handlePhaseBudgetSave}
                />
              ))}
            </div>

            {/* ===== Category Allocation Table (§4.3) ===== */}
            <div className="budget-categories">
              <div className="budget-cat-header">
                <span>分类预算详情</span>
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
                const spentPctOfAlloc = getSpentPctOfAlloc(cat);

                return (
                  <div key={cat.id} className="budget-cat-row">
                    <div className="budget-cat-info">
                      <span className="budget-cat-dot" style={{ background: cat.color }} />
                      <span className="budget-cat-name">{cat.name}</span>
                    </div>
                    <div className="budget-cat-bar-wrap">
                      <div className="budget-cat-bar">
                        <div
                          className="budget-cat-fill allocated"
                          style={{ width: `${allocPct}%`, backgroundColor: cat.color }}
                        />
                        <div
                          className="budget-cat-fill spent-overlay"
                          style={{ width: `${spentPctOfAlloc}%`, backgroundColor: cat.color }}
                          title={`${cat.name}: 支出 ¥${Math.round(cat.spent).toLocaleString()} / 分配 ¥${Math.round(cat.allocated).toLocaleString()}`}
                        />
                      </div>
                    </div>
                    <input
                      type="number"
                      className="input budget-cat-input"
                      value={cat.allocated || ''}
                      onChange={e => handleCategoryAllocation(cat.id, e.target.value)}
                      onFocus={e => e.target.select()}
                      placeholder="0"
                      step={BUDGET_STEP}
                    />
                    <span className="budget-cat-spent">
                      已花 ¥{Math.round(cat.spent).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ===== Empty State (§4.4) ===== */}
        {!hasBudget && (
          <div className="budget-empty-state">
            <div className="budget-empty-icon">💰</div>
            <p className="budget-empty-title">预算尚未设置</p>
            <p className="budget-empty-desc">
              点击上方总预算数字，输入您的装修总预算后，即可分配各阶段预算
            </p>
            <button
              className="btn btn-primary"
              onClick={() => { setTotalInput(''); setEditingTotal(true); }}
            >
              开始设置预算
            </button>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default BudgetPanel;

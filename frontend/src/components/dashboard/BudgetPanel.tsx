import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  useStore, setTotalBudget, setCategoryAllocation, adjustAdjacentBudgets,
  getBudgetRemaining, getBudgetUsageRate,
} from '../../data/store';
import type { BudgetCategory } from '../../data/types';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconPiggy } from '../common/Icons';

// ==================== Constants ====================

const BUDGET_STEP = 100;
const DEBUG = true;
const log = (...args: any[]) => { if (DEBUG) console.log('[BudgetPanel]', ...args); };

function formatCompact(n: number): string {
  if (n >= 1e4) return `¥${(n / 1e4).toFixed(1)}万`;
  return `¥${n.toLocaleString()}`;
}

function clampStep(v: number): number {
  return Math.max(0, Math.round(v / BUDGET_STEP) * BUDGET_STEP);
}

// ==================== BudgetSliderHandle ====================

interface SliderHandleProps {
  leftCat: BudgetCategory;
  rightCat: BudgetCategory;
  pctLeft: number;
  totalBudget: number;
  barEl: HTMLDivElement | null;
}

const BudgetSliderHandle: React.FC<SliderHandleProps> = ({
  leftCat, rightCat, pctLeft, totalBudget, barEl,
}) => {
  const [dragging, setDragging] = useState(false);
  const [tooltip, setTooltip] = useState<{ left: number; right: number } | null>(null);
  const startRef = useRef<{ x: number; leftAlloc: number; rightAlloc: number } | null>(null);

  const onStart = useCallback((clientX: number) => {
    startRef.current = { x: clientX, leftAlloc: leftCat.allocated, rightAlloc: rightCat.allocated };
    log(`Slider drag START | ${leftCat.name}(${leftCat.allocated}) ↔ ${rightCat.name}(${rightCat.allocated})`);
    setDragging(true);
  }, [leftCat.allocated, rightCat.allocated]);

  const onMove = useCallback((clientX: number) => {
    if (!startRef.current || !barEl || totalBudget <= 0) return;
    const { x: startX, leftAlloc, rightAlloc } = startRef.current;
    const barWidth = barEl.clientWidth;
    if (!barWidth) return;
    const deltaPx = clientX - startX;
    const deltaAmount = Math.round((deltaPx / barWidth) * totalBudget / BUDGET_STEP) * BUDGET_STEP;
    const combined = leftAlloc + rightAlloc;
    const newLeft = clampStep(Math.min(combined, Math.max(0, leftAlloc + deltaAmount)));
    setTooltip({ left: newLeft, right: combined - newLeft });
  }, [barEl, totalBudget]);

  const onEnd = useCallback((clientX: number) => {
    if (!startRef.current || !barEl || totalBudget <= 0) {
      setDragging(false); setTooltip(null); startRef.current = null;
      return;
    }
    const barWidth = barEl.clientWidth;
    if (!barWidth) { setDragging(false); setTooltip(null); startRef.current = null; return; }
    const { x: startX, leftAlloc, rightAlloc } = startRef.current;
    const deltaPx = clientX - startX;
    const deltaAmount = Math.round((deltaPx / barWidth) * totalBudget / BUDGET_STEP) * BUDGET_STEP;
    const combined = leftAlloc + rightAlloc;
    const newLeft = clampStep(Math.min(combined, Math.max(0, leftAlloc + deltaAmount)));
    log(`Slider drag END   | ${leftCat.name}=${newLeft}  ${rightCat.name}=${combined - newLeft}  (combined=${combined}, delta=${deltaAmount})`);
    adjustAdjacentBudgets(leftCat.id, rightCat.id, newLeft, combined - newLeft);
    setDragging(false); setTooltip(null); startRef.current = null;
  }, [barEl, totalBudget, leftCat.id, rightCat.id]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); onStart(e.clientX);
  }, [onStart]);

  useEffect(() => {
    if (!dragging) return;
    const mm = (e: MouseEvent) => onMove(e.clientX);
    const mu = (e: MouseEvent) => onEnd(e.clientX);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
  }, [dragging, onMove, onEnd]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation(); onStart(e.touches[0].clientX);
  }, [onStart]);

  useEffect(() => {
    if (!dragging) return;
    const tm = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX); };
    const te = (e: TouchEvent) => onEnd(e.changedTouches[0].clientX);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', te);
    return () => { window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', te); };
  }, [dragging, onMove, onEnd]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const combined = leftCat.allocated + rightCat.allocated;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const newLeft = clampStep(Math.min(combined, Math.max(0, leftCat.allocated + dir * BUDGET_STEP)));
      adjustAdjacentBudgets(leftCat.id, rightCat.id, newLeft, combined - newLeft);
    }
  }, [leftCat, rightCat]);

  return (
    <>
      <button
        className={`budget-slider-handle${dragging ? ' dragging' : ''}`}
        style={{ left: `${pctLeft}%` }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onKeyDown={handleKeyDown}
        aria-label={`调整 ${leftCat.name} 和 ${rightCat.name} 的预算分配`}
        role="slider"
      >
        <span className="budget-slider-grip" />
        <span className="budget-slider-grip" />
      </button>
      {tooltip && (
        <div className="budget-slider-tooltip" style={{ left: `${pctLeft}%` }}>
          <span>{leftCat.name} ¥{tooltip.left.toLocaleString()}</span>
          <span className="budget-slider-tooltip-divider">|</span>
          <span>{rightCat.name} ¥{tooltip.right.toLocaleString()}</span>
        </div>
      )}
    </>
  );
};

// ==================== StageBudgetInput ====================

/** Local-state input that commits to the store on blur, avoiding per-keystroke rounding issues */
const StageBudgetInput: React.FC<{
  catIdx: number;
  cats: BudgetCategory[];
}> = ({ catIdx, cats }) => {
  const cat = cats[catIdx];
  const [localVal, setLocalVal] = useState(String(cat.allocated));

  // Sync from external store changes (slider drags, other edits)
  useEffect(() => {
    log(`StageBudgetInput sync | ${cat.name}: store=${cat.allocated}, local was="${localVal}"`);
    setLocalVal(String(cat.allocated));
  }, [cat.allocated]);

  const handleBlur = useCallback(() => {
    const v = Math.max(0, parseInt(localVal, 10) || 0);
    log(`StageBudgetInput blur | catIdx=${catIdx}  ${cat.name}: input="${localVal}"→parsed=${v}`);

    setLocalVal(String(v));
    setCategoryAllocation(cat.id, v);

    // Recalc total budget from all categories
    const newTotal = cats.reduce((sum, c) => sum + (c.id === cat.id ? v : c.allocated), 0);
    log(`  → setCategoryAllocation(${cat.id}, ${v}), newTotal=${newTotal}`);
    setTotalBudget(newTotal, false); // scaleStages=false: don't redistribute, just update total
  }, [localVal, catIdx, cats, cat.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  }, []);

  return (
    <input
      type="number"
      className="budget-stage-block-input"
      min={0}
      value={localVal}
      onChange={e => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      title="修改后按回车或点击外部确认"
      step={1}
    />
  );
};

// ==================== Main BudgetPanel ====================

export const BudgetPanel: React.FC = () => {
  const state = useStore();
  const [budgetInput, setBudgetInput] = useState(
    state.budget.total > 0 ? String(Math.round(state.budget.total)) : ''
  );
  const barRef = useRef<HTMLDivElement>(null);
  const budgetInputRef = useRef(budgetInput);
  budgetInputRef.current = budgetInput; // always keep ref in sync, no stale-closure risk
  const [, forceTick] = useState(0);

  // Ensure barRef is populated before children read it
  useEffect(() => { forceTick(t => t + 1); }, []);

  // Sync budgetInput when store total changes externally (e.g. stage input blur)
  useEffect(() => {
    setBudgetInput(state.budget.total > 0 ? String(Math.round(state.budget.total)) : '');
  }, [state.budget.total]);

  const hasBudget = state.budget.total > 0;
  const totalBudget = state.budget.total || 0;
  const spent = state.budget.spent;
  const remaining = totalBudget > 0 ? getBudgetRemaining() : 0;
  const usageRate = totalBudget > 0 ? getBudgetUsageRate() : 0;
  const cats = state.budget.categories;
  const totalAllocated = cats.reduce((s, c) => s + c.allocated, 0);
  const overBudget = hasBudget && totalAllocated > state.budget.total;

  // Render-level debug summary
  log(`RENDER | totalBudget=${totalBudget}  spent=${Math.round(spent)}  remaining=${Math.round(remaining)}  totalAllocated=${totalAllocated}`);
  cats.forEach(c => log(`  ${c.id}: ${c.name}  allocated=${c.allocated}  spent=${Math.round(c.spent)}`));

  // ---- Total budget handlers ----
  const handleTotalChange = useCallback((val: string) => setBudgetInput(val), []);

  const commitTotal = useCallback(() => {
    const raw = budgetInputRef.current;
    const v = Math.round(parseFloat(raw) || 0);
    const stepped = Math.round(v / BUDGET_STEP) * BUDGET_STEP || 0;
    log(`commitTotal | raw="${raw}" → parsed=${v} → stepped=${stepped}`);
    setTotalBudget(stepped); // scaleStages=true (default): proportionally redistribute to stages
    setBudgetInput(String(stepped || ''));
  }, []);

  const handleTotalBlur = useCallback(() => {
    log('handleTotalBlur fired');
    commitTotal();
  }, [commitTotal]);

  const handleTotalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      log('handleTotalKeyDown Enter fired');
      (e.target as HTMLInputElement).blur(); // trigger blur → commitTotal
    }
  }, []);

  // Pre-compute segment positions; show the bar once the total budget is set, even if allocations are still zero.
  const segments = cats.map((cat, i) => {
    const leftPct = totalBudget > 0 ? cats.slice(0, i).reduce((s, c) => s + c.allocated, 0) / totalBudget * 100 : 0;
    const wPct = totalBudget > 0 ? Math.max(cat.allocated / totalBudget * 100, 0) : 0;
    return { cat, i, leftPct, wPct };
  });

  return (
    <Card id="homeBudgetCard">
      <CardHeader>
        <div className="card-title-row">
          <span className="iconbox iconbox-coral"><IconPiggy size={16} /></span>
          <div><h3>预算设置与阶段分配</h3></div>
        </div>
      </CardHeader>
      <CardBody>
        {/* ===== Summary Bar ===== */}
        <div className="budget-summary-bar">
          <div className="budget-summary-left">
            <div className="budget-summary-labels">
              <span>已支出 ¥{Math.round(spent).toLocaleString()}</span>
              <span>总预算 ¥{Math.round(totalBudget).toLocaleString()}</span>
            </div>
            <div className="budget-summary-progress">
              <div className="budget-summary-fill" style={{ width: `${usageRate}%` }} />
            </div>
            <div className="budget-summary-labels">
              <span>{usageRate}% 已用</span>
              <span className="budget-remaining-label">
                剩余 ¥{Math.round(remaining).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="budget-summary-right">
            <b>{formatCompact(Math.round(remaining))}</b>
            <span>剩余</span>
          </div>
        </div>

        {/* ===== Total Budget Input ===== */}
        <div className="budget-total-input-row">
          <span>总预算</span>
          <input
            type="number"
            className="budget-total-input"
            value={budgetInput}
            onChange={e => handleTotalChange(e.target.value)}
            onBlur={handleTotalBlur}
            onKeyDown={handleTotalKeyDown}
            step={1}
            placeholder="0"
          />
          <span>元</span>
        </div>

        {/* ===== Divider ===== */}
        <div className="budget-divider" />

        {/* ===== Hint + Slider Bar (only when budget is set) ===== */}
        {hasBudget && (
          <>
            <p className="budget-hint">拖动手柄调整各阶段预算分配</p>
            <div className="budget-slider-bar" ref={barRef}>
              <div className="budget-slider-track" />
              {segments.map(({ cat, i, leftPct, wPct }) => {
                const isFirst = i === 0;
                const isLast = i === cats.length - 1;
                let borderRadius = '0';
                if (isFirst && isLast) borderRadius = '6px';
                else if (isFirst) borderRadius = '6px 0 0 6px';
                else if (isLast) borderRadius = '0 6px 6px 0';
                return (
                  <div
                    key={cat.id}
                    className="budget-slider-seg"
                    style={{ left: `${leftPct}%`, width: `${wPct}%`, backgroundColor: cat.color, borderRadius }}
                  />
                );
              })}
              {cats.slice(0, -1).map((cat, i) => {
                const boundaryPct = totalBudget > 0 ? cats.slice(0, i + 1).reduce((s, c) => s + c.allocated, 0) / totalBudget * 100 : 0;
                return (
                  <BudgetSliderHandle
                    key={`h-${cat.id}`}
                    leftCat={cat}
                    rightCat={cats[i + 1]}
                    pctLeft={boundaryPct}
                    totalBudget={totalBudget}
                    barEl={barRef.current}
                  />
                );
              })}
            </div>
          </>
        )}

        {/* ===== Stage Budget Blocks ===== */}
        <div className="budget-stage-blocks">
          {cats.map((cat, i) => (
            <div key={cat.id} className="budget-stage-block">
              <div className="budget-stage-block-name" style={{ color: cat.color }}>
                {cat.name}
              </div>
              <StageBudgetInput catIdx={i} cats={cats} />
            </div>
          ))}
        </div>

        {/* ===== Over-budget Warning ===== */}
        {overBudget && (
          <div className="budget-warning">
            ⚠️ 预算超支 ¥{Math.round(totalAllocated - state.budget.total).toLocaleString()}
          </div>
        )}

        {/* ===== Category Detail Rows ===== */}
        <div className="budget-detail-rows">
          {cats.map(cat => {
            const spentPct = cat.allocated > 0 ? Math.min(100, Math.round((cat.spent / cat.allocated) * 100)) : 0;
            return (
              <div key={cat.id} className="budget-detail-row">
                <span className="budget-detail-dot" style={{ background: cat.color }} />
                <span className="budget-detail-name">{cat.name}</span>
                <div className="budget-detail-bar-wrap">
                  <div className="budget-detail-bar">
                    <div
                      className="budget-detail-fill"
                      style={{ width: `${spentPct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
                <span className="budget-detail-spent" style={{ color: cat.color }}>
                  ¥{Math.round(cat.spent).toLocaleString()}
                </span>
                <span className="budget-detail-pct">{spentPct}%</span>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
};

export default BudgetPanel;

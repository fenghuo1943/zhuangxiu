import React, { useState, useCallback } from 'react';
import { useStore, setTotalBudget, setCategoryAllocation, getBudgetRemaining, getBudgetUsageRate } from '../../data/store';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconPiggy } from '../common/Icons';

export const BudgetPanel: React.FC = () => {
  const state = useStore();
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState(state.budget.total > 0 ? String(state.budget.total) : '');

  const remaining = getBudgetRemaining();
  const usageRate = getBudgetUsageRate();
  const hasBudget = state.budget.total > 0;

  const handleTotalSave = useCallback(() => {
    const val = parseFloat(totalInput) || 0;
    setTotalBudget(val);
    setEditingTotal(false);
  }, [totalInput]);

  const handleCategoryAllocation = useCallback((catId: string, value: string) => {
    const val = parseFloat(value) || 0;
    setCategoryAllocation(catId, val);
  }, []);

  const totalAllocated = state.budget.categories.reduce((sum, c) => sum + c.allocated, 0);
  const overBudget = hasBudget && totalAllocated > state.budget.total;

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
                <button className="btn btn-outline btn-sm" onClick={() => setEditingTotal(false)}>取消</button>
              </div>
            ) : (
              <b
                className={`budget-stat-value ${!hasBudget ? 'is-placeholder' : ''}`}
                onClick={() => { setTotalInput(String(state.budget.total || '')); setEditingTotal(true); }}
                style={{ cursor: 'pointer' }}
                title="点击设置总预算"
              >
                ¥{hasBudget ? state.budget.total.toLocaleString() : '点击设置'}
              </b>
            )}
          </div>
          <div className="budget-stat">
            <span className="budget-stat-label">已支出</span>
            <b className="budget-stat-value spent">¥{state.budget.spent.toLocaleString()}</b>
          </div>
          <div className="budget-stat">
            <span className="budget-stat-label">剩余</span>
            <b className={`budget-stat-value ${remaining < 0 ? 'over' : ''}`}>
              ¥{remaining.toLocaleString()}
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
                    title={`${cat.name}: ¥${cat.spent.toLocaleString()}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Category Allocation */}
        {hasBudget && (
          <div className="budget-categories">
            <div className="budget-cat-header">
              <span>分类预算分配</span>
              {overBudget && (
                <span className="budget-warning">
                  ⚠️ 预算超支 ¥{(totalAllocated - state.budget.total).toLocaleString()}
                </span>
              )}
            </div>
            {state.budget.categories.map(cat => {
              const allocPct = state.budget.total > 0 ? (cat.allocated / state.budget.total) * 100 : 0;
              const spentPct = state.budget.total > 0 ? (cat.spent / state.budget.total) * 100 : 0;

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
                        className="budget-cat-fill spent"
                        style={{ width: `${spentPct}%`, backgroundColor: cat.color, opacity: 0.5 }}
                      />
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input budget-cat-input"
                    value={cat.allocated || ''}
                    onChange={(e) => handleCategoryAllocation(cat.id, e.target.value)}
                    placeholder="0"
                  />
                  <span className="budget-cat-spent">已花 ¥{cat.spent.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!hasBudget && (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <p className="empty-state-title">预算尚未设置</p>
            <p className="empty-state-desc">点击上方总预算数字，输入您的装修总预算后，即可分配各阶段预算</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default BudgetPanel;

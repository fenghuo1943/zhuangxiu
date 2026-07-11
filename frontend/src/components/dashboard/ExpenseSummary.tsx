import React from 'react';
import { useStore } from '../../data/store';
import { Card, CardHeader, CardBody } from '../common/Card';
import { EmptyState } from '../common/EmptyState';
import { IconDollar } from '../common/Icons';

export const ExpenseSummary: React.FC = () => {
  const state = useStore();
  const recentExpenses = state.expenses.slice(0, 5);
  const hasExpenses = state.expenses.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="card-title-row">
          <span className="iconbox iconbox-blue">
            <IconDollar size={16} />
          </span>
          <div>
            <h3>记账概览</h3>
            <span className="card-subtitle">{state.expenses.length} 条记录</span>
          </div>
        </div>
        <a href="/expense" className="more-link">查看全部 →</a>
      </CardHeader>
      <CardBody>
        {!hasExpenses ? (
          <EmptyState
            icon="💰"
            title="暂无记账记录"
            description="记一笔支出，管理装修花费"
          />
        ) : (
          <div className="expense-mini-list">
            {recentExpenses.map(exp => (
              <div key={exp.id} className="expense-mini-item">
                <div className="expense-mini-info">
                  <span className="expense-mini-title">{exp.title}</span>
                  <span className="expense-mini-date">{exp.date}</span>
                </div>
                <span className="expense-mini-amount">¥{exp.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default ExpenseSummary;

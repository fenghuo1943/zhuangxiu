import React from 'react';
import { useStore, setFlowType, getOrderedFlowSteps } from '../../data/store';
import { IconFlow, IconLayout } from '../common/Icons';

const FlowHero: React.FC = () => {
  const state = useStore();
  const isNew = state.flowType === 'new';
  const steps = getOrderedFlowSteps(state.flowType);
  const doneCount = steps.filter(s => state.flowDoneStepIds.includes(s.id)).length;
  const total = steps.length;
  const resourceCount = steps.reduce((sum, s) => sum + s.standards.length + s.acceptance.length + s.articles.length + s.pitfalls.length, 0);
  const firstUndone = steps.find(s => !state.flowDoneStepIds.includes(s.id));

  return (
    <div className="flow-hero">
      <div className="flow-hero-main">
        <div className="flow-hero-content">
          <span className="eyebrow">
            <IconFlow size={14} /> 装修进程管家
          </span>
          <h1>按阶段推进，少漏项、少返工</h1>
          <p>把装修流程拆成可勾选节点，每个节点保留施工标准、验收标准和攻略内容，方便做步骤执行和核对。</p>
          <div className="flow-hero-actions">
            <div className="flow-type-switch">
              <button
                className={`flow-type-btn ${isNew ? 'active' : ''}`}
                onClick={() => setFlowType('new')}
              >
                <IconLayout size={14} /> 新房毛坯
              </button>
              <button
                className={`flow-type-btn ${!isNew ? 'active' : ''}`}
                onClick={() => setFlowType('old')}
              >
                🔧 旧房改造
              </button>
            </div>
          </div>
        </div>
        <div className="flow-hero-stats">
          <div className="flow-stat">
            <span className="flow-stat-label">整体进度</span>
            <b className="flow-stat-value">{doneCount} / {total}</b>
            <div className="flow-stat-bar">
              <div className="flow-stat-fill" style={{ width: `${total > 0 ? Math.round((doneCount / total) * 100) : 0}%` }} />
            </div>
          </div>
          <div className="flow-stat">
            <span className="flow-stat-label">当前建议关注</span>
            <b className="flow-stat-value current">{firstUndone?.title || '已完成'}</b>
          </div>
          <div className="flow-stat">
            <span className="flow-stat-label">资料数量</span>
            <b className="flow-stat-value">{resourceCount} 条</b>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowHero;

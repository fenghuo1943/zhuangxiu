import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, getFirstUndoneStepId } from '../../data/store';
import { FLOW_STEPS_NEW } from '../../data/mockData';
import { IconMap, IconArrowRight } from '../common/Icons';
import { Card, CardHeader, CardBody } from '../common/Card';

const MAX_VISIBLE_STEPS = 8; // current step + next 7

export const StageRoute: React.FC = () => {
  const state = useStore();
  const navigate = useNavigate();
  const currentStepId = getFirstUndoneStepId();
  const steps = FLOW_STEPS_NEW;
  const completedCount = state.flowDoneStepIds.length;
  const totalCount = steps.length;

  // Find current step index and slice to show current + next 7
  const currentIndex = steps.findIndex(s => s.id === currentStepId);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const visibleSteps = steps.slice(startIndex, startIndex + MAX_VISIBLE_STEPS);
  const hasMore = startIndex + MAX_VISIBLE_STEPS < steps.length;
  const hasEarlier = startIndex > 0;

  return (
    <Card className="stage-route-card">
      <CardHeader>
        <div className="card-title-row">
          <span className="iconbox iconbox-coral">
            <IconMap size={16} />
          </span>
          <div>
            <h3>阶段路线</h3>
            <span className="card-subtitle">{completedCount} / {totalCount} 已完成</span>
          </div>
        </div>
        <a href="/flow" className="more-link">全部流程 →</a>
      </CardHeader>
      <CardBody>
        <div className="home-progress-line">
          {hasEarlier && (
            <span className="home-step-more home-step-more--left">
              ···
            </span>
          )}
          {visibleSteps.map((step) => {
            const isDone = state.flowDoneStepIds.includes(step.id);
            const isCurrent = step.id === currentStepId;
            let cls = 'home-step';
            if (isDone) cls += ' done';
            else if (isCurrent) cls += ' current';

            return (
              <button
                key={step.id}
                className={cls}
                onClick={() => navigate(`/flow#step-${step.id}`)}
                title={`${step.order}. ${step.title}${isDone ? ' (已完成)' : isCurrent ? ' (当前)' : ''}`}
              >
                <span>{step.order}</span>
                <b>{step.title}</b>
              </button>
            );
          })}
          {hasMore && (
            <button
              className="home-step home-step--view-all"
              onClick={() => navigate('/flow')}
              title="查看全部流程"
            >
              <span>···</span>
              <b>
                查看全部
                <IconArrowRight size={12} />
              </b>
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default StageRoute;

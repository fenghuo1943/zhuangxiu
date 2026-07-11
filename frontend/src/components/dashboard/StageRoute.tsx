import React from 'react';
import { useStore, getFirstUndoneStepId } from '../../data/store';
import { FLOW_STEPS_NEW } from '../../data/mockData';
import { IconMap } from '../common/Icons';
import { Card, CardHeader, CardBody } from '../common/Card';

export const StageRoute: React.FC = () => {
  const state = useStore();
  const currentStepId = getFirstUndoneStepId();
  const steps = FLOW_STEPS_NEW;
  const completedCount = state.flowDoneStepIds.length;
  const totalCount = steps.length;

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
          {steps.map((step) => {
            const isDone = state.flowDoneStepIds.includes(step.id);
            const isCurrent = step.id === currentStepId;
            let cls = 'home-step';
            if (isDone) cls += ' done';
            else if (isCurrent) cls += ' current';

            return (
              <button
                key={step.id}
                className={cls}
                onClick={() => window.location.href = `/flow#step-${step.id}`}
                title={`${step.order}. ${step.title}${isDone ? ' (已完成)' : isCurrent ? ' (当前)' : ''}`}
              >
                <span>{step.order}</span>
                <b>{step.title}</b>
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
};

export default StageRoute;

import React from 'react';
import { useStore, getFirstUndoneStepId } from '../../data/store';
import { FLOW_STEPS_NEW } from '../../data/mockData';
import { Card, CardBody } from '../common/Card';
import { IconLayout } from '../common/Icons';

export const ProgressCard: React.FC = () => {
  const state = useStore();
  const currentStepId = getFirstUndoneStepId();
  const totalSteps = FLOW_STEPS_NEW.length; // 22
  const completedCount = state.flowDoneStepIds.length;

  // Find current step
  const currentStep = FLOW_STEPS_NEW.find(s => s.id === currentStepId);
  const currentOrder = currentStep?.order ?? 1;
  const currentTitle = currentStep?.title ?? '设计与开工准备';
  const currentSub = currentStep?.days ?? '';

  // Progress percentage
  const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <Card className="progress-card">
      <CardBody>
        <div className="progress-card-header">
          <span className="progress-card-icon">
            <IconLayout size={18} />
          </span>
          <h3 className="progress-card-title">装修进度</h3>
          <span className="progress-card-pct">{pct}%</span>
        </div>

        {/* Progress bar */}
        <div className="progress-card-bar-wrap">
          <div className="progress-card-bar">
            <div
              className="progress-card-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="progress-card-current">
          <span className="progress-card-label">当前阶段</span>
          <strong className="progress-card-stage">{currentTitle}</strong>
          <span className="progress-card-sub">{currentSub}</span>
        </div>

        <div className="progress-card-bottom">
          <span className="progress-card-fraction">{currentOrder} / {totalSteps}</span>
        </div>
      </CardBody>
    </Card>
  );
};

export default ProgressCard;

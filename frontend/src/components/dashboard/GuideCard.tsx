import React from 'react';
import { useStore, getFirstUndoneStepId } from '../../data/store';
import { Card, CardHeader, CardBody } from '../common/Card';
import { IconBook, IconShield } from '../common/Icons';

export const GuideCard: React.FC = () => {
  const state = useStore();
  const currentStepId = getFirstUndoneStepId();
  const currentStage = state.stages.find(s => s.id === currentStepId);

  return (
    <Card>
      <CardHeader>
        <div className="card-title-row">
          <span className="iconbox iconbox-blue">
            <IconBook size={16} />
          </span>
          <h3>阶段攻略</h3>
        </div>
      </CardHeader>
      <CardBody>
        <p className="guide-stage-name">{currentStage?.name || '设计与开工准备'}</p>
        <p className="guide-stage-desc">
          {currentStage?.description || '完成收房验房、量房设计和物业报备，做好开工前的各项准备。'}
        </p>
        <div className="guide-actions">
          <a href="/flow" className="btn btn-outline btn-sm">
            <IconBook size={14} />
            查看攻略
          </a>
          <a href="/flow" className="btn btn-outline btn-sm">
            <IconShield size={14} />
            验收要点
          </a>
        </div>
      </CardBody>
    </Card>
  );
};

export default GuideCard;

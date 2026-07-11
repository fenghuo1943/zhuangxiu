import React from 'react';
import type { FlowStep } from '../../data/types';
import { useStore, toggleFlowStepDone } from '../../data/store';
import { IconCheck, IconChevronDown, IconBook, IconShield, IconStar, IconAlert } from '../common/Icons';

interface FlowStepCardProps {
  step: FlowStep;
  isExpanded: boolean;
  onToggle: () => void;
}

const resourceLabel: Record<string, string> = {
  standard: '施工标准',
  acceptance: '验收标准',
  article: '攻略文章',
  pitfall: '避坑指南',
};

const resourceIcon: Record<string, React.ReactNode> = {
  standard: <IconCheck size={14} />,
  acceptance: <IconShield size={14} />,
  article: <IconStar size={14} />,
  pitfall: <IconAlert size={14} />,
};

const resourceBadgeClass: Record<string, string> = {
  standard: 'badge-success',
  acceptance: 'badge-info',
  article: 'badge-warning',
  pitfall: 'badge-danger',
};

export const FlowStepCard: React.FC<FlowStepCardProps> = ({ step, isExpanded, onToggle }) => {
  const state = useStore();
  const isDone = state.flowDoneStepIds.includes(step.id);
  const resources = [
    ...step.standards.map(r => ({ ...r, group: 'standard' as const })),
    ...step.acceptance.map(r => ({ ...r, group: 'acceptance' as const })),
    ...step.articles.map(r => ({ ...r, group: 'article' as const })),
    ...step.pitfalls.map(r => ({ ...r, group: 'pitfall' as const })),
  ];

  const grouped: Record<string, typeof resources> = {};
  resources.forEach(r => {
    if (!grouped[r.group]) grouped[r.group] = [];
    grouped[r.group].push(r);
  });

  return (
    <div className={`flow-step-card ${isDone ? 'done' : ''} ${isExpanded ? 'expanded' : ''}`} id={`step-${step.id}`}>
      <div className="flow-step-header" onClick={onToggle} role="button" tabIndex={0} aria-expanded={isExpanded}>
        <div className="flow-step-header-left">
          <span className="flow-step-num">{step.order}</span>
          <div className="flow-step-info">
            <strong className="flow-step-title">{step.title}</strong>
            <span className="flow-step-days">预计工期：{step.days}</span>
          </div>
        </div>
        <div className="flow-step-header-right">
          {isDone && <span className="badge badge-success">✓ 已完成</span>}
          <span className={`flow-step-chevron ${isExpanded ? 'open' : ''}`}>
            <IconChevronDown size={18} />
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="flow-step-body">
          <p className="flow-step-desc">{step.desc}</p>

          {Object.keys(grouped).length > 0 ? (
            <div className="flow-resource-grid">
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="flow-resource-block">
                  <h4 className="flow-resource-title">
                    <span className={`badge ${resourceBadgeClass[group] || 'badge-default'}`}>
                      {resourceIcon[group]} {resourceLabel[group] || group}
                    </span>
                  </h4>
                  <ul className="flow-resource-list">
                    {items.map(item => (
                      <li key={item.id} className="flow-resource-item">
                        <span className="flow-resource-item-icon">
                          {group === 'standard' && <IconBook size={14} />}
                          {group === 'acceptance' && <IconShield size={14} />}
                          {group === 'article' && <IconStar size={14} />}
                          {group === 'pitfall' && <IconAlert size={14} />}
                        </span>
                        <span>{item.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '16px 0' }}>
              <p className="empty-state-desc">该节点暂未关联扩展资料，请以施工与验收要点为准。</p>
            </div>
          )}

          <div className="flow-step-footer">
            <button
              className={`btn ${isDone ? 'btn-outline' : 'btn-green'}`}
              onClick={(e) => { e.stopPropagation(); toggleFlowStepDone(step.id); }}
            >
              <IconCheck size={16} />
              {isDone ? '取消完成' : '标记完成'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowStepCard;

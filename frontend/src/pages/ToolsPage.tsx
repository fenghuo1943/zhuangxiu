import React, { useState, useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  IconTools, IconPiggy, IconLayout, IconBook, IconWrench, IconClock,
} from '../components/common/Icons';

// ---- Budget Calculator Logic ----
const GRADE_RATES: Record<string, { low: number; high: number; label: string }> = {
  simple: { low: 600, high: 900, label: '简装（出租/过渡）' },
  standard: { low: 1000, high: 1500, label: '标准（自住舒适）' },
  premium: { low: 1800, high: 2800, label: '精装（品质升级）' },
  luxury: { low: 3000, high: 5000, label: '豪装（高端定制）' },
};

const BUDGET_CAT_RATIOS = [
  { name: '硬装工程', ratio: 0.32, color: '#e45b3f' },
  { name: '主材选购', ratio: 0.28, color: '#5f9f77' },
  { name: '设备系统', ratio: 0.15, color: '#5c7fa8' },
  { name: '软装家电', ratio: 0.18, color: '#be7b2f' },
  { name: '服务杂项', ratio: 0.07, color: '#9b928b' },
];

// ---- Timeline Estimator Logic ----
const TIMELINE_NEW = [
  { name: '设计与开工准备', days: [7, 15] },
  { name: '墙体拆改', days: [2, 4] },
  { name: '新建墙体', days: [2, 3] },
  { name: '门窗封装', days: [1, 3] },
  { name: '水电改造', days: [5, 10] },
  { name: '管道隔音', days: [1, 2] },
  { name: '防水施工', days: [2, 3] },
  { name: '墙地砖铺贴', days: [5, 7] },
  { name: '瓷砖美缝', days: [1, 2] },
  { name: '成品保护', days: [1, 1] },
  { name: '木工吊顶', days: [3, 5] },
  { name: '墙面基层', days: [3, 5] },
  { name: '墙面涂饰', days: [2, 3] },
  { name: '室内门安装', days: [1, 2] },
  { name: '厨房电器', days: [1, 1] },
  { name: '全屋定制', days: [1, 2] },
  { name: '踢脚线安装', days: [1, 2] },
  { name: '灯具开关', days: [1, 2] },
  { name: '卫浴洁具', days: [1, 2] },
  { name: '开荒保洁', days: [1, 2] },
  { name: '窗帘安装', days: [1, 1] },
  { name: '家具软装', days: [1, 3] },
];

const TIMELINE_OLD = [
  { name: '验房评估', days: [3, 5] },
  { name: '拆除旧物', days: [3, 7] },
  { name: '结构修补', days: [2, 5] },
  { name: '水电改造', days: [5, 10] },
  { name: '防水施工', days: [3, 5] },
  { name: '瓦工贴砖', days: [10, 15] },
  { name: '木工油漆', days: [15, 25] },
  { name: '安装阶段', days: [15, 20] },
  { name: '通风入住', days: [30, 60] },
];

const fmtWan = (v: number) => (v / 10000).toFixed(1) + '万';
const fmtYuan = (v: number) => v.toLocaleString('zh-CN');

const ToolsPage: React.FC = () => {
  // Budget calculator state
  const [budgetArea, setBudgetArea] = useState('90');
  const [budgetGrade, setBudgetGrade] = useState('standard');

  // Timeline estimator state
  const [timelineType, setTimelineType] = useState<'new' | 'old'>('new');
  const [timelineArea, setTimelineArea] = useState('90');

  const budgetResult = useMemo(() => {
    const area = parseFloat(budgetArea) || 0;
    const rate = GRADE_RATES[budgetGrade] || GRADE_RATES.standard;
    const low = area * rate.low;
    const high = area * rate.high;
    const mid = (low + high) / 2;
    return { area, low, high, mid, rate };
  }, [budgetArea, budgetGrade]);

  const timelineResult = useMemo(() => {
    const area = parseFloat(timelineArea) || 90;
    const steps = timelineType === 'new' ? TIMELINE_NEW : TIMELINE_OLD;
    const areaFactor = Math.max(0.7, Math.min(1.5, area / 90));
    let totalMin = 0, totalMax = 0;
    const detail = steps.map(s => {
      const minDays = Math.round(s.days[0] * areaFactor);
      const maxDays = Math.round(s.days[1] * areaFactor);
      totalMin += minDays; totalMax += maxDays;
      return { name: s.name, min: minDays, max: maxDays };
    });
    return { totalMin, totalMax, detail, areaFactor };
  }, [timelineType, timelineArea]);

  return (
    <AppShell currentPage="tools">
      <div className="tools-page">
        <div className="tools-header">
          <span className="eyebrow"><IconTools size={14} /> 实用工具</span>
          <h1>辅助装修管理的实用工具</h1>
          <p>基于行业参考数据的估算工具，实际费用以市场询价为准。</p>
        </div>

        <div className="tools-grid">
          {/* Budget Calculator */}
          <div className="card tools-tool-card active">
            <div className="card-hd">
              <div className="card-title-row">
                <span className="iconbox iconbox-coral"><IconPiggy size={16} /></span>
                <h3>预算计算器</h3>
              </div>
            </div>
            <div className="card-bd">
              <div className="tool-form">
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>房屋面积 (㎡)</label>
                    <input className="input" type="number" min="30" max="500" value={budgetArea} onChange={e => setBudgetArea(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>装修档次</label>
                    <select className="input" value={budgetGrade} onChange={e => setBudgetGrade(e.target.value)} style={{ width: '100%' }}>
                      {Object.entries(GRADE_RATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {budgetResult.area > 0 && (
                <div className="tool-result">
                  <div className="tool-result-total">
                    <span>预估总预算</span>
                    <b>{fmtWan(budgetResult.low)} ~ {fmtWan(budgetResult.high)}</b>
                    <em>参考单价 {budgetResult.rate.low.toLocaleString()} ~ {budgetResult.rate.high.toLocaleString()} 元/㎡</em>
                  </div>
                  <div className="tool-result-bars">
                    {BUDGET_CAT_RATIOS.map(cat => {
                      const catLow = Math.round(budgetResult.low * cat.ratio);
                      const catHigh = Math.round(budgetResult.high * cat.ratio);
                      return (
                        <div key={cat.name} className="tool-cat-row">
                          <div className="tool-cat-info">
                            <span className="budget-cat-dot" style={{ background: cat.color }} />
                            <span>{cat.name}</span>
                            <span className="tool-cat-pct">{(cat.ratio * 100).toFixed(0)}%</span>
                          </div>
                          <span className="tool-cat-range">{fmtYuan(catLow)} ~ {fmtYuan(catHigh)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Estimator */}
          <div className="card tools-tool-card active">
            <div className="card-hd">
              <div className="card-title-row">
                <span className="iconbox iconbox-green"><IconClock size={16} /></span>
                <h3>工期预估</h3>
              </div>
            </div>
            <div className="card-bd">
              <div className="tool-form">
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>装修类型</label>
                    <select className="input" value={timelineType} onChange={e => setTimelineType(e.target.value as 'new' | 'old')} style={{ width: '100%' }}>
                      <option value="new">新房毛坯</option>
                      <option value="old">旧房改造</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>房屋面积 (㎡)</label>
                    <input className="input" type="number" min="30" max="500" value={timelineArea} onChange={e => setTimelineArea(e.target.value)} style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
              <div className="tool-result">
                <div className="tool-result-total">
                  <span>预估总工期</span>
                  <b>{timelineResult.totalMin} ~ {timelineResult.totalMax} 天</b>
                  <em>约 {Math.round(timelineResult.totalMin / 30)} ~ {Math.round(timelineResult.totalMax / 30)} 个月</em>
                </div>
                <div className="tool-timeline-bars" style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {timelineResult.detail.map((s, i) => (
                    <div key={i} className="tool-timeline-row">
                      <span className="tool-timeline-name">{s.name}</span>
                      <div className="tool-timeline-bar-wrap">
                        <div className="tool-timeline-bar" style={{ width: `${Math.min(100, (s.max / (timelineResult.totalMax || 1)) * 100)}%` }} />
                      </div>
                      <span className="tool-timeline-days">{s.min}-{s.max}天</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Placeholder tools */}
          {[
            { icon: <IconLayout size={28} />, title: '面积测量', desc: '记录各房间面积，辅助计算瓷砖、地板、涂料等材料用量。' },
            { icon: <IconBook size={28} />, title: '装修合同模板', desc: '提供装修合同关键条款检查清单，避免漏项和陷阱。' },
          ].map((tool, i) => (
            <div key={i} className="card tools-tool-card">
              <div className="card-bd">
                <div className="tools-tool-icon">{tool.icon}</div>
                <h3>{tool.title}</h3>
                <p>{tool.desc}</p>
                <span className="badge badge-warning">即将上线</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </AppShell>
  );
};

export default ToolsPage;

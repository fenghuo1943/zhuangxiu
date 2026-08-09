import type { TipStatus } from './types';

/** 常用房间预设，作为快速选择 chips；用户也可自由输入自定义房间。 */
export const ROOM_PRESETS = [
  '厨房',
  '主卧',
  '次卧',
  '客厅',
  '卫生间',
  '书房',
  '儿童房',
  '阳台',
  '玄关',
  '其他',
];

export const TIP_STATUS_META: Record<TipStatus, { label: string; color: string }> = {
  pending: { label: '待确认', color: 'coral' },
  adopted: { label: '已采纳', color: 'green' },
  rejected: { label: '不采纳', color: 'gray' },
};

export const TIP_STATUS_OPTIONS: Array<{ value: TipStatus; label: string }> = [
  { value: 'pending', label: '待确认' },
  { value: 'adopted', label: '已采纳' },
  { value: 'rejected', label: '不采纳' },
];

/**
 * 根据装修阶段(stage_parent)和子分组(subgroup_name)推断对应的预算分类和子分类。
 *
 * 用于比价、待购、已购页面的分类筛选功能。
 */

export interface CategoryResult {
  categoryId: string;
  subCategoryId: string | null;
}

// key = "stage_parent||subgroup_name"
const STAGE_SUBGROUP_MAP: Record<string, CategoryResult> = {
  // 开工前准备
  '开工前准备||临时设施':   { categoryId: 'service',   subCategoryId: 'fucai' },
  '开工前准备||前置准备':   { categoryId: 'equipment', subCategoryId: 'jingshui' },

  // 水电阶段
  '水电阶段||电线':         { categoryId: 'hard',      subCategoryId: 'shuidian' },
  '水电阶段||线管配件':     { categoryId: 'hard',      subCategoryId: 'shuidian' },
  '水电阶段||配电箱':       { categoryId: 'hard',      subCategoryId: 'shuidian' },
  '水电阶段||水管配件':     { categoryId: 'hard',      subCategoryId: 'shuidian' },
  '水电阶段||开关插座':     { categoryId: 'hard',      subCategoryId: 'shuidian' },

  // 瓦工阶段
  '瓦工阶段||水泥沙砖':     { categoryId: 'hard',      subCategoryId: 'wagong' },
  '瓦工阶段||瓷砖辅料':     { categoryId: 'hard',      subCategoryId: 'wagong' },
  '瓦工阶段||防水材料':     { categoryId: 'hard',      subCategoryId: 'fangshui' },
  '瓦工阶段||其他配件':     { categoryId: 'hard',      subCategoryId: 'wagong' },

  // 木工阶段
  '木工阶段||龙骨':         { categoryId: 'hard',      subCategoryId: 'mugong' },
  '木工阶段||板材':         { categoryId: 'hard',      subCategoryId: 'mugong' },
  '木工阶段||辅料':         { categoryId: 'hard',      subCategoryId: 'mugong' },

  // 油漆阶段
  '油漆阶段||基层处理':     { categoryId: 'hard',      subCategoryId: 'youqi' },
  '油漆阶段||腻子':         { categoryId: 'hard',      subCategoryId: 'youqi' },
  '油漆阶段||面漆':         { categoryId: 'hard',      subCategoryId: 'youqi' },

  // 安装阶段
  '安装阶段||门窗':         { categoryId: 'material',  subCategoryId: 'menchuang' },
  '安装阶段||卫浴':         { categoryId: 'material',  subCategoryId: 'weiyu' },
  '安装阶段||灯具五金':     { categoryId: 'soft',      subCategoryId: 'dengju' },
  '安装阶段||家电':         { categoryId: 'soft',      subCategoryId: 'jiadian' },
  '安装阶段||全屋定制':     { categoryId: 'material',  subCategoryId: 'quanwudingzhi' },

  // 软装阶段
  '软装阶段||家具':         { categoryId: 'soft',      subCategoryId: 'jiaju' },
  '软装阶段||窗帘布艺':     { categoryId: 'soft',      subCategoryId: 'chuanglian' },
};

/**
 * Stage-level fallback mapping (used when exact subgroup match is not found).
 */
const STAGE_DEFAULTS: Record<string, CategoryResult> = {
  '开工前准备': { categoryId: 'service',   subCategoryId: null },
  '水电阶段':   { categoryId: 'hard',      subCategoryId: 'shuidian' },
  '瓦工阶段':   { categoryId: 'hard',      subCategoryId: 'wagong' },
  '木工阶段':   { categoryId: 'hard',      subCategoryId: 'mugong' },
  '油漆阶段':   { categoryId: 'hard',      subCategoryId: 'youqi' },
  '安装阶段':   { categoryId: 'material',  subCategoryId: null },
  '软装阶段':   { categoryId: 'soft',      subCategoryId: null },
};

/**
 * Map a purchase item's stage_parent + subgroup_name to its budget category.
 * Returns null if the item cannot be mapped (e.g., custom items with unknown stages).
 */
export function mapStageSubgroupToCategory(
  stageParent: string | null | undefined,
  subgroupName: string | null | undefined,
): CategoryResult | null {
  if (!stageParent) return null;

  const key = `${stageParent}||${subgroupName || ''}`;

  // 1. Exact match
  if (STAGE_SUBGROUP_MAP[key]) {
    return STAGE_SUBGROUP_MAP[key];
  }

  // 2. Fallback: try just the stage
  return STAGE_DEFAULTS[stageParent] || null;
}

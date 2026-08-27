/**
 * 双分类系统辅助工具。
 *
 * 采购物品同时拥有两套分类：
 * 1. 采购阶段（stage_parent + subgroup_name）—— 物品「什么时候买」
 * 2. 预算分类（category_id + sub_category_id）—— 物品「花在哪个科目」
 *
 * 本模块提供：
 * - 从 stage/subgroup 推算预算分类的映射表（用于离线/回退场景）
 * - 统一的分类提取函数（优先使用物品自身的 category_id，回退到映射）
 */

export interface CategoryResult {
  categoryId: string;
  subCategoryId: string | null;
}

// key = "stage_parent||subgroup_name"
const STAGE_SUBGROUP_MAP: Record<string, CategoryResult> = {
  // 水电阶段（含原开工前准备）
  '水电阶段||临时设施':   { categoryId: 'service',   subCategoryId: 'fucai' },
  '水电阶段||前置准备':   { categoryId: 'equipment', subCategoryId: 'jingshui' },
  '水电阶段||电线':         { categoryId: 'hard',      subCategoryId: 'shuidian' },
  '水电阶段||线管配件':     { categoryId: 'hard',      subCategoryId: 'shuidian' },
  '水电阶段||配电箱':       { categoryId: 'hard',      subCategoryId: 'shuidian' },
  '水电阶段||水管配件':     { categoryId: 'hard',      subCategoryId: 'shuidian' },
  '水电阶段||开关插座':     { categoryId: 'hard',      subCategoryId: 'shuidian' },

  // 拆改阶段
  '拆改阶段||拆除工具':     { categoryId: 'hard',      subCategoryId: 'chaigai' },
  '拆改阶段||保护材料':     { categoryId: 'hard',      subCategoryId: 'chaigai' },
  '拆改阶段||新建墙体':     { categoryId: 'hard',      subCategoryId: 'chaigai' },
  '拆改阶段||门窗改造':     { categoryId: 'hard',      subCategoryId: 'chaigai' },

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

const STAGE_DEFAULTS: Record<string, CategoryResult> = {
  '水电阶段':   { categoryId: 'hard',      subCategoryId: 'shuidian' },
  '拆改阶段':   { categoryId: 'hard',      subCategoryId: 'chaigai' },
  '瓦工阶段':   { categoryId: 'hard',      subCategoryId: 'wagong' },
  '木工阶段':   { categoryId: 'hard',      subCategoryId: 'mugong' },
  '油漆阶段':   { categoryId: 'hard',      subCategoryId: 'youqi' },
  '安装阶段':   { categoryId: 'material',  subCategoryId: null },
  '软装阶段':   { categoryId: 'soft',      subCategoryId: null },
};

/**
 * 根据 stage/subgroup 推算预算分类（不回退到 item 自身字段）。
 * 用于离线场景或 seed 数据尚未包含 category 字段时。
 */
export function mapStageSubgroupToCategory(
  stageParent: string | null | undefined,
  subgroupName: string | null | undefined,
): CategoryResult | null {
  if (!stageParent) return null;

  const key = `${stageParent}||${subgroupName || ''}`;
  if (STAGE_SUBGROUP_MAP[key]) return STAGE_SUBGROUP_MAP[key];
  return STAGE_DEFAULTS[stageParent] || null;
}

/**
 * 获取物品的预算分类信息。
 * 优先使用物品自身的 category_id（来自后端），
 * 如果没有则回退到 stage/subgroup 推算。
 */
export function getItemCategory(
  item: {
    category_id?: string | null;
    sub_category_id?: string | null;
    stage_parent?: string | null;
    subgroup_name?: string | null;
    stageParent?: string;
    subgroupName?: string;
  },
): CategoryResult | null {
  // 1. 优先使用物品自带的 category_id（来自数据库）
  if (item.category_id) {
    return {
      categoryId: item.category_id,
      subCategoryId: item.sub_category_id || null,
    };
  }
  // 2. 回退：通过 stage + subgroup 推算
  const sp = item.stage_parent ?? item.stageParent ?? null;
  const sn = item.subgroup_name ?? item.subgroupName ?? null;
  return mapStageSubgroupToCategory(sp, sn);
}

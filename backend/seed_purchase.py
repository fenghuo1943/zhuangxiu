"""Seed the purchase reference tables with the comprehensive renovation shopping list.

Data mirrors the reference HTML (采购.html) DEFAULT_DATA structure:
- 7 stages (开工前准备 through 软装阶段)
- 23 subgroups
- 131 reference items

IDs use deterministic prefixes (stage_0..6, sub_0_0..6_1, item_0_0_0..6_1_3)
so the seed is idempotent — re-running will skip existing stages.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import PurchaseRefStage, PurchaseRefSubgroup, PurchaseRefItem

# ── Full reference data ──────────────────────────────────────────────

PURCHASE_DATA = [
    {
        "parent": "开工前准备",
        "subs": [
            {
                "name": "临时设施",
                "items": [
                    {"name": "临时马桶", "spec": "", "qty": 1, "unit": "个"},
                    {"name": "临时水龙头", "spec": "", "qty": 1, "unit": "个"},
                    {"name": "临时灯泡", "spec": "LED", "qty": 2, "unit": "个"},
                    {"name": "临时插座", "spec": "", "qty": 2, "unit": "个"},
                ],
            },
            {
                "name": "前置准备",
                "items": [
                    {"name": "强电箱装饰画", "spec": "", "qty": 1, "unit": "个"},
                    {"name": "前置过滤器", "spec": "", "qty": 1, "unit": "个"},
                ],
            },
        ],
    },
    {
        "parent": "水电阶段",
        "subs": [
            {
                "name": "电线",
                "items": [
                    {"name": "BV铜线", "spec": "1.5mm² 照明用", "qty": 2, "unit": "卷"},
                    {"name": "BV铜线", "spec": "2.5mm² 插座用", "qty": 3, "unit": "卷"},
                    {"name": "BV铜线", "spec": "4mm² 厨卫空调用", "qty": 3, "unit": "卷"},
                    {"name": "BV铜线", "spec": "6mm² 入户线", "qty": 1, "unit": "卷"},
                    {"name": "网线", "spec": "超六类CAT6A", "qty": 1, "unit": "箱"},
                ],
            },
            {
                "name": "线管配件",
                "items": [
                    {"name": "PVC线管", "spec": "20mm 中型壁厚2.0", "qty": 30, "unit": "根"},
                    {"name": "弯头", "spec": "20mm", "qty": 30, "unit": "个"},
                    {"name": "接线盒", "spec": "86型", "qty": 40, "unit": "个"},
                    {"name": "杯梳（锁扣）", "spec": "", "qty": 80, "unit": "个"},
                    {"name": "管卡", "spec": "", "qty": 100, "unit": "个"},
                    {"name": "波纹管", "spec": "筒灯用", "qty": 20, "unit": "根"},
                    {"name": "黄蜡管", "spec": "灯线用", "qty": 10, "unit": "根"},
                    {"name": "锡箔纸", "spec": "强弱电交接用", "qty": 2, "unit": "卷"},
                    {"name": "50PVC管", "spec": "预埋用", "qty": 4, "unit": "根"},
                ],
            },
            {
                "name": "配电箱",
                "items": [
                    {"name": "配电箱体", "spec": "12-13回路", "qty": 1, "unit": "个"},
                    {"name": "空开", "spec": "C63 总开", "qty": 1, "unit": "个"},
                    {"name": "空开", "spec": "C16 照明", "qty": 1, "unit": "个"},
                    {"name": "空开", "spec": "C20 插座", "qty": 1, "unit": "个"},
                    {"name": "空开", "spec": "C25 厨房", "qty": 1, "unit": "个"},
                    {"name": "空开", "spec": "C25 卫生间", "qty": 1, "unit": "个"},
                    {"name": "空开", "spec": "C32 空调", "qty": 3, "unit": "个"},
                    {"name": "漏保", "spec": "C25 30mA 厨卫", "qty": 3, "unit": "个"},
                    {"name": "汇流排", "spec": "", "qty": 2, "unit": "根"},
                    {"name": "零线排", "spec": "", "qty": 1, "unit": "根"},
                    {"name": "地线排", "spec": "", "qty": 1, "unit": "根"},
                ],
            },
            {
                "name": "水管配件",
                "items": [
                    {"name": "PPR热水管", "spec": "DN25 壁厚3.5+", "qty": 5, "unit": "根"},
                    {"name": "PPR热水管", "spec": "DN20", "qty": 10, "unit": "根"},
                    {"name": "PPR弯头", "spec": "", "qty": 20, "unit": "个"},
                    {"name": "PPR三通", "spec": "", "qty": 10, "unit": "个"},
                    {"name": "PPR直接", "spec": "", "qty": 10, "unit": "个"},
                    {"name": "过桥弯", "spec": "", "qty": 4, "unit": "个"},
                    {"name": "双联内丝弯头", "spec": "花洒用间距15cm", "qty": 2, "unit": "个"},
                    {"name": "角阀", "spec": "", "qty": 10, "unit": "个"},
                    {"name": "保温棉", "spec": "水管用", "qty": 10, "unit": "根"},
                    {"name": "管卡", "spec": "PPR", "qty": 40, "unit": "个"},
                    {"name": "生料带", "spec": "", "qty": 5, "unit": "卷"},
                    {"name": "堵漏王", "spec": "", "qty": 2, "unit": "袋"},
                ],
            },
            {
                "name": "开关插座",
                "items": [
                    {"name": "86底盒", "spec": "", "qty": 30, "unit": "个"},
                    {"name": "五孔插座", "spec": "", "qty": 20, "unit": "个"},
                    {"name": "五孔带开关", "spec": "厨房台面用", "qty": 6, "unit": "个"},
                    {"name": "五孔带USB", "spec": "床头用", "qty": 4, "unit": "个"},
                    {"name": "16A三孔插座", "spec": "空调用", "qty": 4, "unit": "个"},
                    {"name": "单开单控", "spec": "", "qty": 10, "unit": "个"},
                    {"name": "单开双控", "spec": "", "qty": 5, "unit": "个"},
                    {"name": "双开双控", "spec": "", "qty": 3, "unit": "个"},
                    {"name": "防水盒", "spec": "卫生间用", "qty": 6, "unit": "个"},
                ],
            },
        ],
    },
    {
        "parent": "瓦工阶段",
        "subs": [
            {
                "name": "水泥沙砖",
                "items": [
                    {"name": "水泥", "spec": "32.5号", "qty": 10, "unit": "袋"},
                    {"name": "河沙", "spec": "", "qty": 5, "unit": "方"},
                    {"name": "红砖", "spec": "砌墙用", "qty": 200, "unit": "块"},
                ],
            },
            {
                "name": "瓷砖辅料",
                "items": [
                    {"name": "瓷砖胶", "spec": "JC/T547 C2", "qty": 10, "unit": "袋"},
                    {"name": "背胶", "spec": "双组份", "qty": 2, "unit": "桶"},
                    {"name": "十字卡", "spec": "2mm", "qty": 2, "unit": "包"},
                    {"name": "美缝剂", "spec": "全聚脲", "qty": 20, "unit": "支"},
                ],
            },
            {
                "name": "防水材料",
                "items": [
                    {"name": "防水涂料", "spec": "刚性+柔性", "qty": 3, "unit": "桶"},
                    {"name": "堵漏王", "spec": "", "qty": 3, "unit": "袋"},
                ],
            },
            {
                "name": "其他配件",
                "items": [
                    {"name": "地漏", "spec": "回字形", "qty": 3, "unit": "个"},
                    {"name": "烟道止逆阀", "spec": "", "qty": 1, "unit": "个"},
                    {"name": "门槛石", "spec": "", "qty": 3, "unit": "条"},
                    {"name": "挡水条", "spec": "淋浴房用", "qty": 1, "unit": "条"},
                    {"name": "隔音棉", "spec": "下水管用", "qty": 5, "unit": "根"},
                    {"name": "阻尼片", "spec": "卫生间下水管", "qty": 3, "unit": "片"},
                ],
            },
        ],
    },
    {
        "parent": "木工阶段",
        "subs": [
            {
                "name": "龙骨",
                "items": [
                    {"name": "轻钢龙骨", "spec": "主龙骨0.8mm", "qty": 20, "unit": "根"},
                    {"name": "轻钢龙骨", "spec": "副龙骨0.5mm", "qty": 40, "unit": "根"},
                ],
            },
            {
                "name": "板材",
                "items": [
                    {"name": "石膏板", "spec": "ENF级 9.5mm+", "qty": 20, "unit": "张"},
                    {"name": "防潮石膏板", "spec": "厨卫用", "qty": 5, "unit": "张"},
                    {"name": "欧松板", "spec": "窗帘盒打底", "qty": 3, "unit": "张"},
                ],
            },
            {
                "name": "辅料",
                "items": [
                    {"name": "白乳胶", "spec": "", "qty": 1, "unit": "桶"},
                    {"name": "铆钉", "spec": "", "qty": 2, "unit": "包"},
                    {"name": "自攻丝", "spec": "", "qty": 2, "unit": "盒"},
                ],
            },
        ],
    },
    {
        "parent": "油漆阶段",
        "subs": [
            {
                "name": "基层处理",
                "items": [
                    {"name": "墙固/界面剂", "spec": "", "qty": 2, "unit": "桶"},
                    {"name": "粉刷石膏", "spec": "底层找平", "qty": 5, "unit": "袋"},
                    {"name": "嵌缝石膏", "spec": "修补缝隙", "qty": 3, "unit": "袋"},
                ],
            },
            {
                "name": "腻子",
                "items": [
                    {"name": "腻子粉", "spec": "耐水型N", "qty": 15, "unit": "袋"},
                    {"name": "网格布", "spec": "挂网用", "qty": 5, "unit": "卷"},
                    {"name": "阴阳角条", "spec": "", "qty": 20, "unit": "根"},
                ],
            },
            {
                "name": "面漆",
                "items": [
                    {"name": "防锈漆", "spec": "钉眼用", "qty": 1, "unit": "罐"},
                    {"name": "底漆", "spec": "", "qty": 2, "unit": "桶"},
                    {"name": "面漆", "spec": "优等品", "qty": 3, "unit": "桶"},
                    {"name": "美纹纸", "spec": "", "qty": 10, "unit": "卷"},
                ],
            },
        ],
    },
    {
        "parent": "安装阶段",
        "subs": [
            {
                "name": "门窗",
                "items": [
                    {"name": "室内门", "spec": "", "qty": 0, "unit": "扇"},
                    {"name": "门套", "spec": "", "qty": 0, "unit": "套"},
                    {"name": "门锁", "spec": "静音锁", "qty": 0, "unit": "把"},
                    {"name": "合页", "spec": "3mm厚3个/门", "qty": 0, "unit": "个"},
                    {"name": "密封条", "spec": "", "qty": 0, "unit": "套"},
                    {"name": "断桥铝窗", "spec": "", "qty": 0, "unit": "平方"},
                    {"name": "纱窗", "spec": "高透金刚网", "qty": 0, "unit": "扇"},
                ],
            },
            {
                "name": "卫浴",
                "items": [
                    {"name": "马桶", "spec": "", "qty": 1, "unit": "个"},
                    {"name": "花洒", "spec": "恒温款", "qty": 1, "unit": "套"},
                    {"name": "浴室柜", "spec": "", "qty": 1, "unit": "套"},
                    {"name": "水龙头", "spec": "抽拉式", "qty": 1, "unit": "个"},
                    {"name": "水槽", "spec": "SUS304大单槽", "qty": 1, "unit": "个"},
                    {"name": "地漏", "spec": "", "qty": 3, "unit": "个"},
                    {"name": "毛巾杆", "spec": "", "qty": 2, "unit": "个"},
                    {"name": "置物架", "spec": "", "qty": 2, "unit": "个"},
                    {"name": "玻璃胶", "spec": "0级防霉", "qty": 5, "unit": "支"},
                ],
            },
            {
                "name": "灯具五金",
                "items": [
                    {"name": "客厅主灯", "spec": "", "qty": 1, "unit": "个"},
                    {"name": "卧室灯", "spec": "", "qty": 0, "unit": "个"},
                    {"name": "射灯", "spec": "深杯防眩 CRI≥90", "qty": 0, "unit": "个"},
                    {"name": "灯带", "spec": "不频闪", "qty": 0, "unit": "米"},
                    {"name": "筒灯", "spec": "", "qty": 0, "unit": "个"},
                    {"name": "阳台灯", "spec": "", "qty": 1, "unit": "个"},
                    {"name": "厨卫灯", "spec": "", "qty": 2, "unit": "个"},
                    {"name": "电动窗帘", "spec": "", "qty": 0, "unit": "套"},
                    {"name": "升降晾衣架", "spec": "", "qty": 1, "unit": "个"},
                ],
            },
            {
                "name": "家电",
                "items": [
                    {"name": "空调挂机", "spec": "", "qty": 0, "unit": "台"},
                    {"name": "空调柜机", "spec": "", "qty": 0, "unit": "台"},
                    {"name": "冰箱", "spec": "一级能效", "qty": 1, "unit": "台"},
                    {"name": "洗衣机", "spec": "", "qty": 1, "unit": "台"},
                    {"name": "油烟机", "spec": "", "qty": 1, "unit": "台"},
                    {"name": "燃气灶", "spec": "", "qty": 1, "unit": "台"},
                    {"name": "洗碗机", "spec": "", "qty": 1, "unit": "台"},
                    {"name": "热水器", "spec": "", "qty": 1, "unit": "台"},
                    {"name": "电视", "spec": "", "qty": 0, "unit": "台"},
                ],
            },
            {
                "name": "全屋定制",
                "items": [
                    {"name": "橱柜", "spec": "", "qty": 0, "unit": "延米"},
                    {"name": "衣柜", "spec": "", "qty": 0, "unit": "投影平方"},
                    {"name": "鞋柜", "spec": "", "qty": 1, "unit": "个"},
                    {"name": "餐边柜", "spec": "", "qty": 1, "unit": "个"},
                    {"name": "铝扣板吊顶", "spec": "厨卫阳台", "qty": 0, "unit": "平方"},
                    {"name": "地板", "spec": "", "qty": 0, "unit": "平方"},
                ],
            },
        ],
    },
    {
        "parent": "软装阶段",
        "subs": [
            {
                "name": "家具",
                "items": [
                    {"name": "沙发", "spec": "", "qty": 1, "unit": "套"},
                    {"name": "床", "spec": "", "qty": 0, "unit": "张"},
                    {"name": "床垫", "spec": "", "qty": 0, "unit": "张"},
                    {"name": "餐桌椅", "spec": "", "qty": 1, "unit": "套"},
                    {"name": "书桌", "spec": "", "qty": 0, "unit": "张"},
                ],
            },
            {
                "name": "窗帘布艺",
                "items": [
                    {"name": "窗帘", "spec": "褶皱2倍", "qty": 0, "unit": "套"},
                ],
            },
        ],
    },
]


async def seed_purchase_references(db: AsyncSession) -> int:
    """Seed reference data into purchase tables. Returns number of stages inserted.

    Idempotent — if stages already exist, skips seeding entirely.
    Uses deterministic IDs (stage_0..6, sub_0_0..6_1, item_0_0_0..6_1_X)
    so re-runs are safe.
    """
    # Check if already seeded
    result = await db.execute(select(PurchaseRefStage))
    if result.scalars().first():
        return 0  # already seeded

    count = 0
    for si, stage_data in enumerate(PURCHASE_DATA):
        stage = PurchaseRefStage(
            id=f"stage_{si}",
            parent=stage_data["parent"],
        )
        db.add(stage)
        count += 1

        for ssi, sub_data in enumerate(stage_data["subs"]):
            subgroup = PurchaseRefSubgroup(
                id=f"sub_{si}_{ssi}",
                stage_id=stage.id,
                name=sub_data["name"],
            )
            db.add(subgroup)

            for ii, item_data in enumerate(sub_data["items"]):
                item = PurchaseRefItem(
                    id=f"item_{si}_{ssi}_{ii}",
                    subgroup_id=subgroup.id,
                    name=item_data["name"],
                    spec=item_data.get("spec", ""),
                    qty=item_data.get("qty", 1),
                    unit=item_data.get("unit", "个"),
                )
                db.add(item)

    await db.commit()
    return count

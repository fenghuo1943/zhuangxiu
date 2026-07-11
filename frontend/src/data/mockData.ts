import type { Stage, BudgetCategory, FlowStep } from './types';

export const DEFAULT_STAGES: Stage[] = [
  { id: 'design', name: '设计与开工准备', order: 1, description: '收房验房、量房设计、物业报备', totalTasks: 3, completedTasks: 0 },
  { id: 'demolish', name: '墙体拆改', order: 2, description: '非承重墙拆除、门洞调整', totalTasks: 2, completedTasks: 0 },
  { id: 'wall-new', name: '新建墙体', order: 3, description: '定位放线、植筋拉结、顶部斜砌', totalTasks: 2, completedTasks: 0 },
  { id: 'window', name: '门窗封装施工', order: 4, description: '断桥铝门窗安装、打胶密封', totalTasks: 2, completedTasks: 0 },
  { id: 'electric', name: '水电改造', order: 5, description: '水电定位、开槽布管、打压测试', totalTasks: 4, completedTasks: 0 },
  { id: 'pipe-sound', name: '管道隔音施工', order: 6, description: '隔音棉包裹、扎带固定', totalTasks: 2, completedTasks: 0 },
  { id: 'waterproof', name: '防水施工', order: 7, description: '卫生间防水、闭水试验', totalTasks: 3, completedTasks: 0 },
  { id: 'tile', name: '墙地砖铺贴', order: 8, description: '地面找平、瓷砖铺贴、空鼓检查', totalTasks: 3, completedTasks: 0 },
  { id: 'grout', name: '瓷砖美缝', order: 9, description: '清缝打胶、环氧彩砂', totalTasks: 1, completedTasks: 0 },
  { id: 'protect', name: '成品保护', order: 10, description: '地膜铺贴、接缝胶带固定', totalTasks: 1, completedTasks: 0 },
  { id: 'ceiling', name: '木工吊顶', order: 11, description: '轻钢龙骨、石膏板安装', totalTasks: 2, completedTasks: 0 },
  { id: 'wall-base', name: '墙面基层处理', order: 12, description: '界面剂、刮腻子、砂纸打磨', totalTasks: 2, completedTasks: 0 },
  { id: 'paint', name: '墙面涂饰', order: 13, description: '底漆封闭、面漆涂刷', totalTasks: 2, completedTasks: 0 },
  { id: 'door', name: '室内门安装', order: 14, description: '门套安装、发泡胶填充', totalTasks: 2, completedTasks: 0 },
  { id: 'kitchen', name: '厨房电器安装', order: 15, description: '烟灶安装、止逆阀检查', totalTasks: 1, completedTasks: 0 },
  { id: 'custom', name: '全屋定制安装', order: 16, description: '柜体安装、门板调试', totalTasks: 1, completedTasks: 0 },
  { id: 'baseboard', name: '踢脚线安装', order: 17, description: '踢脚线粘贴、拐角拼接', totalTasks: 1, completedTasks: 0 },
  { id: 'light', name: '灯具及开关安装', order: 18, description: '灯具安装、开关面板', totalTasks: 1, completedTasks: 0 },
  { id: 'bath', name: '卫浴洁具安装', order: 19, description: '马桶、浴室柜、花洒安装', totalTasks: 1, completedTasks: 0 },
  { id: 'clean', name: '开荒保洁', order: 20, description: '铲刀清理、玻璃清洁', totalTasks: 1, completedTasks: 0 },
  { id: 'curtain', name: '窗帘安装', order: 21, description: '轨道安装、窗帘挂装', totalTasks: 1, completedTasks: 0 },
  { id: 'furniture', name: '家具软装进场', order: 22, description: '大件家具、软装布置', totalTasks: 1, completedTasks: 0 },
];

export const DEFAULT_BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: 'hard', name: '硬装工程', color: '#e45b3f', allocated: 0, spent: 0 },
  { id: 'material', name: '主材选购', color: '#5f9f77', allocated: 0, spent: 0 },
  { id: 'equipment', name: '设备系统', color: '#5c7fa8', allocated: 0, spent: 0 },
  { id: 'soft', name: '软装家电', color: '#be7b2f', allocated: 0, spent: 0 },
  { id: 'service', name: '服务杂项', color: '#9b928b', allocated: 0, spent: 0 },
];

export const FLOW_STEPS_NEW: FlowStep[] = [
  { id: 'design', type: 'new', order: 1, title: '设计与开工准备', days: '7-15天', desc: '先完成收房验房，检查墙面开裂、空鼓等问题并及时要求开发商整改；再通过上门量房，沟通设计风格、平面布局与水电点位；最后携带身份证、房产证、施工图到物业办理装修许可证，缴纳装修保证金，并确认墙体拆改限制、门窗封装要求、垃圾清运等事项。', standards: [], acceptance: [{ id: 1, title: '毛坯房验收', type: 'acceptance' }], articles: [{ id: 1, title: '量房步骤', type: 'article' }, { id: 2, title: '自装第一步，物业报备超详细流程', type: 'article' }, { id: 3, title: '选择装修公司的核心要点', type: 'article' }], pitfalls: [] },
  { id: 'demolish', type: 'new', order: 2, title: '墙体拆改', days: '2-4天', desc: '墙体拆改是优化户型布局的重要环节，主要包括非承重墙拆除、门洞调整及局部结构改造。施工前必须核对图纸并确认承重墙、梁柱、烟道及公共管线位置，严禁破坏主体结构。', standards: [{ id: 1, title: '墙体拆改施工规范', type: 'standard' }], acceptance: [{ id: 2, title: '墙体拆改标准化验收', type: 'acceptance' }], articles: [], pitfalls: [] },
  { id: 'wall-new', type: 'new', order: 3, title: '新建墙体', days: '2-3天', desc: '新建墙体是空间结构改造的核心环节，从定位放线、砂浆配比到植筋拉结、顶部斜砌，每一道工序都会影响墙体的稳固性、垂直度及后期抗裂性能。', standards: [{ id: 3, title: '新建墙体施工规范', type: 'standard' }], acceptance: [{ id: 3, title: '新建墙体标准化验收', type: 'acceptance' }], articles: [], pitfalls: [] },
  { id: 'window', type: 'new', order: 4, title: '门窗封装施工', days: '1-3天', desc: '选断桥铝材质隔音隔热，测量后工厂定制周期约7-15天，安装时打胶要饱满，窗边缝隙用发泡胶填充防渗水。', standards: [{ id: 4, title: '门窗封装施工规范', type: 'standard' }], acceptance: [{ id: 4, title: '门窗封装标准化验收', type: 'acceptance' }], articles: [{ id: 4, title: '门窗选购与封装攻略', type: 'article' }], pitfalls: [] },
  { id: 'electric', type: 'new', order: 5, title: '水电改造', days: '5-10天', desc: '根据生活习惯定位插座、开关、水口，厨卫水电走顶更易检修，完工后做48小时水路打压测试，0.8MPa不掉压为合格。', standards: [{ id: 5, title: '电路施工规范', type: 'standard' }, { id: 6, title: '水路施工规范', type: 'standard' }], acceptance: [{ id: 5, title: '水电材料进场验收', type: 'acceptance' }, { id: 6, title: '电路标准化验收', type: 'acceptance' }, { id: 7, title: '水路标准化验收', type: 'acceptance' }], articles: [{ id: 5, title: '水电走地 vs 走顶', type: 'article' }, { id: 6, title: '电路安装工艺', type: 'article' }, { id: 7, title: '强弱电知识', type: 'article' }, { id: 8, title: '水管选购', type: 'article' }], pitfalls: [] },
  { id: 'pipe-sound', type: 'new', order: 6, title: '管道隔音施工', days: '1-2天', desc: '针对厨房下水管、卫生间立管做隔音处理，先用隔音棉包裹管道，再缠扎带固定，减少水流噪音，尤其适合高层住户。', standards: [{ id: 7, title: '管道隔音施工规范', type: 'standard' }], acceptance: [{ id: 8, title: '管道隔音标准化验收', type: 'acceptance' }], articles: [], pitfalls: [] },
  { id: 'waterproof', type: 'new', order: 7, title: '防水施工', days: '2-3天', desc: '卫生间刷至1.8米高，厨房刷30cm高，淋浴区做满墙；用柔性防水涂料，横竖交叉涂刷2-3遍，墙角阴角做圆弧处理防开裂。', standards: [{ id: 8, title: '防水施工规范', type: 'standard' }], acceptance: [{ id: 9, title: '防水标准化验收', type: 'acceptance' }], articles: [{ id: 9, title: '防水材料解析', type: 'article' }, { id: 10, title: '下沉式卫生间回填', type: 'article' }], pitfalls: [] },
  { id: 'tile', type: 'new', order: 8, title: '墙地砖铺贴', days: '5-7天', desc: '地面先找平，瓷砖提前泡水2小时；厨卫墙地对缝铺贴，留2-3mm缝方便美缝；铺贴后24小时内禁踩，72小时后检查空鼓，空鼓率不超过5%。', standards: [{ id: 9, title: '墙地砖铺贴施工交底', type: 'standard' }, { id: 10, title: '墙砖铺贴施工规范', type: 'standard' }, { id: 11, title: '地砖铺贴施工规范', type: 'standard' }], acceptance: [{ id: 10, title: '铺地砖标准化验收', type: 'acceptance' }, { id: 11, title: '铺墙砖标准化验收', type: 'acceptance' }], articles: [{ id: 11, title: '瓷砖购买指南', type: 'article' }, { id: 12, title: '瓷砖的选择与建议', type: 'article' }], pitfalls: [] },
  { id: 'grout', type: 'new', order: 9, title: '瓷砖美缝', days: '1-2天', desc: '瓷砖铺贴1周后做美缝，先清缝再打胶，用刮板压平后24小时固化；推荐选环氧彩砂，防水防霉适合厨卫。', standards: [{ id: 12, title: '瓷砖美缝施工规范', type: 'standard' }], acceptance: [{ id: 12, title: '瓷砖美缝标准化验收', type: 'acceptance' }], articles: [{ id: 13, title: '美缝材料分类及适用场景说明', type: 'article' }], pitfalls: [] },
  { id: 'protect', type: 'new', order: 10, title: '成品保护', days: '1天', desc: '用1.2mm厚地膜满铺地面，接缝处用胶带粘牢，覆盖墙面30cm高，防止后续施工刮花瓷砖。', standards: [{ id: 13, title: '地面成品保护全流程', type: 'standard' }], acceptance: [], articles: [], pitfalls: [] },
  { id: 'ceiling', type: 'new', order: 11, title: '木工吊顶', days: '3-5天', desc: '客餐厅用轻钢龙骨加石膏板，防潮款适合潮湿区；厨卫装铝扣板，方便检修；预留灯具、浴霸、排气扇位置。', standards: [{ id: 14, title: '木工吊顶施工交底', type: 'standard' }, { id: 15, title: '木工吊顶施工规范', type: 'standard' }], acceptance: [{ id: 13, title: '木工吊顶标准化验收', type: 'acceptance' }], articles: [{ id: 14, title: '自装吊顶龙骨+面板选购', type: 'article' }, { id: 15, title: '6种主流吊顶类型详解', type: 'article' }], pitfalls: [] },
  { id: 'wall-base', type: 'new', order: 12, title: '墙面基层处理', days: '3-5天', desc: '墙面先刷界面剂，腻子每遍薄刮，厚度不超过2mm，干透后用砂纸打磨平整；阴角、阳角需用靠尺找直。', standards: [{ id: 16, title: '墙面基层处理施工规范', type: 'standard' }], acceptance: [{ id: 14, title: '墙面基层处理标准化验收', type: 'acceptance' }], articles: [], pitfalls: [] },
  { id: 'paint', type: 'new', order: 13, title: '墙面涂饰', days: '2-3天', desc: '先刷抗碱底漆封闭基层，再刷两遍面漆；每遍间隔4-6小时，温度低于5℃需停止施工，避免漆膜开裂。', standards: [{ id: 17, title: '墙面涂饰施工规范', type: 'standard' }], acceptance: [{ id: 15, title: '墙面涂饰标准化验收', type: 'acceptance' }], articles: [], pitfalls: [] },
  { id: 'door', type: 'new', order: 14, title: '室内门安装', days: '1-2天', desc: '提前与地板预留5-8mm伸缩缝，门套与墙面缝隙用发泡胶填充，外沿打美容胶收边；实木门需做防潮处理。', standards: [{ id: 18, title: '室内门安装施工规范', type: 'standard' }], acceptance: [{ id: 16, title: '室内门安装标准化验收', type: 'acceptance' }], articles: [{ id: 16, title: '木门选购指南', type: 'article' }], pitfalls: [] },
  { id: 'kitchen', type: 'new', order: 15, title: '厨房电器安装', days: '1天', desc: '与橱柜同步测量尺寸，烟管尽量短且少拐弯；安装后检查止逆阀密封性，避免油烟倒灌。', standards: [], acceptance: [], articles: [{ id: 17, title: '油烟机选购要点', type: 'article' }], pitfalls: [] },
  { id: 'custom', type: 'new', order: 16, title: '全屋定制安装', days: '1-2天', desc: '定制周期约30-45天，安装时先固定柜体再装门板；检查门缝均匀度，五金件调试顺滑度。', standards: [], acceptance: [], articles: [{ id: 18, title: '家装板材全解析与选择', type: 'article' }, { id: 19, title: '主流饰面类型解析与选择', type: 'article' }], pitfalls: [] },
  { id: 'baseboard', type: 'new', order: 17, title: '踢脚线安装', days: '1-2天', desc: '瓷砖踢脚线用水泥粘贴，木质踢脚线打钉固定；与墙面缝隙用美缝剂填充，拐角处45°拼接更美观。', standards: [], acceptance: [], articles: [{ id: 20, title: '踢脚线材质选择', type: 'article' }], pitfalls: [] },
  { id: 'light', type: 'new', order: 18, title: '灯具及开关安装', days: '1-2天', desc: '吊灯需提前预埋承重挂钩，承重为灯具重量的25倍；筒灯、射灯开孔尺寸与灯具匹配，避免过大留缝。', standards: [], acceptance: [], articles: [{ id: 21, title: '简约风无主灯布局攻略', type: 'article' }], pitfalls: [] },
  { id: 'bath', type: 'new', order: 19, title: '卫浴洁具安装', days: '1-2天', desc: '马桶安装先做防水密封圈，浴室柜与墙面打玻璃胶；花洒冷热水管间距15cm，高度1.1m。', standards: [], acceptance: [], articles: [{ id: 22, title: '卫浴选购指南', type: 'article' }], pitfalls: [] },
  { id: 'clean', type: 'new', order: 20, title: '开荒保洁', days: '1-2天', desc: '用铲刀清理瓷砖水泥渍，玻璃刮去除窗膜，高温蒸汽清洁缝隙；重点清理胶印、粉尘和建筑垃圾。', standards: [], acceptance: [], articles: [{ id: 23, title: '新房开荒工具清单', type: 'article' }, { id: 24, title: '新房开荒步骤详解', type: 'article' }], pitfalls: [] },
  { id: 'curtain', type: 'new', order: 21, title: '窗帘安装', days: '1天', desc: '轨道安装距顶5-10cm显层高，窗帘杆两端预留20cm延伸量；挂钩式窗帘需均匀间距，确保垂坠感。', standards: [], acceptance: [], articles: [{ id: 25, title: '窗帘主流面料选择', type: 'article' }, { id: 26, title: '8款热门纱帘全解析', type: 'article' }, { id: 27, title: '罗马杆 vs 顶装轨道 vs 窗帘盒', type: 'article' }], pitfalls: [] },
  { id: 'furniture', type: 'new', order: 22, title: '家具软装进场', days: '1-3天', desc: '先进衣柜、沙发等大件，再摆茶几、床头柜；实木家具避免阳光直射，皮质家具先通风散味。', standards: [], acceptance: [], articles: [], pitfalls: [] },
];

export const FLOW_STEPS_OLD: FlowStep[] = [
  { id: 'old-inspect', type: 'old', order: 1, title: '验房评估', days: '3-5天', desc: '检查旧房现状：墙面、地面、水电管线、门窗等，确定改造范围和预算。重点检查水电管线老化程度。', standards: [], acceptance: [], articles: [], pitfalls: [] },
  { id: 'old-demolish', type: 'old', order: 2, title: '拆除旧物', days: '3-7天', desc: '拆除旧装修：地板、瓷砖、吊顶、旧柜子、旧门窗等。注意保护承重结构。', standards: [{ id: 101, title: '墙体拆除施工规范', type: 'standard' }], acceptance: [{ id: 101, title: '墙体拆除标准化验收', type: 'acceptance' }], articles: [], pitfalls: [] },
  { id: 'old-repair', type: 'old', order: 3, title: '结构修补', days: '2-5天', desc: '修补拆除后的墙体、地面，处理裂缝和空鼓。必要时加固结构。空鼓必须处理，否则后期贴砖会掉。', standards: [], acceptance: [], articles: [], pitfalls: [] },
  { id: 'old-electric', type: 'old', order: 4, title: '水电改造', days: '5-10天', desc: '旧房水电一般需要全部重新铺设。老房子铝线要换铜线，水管建议换PPR管。', standards: [{ id: 102, title: '电路施工规范', type: 'standard' }, { id: 103, title: '水路施工规范', type: 'standard' }], acceptance: [{ id: 102, title: '水电材料进场验收', type: 'acceptance' }, { id: 103, title: '电路标准化验收', type: 'acceptance' }, { id: 104, title: '水路标准化验收', type: 'acceptance' }], articles: [{ id: 101, title: '水电走地 vs 走顶', type: 'article' }, { id: 102, title: '电路安装工艺', type: 'article' }], pitfalls: [] },
  { id: 'old-waterproof', type: 'old', order: 5, title: '防水施工', days: '3-5天', desc: '重新做防水，特别是卫生间和厨房。旧房防水层可能已经失效。', standards: [{ id: 104, title: '防水施工规范', type: 'standard' }], acceptance: [{ id: 105, title: '防水标准化验收', type: 'acceptance' }], articles: [{ id: 103, title: '防水材料解析', type: 'article' }], pitfalls: [] },
  { id: 'old-tile', type: 'old', order: 6, title: '瓦工贴砖', days: '10-15天', desc: '重新铺设墙地砖。旧房可能需要先做地面找平再贴砖。', standards: [{ id: 105, title: '铺砖施工交底', type: 'standard' }, { id: 106, title: '铺墙砖施工规范', type: 'standard' }, { id: 107, title: '铺地砖施工规范', type: 'standard' }], acceptance: [{ id: 106, title: '铺地砖标准化验收', type: 'acceptance' }, { id: 107, title: '铺墙砖标准化验收', type: 'acceptance' }], articles: [{ id: 104, title: '瓷砖购买指南', type: 'article' }, { id: 105, title: '瓷砖的选择与建议', type: 'article' }], pitfalls: [] },
  { id: 'old-wood', type: 'old', order: 7, title: '木工油漆', days: '15-25天', desc: '吊顶、墙面处理、刷漆。旧墙需要铲到红砖重新刮腻子。有裂缝处要贴网格布防裂。', standards: [{ id: 108, title: '吊顶施工规范', type: 'standard' }, { id: 109, title: '刮腻子施工规范', type: 'standard' }, { id: 110, title: '刷漆施工规范', type: 'standard' }], acceptance: [{ id: 108, title: '吊顶标准化验收', type: 'acceptance' }, { id: 109, title: '刮腻子标准化验收', type: 'acceptance' }, { id: 110, title: '刷漆标准化验收', type: 'acceptance' }], articles: [{ id: 106, title: '自装吊顶龙骨+面板选购', type: 'article' }, { id: 107, title: '6种主流吊顶类型详解', type: 'article' }], pitfalls: [] },
  { id: 'old-install', type: 'old', order: 8, title: '安装阶段', days: '15-20天', desc: '橱柜、木门、地板、卫浴、灯具、开关面板等安装。旧门窗建议更换。', standards: [{ id: 111, title: '安门施工规范', type: 'standard' }], acceptance: [{ id: 111, title: '安门标准化验收', type: 'acceptance' }], articles: [{ id: 108, title: '木门选购指南', type: 'article' }, { id: 109, title: '卫浴选购指南', type: 'article' }], pitfalls: [] },
  { id: 'old-ventilate', type: 'old', order: 9, title: '通风入住', days: '30-60天', desc: '通风散味。旧房翻新用料相对少，通风时间可适当缩短，建议至少通风1个月再入住。', standards: [], acceptance: [], articles: [], pitfalls: [] },
];

export const PURCHASE_REFERENCES = [
  {
    parent: '硬装工程',
    subs: [
      { name: '水电材料', items: [
        { id: 'p1', name: 'PPR水管', spec: '25mm', qty: 1, unit: '套', selected: false },
        { id: 'p2', name: '电线', spec: '2.5mm²', qty: 3, unit: '卷', selected: false },
        { id: 'p3', name: '网线', spec: '超六类', qty: 1, unit: '箱', selected: false },
        { id: 'p4', name: '开关插座', spec: '86型', qty: 30, unit: '个', selected: false },
        { id: 'p5', name: '断路器', spec: '2P 63A', qty: 1, unit: '套', selected: false },
      ]},
      { name: '防水材料', items: [
        { id: 'p6', name: '柔性防水涂料', spec: '18kg', qty: 3, unit: '桶', selected: false },
        { id: 'p7', name: '堵漏王', spec: '2kg', qty: 2, unit: '袋', selected: false },
      ]},
      { name: '水泥砂浆', items: [
        { id: 'p8', name: '水泥', spec: '42.5', qty: 20, unit: '袋', selected: false },
        { id: 'p9', name: '中沙', spec: '', qty: 3, unit: '方', selected: false },
        { id: 'p10', name: '瓷砖胶', spec: 'C2型', qty: 10, unit: '袋', selected: false },
      ]},
    ],
  },
  {
    parent: '主材选购',
    subs: [
      { name: '瓷砖', items: [
        { id: 'p11', name: '客厅地砖', spec: '800x800mm', qty: 50, unit: '片', selected: false },
        { id: 'p12', name: '厨房墙砖', spec: '300x600mm', qty: 40, unit: '片', selected: false },
        { id: 'p13', name: '卫生间地砖', spec: '300x300mm', qty: 30, unit: '片', selected: false },
      ]},
      { name: '地板', items: [
        { id: 'p14', name: '强化复合地板', spec: '1215x195mm', qty: 50, unit: '㎡', selected: false },
      ]},
      { name: '门窗', items: [
        { id: 'p15', name: '断桥铝窗', spec: '70系列', qty: 10, unit: '㎡', selected: false },
        { id: 'p16', name: '室内木门', spec: '实木复合', qty: 4, unit: '樘', selected: false },
      ]},
    ],
  },
  {
    parent: '设备系统',
    subs: [
      { name: '暖通', items: [
        { id: 'p17', name: '燃气热水器', spec: '16L', qty: 1, unit: '台', selected: false },
        { id: 'p18', name: '浴霸', spec: '风暖', qty: 2, unit: '台', selected: false },
      ]},
      { name: '净水', items: [
        { id: 'p19', name: '前置过滤器', spec: '40μm', qty: 1, unit: '台', selected: false },
        { id: 'p20', name: 'RO净水器', spec: '600G', qty: 1, unit: '台', selected: false },
      ]},
    ],
  },
  {
    parent: '软装家电',
    subs: [
      { name: '大家电', items: [
        { id: 'p21', name: '冰箱', spec: '500L', qty: 1, unit: '台', selected: false },
        { id: 'p22', name: '洗衣机', spec: '10kg', qty: 1, unit: '台', selected: false },
        { id: 'p23', name: '电视', spec: '65寸', qty: 1, unit: '台', selected: false },
      ]},
      { name: '灯具', items: [
        { id: 'p24', name: '客厅主灯', spec: 'LED', qty: 1, unit: '盏', selected: false },
        { id: 'p25', name: '筒灯', spec: '7W', qty: 12, unit: '个', selected: false },
      ]},
    ],
  },
  {
    parent: '服务杂项',
    subs: [
      { name: '设计服务', items: [
        { id: 'p26', name: '设计费', spec: '', qty: 1, unit: '项', selected: false },
      ]},
      { name: '保洁搬家', items: [
        { id: 'p27', name: '开荒保洁', spec: '', qty: 1, unit: '次', selected: false },
      ]},
    ],
  },
];

# 侧栏工作台主题布局 AI 开发流程分解

> 依据文档：[侧栏工作台主题布局设计指导方案.md](侧栏工作台主题布局设计指导方案.md)  
> 适用范围：桌面端“侧栏工作台”布局、主题设置中的布局切换，以及首页、流程、采购、记账、比价五页的布局接入。  
> 使用方式：按顺序将任务交给 AI 编程助手执行；每个任务完成并验证通过后，再进入下一项。

---

## 0. 全局执行规则

### 0.1 不可违反的产品约束

- 桌面端只保留两个布局：`desktop-default`（全景总览）和 `desktop-sidebar-workbench`（侧栏工作台）。必须删除 `desktop-focus` 的前端类型、注册项、后端白名单、设置卡片和布局组件引用。
- 布局偏好属于登录账号，不属于装修项目；不得写入 `data/store.ts`、项目同步接口或项目导出数据。
- 新布局只改变壳层与信息编排，不重写已有业务数据、接口、权限、采购/比价/记账操作逻辑。
- `>= 768px` 时才可渲染侧栏工作台；小于 `768px` 必须继续使用现有移动端壳层和 `mobile-default` / `mobile-compact` 行为，不能出现桌面侧栏。
- 设置页中的选择只修改草稿；仅当 `PUT /api/user-preferences/theme` 成功后，才允许调用 `applyTheme()` 并切换全站壳层。
- 默认值始终是 `desktop-default`。旧用户已保存的 `desktop-focus` 必须在读取时安全回退到 `desktop-default`，不能导致页面空白或保存失败。
- 参考 HTML 仅用于学习结构节奏；不得拷贝其品牌、账号、外部链接、埋点、同步代码或业务数据。

### 0.2 AI 操作规范

1. 每个任务开始前读取涉及文件，并执行 `git status --short`；保留无关的用户改动。
2. 严格只完成当前任务。若发现前置组件、路由或接口不存在，应记录阻塞项，不用 mock 或重复实现绕过。
3. 新增业务 UI 必须复用现有数据 Hook、状态和事件回调；同一布局实例中的业务组件不得重复渲染。
4. 不要顺手重构 `store.ts`、同步、认证或与本任务无关的页面。
5. 每个任务完成后运行最小相关验证；全部任务完成后才执行完整构建和回归。
6. 不在代码、文档、测试或日志中写入 token、账号或真实用户数据。

### 0.3 目标文件清单

| 层级 | 预计新增/修改 |
| --- | --- |
| 主题注册与 API | `frontend/src/data/theme.ts`、`frontend/src/api/userPreferences.ts`、`frontend/src/components/theme/ThemeProvider.tsx`、`backend/schemas.py`、`backend/routers/user_preferences.py`、`backend/tests/test_user_preferences.py` |
| 桌面壳层 | `frontend/src/components/layout/AppShell.tsx`、`frontend/src/components/layout/DesktopHeader.tsx`、新增 `frontend/src/components/layouts/DesktopSidebarWorkbenchShell.tsx`、`WorkbenchSidebar.tsx`、`WorkbenchPageHeader.tsx`、`workbenchNavigation.ts` |
| 页面接入 | `HomePage.tsx`、`FlowPage.tsx`、`PurchasePage.tsx`、`ExpensePage.tsx`、`ComparePage.tsx`、必要的新布局组合组件 |
| 设置与样式 | `ThemeSettingsPage.tsx`、`frontend/src/styles/*`，可新增 `workbench-layout.css` |

---

## 1. 任务依赖图

```text
T1 现状核对、范围冻结与迁移策略
 └─ T2 删除专注工作台并注册侧栏工作台
     ├─ T3 主题 API 兼容、服务端校验与测试
     └─ T4 设置页布局卡片与草稿交互
         └─ T5 AppShell 布局选择与响应式基础
             ├─ T6 侧栏、页头与共享导航
             ├─ T7 首页与流程页工作台编排
             └─ T8 采购、记账、比价页工作台编排
                 └─ T9 可访问性、断点与视觉回归
                     └─ T10 集成回归与交付
```

`T3` 与 `T4` 可并行，但都依赖 `T2` 的布局 ID 定义；`T6`、`T7`、`T8` 均依赖 `T5`。单个 AI 连续执行时按编号进行。

---

## 2. 任务卡

### T1：现状核对、范围冻结与旧值迁移策略

**目标：** 确认主题偏好链路、现有桌面导航和五个业务页的组件入口，并写出删除 `desktop-focus` 后的兼容策略。

**读取：**

- `frontend/src/data/theme.ts`、`frontend/src/api/userPreferences.ts`、`frontend/src/components/theme/ThemeProvider.tsx`
- `frontend/src/components/layout/AppShell.tsx`、`DesktopHeader.tsx`、`MobileHeader.tsx`、`MobileBottomNav.tsx`
- `frontend/src/pages/ThemeSettingsPage.tsx`、`HomePage.tsx`、`FlowPage.tsx`、`PurchasePage.tsx`、`ExpensePage.tsx`、`ComparePage.tsx`
- `backend/schemas.py`、`backend/routers/user_preferences.py`、`backend/tests/test_user_preferences.py`

**产出：** 记录实际路由、页面主操作、可复用的项目/账号/同步 UI 来源，以及含有 `desktop-focus` 的全部文件。确认“旧值兼容”采用以下规则：服务端读取到 `desktop-focus` 时返回 `desktop-default`；下一次用户保存任意主题设置时写入合法的新值。

**禁止：** 不在此任务实现新壳层或重排页面；不直接修改数据库中所有用户记录。

**完成条件：** 能列出删除点和侧栏工作台接入点，且无未决定的旧值处理方式。

### T2：删除专注工作台并注册侧栏工作台

**目标：** 让前后端只识别全景总览与侧栏工作台，且未知/旧布局有确定回退。

**修改：** `frontend/src/data/theme.ts`、`HomePage.tsx`、`backend/schemas.py`、`backend/routers/user_preferences.py`、相关测试；删除或停止引用 `DesktopFocusHomeLayout.tsx`。

**实现要求：**

- `DesktopLayoutId` 改为 `'desktop-default' | 'desktop-sidebar-workbench'`；`DESKTOP_LAYOUTS` 仅保留这两个选项。
- 删除 `desktop-focus` 的页面 `switch` 分支、样式选择器和布局组件导入；若该组件不再被任何位置引用，可删除该文件。
- `VALID_DESKTOP_LAYOUTS`、Pydantic `Literal` 和服务端默认响应仅使用两个合法 ID。
- 读取历史数据时，在路由层或响应映射层将 `desktop-focus` 规范为 `desktop-default`；PUT 仍拒绝客户端新提交的 `desktop-focus`。
- 前端收到旧值或未知值也必须回退为 `desktop-default`，防止服务端升级前后造成空白页面。

**验证：** 搜索 `desktop-focus`，除迁移兼容/测试说明外不应残留可用注册项；全景总览在桌面端仍正常渲染。

### T3：主题 API 兼容、校验与回归测试

**目标：** 保证布局切换可安全跨设备保存，且旧偏好不会阻塞读取。

**修改：** `backend/schemas.py`、`backend/routers/user_preferences.py`、`backend/tests/test_user_preferences.py`；必要时 `frontend/src/api/userPreferences.ts`。

**最少测试用例：**

1. GET 无记录返回 `desktop-default`，且不落库。
2. PUT 可保存 `desktop-default` 和 `desktop-sidebar-workbench`。
3. PUT 提交 `desktop-focus` 或其他未知值返回校验错误。
4. 数据库中模拟存在 `desktop-focus` 时，GET 返回 `desktop-default`，不抛 500。
5. 不同账号读取/保存相互隔离；主题字段不随切换项目变化。

**完成条件：** 主题接口的合法值、旧值回退和账号隔离均有自动化覆盖。

### T4：主题与布局页的两布局切换

**目标：** 在“我的 - 主题与布局”中以侧栏工作台替换专注工作台，保留既有“确认后生效”机制。

**修改：** `frontend/src/pages/ThemeSettingsPage.tsx`，必要时样式与预览组件。

**实现要求：**

- 桌面端仅显示两张布局卡：全景总览、侧栏工作台；卡片包括名称、说明、线框缩略图和单选状态。
- 侧栏工作台文案为“左侧导航、顶部页头与页面工作区，适合持续管理装修项目”。
- 点击卡片只更新 `draft.desktopLayout`；不改变 `document.documentElement`、不提前切换导航、不发送请求。
- “确定并应用”用完整偏好对象 PUT；成功后使用服务端返回值 `applyTheme()`，失败时保留草稿和错误。
- 小于 `768px` 时桌面布局区域仅展示说明，不允许修改桌面布局；不能覆盖移动端布局草稿。

**验证：** 未确认离开后全站仍为原布局；确认后立即在当前路由切换壳层；刷新并重新登录后保持选择。

### T5：AppShell 布局选择与响应式基础

**目标：** 将“壳层选择”收敛到一个位置，避免每个页面复制布局判断和导航。

**修改/新增：** `AppShell.tsx`、新增 `useMediaQuery` 或等效响应式 Hook、必要时 `ThemeProvider.tsx`。

**实现要求：**

- 在 `AppShell` 中读取已应用主题偏好与响应式断点；移动端仍使用现有 `MobileHeader` + `MobileBottomNav`。
- 宽度 `>= 768px`：`desktop-default` 使用当前 `DesktopHeader`；`desktop-sidebar-workbench` 使用新 `DesktopSidebarWorkbenchShell`；两者不能同时渲染。
- 浏览器跨过 `768px` 断点时即时更新，不能依赖页面刷新或一次性的 `window.innerWidth`。
- 未知桌面 ID 回退 `desktop-default`；壳层切换不卸载业务数据 store、不会改路由、不会发起主题保存。
- 扩展 `AppShell` 参数或建立页头配置 Context，使子页面能够声明页头信息和主操作；不要在 `AppShell` 写五个页面的业务事件。

**验证：** 在任意目标页拖动窗口跨断点，桌面/移动头部正确替换，无双导航、无底部导航残留。

### T6：侧栏、页头和共享导航

**目标：** 完成可复用的桌面工作台壳层，不复制现有业务状态。

**新增：** `DesktopSidebarWorkbenchShell.tsx`、`WorkbenchSidebar.tsx`、`WorkbenchPageHeader.tsx`、`workbenchNavigation.ts`、`workbench-layout.css`（或等效模块样式）。

**实现要求：**

- `workbenchNavigation.ts` 作为唯一导航配置源，使用现有路由：今日总览、装修流程、采购清单、装修记账、比价选品、实用工具、装修技巧、我的；分为“装修工作区”和“辅助工具”。
- 左栏宽 `248px`，`768–1099px` 收至 `208px`；内容区最大宽 `1440px`，内边距 `28px 32px 48px`；内容顶栏高度 `72px` 并粘连。
- 当前导航使用现有路由判断，设置 `aria-current="page"`；图标/文字均为可点击链接，不使用仅点击的 `div`。
- 项目切换、账号菜单、同步状态抽取或复用现有组件/状态来源；不制造两个独立的项目选择器或登录状态。
- `WorkbenchPageHeader` 支持 `eyebrow`、`title`、`primaryAction`、`secondaryActions`；主操作有可读文本、焦点态、禁用态。
- 样式只使用主题语义变量；成功、警告、危险状态继续用各自语义色。

**验证：** 侧栏在五个目标页的当前项正确；键盘 Tab 可依次访问导航、页头动作、主内容；200% 缩放时主内容仍可访问。

### T7：首页与流程页工作台编排

**目标：** 在侧栏工作台内按“状态与下一步优先”重排首页和流程页，同时保持默认布局完全不变。

**修改/新增：** `HomePage.tsx`、`FlowPage.tsx`、新增 `DesktopSidebarWorkbenchHomeLayout.tsx` 与流程页布局组合组件（如有必要）。

**首页要求：**

- 首屏 7:5 双栏：问候/当前阶段/快捷入口 + 今日优先事项。
- 其下四项核心指标：当前进度、预算余额、未完成待办、待购材料。
- 下方 8:4 双栏：施工路线/进度 + 最近动态或预算/采购摘要。
- 复用 `ReminderCard`、`TodayFocus`、`ProgressCard`、`StageRoute`、`BudgetPanel`、`TodoPanel`、`PurchaseSummary`、`ExpenseSummary`；同一个实例不重复渲染。

**流程页要求：**

- 顺序为完成率与当前/下一阶段摘要、横向阶段路线、当前阶段行动条、步骤与说明、攻略/验收/知识/备注。
- 低于可读双栏宽度时改为纵向 DOM 结构或自然堆叠，不使用 CSS `order` 改变阅读顺序。

**验证：** 两页的既有新增、完成、展开、知识查看等操作均可用；切回全景总览后 DOM 和视觉不回归。

### T8：采购、记账、比价页工作台编排

**目标：** 在不改变业务闭环的前提下，将三类列表页组织为“摘要 → 筛选 → 明细 → 收口操作”。

**修改：** `PurchasePage.tsx`、`ExpensePage.tsx`、`ComparePage.tsx` 及最小必要样式/组合组件。

**采购页要求：**

- 保留“我的待购 / 采购参考库”页内标签；待购首行显示待处理、已购买、全部物品摘要。
- 待购依次显示筛选、清单、物品上下文操作；参考库依次显示搜索、新增、批量展开/收起和施工阶段折叠。

**记账页要求：**

- 顶部最多四项金额摘要；分类/阶段概览在明细之前；日期、状态、分类筛选紧邻账单列表。
- 新增/编辑继续使用既有模态框或抽屉逻辑，不能复制第二套表单或改变账单 API。

**比价页要求：**

- 顶部显示比价中物品、候选方案、已选最优方案等摘要和筛选。
- 保持“物品 → 型号 → 渠道报价”层级与既有展开状态；采用方案并加入采购仍是唯一的业务收口。
- 汇总操作固定时不能遮挡最后一条内容，且无选择时禁用或给出清楚说明。

**验证：** 筛选、展开、添加、编辑、删除、去比价、标记已购、采用方案、记账等已有事件及数据同步行为不变。

### T9：响应式、无障碍与视觉回归

**目标：** 确保新增布局在主题色、断点和辅助技术环境中稳定可用。

**检查与修复：**

1. `1440px`、`1024px`：左栏、顶部页头、内容最大宽、卡片网格和粘性元素正确。
2. `768px`：侧栏工作台仍可用且无横向溢出；`767px`：立即回到移动头部和底部导航。
3. `390px`、`320px`：不出现桌面侧栏、桌面顶部操作或遮挡内容的固定元素。
4. 五种预设色与一个自定义色下，导航选中、按钮、焦点 ring、卡片强调和阴影均跟随主题；成功/警告/危险色不被替换。
5. 键盘焦点可见；导航当前项有文本/ARIA 语义；图标没有可见文字时有可访问名称；缩小左栏不删除可访问名称。

**完成条件：** 无横向滚动、无双导航、无被固定栏遮挡的关键操作，且默认布局/移动布局无视觉回归。

### T10：集成回归与交付

**目标：** 验证保存、加载、切换布局及业务操作的完整路径。

**执行：**

```powershell
cd frontend
npm run lint
npm run build

cd ..\backend
pytest
```

若仓库实际命令不同，以 `package.json`、测试配置和 CI 为准；不得为了通过验证而删除既有测试或放宽校验。

**手工验收路径：**

1. 新账号登录后为全景总览；“我的 - 主题与布局”可选择侧栏工作台。
2. 选择侧栏工作台但不确认，返回任意页面，壳层不变。
3. 确认后当前路由立即显示侧栏工作台；刷新、重新登录、切换项目后仍保持选择。
4. 桌面与移动端反复跨断点，始终只显示一个正确壳层。
5. 分别检查首页、流程、采购、记账、比价的关键业务操作与路由。
6. 旧记录含 `desktop-focus` 时，登录后正常回退全景总览；重新保存后不再产生旧 ID。
7. 网络失败或 PUT 失败时，已应用布局保持不变，设置草稿与错误提示仍在。

**交付输出：** AI 必须列出已改文件、运行过的命令及结果、未完成的手工验证项；若页面视觉细节未能由现有组件表达，列为待确认项，不得虚报完成。

---

## 3. 后续扩展边界

本期不实现全局搜索、组件自由拖拽、项目级布局或第三种桌面布局。后续新增布局应另建任务，并同步更新前端类型、后端白名单、设置页、旧值兼容策略、断点和回归测试；不应改变 `user_preferences` 的归属关系或污染项目同步数据。

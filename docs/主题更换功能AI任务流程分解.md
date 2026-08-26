# 主题更换功能 AI 编程任务流程分解

> 依据文档：[主题更换功能开发文档.md](主题更换功能开发文档.md)  
> 适用范围：主题色（预设 + 调色盘自选）、账号级持久化、桌面/移动布局选择与确认后生效。  
> 使用方式：按顺序将每个任务交给 AI 编程助手执行；每个任务完成、验证通过后再进入下一项。

---

## 0. 全局执行规则

### 0.1 不可违反的产品约束

- 主题偏好属于**登录账号**，不是装修项目；不得添加到 `AppState`、`store.ts`、项目同步接口或项目导出 JSON。
- 设置页内的任何选择都只修改草稿；只有点击“确定并应用”且 `PUT` 成功后，才可更新全站样式和内存主题状态。
- 自定义颜色只能通过调色盘（原生 `<input type="color">` 或等效可访问组件）选择，不提供手工颜色文本输入。
- 布局是页面呈现方案，允许不同布局具有不同组件集合、组件层级与信息优先级；不要假定布局只能交换网格位置。
- 组件级拖拽排序不是本功能的一部分。后续若实现，应在具体业务页面中设计，不能放到主题设置页。
- 默认主题必须与当前上线的珊瑚橙视觉一致；未登录、加载失败和登出后均回退默认主题。

### 0.2 AI 操作规范

1. 每个任务开始前先读取涉及文件，并检查 `git status --short`；保留用户已有的无关改动。
2. 不要顺带重构业务 store、同步逻辑、认证逻辑或无关页面。
3. 每个任务只完成当前目标；如发现前置接口/类型缺失，应停止并报告依赖，不要用 mock 绕过。
4. 完成代码后运行与该任务相符的最小验证；任务 10 执行完整构建与回归验证。
5. 不要将 token、数据库连接串、用户数据写入文档、测试快照或前端日志。

### 0.3 目标文件清单

| 层级 | 预计新增/修改 |
|---|---|
| 后端模型 | `backend/models.py`、`backend/schemas.py`、`backend/database.py`、`backend/main.py`、`backend/routers/user_preferences.py` |
| 后端测试 | `backend/tests/test_user_preferences.py` |
| 前端基础 | `frontend/src/data/theme.ts`、`frontend/src/api/userPreferences.ts`、`frontend/src/components/theme/ThemeProvider.tsx` |
| 前端页面 | `frontend/src/pages/ThemeSettingsPage.tsx`、`frontend/src/pages/AccountPage.tsx`、`frontend/src/App.tsx` |
| 布局与样式 | `frontend/src/pages/HomePage.tsx`、可选 `frontend/src/components/layouts/*`、`frontend/src/styles/design-tokens.css`、`frontend/src/styles/global.css`、`frontend/src/styles/components.css` |

---

## 1. 任务依赖图

```text
T1 现状核对与常量设计
 ├─ T2 后端模型与迁移
 ├─ T3 后端 Schema / API / 鉴权
 │   └─ T4 后端接口测试
 └─ T5 前端主题类型与 API
     └─ T6 ThemeProvider 与应用生命周期
         ├─ T7 CSS 变量语义化
         ├─ T8 设置页、路由与“我的”入口
         └─ T9 新桌面/移动布局注册与实现
             └─ T10 集成回归与验收
```

`T2` 与 `T5` 可并行；`T7`、`T8`、`T9` 必须在 `T6` 有可用主题上下文后开始。若由单个 AI 连续执行，严格按编号进行。

---

## 2. 任务卡

### T1：现状核对与主题注册表设计

**目标：** 在不改业务行为前提下，确认当前主题 token、硬编码颜色、首页组件结构与测试运行方式，并定义前后端共识常量。

**读取：**

- `frontend/src/styles/design-tokens.css`、`global.css`、`components.css`
- `frontend/src/pages/HomePage.tsx`、`frontend/src/components/layout/AppShell.tsx`
- `backend/models.py`、`backend/schemas.py`、`backend/auth.py`、`backend/database.py`

**产出：** 在代码中建立以下固定值（后端为权威，前端仅镜像）：

```text
预设色：coral / jade / ocean / violet / amber
桌面布局：desktop-default / desktop-sidebar-workbench
移动布局：mobile-default / mobile-compact
默认值：preset / coral / #E45B3F / desktop-default / mobile-default
```

**约束：** `desktop-sidebar-workbench` 与 `mobile-compact` 的具体组件内容需由布局实现任务决定；侧栏工作台遵循《侧栏工作台主题布局设计指导方案》，本任务不得伪造未确定的视觉设计。

**完成条件：** 已列出需替换的“主题主色硬编码”位置，且区分了不可替换的成功、警告、危险等语义状态色。

---

### T2：后端用户偏好模型与幂等迁移

**目标：** 建立账号级 `user_preferences` 表和 ORM 关系，保证新旧数据库都可安全启动。

**修改：** `backend/models.py`、`backend/database.py`。

**实现要求：**

- 新增 `UserPreference`：`user_id` 为 `users.id` 外键且主键；字段为 `color_mode`、`preset_color_id`、`primary_color`、`desktop_layout`、`mobile_layout`、`updated_at`。
- `User.preference` 是 `uselist=False` 的一对一关系，级联策略与现有 `User.projects` 风格一致。
- 在 `_migrate_integration` 中用 SQLAlchemy `checkfirst=True` 创建缺失表；重复启动不得报错，不修改已有用户或项目数据。
- 不为旧用户批量插入默认记录；读取接口返回内存默认值，首次保存才建行。

**禁止：** 不把字段添加到 `projects` 表；不在迁移中吞掉所有异常后继续运行，应只处理“已存在”等预期幂等情况并保留可诊断日志。

**验证：** 启动数据库初始化两次；确认表字段、主键和外键正确，原有测试可运行。

---

### T3：后端 Schema、偏好 API 与服务端校验

**目标：** 提供安全、完整、账号隔离的主题偏好读写 API。

**修改：** `backend/schemas.py`、新增 `backend/routers/user_preferences.py`、`backend/main.py`。

**接口契约：**

| 方法 | 地址 | 行为 |
|---|---|---|
| GET | `/api/user-preferences/theme` | 返回当前用户记录；没有记录时返回默认对象，不写库 |
| PUT | `/api/user-preferences/theme` | 完整覆盖当前用户的五项偏好；没有记录则创建 |

**实现要求：**

- 两个接口均依赖 `get_current_user`；请求体没有且不能接受 `user_id`。
- 使用 `Literal` 或等效枚举约束布局和预设 id；颜色仅接收 `#RRGGBB` 格式。
- Schema 校验规则：`preset` 模式必须带合法 `preset_color_id`，且 `primary_color` 必须等于服务端预设常量；`custom` 模式必须让 `preset_color_id` 为 `null`。
- GET 的默认响应要有 `updated_at`；可使用当前 UTC 时间，但不要因此落库。
- PUT 提交、刷新并返回持久化对象；同账号多次 PUT 不能创建重复行。

**验证：** 使用 FastAPI TestClient/现有测试方式验证成功 GET、首次 PUT、再次 PUT 与未认证 401。

---

### T4：后端接口测试

**目标：** 把账号隔离和输入校验固化为自动化回归用例。

**新增：** `backend/tests/test_user_preferences.py`；遵循现有测试的数据库 fixture 与认证构造方式。

**最少测试用例：**

1. 未登录 GET 和 PUT 均返回 401。
2. 新用户 GET 返回默认配置，查询数据库确认没有产生 `user_preferences` 行。
3. 首次 PUT 创建一行；再次 PUT 更新同一行。
4. 用户 A 与 B 各自保存配置后，GET 只能读到自己的配置。
5. 拒绝非法颜色、未知预设、未知桌面/移动布局、preset 色与服务端映射不一致、custom 模式携带 preset id。
6. 预设和自定义两种合法请求均能成功保存。

**完成条件：** 本测试文件与已有后端测试可同时通过；测试不依赖线上数据库。

---

### T5：前端主题领域类型与 API 封装

**目标：** 在前端建立与 API 对齐的强类型契约，且不污染项目数据 store。

**新增：** `frontend/src/data/theme.ts`、`frontend/src/api/userPreferences.ts`。

**`theme.ts` 最小职责：**

- 导出 `ThemeColorMode`、`DesktopLayoutId`、`MobileLayoutId`、`ThemePreference`；
- 导出预设颜色元数据与 `DEFAULT_THEME_PREFERENCE`；
- 提供 `normalizeHexColor()`、`isValidHexColor()`；调色盘值统一为大写 `#RRGGBB`；
- 提供由主色生成深色、浅色、focus ring、阴影色的纯函数；避免把固定 `rgba(228,91,63,...)` 拼回去。

**`userPreferences.ts` 最小职责：**

- 使用已有 `apiGet`、`apiPut` 实现 `fetchThemePreference()`、`updateThemePreference(input)`；
- 统一完成 API snake_case 与前端 camelCase 的映射；页面层不得处理字段命名转换；
- API 返回值必须经过颜色/枚举基础校验，损坏数据回退时交给 Provider 处理。

**禁止：** 不向 `data/store.ts` 加主题字段，也不使用项目 `/sync` 接口。

**验证：** `npm run build` 通过；类型推断能阻止传入未知布局 id。

---

### T6：ThemeProvider、认证生命周期与真正的全站应用

**目标：** 用户登录后加载主题，登出后复位，并以 CSS 变量与根数据属性将已保存偏好应用到全站。

**新增/修改：** `frontend/src/components/theme/ThemeProvider.tsx`、`frontend/src/App.tsx`；必要时对 `frontend/src/api/useAuth.ts` 增加最小的认证状态订阅能力。

**实现要求：**

- Provider 在 `BrowserRouter` 内包裹受保护页面；它以当前认证状态为唯一依据加载主题。
- 未登录：立刻 `resetThemeToDefault()`，不请求主题 API。
- 登录确认：调用 GET；成功时 `applyTheme()`，失败时保留默认主题、保存可展示错误但不阻塞页面。
- 登出、token 失效、账号切换：清除内存偏好并立即恢复默认 CSS 变量和 `data-*` 属性。
- `applyTheme()` 仅接收已经校验的完整 `ThemePreference`，写入 `document.documentElement.style` 的主题变量，并设置 `data-desktop-layout`、`data-mobile-layout`。
- Provider 只保存“已应用配置”；草稿必须由设置页本地 `useState` 管理。

**关键验证：**

- 默认值加载时页面外观不变；
- 模拟两个账号顺序登录，后者不会继承前者主题；
- GET 失败不导致页面崩溃；
- Provider 不触发循环 GET 或重复请求风暴。

---

### T7：CSS token 语义化与颜色回归

**目标：** 让切换主色真正覆盖主要交互视觉，同时不污染状态语义色。

**修改：** `design-tokens.css`、`global.css`、`components.css`，及 T1 识别出的必要页面内联样式。

**实现要求：**

- 新建 `--theme-primary`、`--theme-primary-deep`、`--theme-primary-soft`、`--theme-primary-ring`、`--theme-primary-shadow` 等变量；旧的 `--fresh-coral*` 映射到这些变量，确保默认值不变。
- 将所有“品牌主色”硬编码替换为 token，包括 hover、active、focus、浅色背景、渐变、阴影。
- 保留 `--fresh-green`、`--fresh-amber`、删除/错误红等语义色。不能将成功标签因主题变蓝/紫。
- 补齐当前代码里已在使用但未定义的 `--color-primary`、`--color-primary-light`、`--fresh-border`、`--fresh-surface` 兼容 alias，或统一替换为已有变量。
- 新增的颜色相关样式必须使用变量，不能再次写死珊瑚橙。

**验证：** 将浏览器根变量临时改为五种预设与任意调色盘颜色，检查按钮、链接、选中项、输入焦点、渐变和阴影均变色且文本对比度可接受。

---

### T8：主题设置页、路由和我的页面入口

**目标：** 完成用户可见的设置流程，并严格实现“确定后生效”。

**新增/修改：** `ThemeSettingsPage.tsx`、`App.tsx`、`AccountPage.tsx`、必要的图标/样式文件。

**页面状态：**

```text
已应用配置（Provider） → 进入页面时复制为草稿
草稿修改               → 仅更新本地 state
确定并应用             → PUT 成功 → Provider.applyTheme(服务端返回值)
取消                   → 丢弃草稿、返回 /account
恢复默认               → 只重置草稿，等待用户确认
```

**实现要求：**

- 在账号页“分类管理”入口之前增加“主题与布局”入口，跳转 `/theme-settings`。
- 在 `App.tsx` 的受保护路由内注册设置页；不加入桌面顶栏或移动底栏一级导航。
- 预设色展示为可访问的色块/单选项；自定义色使用调色盘；选中态依据 `colorMode` + `presetColorId`，不要仅比较色值。
- 桌面端只允许编辑桌面布局，移动端只允许编辑移动布局。提交必须基于“已应用完整配置 + 当前端草稿字段”合成完整对象，绝不能把另一端布局改回默认。
- 保存按钮的 loading 状态防止重复提交；保存失败保留草稿、显示错误、绝不调用 `applyTheme`。
- 增加小型预览可以展示草稿，但预览必须隔离在设置页局部容器中，不能修改全局 `:root`。

**验证：** 修改任意色/布局后不点击确认就离开页面，刷新或重进后均仍为原设置；确认后立即生效，且 GET 返回已保存值。

---

### T9：移除专注工作台、注册侧栏工作台与移动新布局

**目标：** 删除 `desktop-focus` 的类型、元数据、服务端白名单与首页组合组件；接入并交付 `desktop-sidebar-workbench`、`mobile-compact` 两种可用新布局；同时允许未来布局改变组件集合。

**修改/新增：** `HomePage.tsx`、相应布局组合组件（推荐 `frontend/src/components/layouts/`）及样式文件。

**推荐结构：**

```tsx
function HomePage() {
  const { preference } = useTheme();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const layoutId = isMobile ? preference.mobileLayout : preference.desktopLayout;
  return <AppShell currentPage="home">{renderHomeLayout(layoutId)}</AppShell>;
}
```

可将现有结构收为 `DefaultHomeLayout`；新布局使用 `DesktopFocusHomeLayout`、`MobileCompactHomeLayout`。布局组件可复用 `BudgetPanel`、`TodoPanel` 等业务组件与数据 Hook，但不强制复制默认 DOM 结构。

**实现要求：**

- 未识别布局 id 必须回退到相应端默认布局；
- `desktop-sidebar-workbench` 在 `>=768px` 呈现，`mobile-compact` 在 `<768px` 呈现；切换断点不应显示错误端布局；
- 每个布局中同一业务组件只渲染一次，避免双重请求、重复状态或重复操作入口；
- 若存在不同 DOM 顺序，使用不同布局组件保障键盘/读屏顺序，不依赖 CSS `order` 反转；
- 布局内允许隐藏/替换组件，但仍需根据该布局产品设计保证关键功能入口可达；
- 本期不要实现任意组件拖拽，也不要把布局结构序列化进用户偏好表。

**验证：** 四种组合（默认/新桌面 × 默认/新移动）均能正常加载；在 320、375、768、1024、1440px 无横向溢出，无底部导航遮挡，关键入口可达。

---

### T10：集成回归、构建与交付检查

**目标：** 以真实使用路径验证所有任务组合没有破坏现有项目。

**执行：**

```powershell
cd frontend
npm run lint
npm run build

cd ..\backend
pytest
```

若项目实际测试命令与此不同，以现有 `package.json`、`requirements.txt` 和 CI 配置为准；不得为了通过测试而删除已有测试或降低校验。

**手工验收路径：**

1. 新账号登录 → 默认主题；进入“我的”可找到设置入口。
2. 选择一个预设色 → 不确认 → 返回首页，主题不变。
3. 重进设置 → 调色盘选择任意颜色 → 确认，主题立即生效。
4. 刷新、重新登录同账号 → 自定义色和两个布局均保留。
5. 在桌面改桌面布局、在手机改移动布局 → 两端字段互不丢失。
6. 切换装修项目 → 主题不变；退出登录 → 恢复默认；另一账号登录 → 加载其独立配置。
7. 断网或让 PUT 返回失败 → 主题保持原值，草稿与错误提示仍在。
8. 检查默认主题、五种预设色与任意自定义色下的主要页面；成功/警告/危险状态色保持其语义。

**交付前输出：** AI 应报告已改文件、运行过的命令及结果、未覆盖的手工验证项；若布局视觉细节尚未给出，须明确列为待产品设计确认，不能自行宣称完成。

---

## 3. 后续布局扩展任务模板（不属于本期）

当需要增加“另一种布局”时，创建一个独立任务，不改 `user_preferences` 表。任务必须至少包含：

1. 确认目标端（桌面或移动）、布局 id、名称、适用页面、组件清单与关键入口；
2. 在后端合法布局常量、前端类型/注册表和设置页选项中同步增加该 id；
3. 新建或调整布局组合组件，明确 DOM/键盘顺序；
4. 为新布局添加断点、无障碍和溢出验证；
5. 回归现有布局，确认新 id 不影响原用户已保存的偏好；
6. 若后续需求是“用户自由拖拽组件”，改为为目标页面单独设计排序数据与交互，不复用主题设置页。

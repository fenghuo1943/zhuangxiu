# 装修技巧功能 AI 开发指导文档

> 项目：装修手记（FastAPI + React/Vite/TS）
> 文档用途：指导后续 AI 或开发者实现「装修技巧记录」新功能
> 需求沟通日期：2026-08-09

---

## 1. 目标

新增「装修技巧」功能：用户记录自己在别处学到的装修技巧（如「衣柜挂衣杆朝里挪 3~4cm」「厨房洗菜区和切菜区上方加灯带」），按房间（厨房、主卧、客厅等）筛选查看，用于自装或在和装修公司沟通确定方案时作为参考。

该功能是**个人知识库**，与现有的「流程资源知识文章」（`knowledge.py`，管理员维护的规范/避坑文章）相互独立，互不混用。

## 2. 需求确认结果（多轮沟通结论）

| 决策点 | 结论 |
|--------|------|
| 功能入口 | 独立新页面 `/tips`；桌面顶部导航加「技巧」项；移动端底部导航末项改为「更多」，弹层内收纳「流程」+「技巧」，后续可继续扩展 |
| 数据归属 | **用户级全局**：属于登录用户，跨项目通用，不挂在某个项目下 |
| 采纳状态 | 每条技巧带状态：**待确认 / 已采纳 / 不采纳**，配合沟通定方案流程 |
| 图片支持 | 支持可选传图（多图），复用现有上传接口 |
| 房间分类 | **预设 + 自定义**：预设常用房间作快速 chips，也允许自由输入房间名 |
| 筛选维度 | 房间 chips + **关键词搜索**（标题/内容）+ **按采纳状态** 筛选 |
| 来源字段 | **不单独建字段**，来源直接写进详情内容文本 |
| 预置示例 | 预置几条示例技巧数据（可删） |
| 详情查看 | 列表 + 弹窗（查看/编辑复用同一 Modal，与记账页弹窗交互一致） |

---

## 3. 数据模型（后端 `backend/models.py`）

新增 `Tip` 模型（SQLAlchemy，风格与现有模型一致）：

```python
class Tip(Base):
    """用户记录的装修技巧（个人知识库，用户级全局）。"""
    __tablename__ = "tips"
    __table_args__ = {"comment": "装修技巧表"}
    id = _pk()
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)                 # 一句话概括技巧
    room = Column(String(50), nullable=False, index=True)       # 房间：预设值或自定义名
    content = Column(Text, default="")                          # 详情文本（来源写在这里）
    status = Column(String(20), nullable=False, default="pending")  # pending/adopted/rejected
    images = Column(JSON, default=list)                         # 图片 URL 数组，如 ["/assets/flow-images/xx.jpg"]
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("User")
```

说明：
- `status` 取值：`pending`=待确认、`adopted`=已采纳、`rejected`=不采纳。
- `room` 用字符串而非外键，便于自由输入自定义房间；预设房间只是前端提示项。
- 表由 `init_db()` 里的 `Base.metadata.create_all` 自动创建，无需手工建表。
- 不需要改动 `Project`，技巧与项目无关。

---

## 4. 接口设计

### 4.1 Schemas（`backend/schemas.py` 追加）

```python
class TipCreate(BaseModel):
    title: str = Field(..., max_length=200)
    room: str = Field(..., max_length=50)
    content: str = Field("", max_length=20000)
    status: str = Field("pending", pattern="^(pending|adopted|rejected)$")
    images: list[str] = []

class TipUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    room: Optional[str] = Field(None, max_length=50)
    content: Optional[str] = Field(None, max_length=20000)
    status: Optional[str] = Field(None, pattern="^(pending|adopted|rejected)$")
    images: Optional[list[str]] = None

class TipOut(BaseModel):
    id: str
    user_id: str
    title: str
    room: str
    content: str
    status: str
    images: list[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
```

### 4.2 路由（新建 `backend/routers/tips.py`）

前缀 `/api/tips`，**所有接口 `Depends(get_current_user)`**（普通登录用户即可，非管理员），且校验 `tip.user_id == user.id`（参照 `todos.py` 的 `_verify_owner` 风格，这里是校验 tip 归属而非项目）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tips` | 当前用户的技巧列表；查询参数 `room`、`status`、`q`（标题/内容关键词，用 `LIKE`）；按 `created_at desc` 排序 |
| POST | `/api/tips` | 新增（返回 201） |
| PUT | `/api/tips/{tip_id}` | 更新 |
| DELETE | `/api/tips/{tip_id}` | 删除（返回 204） |

列表接口签名参考：

```python
@router.get("", response_model=list[TipOut])
async def list_tips(
    room: str | None = Query(None),
    status: str | None = Query(None, pattern="^(pending|adopted|rejected)$"),
    q: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    qs = select(Tip).where(Tip.user_id == user.id)
    if room:
        qs = qs.where(Tip.room == room)
    if status:
        qs = qs.where(Tip.status == status)
    if q:
        like = f"%{q.strip()}%"
        qs = qs.where(or_(Tip.title.like(like), Tip.content.like(like)))
    qs = qs.order_by(Tip.created_at.desc())
    result = await db.execute(qs)
    return result.scalars().all()
```

**图片清理逻辑**（PUT / DELETE 时）：`images` 是 URL 数组，参照 `knowledge.py` 里的 `_extract_image_filenames` / `_delete_image_files`，按「从数组中被移除且不再被任何 tip 引用」清理磁盘文件。**注意**：图片目录 `frontend/public/assets/flow-images/` 与知识文章共用，删除前需确认该文件名没有被任何 `knowledge_articles.content` 引用（可复用 `_get_all_used_filenames` 思路，额外扫一遍 tips.images 即可）。

### 4.3 上传接口权限调整（`backend/routers/upload.py`）

现有 `POST /api/upload/image` 用 `require_admin`，普通用户无法传图。改为 `get_current_user`，让登录用户能给技巧传图：

```python
user=Depends(get_current_user),  # 原来是 require_admin
```

说明：该改动只放开「上传图片文件」权限，知识文章仍为管理员维护（`knowledge.py` 未动），安全性可接受（个人自用工具）。

### 4.4 注册路由

- `backend/main.py`：`from .routers import ... tips ...`，`app.include_router(tips.router)`。
- `backend/database.py` 的 `init_db()`：在现有 seed 调用旁追加 `from .seed_tips import seed_tips` 并执行（见第 5 节）。

---

## 5. 种子数据（新建 `backend/seed_tips.py`）

幂等逻辑：
- 取第一个管理员用户（`is_admin == True`），若不存在则取第一个用户；若无用户则跳过。
- 若该用户已有技巧则跳过（幂等），否则插入示例技巧（状态多为 `pending`，便于用户体验筛选）。

示例数据（含用户给出的两个例子，其余为常见技巧）：

| 标题 | 房间 | 内容 | 状态 |
|------|------|------|------|
| 衣柜挂衣杆朝里挪 3~4cm | 主卧 | 挂衣杆离背板内移 3~4cm，衣服挂上后柜门更好关。来源：装修博主。 | pending |
| 厨房洗菜区和切菜区上方加灯带 | 厨房 | 吊柜底部加灯带，人站台前不会挡住顶灯，切菜更安全。 | pending |
| 玄关预留感应灯 | 玄关 | 入户预留感应灯插座，进门自动亮。 | pending |
| 卫生间镜柜后留插座 | 卫生间 | 镜柜内预留插座给电动牙刷、吹风机。 | pending |
| 沙发墙预留投影仪插座与网口 | 客厅 | 布水电时在沙发墙上方留好投影插座。 | pending |

---

## 6. 前端实现

### 6.1 类型（`frontend/src/data/types.ts` 追加）

```ts
export type TipStatus = 'pending' | 'adopted' | 'rejected';

export interface Tip {
  id: string;
  title: string;
  room: string;
  content: string;
  status: TipStatus;
  images: string[];
  createdAt: string;
  updatedAt?: string;
}
```

### 6.2 API 封装（新建 `frontend/src/api/tips.ts`）

复用 `apiGet/apiPost/apiPut/apiDelete`（参照 `api/todos` 或 `api/knowledge.ts`）：

```ts
export async function fetchTips(params?: { room?: string; status?: string; q?: string }): Promise<Tip[]>
export async function createTip(data: Omit<Tip, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tip>
export async function updateTip(id: string, data: Partial<Omit<Tip, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Tip>
export async function deleteTip(id: string): Promise<void>
export async function uploadTipImage(file: File): Promise<{ url: string; filename: string }>
```

- `fetchTips` 用 `URLSearchParams` 组装 `room/status/q`，`q` 为关键词。
- `uploadTipImage` 复用现有 `POST /api/upload/image`（form-data，带 Authorization）。

### 6.3 房间预设常量（新建 `frontend/src/data/tipsPresets.ts` 或放页面内）

```ts
export const ROOM_PRESETS = ['厨房', '主卧', '次卧', '客厅', '卫生间', '书房', '儿童房', '阳台', '玄关', '其他'];
export const TIP_STATUS_META: Record<TipStatus, { label: string; color: 'coral' | 'green' | 'gray' }> = {
  pending:  { label: '待确认', color: 'coral' },
  adopted:  { label: '已采纳', color: 'green' },
  rejected: { label: '不采纳', color: 'gray' },
};
```

「自定义房间」由当前数据推导：取 `tips` 中出现且不在 `ROOM_PRESETS` 里的房间名，作为额外 chips 追加在预设 chips 之后。

### 6.4 页面（新建 `frontend/src/pages/TipsPage.tsx`）

结构（`AppShell currentPage="tips"`）：

1. **顶部工具栏**
   - 左侧「新增技巧」按钮（主按钮样式）
   - 搜索框（关键词 `q`，输入防抖或回车触发）
   - 房间 chips：`全部` + 预设 + 自定义（点击筛选/取消，高亮当前）
   - 状态筛选：`全部 / 待确认 / 已采纳 / 不采纳`（可用 select 或小按钮组）
2. **技巧列表**（卡片式）
   - 每条卡片：标题、房间 tag、状态 tag、首图缩略图（若有）、内容摘要（截断）、创建时间
   - 点击卡片 → 打开详情/编辑弹窗
   - 空状态：无技巧时显示引导文案（「还没有技巧，点右上角新增」）
3. **详情/编辑弹窗**（复用记账页 Modal 交互风格）
   - 标题输入框（必填）
   - 房间：输入框（带 `datalist` 预设提示）+ 常见房间快捷 chips，可自由输入
   - 内容：多行 textarea（提示「来源写在这里，如：小红书、装修公司、邻居…」）
   - 状态：select（待确认/已采纳/不采纳）
   - 图片：上传按钮 + 缩略图预览网格，每张可删除（新增态与编辑态共用）
   - 底部：保存 / 删除（红色，二次确认）
4. **数据加载方式**：页面内 `useState + useEffect` 直接调用 `api/tips`，**不接入中央 store**（`store.ts` 已很大，技巧功能自洽独立，参照 ToolsPage/FlowPage 弹窗的本地状态模式）。未登录时参照现有页面提示跳转登录。

### 6.5 导航与路由改动

- `frontend/src/App.tsx`：新增 `<Route path="/tips" element={<TipsPage />} />`
- `frontend/src/components/layout/DesktopHeader.tsx`：`navItems` 追加
  `{ id: 'tips', label: '技巧', href: '/tips', icon: <IconBook size={16} /> }`（`IconBook` 已在 `components/common/Icons` 中导出）
- `frontend/src/components/layout/MobileBottomNav.tsx`：**改造为「首页 / 采购 / 比价 / 记账 / 更多」5 项**，末项「更多」点击弹出菜单，把原「流程」和新「技巧」收进弹层；`moreItems` 用数组结构，后续新增入口只需追加数组即可扩展：

  ```tsx
  const navItems = [
    { id: 'home', label: '首页', href: '/', icon: IconHome },
    { id: 'purchase', label: '采购', href: '/purchase', icon: IconShopping },
    { id: 'compare', label: '比价', href: '/compare', icon: IconCompare },
    { id: 'expense', label: '记账', href: '/expense', icon: IconExpense },
    { id: 'more', label: '更多', href: '#more', icon: IconMenu },  // IconMenu 已存在
  ];

  // 更多弹层菜单项 —— 后续新增入口只需往此数组追加
  const moreItems = [
    { id: 'flow', label: '流程', href: '/flow', icon: IconFlow },
    { id: 'tips', label: '装修技巧', href: '/tips', icon: IconBook },
  ];
  ```

  组件逻辑：
  - `const [moreOpen, setMoreOpen] = useState(false)`；点击「更多」`preventDefault()` 并 `toggle`
  - `const moreActive = moreItems.some(i => i.id === currentPage)`；为 `true` 时「更多」项加 `active` 类（保证在流程/技巧页时「更多」高亮）
  - `moreOpen` 时渲染 `.more-overlay`（全屏半透明遮罩，点击关闭）+ `.more-sheet`（菜单面板，`stopPropagation`，点击某项跳转并关闭）
- （可选，推荐）`frontend/src/components/dashboard/QuickEntries.tsx` 的 `entries` 追加一条「装修技巧」入口，便于首页直达。

### 6.6 样式（`frontend/src/styles/components.css` 追加）

遵循现有暖色系、柔和圆角、卡片风格与 design-tokens：
- `.tips-toolbar`：工具栏布局
- `.tips-chips` / `.chip.active`：房间 chips，激活态主题色高亮
- `.tip-card`：列表卡片（悬停阴影、点击态）
- `.tip-status-tag.{coral|green|gray}`：状态 tag（待确认橙 / 已采纳绿 / 不采纳灰）
- `.tip-images-grid`：弹窗内图片缩略图网格（正方形裁剪、删除角标）
- `.more-overlay`：全屏半透明遮罩（z-index 高于导航）
- `.more-sheet`：底部导航上方弹出的菜单面板（白底、圆角、阴影），菜单项为图标 + 文字列表，当前页高亮；若菜单项超一屏允许内部滚动
- 移动端适配：底部导航保持 5 项无需收窄；房间 chips 横向可滚动。

---

## 7. 文件改动清单

**后端**
- `backend/models.py` — 新增 `Tip` 模型
- `backend/schemas.py` — 新增 `TipCreate / TipUpdate / TipOut`
- `backend/routers/tips.py` — **新建**：CRUD 路由
- `backend/seed_tips.py` — **新建**：示例技巧种子
- `backend/routers/upload.py` — `require_admin` → `get_current_user`
- `backend/main.py` — 注册 `tips.router`
- `backend/database.py` — `init_db()` 内追加 `seed_tips` 调用

**前端**
- `frontend/src/data/types.ts` — 新增 `Tip` / `TipStatus`
- `frontend/src/api/tips.ts` — **新建**：API 封装
- `frontend/src/data/tipsPresets.ts` — **新建**：房间预设、状态元信息
- `frontend/src/pages/TipsPage.tsx` — **新建**：主页面 + 详情/编辑弹窗
- `frontend/src/App.tsx` — 新增 `/tips` 路由
- `frontend/src/components/layout/DesktopHeader.tsx` — 导航加「技巧」
- `frontend/src/components/layout/MobileBottomNav.tsx` — 改造：末项改「更多」，把「流程」收进弹层并新增「技巧」（`moreItems` 数组可扩展）
- `frontend/src/components/dashboard/QuickEntries.tsx` —（可选）首页入口卡片
- `frontend/src/styles/components.css` — 新增 `.tips-*` 样式与移动端适配

---

## 8. 验收要求

1. 登录用户可新增/编辑/删除技巧（标题、房间、内容、状态、多图），数据只对本人可见；未登录访问 `/tips` 有引导。
2. 房间 chips（全部 + 预设 + 自定义房间）筛选正确；关键词搜索标题/内容生效；状态筛选生效；三者可组合。
3. 上传图片成功、弹窗内缩略图可预览可删除；保存后删除已移除图片的磁盘文件（不影响其它技巧与知识文章引用的图片）。
4. 桌面顶部导航出现「技巧」；移动端底部导航为「首页/采购/比价/记账/更多」，点击「更多」弹出菜单含「流程」「装修技巧」，在流程/技巧页时「更多」高亮，点击菜单项跳转并关闭弹层。
5. 首次启动后，首个管理员/用户能看到预置的示例技巧，可正常删除。
6. 前后端构建通过（`tsc` / `vite build` 无报错，后端启动无异常）。

---

## 9. 实现备注与注意事项

- **移动端「更多」弹层**：`moreItems` 是数组结构，后续新入口（如「工具」）直接往数组追加即可，无需改动底部导航主体；弹层内菜单项超一屏时允许滚动，点击遮罩即关闭。
- **图片清理跨表**：图片目录与知识文章共用，删除逻辑务必先确认文件未被 `knowledge_articles` 引用（可复用 knowledge.py 的工具函数）。
- **关键词搜索**：SQLite 下用 `LIKE` 即可，无需全文索引（数据量小）。
- **状态语义**：`pending` 待确认 → 沟通现场改 `adopted`/`rejected`，配合「筛选已采纳」可直接作为给装修公司的方案清单参考。
- **不进 AppStateSync**：技巧是用户级、与项目无关，不需要加入 `sync.py` 的全量同步结构，独立在 api 层存取即可。
- **room 归一化**：自定义输入时建议 `trim`，且首字母大写/全角半角尽量统一，避免同一房间出现「主卧」和「 主卧」两个 chip。

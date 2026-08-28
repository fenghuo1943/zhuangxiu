# API 重复请求修复文档

## 一、问题描述

访问首页或切换页面时，网络面板出现大量重复的 `/api/...` 请求，主要表现为：

- 认证相关请求重复（`/api/auth/me`）
- 同步数据请求重复（预算、支出、采购、流程进度等）
- 主题配置请求重复（`/api/user-preferences/theme`）

**影响范围：**
- 增加服务器压力和网络带宽消耗
- 前端性能下降（多次渲染、状态竞争）
- 用户体验变差（加载延迟、数据不一致）

---

## 二、根因分析

### 2.1 React StrictMode 双挂载

`src/main.tsx` 使用了 `React.StrictMode`：

```tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

在开发模式下，StrictMode 会**故意双挂载组件**以检测副作用问题，导致：
- `useAuth` 的 `useEffect` 执行两次
- `ThemeProvider` 的 `useEffect` 执行两次
- 每个组件的初始化逻辑被重复触发

### 2.2 多模块独立触发全局初始化

应用架构中存在多个独立的初始化路径：

```
main.tsx → App.tsx → ThemeProvider → useAuth → getMe() + syncFromServerAfterLogin()
                                          ↓
                                       store.ts (syncFromServerAfterLogin)
                                          ↓
                                       所有 API 模块 (budget, expenses, flow, purchase, etc.)
```

**问题点：**
- `useAuth` 在 mount 时调用 `getMe()` 和 `syncFromServerAfterLogin()`
- `syncFromServerAfterLogin()` 包含**8+ 个串行子 API 调用**
- `ThemeProvider` 在认证就绪后触发 `fetchThemePreference()`
- 多个组件可能同时监听认证状态并触发各自的初始化逻辑

### 2.3 缺乏请求级去重机制

当前 API 客户端（`src/api/client.ts`）**没有实现通用的请求去重**：
- 每次调用 `apiGet()` 都会发起新的 HTTP 请求
- 没有请求缓存（如 `Map<string, Promise>` 模式）
- 没有 AbortController 取消未完成的请求
- 没有基于请求签名的幂等保护

---

## 三、已实施的修复（步骤 1-3）

### 3.1 认证初始化去重

**文件：** `src/api/useAuth.ts`

**修复方案：** 使用模块级 Promise 守卫

```typescript
// 模块级变量，防止 StrictMode 双挂载导致重复初始化
let authInitPromise: Promise<void> | null = null;

// 在 useEffect 中
useEffect(() => {
  if (globalAuthState.loading && !authInitPromise) {
    authInitPromise = (async () => {
      try {
        if (isAuthenticated()) {
          maybeRotate();
          await getMe();
          await syncFromServerAfterLogin();
        } else {
          setAuthState({ ...globalAuthState, loading: false });
        }
      } catch (error) {
        clearTokens();
        setAuthState({
          user: null,
          isLoggedIn: false,
          loading: false,
          error: null,
        });
      } finally {
        authInitPromise = null;
      }
    })();
  }
}, []);
```

**效果：**
- StrictMode 双挂载时，只有第一次会执行初始化
- 第二次挂载发现 `authInitPromise` 已存在，跳过执行
- 初始化完成后 Promise 被清理，允许后续重新触发

---

### 3.2 Store 同步流程去重

**文件：** `src/data/store.ts`

**修复方案：** 模块级 Promise 守卫 + 复用机制

```typescript
// 模块级变量，防止并发调用 syncFromServerAfterLogin
let syncInitPromise: Promise<void> | null = null;

export async function syncFromServerAfterLogin(): Promise<void> {
  // 如果已有同步在进行中，直接返回该 Promise
  if (syncInitPromise) {
    return syncInitPromise;
  }

  syncInitPromise = (async () => {
    try {
      const { assertLoggedIn } = await import('./useAuth');
      assertLoggedIn();

      // 串行加载各类数据...
      const { fetchProjects } = await import('../api/project');
      const projects = await fetchProjects();
      // ... 更多数据加载
    } catch (error) {
      console.error('从服务器同步数据失败:', error);
    } finally {
      syncInitPromise = null;
    }
  })();

  return syncInitPromise;
}
```

**效果：**
- 多个调用点同时触发时，只有第一个会执行实际同步
- 后续调用复用同一个 Promise，等待相同结果
- 同步完成后 Promise 被清理

---

### 3.3 主题请求去重

**文件：** `src/components/theme/ThemeProvider.tsx`

**修复方案：** 模块级 Promise 守卫

```typescript
// 模块级变量，防止重复获取主题配置
let themeFetchPromise: Promise<ThemePreference> | null = null;

const refreshTheme = useCallback(async () => {
  if (!authState.isLoggedIn) {
    resetThemeToDefault();
    return;
  }

  try {
    // 如果已有请求在进行中，直接返回该 Promise
    if (themeFetchPromise) {
      return await themeFetchPromise;
    }

    themeFetchPromise = fetchThemePreference();
    const pref = await themeFetchPromise;
    applyThemeToDOM(pref);
    setPreference(pref);
    localStorage.setItem('theme_preference', JSON.stringify(pref));
  } catch (err) {
    console.error('Failed to load theme preference:', err);
    setError(err instanceof Error ? err.message : '加载主题配置失败');
  } finally {
    themeFetchPromise = null;
  }
}, [authState.isLoggedIn, applyThemeToDOM, resetThemeToDefault]);
```

**效果：**
- ThemeProvider 双挂载时，只有第一次会发起请求
- 第二次挂载复用第一次的 Promise
- 请求完成后 Promise 被清理

---

## 四、待实施的修复（步骤 4）

### 4.1 通用请求去重缓存

**文件：** `src/api/client.ts`

**目标：** 为所有 GET 请求实现请求级去重缓存

**实现方案：**

```typescript
// 请求缓存：key = `${method}:${path}:${queryString}`
const requestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();

// 缓存 TTL（毫秒）- 5秒内相同请求复用
const CACHE_TTL = 5000;

// 生成请求缓存 key
function getCacheKey(method: string, path: string, params?: Record<string, any>): string {
  const queryString = params
    ? '?' + new URLSearchParams(params as Record<string, string>).toString()
    : '';
  return `${method}:${path}:${queryString}`;
}

// 检查缓存是否有效
function isCacheValid(entry: { timestamp: number }): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

// 清理过期缓存
function cleanupCache(): void {
  for (const [key, entry] of requestCache.entries()) {
    if (!isCacheValid(entry)) {
      requestCache.delete(key);
    }
  }
}

// 修改 apiGet 函数
export async function apiGet<T>(path: string, params?: Record<string, any>): Promise<T> {
  // 仅对 GET 请求启用缓存
  const cacheKey = getCacheKey('GET', path, params);

  // 检查缓存
  const cached = requestCache.get(cacheKey);
  if (cached && isCacheValid(cached)) {
    return cached.promise;
  }

  // 发起新请求并缓存
  const promise = request<T>('GET', path, { params });
  requestCache.set(cacheKey, { promise, timestamp: Date.now() });

  // 请求完成后从缓存中移除（失败时也移除）
  promise.finally(() => {
    requestCache.delete(cacheKey);
  });

  // 定期清理过期缓存
  cleanupCache();

  return promise;
}
```

**注意事项：**
- 仅对 GET 请求启用缓存（POST/PUT/DELETE 通常有副作用，不应缓存）
- 设置合理的 TTL（5秒是经验值，可根据业务调整）
- 请求失败时立即清除缓存，允许重试
- 对于需要实时性的请求（如轮询），应跳过缓存或使用更短的 TTL

---

### 4.2 请求取消机制

**目标：** 为组件 effect 中的数据请求实现取消机制

**实现方案：**

```typescript
// 在 client.ts 中添加 AbortController 支持
export async function apiGetWithAbort<T>(
  path: string,
  params?: Record<string, any>,
  signal?: AbortSignal
): Promise<T> {
  return request<T>('GET', path, { params, signal });
}

// 在组件中使用
useEffect(() => {
  const controller = new AbortController();

  const fetchData = async () => {
    try {
      const data = await apiGetWithAbort('/api/budget', { projectId }, controller.signal);
      setBudget(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to fetch budget:', err);
      }
    }
  };

  fetchData();

  // 清理函数：取消未完成的请求
  return () => controller.abort();
}, [projectId]);
```

---

### 4.3 按需加载优化

**目标：** 减少 `syncFromServerAfterLogin()` 中的串行请求

**当前问题：**
```typescript
// 当前实现：串行加载 8+ 个 API
const projects = await fetchProjects();
const budget = await fetchBudget(activeProjectId);
const expenses = await fetchExpenses(activeProjectId);
const flowProgress = await fetchFlowProgress(activeProjectId);
// ... 更多串行请求
```

**优化方案：**

```typescript
// 方案1：并行加载无依赖的数据
export async function syncFromServerAfterLogin(): Promise<void> {
  const { assertLoggedIn } = await import('./useAuth');
  assertLoggedIn();

  // 第一步：加载关键数据（项目列表、当前项目 ID）
  const { fetchProjects } = await import('../api/project');
  const projects = await fetchProjects();
  updateState({ projects });

  const activeProjectId = getActiveProjectId();
  if (!activeProjectId) return;

  // 第二步：并行加载所有模块数据
  const [
    budget,
    expenses,
    flowProgress,
    purchaseRefs,
    selectedPurchases,
    purchasedItems,
    compareItemIds,
    subcategories
  ] = await Promise.all([
    fetchBudget(activeProjectId),
    fetchExpenses(activeProjectId),
    fetchFlowProgress(activeProjectId),
    fetchPurchaseRefs(),
    fetchSelectedPurchases(activeProjectId),
    fetchPurchasedItems(activeProjectId),
    fetchCompareItemIds(activeProjectId),
    fetchSubcategories()
  ]);

  // 第三步：更新状态
  updateState({
    budget,
    expenses,
    flowProgress,
    purchaseRefs,
    selectedPurchases,
    purchasedItems,
    compareItemIds,
    subcategories
  });
}
```

**效果：**
- 将串行请求改为并行，总耗时从 8T 降为 T（T 为最慢请求耗时）
- 显著减少页面加载时间

---

## 五、最佳实践指南

### 5.1 新增 API 请求时的检查清单

在添加新的 API 请求时，请确认：

- [ ] **是否需要请求去重？**
  - 如果是 GET 请求且可能被多次调用，考虑使用缓存
  - 如果是用户操作触发的请求，通常不需要缓存

- [ ] **是否需要请求取消？**
  - 如果在组件 `useEffect` 中发起请求，必须实现取消机制
  - 使用 AbortController 在 cleanup 函数中取消请求

- [ ] **是否需要错误重试？**
  - 对于网络错误，考虑实现指数退避重试
  - 对于 4xx 错误，通常不应重试

- [ ] **是否需要乐观更新？**
  - 对于用户操作（如添加、删除），先更新本地状态
  - 异步同步到服务器，失败时回滚

### 5.2 新增组件时的检查清单

在创建新组件时，请确认：

- [ ] **是否正确设置 useEffect 依赖数组？**
  - 依赖数组必须包含所有外部变量
  - 避免使用空数组 `[]` 但内部引用了变化的 props/state

- [ ] **是否需要防抖/节流？**
  - 对于频繁触发的事件（如搜索输入），使用防抖
  - 对于滚动/resize 事件，使用节流

- [ ] **是否正确处理组件卸载？**
  - 在 useEffect cleanup 中取消未完成的请求
  - 在 cleanup 中清除定时器
  - 在 cleanup 中取消事件监听

### 5.3 Store 更新时的检查清单

在修改 `src/data/store.ts` 时，请确认：

- [ ] **是否调用了 `assertLoggedIn()`？**
  - 所有需要认证的操作必须在开头调用此函数

- [ ] **是否实现了乐观更新？**
  - 先更新本地状态
  - 异步同步到服务器
  - 失败时静默处理（或回滚）

- [ ] **是否使用了动态 `import()`？**
  - 为避免循环依赖，API 模块应使用 `import('../api/xxx')` 动态导入

---

## 六、验证方法

### 6.1 验证重复请求已修复

1. 打开浏览器开发者工具 → Network 面板
2. 刷新页面（Ctrl+F5 强制刷新）
3. 观察请求数量：
   - 修复前：每个 API 会发起 2-4 次请求
   - 修复后：每个 API 只发起 1 次请求

### 6.2 验证功能正常

1. 登录后检查所有数据是否正确加载
2. 切换项目，验证数据刷新正常
3. 执行增删改操作，验证同步正常
4. 退出登录，验证状态清理正常

### 6.3 验证性能提升

1. 使用 Chrome DevTools → Performance 面板
2. 录制页面加载过程
3. 对比修复前后的：
   - 首屏加载时间
   - 总请求时间
   - JavaScript 执行时间

---

## 七、相关文件清单

| 文件 | 作用 | 修复状态 |
|------|------|----------|
| `src/main.tsx` | 应用入口，启用 StrictMode | 无需修改（StrictMode 用于开发检测） |
| `src/api/useAuth.ts` | 认证 Hook，初始化去重 | ✅ 已完成 |
| `src/data/store.ts` | 全局状态 Store，同步去重 | ✅ 已完成 |
| `src/components/theme/ThemeProvider.tsx` | 主题 Provider，请求去重 | ✅ 已完成 |
| `src/api/client.ts` | HTTP 客户端，通用缓存 | ⏳ 待实施 |

---

## 八、参考资源

- [React StrictMode 文档](https://react.dev/reference/react/StrictMode)
- [AbortController MDN 文档](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [TanStack Query（推荐的替代方案）](https://tanstack.com/query/latest)

---

## 九、后续优化建议

1. **引入 TanStack Query（React Query）**
   - 自动处理请求去重、缓存、重试、后台刷新
   - 替换当前的自定义 Store 和 API 客户端
   - 显著简化代码并提升性能

2. **实现 API 响应缓存层**
   - 使用 Service Worker 缓存 GET 请求响应
   - 支持离线访问和更快的页面加载

3. **添加请求监控和分析**
   - 记录每个 API 的请求次数、耗时、错误率
   - 识别性能瓶颈和异常模式

---

**文档版本：** v1.0
**最后更新：** 2026-08-28
**维护人：** 开发团队

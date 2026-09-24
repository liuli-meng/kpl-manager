# kpl-manager 修订版路线（按代码现状校准）

> 原则：**增量、不重写、保存档、先契约后分层**。  
> 基线：`npm run test:fast` 全绿。模块契约：`docs/MODULE_GRAPH.md`。  
> 网页看板：`../index.html`（可勾选进度，本机 localStorage）。

## Issue 进度

| # | 项 | 状态 |
|---|---|---|
| ① | 模块依赖图 + 循环依赖 | ✅ `docs/MODULE_GRAPH.md` 已标已知环 |
| ② | issue 清单压进仓库 | ✅ 本文件 + `../index.html` |
| ③ | 迁移样本 + sanitizeImport | ✅ `tests/verify-migrate.js` / `verify-statestore.js` |
| ④ | Phase1：stateStore 入口 / permission / save 防抖 / mid 红线 | ⬜ |
| ⑤ | Phase2：phase 守卫 / nextDay / 转会拆分 / aiCoach 等价 | ⬜ |
| ⑥ | Phase3：modal 栈 / 模板 / 事件委托 | ⬜ |
| ⑦ | `window._nego` 去 `s` 引用 | ✅ `negoState()` + `verify-nego` 断言 |

---

## 总评

原则 / 避坑 / 分阶段**完全正确**。要改的是三处**事实判断**与**优先级**。

---

## 一、状态层：最大的坑被低估了

### 判断偏差 1：「UI 临时态混在 S」——基本不成立

| 临时态 | 实际位置 |
|---|---|
| 谈判 / 卖人 | `window._nego` / `window._sellNego` |
| BP 草稿 | `window._draft` |
| 赛前换位 | `window._prepPos` / `window._prepTitle` |
| 日志筛选 / 联盟 Tab | `window._logFilter` / `window._unionTab` |

- `s.draft` 是**选秀业务进度**（跨日），本就该进存档。
- `s.pick` 是 BP 残留，开赛会清空。

→ 「剥离 UI 临时态」工作量与收益都≈0。真正该做：**别把 `s` 引用塞进 `window._nego={s,...}`**，用时 `getState()`。

### 判断偏差 2：`patchState` 禁裸写——全案最大风险

现实是几十上百个 `f(s)` **接收参数就地 mutate**，不是只写全局 `S`。

若严格「禁止 `s.xxx=`」：
- 要么打爆所有 `f(s)`（违反最小改动）
- 要么 `patchState` 形同虚设

**可行落法**：
1. 只包**全局入口**（`load/newState/save/导出导入`），`S` 仍可变
2. `patchState` 作**可选**写路径；旧代码继续 `s.x=`
3. 开发态**薄探针**只记变更日志/脏标记，**不拦截写入**
4. 核心链路（`nextDay` / `finishSeries` / `advancePhase`）迁完后再考虑热路径强制

否则 Phase1 会变成第二个 rewrite。

### 判断偏差 3：脏标记 + 局部渲染——粒度错了

`renderAll()` 现状：刷顶栏 + **只渲染当前页**，不是 8 页全刷。  
脏标记对着整页 HTML 拼接帮助有限，要先有组件级模板边界（Phase3）。

→ Phase1 只做 `save()` 防抖/合并 + 保留全量 `renderAll` 开关；脏渲染挪到 Phase3 之后。

### 其余

- 「派生数据重复存储」自相矛盾；现状是**现场算、少缓存**。别为优化乱加缓存字段。`rebuildMatchStore` 不动是对的。
- 存档 schema、迁移用例、tab 冲突：抬进 Phase0/1。

---

## 二、业务引擎层

| 项 | 判定 |
|---|---|
| `singleGame` 纯函数化 | **已完成**（纯函数、不写 S）；可补单测 |
| `permission.js` 集中 mode | **该做**。`canBuy` 等→permission；文案→留 UI |
| phase 枚举 + 守卫 | **该做**（season / cups / state 散落） |
| AI / 玩家转会入口分离 | **该做**，共享 `negoCapCheck` |
| Command 包装 | **值得**，目的=可测+可灰度；**不要为撤销设计** |

**应加重**：
- `mid` / `rebuildMatchStore` / 续赛是**最脆红线**，必跑 `verify-series-resume`
- `nextDay` 分层覆盖「结算弹窗未点就存档」（`queueMatchAdvance`）

---

## 三、UI 层

| 项 | 判定 |
|---|---|
| 模板抽离 + 公共卡片纯函数 | **对** |
| 事件委托 + data-action 渐进 | **对** |
| 统一 modal 栈 | **对** |
| 长列表虚拟切片 | **伪需求**（名单个位数～十余）→ 先分页/实测 |
| 静态文案预编译 | 可降级 |

注意：`perf-monitor.js` / `bgm-panel.js` 已 monkey-patch `renderAll`/`openSaveMgmt`，改入口时一并收拾。

---

## 四、分阶段（修订）

| 阶段 | 保留 | 调整 |
|---|---|---|
| **0** | 冻静态表、JSDoc、修文档、gameLog | **+ 迁移样本 + sanitizeImport schema** |
| **1** | stateStore 薄适配、permission、变更探针 | **去** UI 临时态剥离、脏标记局部渲染；**+ mid/续打红线 + 错误自动存快照** |
| **2** | Command、phase 守卫、AI/玩家转会拆分、nextDay 分层 | **去** singleGame 纯化；**+ aiCoach 行为等价测试** |
| **3** | 模板拆分、事件委托、modal 栈 | 虚拟列表**降为可选** |
| **4** | UT、调试面板 | 错误快照已在 Phase1 |

---

## 五、一句话结论

1. 原则 / 避坑 / 分阶段：**对**
2. 状态门面若「禁止裸写 S」→ **会重演 rewrite**；先探针、后渐进
3. 应删/降：UI 临时态剥离、singleGame 纯化、长列表虚拟化
4. 应抬权：**存档迁移测试、mid 续打红线、错误自动存快照**

---

## 六、下一步 issue（按修订顺序）

```text
① 模块依赖图 + 标出循环依赖（docs/MODULE_GRAPH.md 完善）
② issue 任务清单压进仓库（本文件）
③ Phase0 收尾：迁移样本测试 + sanitizeImport schema
④ Phase1：stateStore 入口包装 + permission 收口 + save 防抖 + mid 红线
⑤ Phase2：phase 守卫 / nextDay 分层 / 转会入口分离 / aiCoach 等价测试
⑥ Phase3：modal 栈 → 公共模板 → 拆 ui-*.js → 事件委托灰度
⑦ window._nego 改 getState()（随时可插队，断链 bug）
```

伪代码等 Phase1 门面形态定了再写，避免按错误假设写一版。

---

## 红线

- ❌ 禁止「禁裸写 S」的强制门面（先探针）
- ❌ Vue/React、core/engine/ui 搬家、事件总线
- ❌ 动 mid 续赛不跑 `verify-series-resume`
- ❌ freeze `PLAYER_POOL` 等 installEra 可变池
- ❌ 为撤销而设计 Command
- ❌ 未测量就上虚拟列表

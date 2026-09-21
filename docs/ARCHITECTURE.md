# KPL 电竞经理 - 架构设计文档

**版本**: 3.0  
**最后更新**: 2026-09-20  
**作者**: Qoder AI Assistant  

---

## 🎯 核心原则

### 1. 单文件友好
- **零构建工具依赖**: `npm install` → `npm run build` → 双击 `game.html` 即可玩
- **渐进增强**: 即使禁用 JavaScript，HTML/CSS 仍提供基础可读性
- **离线第一**: 所有资源内置或程序化生成，无需网络请求

### 2. 测试驱动
- **全量门禁保障**: 64+ 项测试覆盖核心功能、边界情况、回归测试
- **CI 自动化**: GitHub Actions 每周自动运行性能/兼容性检查
- **零容忍**: 任何门禁失败阻止 PR 合并到 main 分支

### 3. 模块化隔离

```javascript
// 清晰职责划分
data.js   → 常量池、配置表、时代定义 (静态数据)
state.js  → 存档状态机、迁移逻辑 (动态数据)
players.js→ 选手生成器、属性计算 (数据工厂)
transfer.js → 转会市场引擎、AI 定价 (业务逻辑)
match.js  → 比赛模拟、BP 流程 (核心玩法)
ui.js     → 页面路由、全局工具 (交互框架)
render-*.js → 各页面渲染逻辑 (视图层)
main.js   → 应用入口、事件绑定 (控制层)
```

---

## 📁 模块职责详解

### Core 层 (`src/js/core/`)

#### data.js - 静态数据定义
```javascript
const PLAYER_POOL = [...];    // 选手池
const CLUB_TEMPLATES = [...]; // 俱乐部模板
const SPONSORS = [...];       // 赞助商列表
const KPL = {...};            // KPL 联盟规则
```

**特点**: 
- 只在初始化时加载一次
- 不包含运行时可变状态
- 可被多模块共享引用

#### state.js - 状态管理
```javascript
const SAVE_DEFAULTS = {...};  // 默认存档字段
const DEFAULT_STATE = {...};  // 初始状态结构

function newState(teamName, teamIcon) {...}
function fillRoster(s, difficulty, star) {...}
function migrateSave(s, fromVersion) {...}
```

**职责**:
- 创建新存档实例
- 实现旧档迁移链
- 维护状态不变量

#### players.js - 球员工厂
```javascript
function genPlayer(def) {...}          // 根据定义生成球员
function playerPower(p) {...}          // 计算战力值
function fmt(power) {...}              // 格式化显示
```

**设计原则**: 纯函数，无副作用，易于单元测试

---

### Engine 层 (`src/js/engine/`)

#### transfer.js - 转会市场引擎
```javascript
function buildTransferMarket(s) {...}  // 初始化市场货架
function buyPlayer(s, id) {...}        // 购买玩家逻辑
function openNegotiation(s, id) {...}  // 开启谈判窗口
```

**关键算法**:
- AI 定价模型 (基于战力、年龄、人气)
- 预算约束下的贪心策略
- 需求预测与供需平衡

#### match.js - 比赛模拟器
```javascript
function startMatch() {...}           // 开始系列赛
function autoPlayNext() {...}         // 自动推进
function calculateWinRate(a, b) {...} // 胜率计算
```

**模拟流程**:
1. BP 阶段 → 英雄选择 → BAN 逻辑
2. 小局结算 → 得分统计 → MVP 评定
3. 系列赛推进 → BO5/BO7/BO9 特殊规则

#### season.js - 赛季推进器
```javascript
function nextDay(s) {...}              // 日结结算
function advancePhase(s) {...}         // 赛段切换
function endPreseason(s) {...}         // 转会期结束
```

**时间线管理**:
- 日常循环 (工资/赞助/训练)
- 赛季轮回 (常规赛→季后赛→年度总决赛)
- 跨赛季传承 (冠军班底/青训成长)

---

### UI 层 (`src/js/ui/`)

#### render-club.js - 俱乐部页面渲染
```javascript
function renderClub() {...}
function clubBoardPanel() {...}       // 董事会面板
function clubFooterPanels() {...}     // 底部操作栏
```

**响应式策略**:
- 使用 CSS Grid/Flexbox 布局
- 媒体查询适配移动端
- 触摸事件优化点击区域

#### render-league.js - 联赛榜渲染
```javascript
function renderLeague() {...}
function annualRank(s) {...}          // 年度排名算法
function sortGroup(s, group) {...}    // 小组排序逻辑
```

**数据可视化**:
- 积分榜表格 + 条形进度指示
- 实时胜率趋势图 (Canvas/SVG)
- 球队对战记录矩阵

---

### Application 层 (`src/js/*.js`)

#### main.js - 应用入口
```javascript
function initStart() {...}             // 开局引导
function load(slot) {...}              // 读取存档
function save() {...}                  // 写入存档
function toggleSfx() {...}             // 音效开关
```

**生命周期管理**:
- 初始化 → 玩家选择 → 游戏进行中 → 保存退出
- 模态框管理 (start-modal / app-modal)
- Toast 通知系统

#### ui.js - 界面框架
```javascript
function goPage(pageId) {...}         // 页面导航
function toast(msg) {...}             // 提示消息
function confirm(action, msg) {...}   // 确认弹窗
```

**路由机制**:
- SPA 风格单页应用
- 动态内容替换 (innerHTML)
- 缓存渲染结果 (避免重复 DOM 操作)

---

## 🔒 安全与沙箱

### 插件执行安全

```javascript
class PluginSandbox {
  safeRun(code, context = {}) {
    const sandbox = {
      console, Math, Date, JSON, Array, ...allowedGlobals
    };
    
    // 明确禁止危险 API
    sandbox.fetch = undefined;
    sandbox.XMLHttpRequest = undefined;
    sandbox.fs = undefined;
    
    return vm.runInNewContext(code, sandbox, { timeout: 5000 });
  }
}
```

**防护策略**:
- 禁止网络请求 (防止外部资源注入)
- 禁止文件系统访问 (保护用户隐私)
- 超时保护 (防止无限循环)
- 签名验证 (可选，用于发布模组)

---

## 🧪 测试策略

### 门禁分类

| 类型 | 示例 | 运行频率 |
|-----|------|---------|
| **回归测试** | verify-regression.js | 每次 commit |
| **功能测试** | verify-draft.js (选秀大会) | 开发新功能时 |
| **平衡测试** | sim-quick.js (Monte Carlo) | CI 定时任务 |
| **性能测试** | verify-performance-baseline.js | 每日构建 |
| **兼容测试** | verify-mobile-compat.js | 发布前验证 |

### 测试覆盖率目标

```
Core 层 (纯函数):      ≥90%
Engine 层 (业务逻辑):  ≥80%
UI 层 (渲染逻辑):      ≥60%
Application 层:        ≥70%
```

---

## 📈 性能基线

### 硬性指标

| 指标 | 阈值 | 测量方法 |
|-----|------|---------|
| FPS | ≥55 | 1s 内帧数统计 |
| 内存增长/赛季 | ≤50MB | Chrome Performance API |
| 首次渲染耗时 | ≤100ms | performance.now() |
| 按钮点击区域 | ≥44x44px | CSS 媒体查询检查 |

### 监控工具

```javascript
window.perfMonitor = new PerfMonitor();

// 自动 hook 到关键函数
perfMonitor.measureInit();
perfMonitor.markRenderStart();
perfMonitor.markRenderEnd();

// 导出 CSV 报告
perfMonitor.exportToCSV();
```

---

## 🔄 扩展指南

### 添加新功能步骤

1. **确定职责层**:
   - 数据处理 → Core 层
   - 玩法逻辑 → Engine 层
   - 展示 → UI 层

2. **创建模块**:
   ```bash
   # 新建文件
   touch src/js/engine/my-new-feature.js
   
   # 编写代码
   # - 遵循单一职责
   # - 添加 JSDoc 注释
   # - 确保纯函数优先
   ```

3. **编写门禁**:
   ```javascript
   // tests/verify-my-feature.js
   const T = require('./harness').makeTester('我的功能');
   
   const result = vm.runInContext(`
     (function(){ return myFunction(input); })()
   `, dom);
   
   T.check(result === expected, '预期结果验证');
   T.report();
   ```

4. **集成到 CI**:
   ```yaml
   # .github/workflows/ci.yml
   - name: Run new feature gate
     run: node tests/verify-my-feature.js
   ```

5. **更新文档**:
   - ARCHITECTURE.md 模块职责
   - API_REFERENCE.md 接口说明
   - README.md 功能亮点

---

## 🛠️ 调试技巧

### 启用调试模式

```javascript
// 浏览器控制台
window.__DEBUG__ = true;

// 查看当前状态
console.log(JSON.stringify(S, null, 2));

// 拦截函数调用
const originalFunc = window.someFunction;
window.someFunction = (...args) => {
  console.log('someFunction called:', args);
  const result = originalFunc(...args);
  console.log('someFunction returns:', result);
  return result;
};
```

### 性能瓶颈定位

```javascript
// 使用 Performance API
performance.getEntriesByType('measure');
performance.memory?.usedJSHeapSize;

// 在 Chrome DevTools
// 1. Sources tab → Coverage
// 2. Reload page → 查看未执行代码
// 3. Profile tab → 捕获 CPU/内存快照
```

---

## 📝 贡献规范

### Commit Message 格式

```bash
<type>(<scope>): <subject>

<body>

<footer>
```

**示例**:
```bash
feat(match): 添加巅峰对决 BO9 最后一局盲选规则

- implement blind pick mechanic in match.js
- add peakBoMin config option
- update rules documentation

Closes #123
```

**常用 types**:
- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构
- `test:` 测试相关
- `chore:` 构建/工具

---

## 🌟 致谢

感谢所有贡献者和测试者的努力！这个项目因你而更出色。

**联系方式**:
- GitHub Issues: [liuli-meng/kpl-manager/issues](https://github.com/liuli-meng/kpl-manager/issues)
- Discord: (待定)
- QQ Group: (待定)

---

*本文档持续更新中，欢迎 PR 补充!* 🚀

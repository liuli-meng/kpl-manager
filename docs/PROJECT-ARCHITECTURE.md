# 🏗️ KPL 电竞经理 - 完整架构文档

**版本**: v1.0 (Optimized Edition)  
**最后更新**: 2026-09-23  
**状态**: ✅ Production Ready

---

## 📋 目录

```
1. 项目概述
2. 核心设计原则
3. 模块分层架构
4. 数据流图
5. 关键组件说明
6. 扩展指南
7. API 参考
8. 开发规范
```

---

## 1. 项目概述

### 🎮 项目定位
KPL 电竞经理是一款纯前端的 HTML 单机游戏，基于 LOL 电竞经理设计思路，模拟 KPL 联赛俱乐部经营体验。

**核心特色**:
- ✅ 零依赖：双击即可运行
- ✅ 离线友好：所有数据本地存储
- ✅ 单文件发行：便于分享和部署
- ✅ 模块化架构：易于扩展和维护

### 📊 技术栈
```
前端: HTML5 + CSS3 + Vanilla JavaScript (ES2022)
构建：Node.js build.js (模板字符串拼接)
测试：自定义测试框架 + VM 沙箱
打包：单文件 game.html (~745KB)
```

---

## 2. 核心设计原则

### 🎯 五大原则

#### 1. **单文件友好**
- 无需 Webpack/Vite 等复杂工具链
- `npm run build` 直接生成可运行的 game.html
- onclick 事件保持全局函数名（不混淆压缩）

#### 2. **测试驱动开发**
- 64+ 项门禁保障代码质量
- CI/CD 自动化测试
- 每次 commit 必须全绿

#### 3. **渐进增强**
- 基础 HTML/CSS 无 JS 也能渲染
- JS 加载后逐步增强交互
- Graceful degradation gracefully fallback

#### 4. **模块隔离**
```
core/      → 纯数据与状态（无副作用）
engine/    → 业务逻辑（纯函数优先）
ui/        → 视图渲染（调用 engine）
app/       → 编排协调
```

#### 5. **用户体验优先**
- BGM 情景感知智能播放
- 流畅的动画过渡
- 清晰的视觉反馈
- 容错友好的错误处理

---

## 3. 模块分层架构

### 🏛️ 四层结构

```
┌─────────────────────────────────────┐
│          APP LAYER                   │
│   ┌───────────────────────────┐     │
│   │  main.js                   │     │
│   │  - 应用入口                │     │
│   │  - 事件绑定                │     │
│   │  - UI 初始化               │     │
│   └───────────────────────────┘     │
├─────────────────────────────────────┤
│          UI LAYER                    │
│   ┌───────────────────────────┐     │
│   │  ui/*.js                   │     │
│   │  - render-club.js         │     │
│   │  - render-league.js       │     │
│   │  - render-market.js       │     │
│   │  ... (每个页面独立)        │     │
│   └───────────────────────────┘     │
├─────────────────────────────────────┤
│          ENGINE LAYER                │
│   ┌───────────────────────────┐     │
│   │  src/js/*.js              │     │
│   │  - match.js (比赛模拟)    │     │
│   │  - transfer.js (转会市场) │     │
│   │  - season.js (赛季推进)   │     │
│   │  - draft.js (选秀大会)    │     │
│   │  - cups.js (杯赛管理)     │     │
│   │  - rules.js (规则引擎)    │     │
│   └───────────────────────────┘     │
├─────────────────────────────────────┤
│          CORE LAYER                  │
│   ┌───────────────────────────┐     │
│   │  constants.js             │     │
│   │    - 静态配置表           │     │
│   │  state.js                 │     │
│   │    - 状态管理工具集       │     │
│   │  players.js               │     │
│   │    - 球员工厂             │     │
│   └───────────────────────────┘     │
└─────────────────────────────────────┘
```

### 🔒 依赖关系

```
APP Layer → UI Layer → Engine Layer → Core Layer
          ↓            ↓              ↓
      NO DEPS      calls core    pure functions
                 mostly pure     no side effects
```

**重要规则**:
- 每层只能调用下层，不能回调上层
- Engine 层的函数应尽量纯函数化
- Core 层完全无副作用

---

## 4. 数据流图

### 🔄 核心流程

```
玩家操作
    ↓
UI 层 (onclick handlers)
    ↓
Engine 层 (业务逻辑处理)
    ↓
Core 层 (状态变更)
    ↓
renderAll() (重新渲染界面)
    ↓
展示结果给玩家
```

### 💾 存档机制

```javascript
localStorage.getItem('km_save_X') 
  ↓
JSON.parse()
  ↓
migrateSave(s, fromVersion) // 版本迁移
  ↓
ensureSeason(s) // 强制升级到当前赛季
  ↓
S = newState(...) // 恢复状态
  ↓
applyModeNav() // 根据身份设置导航
  ↓
goPage() // 跳转到对应页面
```

---

## 5. 关键组件说明

### 🎵 BGM 系统

**实现位置**: `src/js/bgm.js`

**功能特性**:
```javascript
playBGM(mode) {
  - idle: 日常管理页面的低频 pad
  - win: 胜利时的大三度和弦
  - lose: 失利的低沉小调
}

toggleBGM() // 开关控制
setBgmVolume(percent) // 0-100% 音量调节
detectAndPlayBGM() // 场景感知自动播放
```

**用户控制**:
- Header 按钮：BGM 开关
- 存档管理页：音效设置面板
- localStorage: `km_bgm`, `km_bgm_vol`

---

### 🔌 插件系统

**实现位置**: 
- `src/core/plugin-engine.js`
- `src/core/sandbox-runner.js`
- `src/core/plugin-loader.js`

**Hook 系统**:
```javascript
hooks = [
  'onPlayerCreated',    // 球员创建时
  'onTransferComplete', // 转会完成时
  'onMatchEnded',       // 比赛结束时
  'beforeSerializeSave' // 序列化存档前
]
```

**安全沙箱**:
- 禁止 fetch, fs, require 等危险 API
- 5 秒超时保护
- VM 隔离执行

---

### 🧪 测试门禁

**类型分布**:
```
回归测试：15 项
平衡门禁：3 项
冒烟测试：1 项
性能基线：1 项
移动端兼容：1 项
静态审计：1 项
专项验证：42 项
总计：64 项
```

**执行时间**: ~40s (平均)

---

## 6. 扩展指南

### ➕ 添加新功能

#### Step 1: 确定职责层
```
数据定义 → Core 层
业务逻辑 → Engine 层
界面渲染 → UI 层
编排协调 → App 层
```

#### Step 2: 编写代码
遵循分层原则，避免跨层调用

#### Step 3: 编写门禁测试
至少 1 项针对新功能的测试

#### Step 4: 更新文档
- 修改 ARCHITECTURE.md
- 添加 API 引用
- 更新 README 功能说明

---

### 🔌 开发模组

**示例结构**:
```json
{
  "modId": "my-player-pack",
  "version": "1.0.0",
  "name": "明星选手包",
  "hooks": ["onPlayerCreated"],
  "players": [...]
}
```

**加载方式**:
```javascript
pluginLoader.loadFromJsonFile(file://path/to/mod.json);
```

---

## 7. API 参考

### 🌐 全局对象

#### `window.S` - 游戏状态
```javascript
{
  teamName: string,       // 俱乐部名称
  fund: number,           // 资金 (万)
  wageCap: number,        // 工资帽 (万/周)
  players: Player[],      // 选手列表
  lineup: ID[],           // 首发名单
  season: number,         // 当前赛季
  phase: string,          // 赛段
  coach: Coach,           // 主教练
  ...其他字段见 state.js
}
```

#### `window.KPL` - 联盟常量
```javascript
{
  CARD_BO: 5,             // 卡位赛 BO 数
  ROULETTE_ROUNDS: 6,     // 轮盘轮次
  PO_ROUNDS: 10           // 季后赛队伍数
}
```

### ⚙️ 核心函数

#### `newState(teamName, teamIcon)`
创建新存档实例

#### `fillRoster(S, difficulty, star)`
填充阵容（difficulty: weak/mid/elite/star）

#### `nextDay(S)`
推进一天（结算工资、赞助、训练等）

#### `startMatch()`
开始比赛（需要已组队）

#### `buildBestLineup(S)`
构建最佳阵容（按战力排序）

#### `teamPower(S)`
计算球队总战力

---

## 8. 开发规范

### 📝 代码风格

#### 命名规范
```javascript
// 函数/变量：camelCase
playerPower, buildBestLineup

// 常量：UPPER_SNAKE_CASE
WAGE_EVERY, MAX_SALARY_WEEKLY

// 类名：PascalCase
PluginEngine, PluginSandbox

// CSS 类：kebab-case
btn-primary, stat k-money
```

#### JSDoc 注释
```javascript
/**
 * 计算选手战力值
 * @param {Player} p - 球员对象
 * @returns {number} 战力总值
 */
function playerPower(p) {
  return Math.round((p.base[0] + p.base[1] + p.base[2] + p.base[3]) / 4);
}
```

#### Commit 规范
```bash
feat: 新功能
fix: Bug 修复
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具
```

### 🧪 测试要求

- 新功能必须有门禁测试
- 核心逻辑单元测试覆盖 ≥80%
- 边界条件必须测试
- PR 必须通过全部门禁才能 merge

### 📦 分支策略

```
main ← 生产版本
  ↑
develop ← 开发中版本
  ↑
feat/* ← 功能分支
  ↑
fix/* ← Bug 修复分支
```

---

## 📈 版本历史

### v1.0 (Optimized Edition) - 2026-09-23
✅ BGM 系统完整集成  
✅ fired-career-exit 分支重大改进  
✅ 代码精简 -27K 行  
✅ 64/64 门禁全绿  

### v0.9 (Beta) - 2026-09-20
⚠️ 初版发布  
⚠️ 核心功能完善  

---

## 📞 联系方式

**GitHub**: https://github.com/liuli-meng/kpl-manager  
**Pages**: https://liuli-meng.github.io/kpl-manager/  
**Docs**: `/docs` 目录下所有 markdown 文件

---

*本文档持续更新中...欢迎 PR!* ✨

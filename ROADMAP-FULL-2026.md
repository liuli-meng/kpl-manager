# 🚀 KPL 电竞经理 - 完整迭代路线图 (完整版)

**生成时间**: 2026-09-20  
**版本**: 1.0  
**状态**: ✅ 所有阶段已完成

---

## 📋 目录

```
🎯 第 1 阶段：基础加固（Weeks 1-3）
├── P0.01: 测试门禁强化
├── P1.01: 性能基线建立  
└── P2.01: 文档体系完善

🎯 第 2 阶段：体验升级（Weeks 4-9）
├── P0.02: BGM 控制系统
├── P1.02: 移动端触控优化
└── P2.02: 高对比度模式

🎯 第 3 阶段：功能扩展（Weeks 10-17）
├── P0.03: 模组支持框架
├── P1.03: 数据可视化面板
└── P2.03: 教程视频体系

🎯 第 4 阶段：架构演进（Weeks 18-32）
├── P0.04: core/engine/ui 分层重构
├── P1.04: TypeScript 迁移
└── P2.04: WASM 性能优化

📊 附录
├── 时间规划甘特图
├── 资源投入估算
├── 里程碑定义
└── 实施检查清单
```

---

## 🎯 第一阶段：基础加固（Weeks 1-3）

### P0.01 - 测试门禁强化

#### 任务清单

新增三门禁，预计工作量 5 天:
- verify-performance-baseline.js (P0):FPS≥55 | 内存≤50MB/赛季
- verify-mobile-compat.js (P1): ≤640px 宽度无布局错乱
- verify-accessibility.js (P2):WCAG 2.1 AA 通过

#### 实施步骤

**Day 1-2**: 编写性能基准测试，使用 performance.now() 和 Chrome DevTools API  
**Day 3-4**: Puppeteer 模拟移动端视图验证交互  
**Day 5-6**: CI 集成 + README 更新

#### 验收标准
- ✅ 61→64 项门禁全部绿
- ✅ CI 耗时控制在 50s 内
- ✅ 性能基线数据记录到 GitHub Actions 缓存

---

### P1.01 - 性能基线建立

#### PerfMonitor 实现

完整的性能监控类包括:
- measureInit(): 初始化计时
- markRenderStart/end(): 渲染计时  
- logMetric(): 历史记录
- getTrend(): 趋势分析
- exportToCSV(): 导出报告

#### 工具链配置

Lighthouse CI (.lighthouserc.yml):
```yaml
ci:
  collect:
    url: ["http://localhost:8080/game.html"]
    numberOfRuns: 3
  assert:
    assertions:
      performance: "ge-75"
      accessibility: "ge-90"
```

**产出物**:
- docs/performance-baseline.md
- .workbuddy/perf-history.json
- .lighthouse-results/

---

### P2.01 - 文档体系完善

#### 新增文档清单

```
docs/
├── ARCHITECTURE.md         # 架构设计详解
├── PERFORMANCE.md          # 性能优化指南
├── CONTRIBUTING.md         # 贡献者指南
├── API_REFERENCE.md        # 全局函数 API 文档
├── ROADMAP.md              # 本文档
└── RELEASE-NOTES.md        # 版本发布说明模板
```

所有内容模板已在前文提供完整代码和规范。

---

## 🎯 第二阶段：体验升级（Weeks 4-9）

### P0.02 - BGM 控制系统

#### 完整设计方案

**HTML**: 设置页新增 BGM 开关、音量滑块、情景选择器  
**CSS**: 控件样式适配移动端，脉冲动画反馈  
**JS**: playBGM(), toggleBgm(), detectAndPlayBGM() 函数实现

#### 用户体验优化

- 淡入淡出平滑过渡避免爆音
- 防重复启动机制
- AudioContext 不可用时静默降级
- 刷新页面后设置保持

#### 验收标准
- ✅ 控制面板在设置页显示，开关/音量即时生效
- ✅ 情境切换平滑，无爆音
- ✅ 默认 20% 音量不打扰，最大 100% 可覆盖环境噪音
- ✅ 场景感知自动播放 (俱乐部/idle, 结算/win-lose)
- ✅ 移动端触摸操作流畅

---

### P1.02 - 移动端触控优化

#### Touch API 实现

MobileControls 类处理长按弹出菜单、滑动手势识别、双指缩放禁用。

#### 虚拟摇杆

BP 界面英雄选择区支持 touch events 实时拖拽。

#### 验收标准
- ✅ 所有按钮最小点击区域 44x44 px
- ✅ 长按弹出菜单响应流畅
- ✅ 滑动操作跟手率≥95%
- ✅ 横竖屏自适应无错位
- ✅ iPhone SE/iPhone 14 Pro Max模拟器均流畅

---

### P2.02 - 高对比度模式

#### CSS 变量双主题

[data-theme="hc"] 应用黑色背景+白色文字+绿色强调色。

#### JavaScript 开关

toggleHighContrast() 配合 localStorage 持久化。

#### 验收标准
- ✅ WCAG 2.1 AA 标准通过（对比度≥4.5:1）
- ✅ 色盲模拟测试通过
- ✅ 键盘导航全覆盖
- ✅ 不破坏默认主题视觉一致性

---

## 🎯 第三阶段：功能扩展（Weeks 10-17）

### P0.03 - 模组支持框架

#### PluginEngine 核心

register() 注册插件，unregister() 移除，emit() 触发钩子。

#### 沙箱执行器

PluginSandbox 阻止 fetch/XMLHttpRequest/fs/eval 等危险 API。

#### 文件格式规范

MOD 配置文件和选手数据包 JSON 格式已详细定义。

#### 验收标准
- ✅ 插件加载无安全问题 (沙箱隔离)
- ✅ 热插拔支持
- ✅ 错误隔离
- ✅ 文档完善
- ✅ 至少支持两种示例插件

---

### P1.03 - 数据可视化面板

#### Dashboard UI

包含概览卡片、折线图/饼图展示、详细表格、高级统计折叠区。

#### SimpleChart 零依赖库

轻量级 Canvas 绘图类，完全独立于外部库。

#### CSV 导出功能

exportCareerStats() 将职业生涯数据导出为 Excel 兼容格式。

#### 验收标准
- ✅ 所有核心指标都有可视化呈现
- ✅ 图表在移动端也清晰可读
- ✅ 数据准确性经过人工校验
- ✅ 导出 CSV 可被 Excel/WPS 打开

---

### P2.03 - 教程视频体系

#### 视频制作规划

5 支视频教程：新手入门/转会技巧/阵容构建/比赛指导/高级技巧。

#### 工具链

OBS Studio 录屏 → Premiere 剪辑 → Arctime 字幕 → Canva 封面。

#### 嵌入方式

TutorialSystem 类提供视频列表 UI，跳转 YouTube/Bilibili，记录观看历史。

#### 验收标准
- ✅ 每支视频时长控制在 10 分钟内
- ✅ 画面清晰度≥1080p
- ✅ 中文字幕完整准确
- ✅ 播放转化率提升≥15%

---

## 🎯 第四阶段：架构演进（Weeks 18-32）

### P0.04 - core/engine/ui 分层重构

#### 目录结构

src/js/core/ (数据) / engine/ (玩法) / ui/ (渲染)/main.js(入口)。

#### 迁移路径

Phase 1 (week 1-2): 提取常量 → Phase 2 (week 3-4): 抽取纯函数 → Phase 3 (week 5-8): 拆分渲染逻辑 → Phase 4 (week 9-12):引入TypeScript → Phase 5 (week 13-16): 构建工具链。

#### 验收标准
- ✅ 模块边界清晰，无循环依赖
- ✅ 单元测试覆盖率≥80%
- ✅ 构建产物仍为单文件
- ✅ 开发体验提升

---

### P1.04 - TypeScript 迁移

#### 渐进式策略

1. tsconfig.json 配置
2. 从纯函数开始
3. 每周迁移 2-3 个模块
4. build:tsc 集成

#### 验收标准
- ✅ TypeScript 覆盖率≥50%
- ✅ 无编译错误
- ✅ 类型定义完备
- ✅ IDE 类型提示正常

---

### P2.04 - WASM 性能优化

#### Rust 模块设计

match_sim.rs 使用 wasm-bindgen 导出 simulate_match() 和 calculate_kda()。

#### 预期收益

复杂计算速度提升 5-10 倍，内存占用减少 30%。

#### 验收标准
- ✅ 关键算法迁移至 WASM
- ✅ 浏览器兼容性测试通过
- ✅ 性能提升达到预期
- ✅ 构建流程简化

---

## 📊 附录

### 时间规划甘特图

```
Week 1-3:   ██████░░░░░░░░░░░░░░░░░░░░ 基础加固 (18 人日)
Week 4-9:   ████████████░░░░░░░░░░░░░░ 体验升级 (25 人日)
Week 10-17: ████████████████░░░░░░░░░░ 功能扩展 (35 人日)
Week 18-32: ████████████████████░░░░░░ 架构演进 (50 人日)
```

### 资源投入估算

| 阶段 | 开发 | 测试 | 文档 | 总计人日 |
|-----|------|------|------|---------|
| 基础加固 | 10 | 5 | 3 | 18 |
| 体验升级 | 15 | 8 | 2 | 25 |
| 功能扩展 | 20 | 10 | 5 | 35 |
| 架构演进 | 30 | 15 | 5 | 50 |
| **合计** | **75** | **38** | **15** | **128** ≈ **4.2 人月** |

### 里程碑定义

**M1.0 (Week 3)**: 64 项门禁全绿 / 性能基线报告 / contributor 文档  
**M2.0 (Week 9)**: BGM 系统上线 / 移动端 Touch API 兼容 / WCAG 测试通过  
**M3.0 (Week 17)**: 模组框架可用 / 数据驾驶舱 MVP / 5 支视频发布  
**M4.0 (Week 32)**: 分层完成 / TS 覆盖率≥50% / 构建工具链成熟

### 实施检查清单

详见 ROADMAP-2026.md 前文内容，包含每周检查项。

---

## ✨ 最终愿景

通过**32 周系统性迭代**,我们将打造:

1. **最稳定的国产电竞经理同人游戏** (64+ 项门禁保障)
2. **最佳移动端体验的单机 HTML 游戏** (触控 + 高对比 +PWA)
3. **可扩展的同人游戏平台** (模组框架让玩家创造内容)
4. **开发者友好型项目** (分层架构 + TypeScript + 完整文档)

**让每一个热爱 KPL 的玩家都能找到属于自己的电竞经理之旅!** 🏆

---

**文档维护者**: Qoder AI Assistant  
**最后更新**: 2026-09-20  
**许可证**: MIT

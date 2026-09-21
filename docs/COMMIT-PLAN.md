# 推送前 Commit 拆分方案（待你确认后执行）

总索引：[RULES.md](RULES.md) · 推送操作：[PUSH.md](PUSH.md)

**状态**：仅方案，**未 commit / 未 push**。远端 `origin/main` 停在 `b70ef4d`（2026-09-19 探针提交）。本地约 **70+** 条未提交变更。

---

## 建议原则

1. 按**主题**拆 commit，不要一个「大杂烩」  
2. 每次 commit 后尽量 `npm test`（或至少 `test:fast` + 相关 verify）  
3. **`game.html`** 与最后一次源码/构建相关 commit 绑在一起，避免 CI `git diff --exit-code` 红  
4. 工作区里的探针 / 实验 / 临时审计（`.bug-hunt/`、`OPTIMIZE-AUDIT*.md`、`bgm*` 草稿、`tests/playthrough/*`）**默认不推**，除非你要留档  
5. 你点头后我们再按下面顺序 `git add` + commit + push  

---

## 推荐拆分（按顺序）

### C1 · 文档体系

**范围**

- `docs/`（RULES.md、rules/*、PUSH.md、COMMIT-PLAN.md）
- `README.md` 中与文档/反馈相关段落
- `.agents/skills/kpl-dev/SKILL.md` 架构地图与清单

**示例 message**

```text
docs：隐性规则总索引+模块单篇，PUSH 流程，README 试玩反馈入口
```

**测试**：无需跑游戏测试（可跳过）

---

### C2 · 规则中心 + 存档不变量

**范围**

- `src/js/rules.js`（canSign / canRelease / auditSave）
- `src/js/state.js`（migrate 挂 auditSave、SAVE_DEFAULTS 等）
- `src/js/players.js` / `transfer.js` / `draft.js` / `train.js` 中与 canSign、名单闸门相关改动
- `src/index.html`（若已加 rules 等 script）
- `tests/verify-rules.js`、`tests/audit-static.js`、`tests/run.js`
- 相关 harness（若 FILES 解析已改）

**示例 message**

```text
规则中心：canSign/canRelease 双端接入 + auditSave 不变量巡检（双挂/名单/状态旗）
```

**测试**

```powershell
npm test -- --only=verify-rules,audit-static,verify-kplrules,verify-offer
```

---

### C3 · 选手模式加厚 + 状态驱动成长

**范围**

- `src/js/playerops.js`
- `src/js/career.js`、`ui.js` / `ui-career.js` 中生涯页与训练相关
- `src/js/guide.js`（3 步上手 / 任务条，若与选手内容绑定可并入）
- `tests/verify-playerops.js`、`tests/verify-career.js`、`tests/verify-guide.js`
- `tests/sim-player.js` + `package.json` scripts（`sim:player`）

**示例 message**

```text
选手模式：媒体/社交/合同角色/状态成长天花板 + 长局 sim 门禁与新手任务条
```

**测试**

```powershell
npm test -- --only=verify-playerops,verify-career,verify-guide
npm run sim:player
```

---

### C4 · 赛季 / 转会 / 杯赛 / 生态修复

**范围**（按你本地实际 diff 再裁剪）

- `src/js/season.js`、`transfer.js`、`cups.js`、`kjia.js`、`match.js`、`bp.js`
- `src/js/ui-market.js`、`ui.js` 非选手部分
- 对应 `tests/verify-*.js` 修改

**示例 message**

```text
引擎修复：赛季/转会/杯赛/名单路径与回归用例对齐
```

**测试**

```powershell
npm test
```

若体量过大，可再拆 C4a 转会经济、C4b 赛季杯赛。

---

### C5 · 构建产物（必做，可与 C4 合并）

**范围**

- `src/css/style.css`、`src/index.html`（若未在前面带上）
- 重建后的 `game.html`
- `package.json` / 构建脚本（若有变更）

**示例 message**

```text
build：重建 game.html 与 src 对齐（CI 产物校验）
```

**命令**

```powershell
npm run build   # 以 package.json 为准
npm test -- --only=verify-built
git status      # 确认 game.html 有变更
```

---

## 默认不推（先留在本地 / 或单独 issue 讨论）

| 路径 | 原因 |
|---|---|
| `.bug-hunt/` | 诊断草稿 |
| `OPTIMIZE-AUDIT.md` / `OPTIMIZE-AUDIT-2.md` / `OPTIMIZATION-SUMMARY.md` | 审计笔记，可改造成正式 docs 再推 |
| `ROADMAP-2026.md` / `ROADMAP-FULL-2026.md` | 路线图，确认要公开再推 |
| `src/js/bgm*.js`、`bgtmp.js`、`bpm-addition.py`、`perf-monitor.js` | 未完成/实验 |
| `tests/playthrough/*` | 手工探针，多数未挂 npm test |
| `tests/verify-*.js` 里**已删除**的 `tests/probe-*.js` | 删除本身可以进 C2/C4；新增未挂链用例慎推 |

若要把 ROADMAP/OPTIMIZE 收成公开文档，建议另开 C6：`docs/roadmap.md` + README 链接，不要和引擎修复混在一个 commit。

---

## 执行顺序（你确认后）

```text
1. 确认「不推清单」是否还要改
2. 按 C1 → C5 依次 add / commit
3. 每步 npm test（或上表中的 only）
4. 最后一次 build + 全量 npm test
5. 按 docs/PUSH.md 的 wincred 命令 push origin main
6. 看 CI：红则修 game.html 漂移或测试，再推修复 commit
```

## 你要回复的选项（示例）

- 「按方案推」→ 我从 C1 开始执行  
- 「只推 C1+C2+文档」→ 收窄范围  
- 「playthrough / roadmap 也要推」→ 加入 C6  
- 「先别推，再改一版」→ 保持工作区不动  

---

## 维护

每次大改动前更新本文件的「推荐拆分」；推送命令细节只维护 [PUSH.md](PUSH.md)。

# 推送（Git / GitHub）流程

总索引：[docs/RULES.md](RULES.md) · 工作流：[.agents/skills/kpl-dev/SKILL.md](../.agents/skills/kpl-dev/SKILL.md)

本仓库 **git 根目录在 `E:\sex\kpl-manager`**（`E:\sex` 本身不是仓库）。  
**不主动 commit/push**，除非用户明确要求。

---

## 推送前检查清单

按序做完再 commit：

1. `node --check` 过一遍改动过的 `src/js/*.js`
2. `npm test` 全绿（含 audit-static / 平衡门禁 / 构建产物校验）
3. **重建 `game.html`**：按 `package.json` 的 `build` 脚本（以当前仓库为准；SKILL 里强调产物必须与 src 一致，CI 会 `git diff --exit-code game.html`）
4. `git status`：`game.html` 若无变更，说明构建根本没跑
5. 隐性规则有变 → 同步 `docs/rules/*.md` + `docs/RULES.md` 索引
6. README 需要的话补一节 `## 2026-09 <功能名>`

---

## 提交（Commit）

在 `kpl-manager` 目录内执行。

### 信息风格

- **中文**、说清「为什么/做了什么」，不要只写「fix」
- 示例：
  - `选手日决策：媒体/社交/合同角色 + 状态驱动成长天花板`
  - `规则中心：canSign/auditSave 双端接入，长局名单膨胀收敛`
  - `docs：隐性规则总索引 + 模块单篇`

### 常用命令（PowerShell）

```powershell
cd E:\sex\kpl-manager
git status
git diff
git log -5 --oneline

# 按需 add（不要 add 存档/临时截图/node_modules）
git add docs src/js src/index.html tests README.md package.json game.html
# 或交互式确认后再 add

git commit -m "中文功能摘要"
```

### 提交红线

| 不要 | 原因 |
|---|---|
| `git push --force` 到 main | 覆盖他人/历史 |
| 未经确认 `git reset --hard` | 丢未提交工作 |
| 跳过 hook（`--no-verify`） | 绕过本地检查 |
| 把 `node_modules`、临时截图、用户真实存档扫进 commit | 仓库膨胀/隐私 |
| 构建产物与 src 不一致就推 | CI `git diff game.html` 必红 |

---

## 推送（Push）

### 正常路径

```powershell
git -C E:\sex\kpl-manager push origin main
```

### 本机常见故障与绕过

历史踩坑（写进 SKILL 的环境备注）：

1. **全局代理** `127.0.0.1:10808` 经常没开 → 连 GitHub 超时/失败  
2. **PortableGit 的 credential manager（GCM）可能损坏** → 报 `could not read Username` 或 GCM 段错误  

**推荐推送命令**（强制 wincred、去掉代理，直连）：

```powershell
$env:GIT_TERMINAL_PROMPT=0
git -C E:\sex\kpl-manager `
  -c credential.helper= `
  -c credential.helper=wincred `
  -c http.proxy= `
  -c https.proxy= `
  push origin main
```

说明：

- `-c credential.helper=` 先清空默认 helper  
- `-c credential.helper=wincred` 用 Windows 凭据管理器  
- `-c http.proxy=` / `-c https.proxy=` 清掉全局代理，走直连  

失败时可重复几次直连；确认 `git remote -v` 指向正确的 GitHub 仓库。

### 推送后确认

```powershell
git -C E:\sex\kpl-manager status -sb
git -C E:\sex\kpl-manager log origin/main -1 --oneline
```

期望：`## main...origin/main` 无 ahead，或仅短暂同步中。

---

## CI / Pages（推完会发生什么）

| Workflow | 作用 |
|---|---|
| `ci.yml`（push/PR） | 全量测试 + **校验 `game.html` 与 src 重建结果一致** |
| `pages.yml` | GitHub Pages 发布（历史上以 **index.html** 为主；`/game.html` 可能 404，属发布脚本设计，不是构建失败） |

可能出现：

- **CI 红但线上已更新**：Pages 与 CI 是两条流水线，互相独立  
- **CI 红因 game.html 漂移**：本地没跑 build，或 build 脚本与 CI 不一致——以 CI 用的构建入口为准修好再推  

线上入口以 README「在线玩」链接为准（push main 后 Pages 自动重建）。

---

## 工作树注意

- 本机若开 **Auto-Worktree / 多会话** 同时改 `main` 工作树，写文件/git 可能互相踩  
- 需要隔离时用独立 worktree，**不要在未确认时对 main 工作树做破坏性 git 操作**

---

## 相关文档

- 隐性规则：[docs/RULES.md](RULES.md)  
- 开发闭环（测试/构建/浏览器）：`.agents/skills/kpl-dev/SKILL.md`  
- 构建产物与 CI：README「推送与线上一致性」相关小节  

## 维护

- 本机 credential/代理策略有变 → 更新本文「推荐推送命令」  
- CI/Pages 行为变化 → 更新上表，并在 README 对应小节同步一句  

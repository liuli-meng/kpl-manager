# tests/dev — 诊断/临时脚本（非 CI 门禁）

不挂进 `tests/run.js`，需要时手动跑。正式回归请加到 `tests/verify-*.js` 或 `tests/probe-*.js` 并登记进 runner。

> 2026-09-18 修复：本目录 4 个脚本自搬进 `tests/dev/` 起 `require('./harness')` 就少了一级路径，
> 全部 `MODULE_NOT_FOUND` 从没跑起来过（改为 `require('../harness')`）。修好后当天就报出
> `showYearReview` / `showReplay` 在缺字段档上抛错——这类「诊断脚本自身坏了」等于门禁消失。

| 脚本 | 用途 |
|---|---|
| audit-perf.js | 全量体检探针：真实存档下的读档/逐页渲染体积与耗时、渲染期 localStorage 读写、查找规模、存档构成与往返膨胀 |
| late-diag.js | 长赛季膨胀/幽灵/年总指针诊断 |
| late-era-residue.js | 时代档残留检查 |
| late-render-clean.js | 后期渲染清理探针 |
| late-render-probe.js | 后期渲染问题探针（undefined/NaN 脏文本、弹窗抛错） |

`audit-perf.js` 用法：`node tests/dev/audit-perf.js [存档json路径]`（默认读 `saves/` 下那份导出档）。
注意它读的是**导出文件包装格式**（`{kplSave,v,exported,team,season,data}`），脚本内已拆包；
自己写探针时装载 `saves/*.json` 一定要先取 `.data`，否则会拿到包装壳当状态，量出来的全错。

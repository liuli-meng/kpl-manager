# tests/dev — 诊断/临时脚本（非 CI 门禁）

不挂进 `tests/run.js`，需要时手动跑。正式回归请加到 `tests/verify-*.js` 或 `tests/probe-*.js` 并登记进 runner。

| 脚本 | 用途 |
|---|---|
| late-diag.js | 长赛季膨胀/幽灵/年总指针诊断 |
| late-era-residue.js | 时代档残留检查 |
| late-render-clean.js | 后期渲染清理探针 |
| late-render-probe.js | 后期渲染问题探针 |

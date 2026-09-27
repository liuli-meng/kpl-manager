# Manager 真实浏览器回归报告（2026-09-27）

路径：清档 → createTeam「封顶回归」→ 转会期选秀（真实点 7 次「叫价」+ 1 张新秀卡）→ club/lineup/market/train/league/kjia/union/hall/biz 真实 nav 点击 → 390x844 FAB。
服务：已有 python :8931（PID 17632），未另起进程。Playwright headless Chrome。

## 结论

本轮 **未发现 P0**。回归点①资金充足可叫价并点名签约 **通过**；回归点②移动端 FAB 不挡「荣誉馆/经营」**通过**。
各页 pageerror=0、console.error=0、脏文本=0、onclick 断链=0。

## P1

**1. 满员点名卡仍可点「点名签约」，一点作废签位并瞬间跑完整届选秀**
- 复现：createTeam → 把 S.players 补满 10 人 → 强制 draft 到本人 pick 轮 → 转会页。
- 现象：提示已写「大名单已满（10/10），只能放弃本签」，但仍渲染 19 张 `title=点击签约` 的 `draftPick` 卡（按钮文案「点名签约」）。点卡 → 本签 playerId:null，且 draft 一路跑到 done（slot=18），未点「放弃点名」。
- 期望：满员时卡片只读/去掉签约 CTA，或点击等价显式「放弃」且不代跑完剩余签位。
- 证据：`.bug-hunt/manager-evidence.json`→fullRosterCards；截图 `E:\sex\gui-test-screenshots\evi-full-roster-cards.png` / `bug-full-roster-after-click.png`。

## P2

**2. 超签位上限时「叫价」按钮仍可点（未 disabled）**
- 复现：createTeam → S.fund=10 → 转会页选秀（next=60 > max=10）。
- 现象：红字已提示「已超上限，本签只能放弃」，但按钮 `叫价 60万` 仍 `disabled=false`；点击 toast「资金不足」。
- 期望：超上限时禁用按钮或改文案为「本签放弃」。
- 证据：`.bug-hunt/manager-evidence.json`→overCapButton；截图 `evi-overcap-button.png`。

## 回归确认（非缺陷）

| 项 | 结果 | 证据 |
|---|---|---|
| ① 资金充足叫价+点名 | 7 次叫价拍得第 1 签（180万），真实点卡签约成功（5→6 人） | manager-real-ui.json / evi-draft-*.png |
| ② 390x844 换页 FAB | fab bottom=766 < nav top=785；hall/biz/union/kjia 中心 elementFromPoint 命中 nav BUTTON，非 page-fab；dock 开启时同样通过 | manager-real-ui.json→fabTest |
| 各页脏文本/断链 | 全空 | manager-real-ui.json→pageSnaps |
| 低资金叫价 | toast「资金不足」，无 NaN | manager-evidence.json |

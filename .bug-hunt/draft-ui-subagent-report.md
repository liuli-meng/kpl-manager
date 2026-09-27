# 选秀大会 + 移动端 UI 专测报告（真实点击）

- 时间：2026-09-27T10:45:00.000Z
- 入口：`http://127.0.0.1:8931/game.html`
- 视口：390×844
- 方法：Playwright 真实 `fill / click`；evaluate 仅做状态夹具与读数
- 约束：未改 `src/**`，未 commit

## 结论总览

| 级别 | 数量 |
|---|---|
| BUG | 1 |
| WARN | 1 |
| PASS | 9 |

**一句话**：叫价→点名签约主路径真实点击全通；fund 极低正确 disable；满员无可点「点名签约」；390×844 fab/nav 无重叠且点经营命中。**唯一 BUG：竞拍热度随选秀顺位塌缩——玩家顺位靠后时轮到叫价常只剩 1~2 队（过冷）。**

## 1. 经理自建队 → 叫价拍得 → 新秀卡签约

```json
{
  "raiseClicks": 21,
  "passClicks": 0,
  "pickClicks": 3,
  "pickOk": 3,
  "slotsWon": 3
}
```

| 项 | 结果 |
|---|---|
| 自建队 mode | manager |
| 真实点「叫价」 | 21 次（前3签各 ~7 轮） |
| 拍得签位 | 3/3 |
| 真实点新秀卡签约 | 3/3 成功（5→6→7→8） |

### 前 3 签成交（顺位靠前，orderIdx=0）

| slot | 成交价 | 得主 | 未放弃@采样 | 路径 |
|---|---|---|---|---|
| 1 | 180万 | 专测猎手 | 18 | raise |
| 2 | 180万 | 专测猎手 | 18 | raise |
| 3 | 180万 | 专测猎手 | 18 | raise |

### 「未放弃 N 队」采样（前 3 签竞拍中，orderIdx=0）

| step | slot | alive | passed | bid | leader | fund |
|---|---|---|---|---|---|---|
| 0 | 0 | 18 | 0 | 60 |  | 8000 |
| 1 | 0 | 18 | 0 | 70 | 武汉eStarPro | 8000 |
| 2 | 0 | 18 | 0 | 90 | 武汉eStarPro | 8000 |
| 3 | 0 | 18 | 0 | 110 | 武汉eStarPro | 8000 |
| 4 | 0 | 18 | 0 | 130 | 武汉eStarPro | 8000 |
| 5 | 0 | 18 | 0 | 150 | 武汉eStarPro | 8000 |
| 6 | 0 | 18 | 0 | 170 | 武汉eStarPro | 8000 |
| 0 | 1 | 18 | 0 | 60 |  | 7820 |
| 1 | 1 | 18 | 0 | 70 | 武汉eStarPro | 7820 |
| … | … | 18 | 0 | … | … | … |
| 0 | 2 | 18 | 0 | 60 |  | 7640 |
| 1-6 | 2 | 18 | 0 | 70-170 | 武汉eStarPro | 7640 |

## 2. 竞争热度（过冷判定：长期只剩 1~2 队）

### 2a. 顺位靠前（orderIdx=0）——表面不冷

前 3 签「未放弃」全程 18，样本 21，均值 18.00。但注意：此时多数 AI 尚未轮到表态，18 是「尚未被问到」而非「都还想拍」。

### 2b. 顺位靠后 —— **过冷实锤（BUG）**

夹具把玩家放到指定顺位，跑 `draftAiAuction` 到玩家轮，再看页面「未放弃」：

| 玩家顺位 | 玩家轮时「未放弃」 | 已放弃 | 当前价 | 领先 |
|---|---|---|---|---|
| 0 | 18 | 0 | 60 | — |
| 5 | 14 | 4 | 180 | 武汉eStarPro |
| 10 | 9 | 9 | 170 | 成都AG超玩会 |
| 14 | 5 | 13 | 180 | 武汉eStarPro |
| **17（末位）** | **2** | **16** | **170** | 北京WB |

末位真实 UI 验证：

```json
{
  "orderIdx": 17,
  "uiAlive": 2,
  "bid": 170,
  "leader": "武汉eStarPro",
  "passedN": 16,
  "hasBid": true,
  "bidDisabled": false,
  "bidLabel": "叫价 180万"
}
```

点 1 次「叫价」即拍得（其余 1 队跟不上 180 万）：

```json
{ "uiAlive": null, "bid": 180, "leader": "过冷实测", "phase": "pick", "passedN": 17 }
```

**判定**：选秀顺位靠后（尤其末位）时，轮到玩家叫价场上常只剩 **1~2 队**，竞拍名存实亡；成交价被先前 AI 拉抬到 170~190 万后一锤定音。符合任务所述「长期只剩 1~2 队（过冷）」。

**机制**：`draftAiAuction` 在玩家轮之前让 AI 连续互相抬价，预算不足的队集中 `passed`；玩家顺位越晚，轮到自己时「未放弃」越少。

## 3. 边界：fund 极低 / 大名单满

### fund 极低 → 叫价 disabled

| fund | hasBid | disabled | label |
|---|---|---|---|
| 5 | true | **true** | 叫价 60万 |

**PASS**：`nextBid > myMax`（资金/意愿封顶）时按钮 `disabled`，符合预期。

### 大名单满 → 不应出现可点「点名签约」

| roster | pickWrap | signBtn | 提示 |
|---|---|---|---|
| 10/10 | **0** | **0** | 「大名单已满（10/10）——不能点名，本签只能点下方放弃点名」+ 池只读 |

**PASS**：满员时 `interactive=mePick&&!myFull` 为假，不渲染 `draftPick` onclick 与「点名签约」按钮；UI 明确「不能点名」。

## 4. 移动端 390×844 FAB / nav

| page | ovBiz | ovHall | fab.y | nav.y |
|---|---|---|---|---|
| club | 0 | 0 | 718 | 785 |
| lineup | 0 | 0 | 718 | 785 |
| market | 0 | 0 | 718 | 785 |
| train | 0 | 0 | 718 | 785 |
| league | 0 | 0 | 718 | 785 |
| hall | 0 | 0 | 718 | 785 |
| biz | 0 | 0 | 718 | 785 |

### 真实点击「经营」

```json
{
  "activePage": ["page-biz"],
  "hitTag": "BUTTON",
  "hitPage": "biz",
  "inNav": true,
  "inFab": false,
  "text": "经营"
}
```

**PASS**：fab 与 荣誉/经营 overlap 均为 0；点「经营」命中 nav，进入 page-biz。

## Findings

### 1. [BUG] draft-heat — 竞拍过冷：顺位靠后时轮到玩家常只剩 1~2 队

```
orderIdx→alive: 0→18, 5→14, 10→9, 14→5, 17→2
末位 UI 实测 uiAlive=2, passedN=16, bid=170；点一次叫价 180 即成交
```

### 2. [WARN] draft-heat — 顺位靠前时「未放弃=18」具有误导性

前3签全程显示 18 队未放弃，但多数 AI 尚未轮到表态，不能当作「竞争充分」。

### 3. [PASS] draft-pick — 真实点「叫价」拍得签位并点新秀卡签约成功 3 人（叫价 21 · 放弃 0 · 拍得 3 签）

### 4. [PASS] draft-pick — 第1签拍得后点卡片签约成功（5→6）

### 5. [PASS] draft-pick — 第2签拍得后点卡片签约成功（6→7）

### 6. [PASS] draft-pick — 第3签拍得后点卡片签约成功（7→8）

### 7. [PASS] boundary-fund — fund=5 时叫价按钮 disabled

### 8. [PASS] boundary-full — 满员时无「点名签约」可点入口（pickWrap=0 signBtn=0）

### 9. [PASS] overlap — 390×844 各页 .page-fab 与 荣誉/经营 nav 重叠面积均为 0

### 10. [PASS] overlap — 真实点击「经营」命中 nav 并进入 page-biz

## 复现

```bash
node .bug-hunt/draft-ui-focused.js
node .bug-hunt/probe-draft-order-heat.js
```

## 说明

- 主路径（自建队、叫价、点新秀卡、扫页、点经营）全部真实点击。
- fund 极低 / 大名单满 / 顺位夹具用 evaluate 写状态后，再走 UI 读数与点击验证。
- 过冷判定：玩家顺位靠后时「未放弃」≤2 即报 BUG；顺位靠前样本仅作对照。
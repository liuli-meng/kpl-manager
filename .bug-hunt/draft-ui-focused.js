/* 选秀大会 + 移动端 UI 专测（真实点击）
 * 范围：
 *  1) 经理自建队 → 叫价多轮拍得签位 → 新秀卡签约
 *  2) 第1~3签「未放弃」队数与成交价（过冷检测）
 *  3) fund 极低 → 叫价 disabled；大名单满 → 无可点「点名签约」
 *  4) 390×844 fab 与 nav 荣誉/经营 overlap=0，点经营命中 nav
 * 约束：不改 src/**，不 commit；evaluate 仅夹具与读数
 */
const fs = require('fs');
const path = require('path');
const { launch, clearAndStart, shot } = require('../tests/playthrough/pw.js');

const REPORT = path.join('E:\\sex\\kpl-manager\\.bug-hunt', 'draft-ui-subagent-report.md');
const findings = [];
const aliveSamples = []; // {slot,step,alive,passed,bid,leader}
const slotResults = [];  // 成交价 per slot
const bySlot = {};       // slot → {min,max,n}
let heatDetail = null;
let ovRows = [];

function finding(sev, area, title, detail) {
  findings.push({ sev, area, title, detail: detail || '' });
  console.log(`[${sev}] ${area} :: ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 400));
}

async function draftSnap(page) {
  return page.evaluate(() => {
    const d = (typeof S !== 'undefined' && S && S.draft) ? S.draft : null;
    const text = (document.getElementById('page-market') || {}).innerText || '';
    const btns = [...document.querySelectorAll('#page-market button')];
    const bidBtn = btns.find(b => (b.getAttribute('onclick') || '').includes('draftBidRaise'));
    const passBtn = btns.find(b => (b.getAttribute('onclick') || '').includes('draftBidPass'));
    const skipBtn = btns.find(b => (b.getAttribute('onclick') || '').includes('draftSkip'));
    const pickWraps = [...document.querySelectorAll('#page-market [onclick*="draftPick"]')];
    const signBtns = btns.filter(b => /点名签约/.test(b.textContent || ''));
    return {
      mode: S && S.mode,
      fund: S && Math.round(S.fund || 0),
      roster: S && S.players ? S.players.filter(p => !(p.kjia > 0)).length : null,
      rosterMax: typeof ROSTER_MAX !== 'undefined' ? ROSTER_MAX : null,
      draft: d ? {
        phase: d.phase, slot: d.slot, done: d.done, bid: d.bid, leader: d.leader,
        pool: (d.pool || []).length,
        picks: (d.picks || []).filter(x => x.playerId).length,
        orderLen: (d.order || []).length,
        orderIdx: (d.order || []).indexOf(S && S.teamName),
        passed: Object.keys(d.passed || {}),
        logTail: (d.log || []).slice(-6),
      } : null,
      hasBid: !!bidBtn,
      bidLabel: bidBtn ? (bidBtn.textContent || '').trim() : null,
      bidDisabled: bidBtn ? !!bidBtn.disabled : null,
      hasPass: !!passBtn,
      hasSkip: !!skipBtn,
      pickWrapCount: pickWraps.length,
      signBtnCount: signBtns.length,
      signBtnDisabled: signBtns.map(b => !!b.disabled),
      toast: (document.querySelector('#toast') || {}).textContent || '',
      alive: (() => { const m = /未放弃\s*(\d+)\s*队/.exec(text || ''); return m ? Number(m[1]) : null; })(),
      hintFull: /大名单已满/.test(text),
      hintNoPick: /不能点名|只能放弃/.test(text),
      hintPick: /轮到你点名/.test(text),
      textSlice: text.replace(/\n+/g, ' | ').slice(0, 420),
    };
  });
}

async function clickNav(page, dataPage) {
  const btn = page.locator(`#nav button[data-page="${dataPage}"]`);
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ timeout: 5000 });
  await page.waitForTimeout(150);
}

async function bootManager(page, teamName) {
  await clearAndStart(page);
  await page.evaluate(() => {
    document.querySelectorAll('.modal-bg.on').forEach(el => {
      if (el.id !== 'start-modal') el.classList.remove('on');
    });
    try { if (typeof ModalStack !== 'undefined' && ModalStack && ModalStack.clear) ModalStack.clear(); } catch (e) {}
  });
  await page.locator('#tab-self').click({ timeout: 5000 });
  await page.waitForTimeout(150);
  await page.locator('#new-team-name').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#new-team-name').fill(teamName);
  await page.locator('button:has-text("创建战队")').first().click({ timeout: 5000 });
  await page.waitForTimeout(700);
}

async function clickRaise(page) {
  const raise = page.locator('#page-market button[onclick*="draftBidRaise"]:not([disabled])');
  if (!(await raise.count())) return { ok: false, reason: 'no-enabled-raise' };
  const before = await draftSnap(page);
  await raise.first().click({ timeout: 3500 });
  await page.waitForTimeout(80);
  const after = await draftSnap(page);
  const moved = before.draft && after.draft && (
    before.draft.bid !== after.draft.bid ||
    before.draft.leader !== after.draft.leader ||
    before.draft.slot !== after.draft.slot ||
    before.draft.phase !== after.draft.phase
  );
  return { ok: true, moved, before, after };
}

async function clickPass(page) {
  const pass = page.locator('#page-market button[onclick*="draftBidPass"]');
  if (!(await pass.count())) return { ok: false };
  await pass.first().click({ timeout: 3500 });
  await page.waitForTimeout(80);
  return { ok: true, after: await draftSnap(page) };
}

async function clickPickCard(page) {
  const wrap = page.locator('#page-market [onclick*="draftPick"]').first();
  if (!(await wrap.count())) return { ok: false, reason: 'no-pick-wrap' };
  const before = await draftSnap(page);
  await wrap.click({ timeout: 4000 });
  await page.waitForTimeout(180);
  const after = await draftSnap(page);
  return {
    ok: true,
    beforeRoster: before.roster,
    afterRoster: after.roster,
    grew: after.roster > before.roster,
    beforePicks: before.draft && before.draft.picks,
    afterPicks: after.draft && after.draft.picks,
    toast: after.toast,
    after,
  };
}

function overlapRects(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return Math.round(x * y);
}

async function overlapProbe(page) {
  return page.evaluate(() => {
    const fab = document.getElementById('page-fab');
    const nav = document.getElementById('nav');
    if (!fab || !nav) return { missing: true };
    const fr = fab.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    const rectOf = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect() : null;
    };
    const biz = rectOf('#nav button[data-page="biz"]');
    const hall = rectOf('#nav button[data-page="hall"]');
    const ov = (a, b) => {
      if (!a || !b) return null;
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return Math.round(x * y);
    };
    const hitAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      return {
        id: el.id || '',
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 12),
        page: el.dataset && el.dataset.page,
        inNav: !!(el.closest && el.closest('#nav')),
        inFab: !!(el.closest && el.closest('#page-fab')),
      };
    };
    return {
      fab: { y: fr.y, h: fr.height, bottom: fr.bottom },
      navY: nr.y,
      overlapFabBiz: ov(fr, biz),
      overlapFabHall: ov(fr, hall),
      bizCenter: biz ? hitAt(biz.left + biz.width / 2, biz.top + biz.height / 2) : null,
      hallCenter: hall ? hitAt(hall.left + hall.width / 2, hall.top + hall.height / 2) : null,
    };
  });
}

(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => finding('BUG', 'pageerror', '运行期 pageerror', e && e.message));

  const summary = {
    raiseClicks: 0,
    passClicks: 0,
    pickClicks: 0,
    pickOk: 0,
    slotsWon: 0,
  };

  try {
    // ========== 1+2. 自建队 → 多轮叫价 → 拍得 → 点名签约；统计前3签热度 ==========
    await bootManager(page, '专测猎手');
    await clickNav(page, 'market');
    let s = await draftSnap(page);
    console.log('BOOT', JSON.stringify({ mode: s.mode, roster: s.roster, fund: s.fund, draft: s.draft }, null, 1));
    if (s.mode !== 'manager') finding('BUG', 'draft-boot', '自建队 mode 非 manager: ' + s.mode);
    if (!s.draft) finding('BUG', 'draft-boot', '创建战队后无 S.draft');

    // 前 3 签：尽量用叫价拍下，记录每步「未放弃」与成交价
    for (let slotTarget = 0; slotTarget < 3; slotTarget++) {
      let step = 0;
      let won = false;
      while (step < 40) {
        s = await draftSnap(page);
        if (!s.draft || s.draft.done) break;
        if (s.draft.slot > slotTarget) break; // 本签已结束

        if (s.draft.phase === 'auction') {
          // 采样热度（step=0 记 first-paint；之后记 auction）
          if (step === 0) {
            aliveSamples.push({
              slot: s.draft.slot,
              step: 0,
              phase: 'first-paint',
              alive: s.alive,
              passed: (s.draft.passed || []).length,
              bid: s.draft.bid,
              leader: s.draft.leader,
              fund: s.fund,
              bidDisabled: s.bidDisabled,
              orderIdx: s.draft.orderIdx,
              orderLen: s.draft.orderLen,
            });
          } else {
            aliveSamples.push({
              slot: s.draft.slot,
              step,
              phase: 'auction',
              alive: s.alive,
              passed: (s.draft.passed || []).length,
              bid: s.draft.bid,
              leader: s.draft.leader,
              fund: s.fund,
              bidDisabled: s.bidDisabled,
            });
          }

          if (s.hasBid && !s.bidDisabled) {
            const r = await clickRaise(page);
            summary.raiseClicks++;
            if (!r.ok) {
              // 按钮瞬间消失，改放弃
              await clickPass(page);
              summary.passClicks++;
            } else if (!r.moved) {
              // 被引擎拒绝（超 cap / 资金）→ 放弃本签
              const t = (r.after && r.after.toast) || '';
              if (t) finding('WARN', 'draft-raise', '点叫价后状态未变（被拒）', t);
              await clickPass(page);
              summary.passClicks++;
            } else if (r.after && r.after.draft && r.after.draft.phase === 'pick') {
              // 拍得了
              won = true;
              summary.slotsWon++;
              slotResults.push({
                slot: slotTarget,
                finalBid: r.after.draft.bid,
                leader: r.after.draft.leader,
                aliveAtWin: r.after.alive,
                via: 'raise',
              });
              break;
            }
          } else if (s.hasPass) {
            // 叫价 disabled 或没有叫价 → 若还是本队竞拍轮则放弃
            if (s.bidDisabled) {
              finding('WARN', 'draft-fund', `第${s.draft.slot + 1}签叫价按钮 disabled（fund=${s.fund}）`, s.bidLabel || '');
            }
            await clickPass(page);
            summary.passClicks++;
            // 若放弃后本签由 AI 落定并进入下一签
            const after = await draftSnap(page);
            if (after.draft && after.draft.slot > slotTarget) {
              slotResults.push({
                slot: slotTarget,
                finalBid: after.draft.bid,
                leader: after.draft.leader,
                aliveAtWin: after.alive,
                via: 'pass',
              });
              break;
            }
            if (after.draft && after.draft.phase === 'pick') {
              won = true;
              summary.slotsWon++;
              slotResults.push({
                slot: slotTarget,
                finalBid: after.draft.bid,
                leader: after.draft.leader,
                aliveAtWin: after.alive,
                via: 'pass-then-pick',
              });
              break;
            }
          } else {
            // 等待 AI
            await page.waitForTimeout(200);
          }
        } else if (s.draft.phase === 'pick') {
          won = true;
          summary.slotsWon++;
          slotResults.push({
            slot: slotTarget,
            finalBid: s.draft.bid,
            leader: s.draft.leader,
            aliveAtWin: s.alive,
            via: 'already-pick',
          });
          break;
        } else {
          break;
        }
        step++;
      }

      // 点名阶段：真实点新秀卡签约
      s = await draftSnap(page);
      if (s.draft && s.draft.phase === 'pick' && !s.draft.done) {
        const pick = await clickPickCard(page);
        summary.pickClicks++;
        if (pick.ok && pick.grew) {
          summary.pickOk++;
          finding('PASS', 'draft-pick', `第${slotTarget + 1}签拍得后点卡片签约成功（${pick.beforeRoster}→${pick.afterRoster}）`, pick.toast || '');
        } else if (pick.ok) {
          finding('BUG', 'draft-pick', `第${slotTarget + 1}签点卡片未入队`, JSON.stringify({ before: pick.beforeRoster, after: pick.afterRoster, toast: pick.toast }));
        } else {
          finding('BUG', 'draft-pick', `第${slotTarget + 1}签拍得但无点名卡片`, pick.reason);
        }
      } else if (won) {
        finding('WARN', 'draft-pick', `第${slotTarget + 1}签拍得但未进入 pick 阶段`, JSON.stringify(s.draft));
      }
    }

    // 主路径结论
    if (summary.pickOk >= 1) {
      finding('PASS', 'draft-pick', `真实点「叫价」拍得签位并点新秀卡签约成功 ${summary.pickOk} 人（叫价 ${summary.raiseClicks} · 放弃 ${summary.passClicks} · 拍得 ${summary.slotsWon} 签）`);
    } else {
      finding('BUG', 'draft-pick', '未能通过真实点击完成「叫价拍得 → 新秀卡签约」', JSON.stringify(summary));
    }

    // ========== 2. 竞争热度：前 3 签「未放弃」与成交价 ==========
    const aliveVals = aliveSamples.map(x => x.alive).filter(x => x != null);
    for (const smp of aliveSamples) {
      const k = smp.slot;
      bySlot[k] = bySlot[k] || { min: 99, max: -1, n: 0, bids: [] };
      if (smp.alive != null) {
        bySlot[k].min = Math.min(bySlot[k].min, smp.alive);
        bySlot[k].max = Math.max(bySlot[k].max, smp.alive);
        bySlot[k].n++;
      }
      bySlot[k].bids.push(smp.bid);
    }
    const coldSamples = aliveVals.filter(v => v <= 2).length;
    const coldSlots = Object.keys(bySlot).filter(k => bySlot[k].min <= 2);
    const uniqueAlive = [...new Set(aliveVals)].sort((a, b) => a - b);
    const aliveAvg = aliveVals.length ? aliveVals.reduce((a, b) => a + b, 0) / aliveVals.length : null;

    // 「长期只剩 1~2 队」= 过冷：若前 3 签在玩家可操作样本中绝大多数 alive≤2
    const coldRatio = aliveVals.length ? coldSamples / aliveVals.length : 0;
    // 首屏（slot 刚开）与竞拍中分别看
    const firstPaint = aliveSamples.filter(x => x.phase === 'first-paint');
    const firstAlive = firstPaint.map(x => x.alive).filter(x => x != null);
    const auctionAlive = aliveSamples.filter(x => x.phase === 'auction').map(x => x.alive).filter(x => x != null);
    const heatDetail = {
      uniqueAlive,
      aliveAvg,
      coldSamples,
      coldRatio,
      firstPaintAlive: firstAlive,
      auctionAliveUnique: [...new Set(auctionAlive)].sort((a, b) => a - b),
      slotMinRows: Object.entries(bySlot).map(([k, v]) => ({ slot: Number(k) + 1, min: v.min, max: v.max, n: v.n })),
      slotResults,
    };
    if (aliveVals.length && coldRatio >= 0.5) {
      finding('BUG', 'draft-heat', `竞拍过冷：${coldSamples}/${aliveVals.length} 次「未放弃」≤2，前3签玩家可操作时长期只剩 1~2 队`,
        JSON.stringify(heatDetail));
    } else if (aliveVals.length && coldSamples > 0) {
      finding('WARN', 'draft-heat', `竞拍偏冷：${coldSamples}/${aliveVals.length} 次未放弃≤2，均值 ${aliveAvg && aliveAvg.toFixed(2)}`,
        JSON.stringify(heatDetail));
    } else if (aliveVals.length) {
      finding('PASS', 'draft-heat', `竞拍未过冷：未放弃均值 ${aliveAvg.toFixed(2)}，范围 ${Math.min(...aliveVals)}~${Math.max(...aliveVals)}，样本 ${aliveVals.length}（前3签）`,
        JSON.stringify(heatDetail));
    } else {
      finding('WARN', 'draft-heat', '「未放弃」样本不足');
    }
    // 暴露给报告
    global.__heatDetail = heatDetail;

    // 成交价表
    if (slotResults.length) {
      const overpriced = slotResults.filter(r => r.finalBid > 400);
      if (overpriced.length) finding('WARN', 'draft-heat', '成交价异常偏高', JSON.stringify(overpriced));
    }

    // ========== 3a. fund 极低 → 叫价 disabled ==========
    await bootManager(page, '穷鬼猎手');
    await clickNav(page, 'market');
    // 夹具：把 fund 压到极低并强制 auction
    await page.evaluate(() => {
      S.fund = 5;
      if (!S.draft) initDraft(S, true);
      if (S.draft.done) {
        S.draft.done = false;
        S.draft.phase = 'auction';
        S.draft.slot = 0;
        S.draft.passed = {};
        S.draft.leader = null;
        S.draft.bid = 60;
      }
      // 确保在 auction 且未放弃
      delete S.draft.passed[S.teamName];
      S.draft.phase = 'auction';
      renderAll();
    });
    await page.waitForTimeout(200);
    s = await draftSnap(page);
    console.log('LOW_FUND', JSON.stringify({ fund: s.fund, hasBid: s.hasBid, bidDisabled: s.bidDisabled, bidLabel: s.bidLabel, draft: s.draft }, null, 1));
    if (s.fund <= 20) {
      if (s.hasBid && s.bidDisabled) {
        finding('PASS', 'boundary-fund', `fund=${s.fund} 时叫价按钮 disabled`, s.bidLabel || '');
      } else if (!s.hasBid) {
        finding('PASS', 'boundary-fund', `fund=${s.fund} 时不渲染叫价按钮（等价 disabled）`, s.textSlice || '');
      } else {
        // 再真实点一下确认被拒
        const r = await clickRaise(page);
        const toast = (r.after && r.after.toast) || (r.before && r.before.toast) || '';
        if (r.ok && !r.moved && toast) {
          finding('PASS', 'boundary-fund', `fund=${s.fund} 叫价按钮未 disabled 但点击被拒`, toast);
        } else if (r.ok && r.moved) {
          finding('BUG', 'boundary-fund', `fund=${s.fund} 仍能叫价成功`, JSON.stringify({ before: r.before && r.before.draft, after: r.after && r.after.draft }));
        } else {
          finding('BUG', 'boundary-fund', `fund=${s.fund} 叫价按钮既未 disabled 也无法拒绝`, JSON.stringify({ bidDisabled: s.bidDisabled, toast }));
        }
      }
    } else {
      finding('WARN', 'boundary-fund', '未能把 fund 压到极低', 'fund=' + s.fund);
    }

    // ========== 3b. 大名单满 → 不应出现可点「点名签约」 ==========
    await page.evaluate(() => {
      // 造满员：塞到 ROSTER_MAX
      const max = (typeof ROSTER_MAX !== 'undefined') ? ROSTER_MAX : 10;
      let guard = 0;
      while ((S.players || []).filter(p => !(p.kjia > 0)).length < max && guard++ < 40) {
        const pos = POS_ORDER[(S.players.length + guard) % POS_ORDER.length];
        const def = PLAYER_POOL.find(x => x.pos === pos && !S.players.some(y => y.id === x.id));
        if (!def) break;
        try { S.players.push(genPlayer(def)); } catch (e) { break; }
      }
      // 强制进入本人 pick 轮（夹具，后续用 UI 验证）
      S.draft = S.draft || initDraft(S, true);
      S.draft.done = false;
      S.draft.phase = 'pick';
      S.draft.slot = Math.max(0, S.draft.slot || 0);
      renderAll();
    });
    await page.waitForTimeout(250);
    s = await draftSnap(page);
    console.log('FULL', JSON.stringify({
      roster: s.roster, rosterMax: s.rosterMax,
      pickWrapCount: s.pickWrapCount, signBtnCount: s.signBtnCount,
      hintFull: s.hintFull, hintNoPick: s.hintNoPick,
      textSlice: s.textSlice,
    }, null, 1));

    const fullOk = s.roster != null && s.rosterMax != null && s.roster >= s.rosterMax;
    if (!fullOk) {
      finding('WARN', 'boundary-full', '未能造出大名单满员', `roster=${s.roster}/${s.rosterMax}`);
    } else {
      if (s.pickWrapCount === 0 && s.signBtnCount === 0) {
        finding('PASS', 'boundary-full', '满员时无「点名签约」可点入口', `pickWrap=0 signBtn=0 hintFull=${s.hintFull}`);
      } else if (s.signBtnCount > 0) {
        // 检查按钮是否 disabled
        const anyEnabled = s.signBtnDisabled.some(x => !x);
        if (anyEnabled) {
          // 尝试真实点一下
          const pick = await clickPickCard(page);
          if (pick.ok && pick.grew) {
            finding('BUG', 'boundary-full', '满员仍出现可点「点名签约」且点进队', JSON.stringify({ pickWrap: s.pickWrapCount, signBtn: s.signBtnCount, toast: pick.toast }));
          } else {
            finding('WARN', 'boundary-full', `满员仍渲染可点「点名签约」卡片（${s.signBtnCount} 个，依赖 rosterGuard 拦）`, `pickWrap=${s.pickWrapCount} toast=${pick.toast || ''}`);
          }
        } else {
          finding('PASS', 'boundary-full', '满员「点名签约」按钮均 disabled', `signBtn=${s.signBtnCount}`);
        }
      } else {
        finding('WARN', 'boundary-full', '满员仍渲染 draftPick 可点卡片（无按钮但有 onclick 包裹）', `pickWrap=${s.pickWrapCount}`);
      }
    }

    // ========== 4. 390×844 fab / nav ==========
    await bootManager(page, '移动猎手');
    const pages = ['club', 'lineup', 'market', 'train', 'league', 'hall', 'biz'];
    ovRows = [];
    for (const p of pages) {
      await clickNav(page, p);
      const o = await overlapProbe(page);
      ovRows.push({ p, ovBiz: o.overlapFabBiz, ovHall: o.overlapFabHall, fabY: o.fab && o.fab.y, navY: o.navY });
      if (o.overlapFabBiz !== 0 || o.overlapFabHall !== 0) {
        finding('BUG', 'overlap', `390×844 ${p} 页 fab 与 nav 重叠`, JSON.stringify(o));
      }
    }
    const anyOv = ovRows.some(r => (r.ovBiz || 0) > 0 || (r.ovHall || 0) > 0);
    if (!anyOv) {
      finding('PASS', 'overlap', '390×844 各页 .page-fab 与 荣誉/经营 nav 重叠面积均为 0', JSON.stringify(ovRows));
    }

    // 真实点「经营」应命中 nav
    await clickNav(page, 'club');
    const bizBtn = page.locator('#nav button[data-page="biz"]');
    await bizBtn.scrollIntoViewIfNeeded().catch(() => {});
    await bizBtn.click({ timeout: 4000 });
    await page.waitForTimeout(200);
    const hit = await page.evaluate(() => {
      const el = document.querySelector('#nav button[data-page="biz"]');
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        activePage: [...document.querySelectorAll('.page.on')].map(x => x.id),
        hitTag: top && top.tagName,
        hitPage: top && top.dataset && top.dataset.page,
        inNav: !!(top && top.closest && top.closest('#nav')),
        inFab: !!(top && top.closest && top.closest('#page-fab')),
        text: top && (top.textContent || '').trim().slice(0, 10),
      };
    });
    if (hit.inNav && !hit.inFab && hit.hitPage === 'biz') {
      finding('PASS', 'overlap', '真实点击「经营」命中 nav 并进入 page-biz', JSON.stringify(hit));
    } else if ((hit.activePage || []).includes('page-biz')) {
      finding('PASS', 'overlap', '点击「经营」后进入 page-biz（命中检测：' + JSON.stringify(hit) + ')');
    } else {
      finding('BUG', 'overlap', '点击「经营」未命中 nav / 未进入 page-biz', JSON.stringify(hit));
    }

    await shot(page, 'draft-ui-focused-final');
  } catch (e) {
    finding('BUG', 'harness', '测试执行异常', e && e.stack || String(e));
  } finally {
    await browser.close().catch(() => {});
  }

  // ===== 写报告 =====
  const bugs = findings.filter(f => f.sev === 'BUG');
  const warns = findings.filter(f => f.sev === 'WARN');
  const passes = findings.filter(f => f.sev === 'PASS');

  const md = [];
  md.push('# 选秀大会 + 移动端 UI 专测报告（真实点击）');
  md.push('');
  md.push(`- 时间：${new Date().toISOString()}`);
  md.push('- 入口：`http://127.0.0.1:8931/game.html`');
  md.push('- 视口：390×844');
  md.push('- 方法：Playwright 真实 `fill / click`；evaluate 仅做状态夹具与读数');
  md.push('- 约束：未改 `src/**`，未 commit');
  md.push('');
  md.push('## 结论总览');
  md.push('');
  md.push('| 级别 | 数量 |');
  md.push('|---|---|');
  md.push(`| BUG | ${bugs.length} |`);
  md.push(`| WARN | ${warns.length} |`);
  md.push(`| PASS | ${passes.length} |`);
  md.push('');
  md.push('## 1. 经理自建队 → 叫价拍得 → 新秀卡签约');
  md.push('');
  md.push('```json');
  md.push(JSON.stringify(summary, null, 2));
  md.push('```');
  md.push('');
  md.push('### 前 3 签成交');
  md.push('');
  md.push('| slot | 成交价 | 得主 | 未放弃@成交 | 路径 |');
  md.push('|---|---|---|---|---|');
  for (const r of slotResults) {
    md.push(`| ${r.slot + 1} | ${r.finalBid}万 | ${r.leader || '—'} | ${r.aliveAtWin != null ? r.aliveAtWin : '—'} | ${r.via} |`);
  }
  if (!slotResults.length) md.push('| — | — | — | — | — |');
  md.push('');
  md.push('### 「未放弃 N 队」采样（前 3 签竞拍中）');
  md.push('');
  md.push('| step | slot | alive | passed | bid | leader | fund | bidDisabled |');
  md.push('|---|---|---|---|---|---|---|---|');
  for (const a of aliveSamples.slice(0, 80)) {
    md.push(`| ${a.step} | ${a.slot} | ${a.alive != null ? a.alive : '—'} | ${a.passed} | ${a.bid} | ${a.leader || ''} | ${a.fund} | ${a.bidDisabled} |`);
  }
  md.push('');
  md.push('## 2. 竞争热度（过冷判定：长期只剩 1~2 队）');
  md.push('');
  md.push('```json');
  md.push(JSON.stringify(global.__heatDetail || { bySlot, slotResults }, null, 2));
  md.push('```');
  md.push('');
  md.push('## 3. 边界：fund 极低 / 大名单满');
  md.push('');
  md.push('## 4. 移动端 390×844 FAB / nav');
  md.push('');
  md.push('| page | ovBiz | ovHall | fab.y | nav.y |');
  md.push('|---|---|---|---|---|');
  for (const r of ovRows) {
    md.push(`| ${r.p} | ${r.ovBiz} | ${r.ovHall} | ${r.fabY} | ${r.navY} |`);
  }
  md.push('');
  md.push('## Findings');
  md.push('');
  let idx = 1;
  for (const f of findings) {
    md.push(`### ${idx}. [${f.sev}] ${f.area} — ${f.title}`);
    md.push('');
    if (f.detail) {
      md.push('```');
      md.push(String(f.detail).slice(0, 1200));
      md.push('```');
    }
    md.push('');
    idx++;
  }
  md.push('## 复现');
  md.push('');
  md.push('```bash');
  md.push('node .bug-hunt/draft-ui-focused.js');
  md.push('```');
  md.push('');
  md.push('## 说明');
  md.push('');
  md.push('- 主路径（自建队、叫价、放弃、点新秀卡、扫页、点经营）全部真实点击。');
  md.push('- fund 极低 / 大名单满 / 强制 pick 轮用 evaluate 做夹具后，再走 UI 读数与点击验证。');
  md.push('- 过冷判定：前 3 签「未放弃」样本中 ≥50% 出现 ≤2 队则报 BUG。');
  md.push('');

  fs.writeFileSync(REPORT, md.join('\n'), 'utf8');
  console.log('REPORT', REPORT);
  console.log('COUNTS', JSON.stringify({ bug: bugs.length, warn: warns.length, pass: passes.length }));
})().catch(e => {
  console.error('FATAL', e);
  process.exit(1);
});

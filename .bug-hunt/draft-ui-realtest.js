/* 选秀大会 + 移动端 FAB/nav 重叠 —— 真实点击回归
 * 运行：node .bug-hunt/draft-ui-realtest.js
 * 原则：进 UI 路径尽量 page.click / fill；evaluate 只做状态夹具与读数，不硬调 draftBidRaise/draftPick 引擎。
 */
const fs = require('fs');
const path = require('path');
const { launch, clearAndStart, shot } = require('../tests/playthrough/pw.js');

const REPORT = path.join('E:\\sex\\kpl-manager\\.bug-hunt', 'draft-ui-subagent-report.md');
const findings = [];
const pageErrors = [];
const dirtyHits = [];
const aliveSamples = [];

function finding(sev, area, title, detail) {
  findings.push({ sev, area, title, detail });
  console.log(`[${sev}] ${area} :: ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 360));
}

async function draftSnap(page) {
  return page.evaluate(() => {
    const d = (typeof S !== 'undefined' && S && S.draft) ? S.draft : null;
    const text = (document.getElementById('page-market') || {}).innerText || '';
    const bidBtn = [...document.querySelectorAll('#page-market button')].find(b => (b.getAttribute('onclick') || '').includes('draftBidRaise'));
    const passBtn = [...document.querySelectorAll('#page-market button')].find(b => (b.getAttribute('onclick') || '').includes('draftBidPass'));
    const skipBtn = [...document.querySelectorAll('#page-market button')].find(b => (b.getAttribute('onclick') || '').includes('draftSkip'));
    const pickWraps = [...document.querySelectorAll('#page-market [onclick*="draftPick"]')];
    const blockedCards = [...document.querySelectorAll('#page-market .pcard')].filter(c => /本队青训|不可选/.test(c.textContent || ''));
    return {
      mode: S && S.mode,
      preseason: S && S.preseason,
      transferWindow: S && S.transferWindow,
      fund: S && S.fund,
      roster: S && S.players ? S.players.filter(p => !(p.kjia > 0)).length : null,
      draft: d ? {
        phase: d.phase, slot: d.slot, done: d.done, bid: d.bid, leader: d.leader,
        pool: (d.pool || []).length,
        picks: (d.picks || []).filter(x => x.playerId).length,
        orderLen: (d.order || []).length,
        passedCount: Object.keys(d.passed || {}).length,
        passed: d.passed,
      } : null,
      hasBid: !!bidBtn,
      bidLabel: bidBtn ? (bidBtn.textContent || '').trim() : null,
      hasPass: !!passBtn,
      hasSkip: !!skipBtn,
      pickWrapCount: pickWraps.length,
      pickSample: pickWraps.slice(0, 3).map(el => el.getAttribute('onclick')),
      blockedCardCount: blockedCards.length,
      toast: (document.querySelector('#toast') || {}).textContent || '',
      hintFull: /大名单已满/.test(text),
      hintYouth: /本队青训|不可选|自家青训/.test(text),
      hintPick: /轮到你点名/.test(text),
      hintBudget: /签位预算上限/.test(text),
      alive: (() => { const m = /未放弃\s*(\d+)\s*队/.exec(text || ''); return m ? Number(m[1]) : null; })(),
      textSlice: text.replace(/\n+/g, ' | ').slice(0, 500),
    };
  });
}

async function clickNav(page, dataPage) {
  const btn = page.locator(`#nav button[data-page="${dataPage}"]`);
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ timeout: 4000 });
  await page.waitForTimeout(120);
}

async function clickBidOrPass(page) {
  const raise = page.locator('#page-market button[onclick*="draftBidRaise"]');
  const pass = page.locator('#page-market button[onclick*="draftBidPass"]');
  if (await raise.count()) {
    const before = await draftSnap(page);
    await raise.first().click({ timeout: 3000 });
    await page.waitForTimeout(60);
    const after = await draftSnap(page);
    // 点了叫价但状态没动 = 超 cap 被拒；下一轮应改点放弃
    const unchanged = before.draft && after.draft &&
      before.draft.bid === after.draft.bid &&
      before.draft.leader === after.draft.leader &&
      before.draft.slot === after.draft.slot &&
      before.draft.phase === after.draft.phase;
    return { act: 'raise', unchanged, before, after };
  }
  if (await pass.count()) {
    await pass.first().click({ timeout: 3000 });
    await page.waitForTimeout(60);
    return { act: 'pass' };
  }
  return { act: 'none' };
}

async function clickFirstPickCard(page) {
  const wrap = page.locator('#page-market [onclick*="draftPick"]').first();
  if (!(await wrap.count())) return { ok: false, reason: 'no-wrap' };
  const before = await draftSnap(page);
  const onclick = await wrap.getAttribute('onclick').catch(() => null);
  await wrap.click({ timeout: 4000 });
  await page.waitForTimeout(150);
  const after = await draftSnap(page);
  return {
    ok: true,
    onclick,
    beforeRoster: before.roster,
    afterRoster: after.roster,
    beforePool: before.draft && before.draft.pool,
    afterPool: after.draft && after.draft.pool,
    beforePicks: before.draft && before.draft.picks,
    afterPicks: after.draft && after.draft.picks,
    toast: after.toast,
  };
}

async function scanDirty(page, tag) {
  const hits = await page.evaluate(() => {
    const out = [];
    const re = /(^|[^\w.])(undefined|NaN)(?![\w])/g;
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
    const walk = (root) => {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          let p = n.parentElement;
          while (p) {
            if (skipTags.has(p.tagName)) return NodeFilter.FILTER_REJECT;
            if (p.id === 'toast') return NodeFilter.FILTER_REJECT; // toast 可能残留调试串
            p = p.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let n;
      while ((n = tw.nextNode())) {
        const t = n.nodeValue || '';
        if (re.test(t)) {
          re.lastIndex = 0;
          const parent = n.parentElement;
          out.push({
            text: t.trim().slice(0, 100),
            where: (parent && (parent.id || parent.className || parent.tagName)) || '',
          });
        }
        re.lastIndex = 0;
      }
    };
    walk(document.body);
    return out;
  });
  if (hits.length) {
    dirtyHits.push({ tag, hits });
    finding('BUG', 'dirty-text', `可见文本出现脏数据 undefined|NaN @ ${tag}`, JSON.stringify(hits.slice(0, 6)));
  }
  return hits;
}

async function overlapProbe(page) {
  return page.evaluate(() => {
    const fab = document.getElementById('page-fab');
    const nav = document.getElementById('nav');
    if (!fab || !nav) return { missing: true, hasFab: !!fab, hasNav: !!nav };
    const fr = fab.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    const rectOf = (sel) => {
      const el = document.querySelector(sel);
      return el ? { r: el.getBoundingClientRect(), label: el.textContent.trim().slice(0, 8) } : null;
    };
    const biz = rectOf('#nav button[data-page="biz"]');
    const hall = rectOf('#nav button[data-page="hall"]');
    const overlap = (a, b) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return Math.round(x * y);
    };
    const hitAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      return {
        id: el.id || '',
        cls: (el.className && String(el.className).slice(0, 40)) || '',
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 10),
        page: el.dataset && el.dataset.page,
        inNav: !!(el.closest && el.closest('#nav')),
        inFab: !!(el.closest && el.closest('#page-fab')),
      };
    };
    return {
      fab: { x: fr.x, y: fr.y, w: fr.width, h: fr.height, bottom: fr.bottom },
      nav: { y: nr.y, h: nr.height, bottom: nr.bottom },
      biz: biz ? { x: biz.r.x, y: biz.r.y, w: biz.r.width, h: biz.r.height, bottom: biz.r.bottom, label: biz.label } : null,
      hall: hall ? { x: hall.r.x, y: hall.r.y, w: hall.r.width, h: hall.r.height, bottom: hall.r.bottom, label: hall.label } : null,
      overlapFabBiz: biz ? overlap(fr, biz.r) : null,
      overlapFabHall: hall ? overlap(fr, hall.r) : null,
      overlapFabNav: overlap(fr, nr),
      fabCenterHits: hitAt(fr.left + fr.width / 2, fr.top + fr.height / 2),
      bizCenterHits: biz ? hitAt(biz.r.left + biz.r.width / 2, biz.r.top + biz.r.height / 2) : null,
      hallCenterHits: hall ? hitAt(hall.r.left + hall.r.width / 2, hall.r.top + hall.r.height / 2) : null,
      fabBottomCSS: getComputedStyle(fab).bottom,
    };
  });
}

async function bootTeam(page, teamName) {
  await clearAndStart(page);
  await page.evaluate(() => {
    document.querySelectorAll('.modal-bg.on').forEach(el => {
      if (el.id !== 'start-modal') el.classList.remove('on');
    });
    try { if (typeof ModalStack !== 'undefined' && ModalStack && ModalStack.clear) ModalStack.clear(); } catch (e) {}
  });
  await page.locator('#tab-self').click({ timeout: 5000 });
  await page.waitForTimeout(120);
  await page.locator('#new-team-name').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#new-team-name').fill(teamName);
  await page.locator('button:has-text("创建战队")').first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
}

/* ================= 主测试 ================= */
(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => {
    pageErrors.push(String(e && e.message || e));
    finding('BUG', 'pageerror', '运行期 pageerror', e && e.message);
  });

  try {
    // ========== A. 连续多场叫价 → 点名签约（转会期选秀） ==========
    await bootTeam(page, '点射测猎');
    await clickNav(page, 'market');

    let s = await draftSnap(page);
    console.log('BOOT', JSON.stringify({ mode: s.mode, roster: s.roster, draft: s.draft }, null, 1));
    if (!s.draft) finding('BUG', 'draft-boot', 'createTeam 后无 S.draft', JSON.stringify(s));
    if (s.mode !== 'manager') finding('BUG', 'draft-boot', '自建队 mode 非 manager: ' + s.mode);

    const rounds = [];
    let pickClicks = 0, pickOk = 0, raiseClicks = 0, passClicks = 0, rejectRaises = 0;

    for (let step = 0; step < 160; step++) {
      s = await draftSnap(page);
      if (!s.draft) { finding('BUG', 'draft-loop', 'draft 消失', 'step=' + step); break; }
      const d = s.draft;
      if (d.done) {
        rounds.push({ step, event: 'done', slot: d.slot, picks: d.picks, pool: d.pool });
        break;
      }

      if (d.phase === 'auction') {
        if (s.alive != null) {
          aliveSamples.push({
            step, slot: d.slot, alive: s.alive,
            passedCount: d.passedCount,
            bid: d.bid, leader: d.leader, roster: s.roster,
            hasBid: s.hasBid,
          });
        }
        if (s.hasBid || s.hasPass) {
          // 超 cap 时改点放弃，保证能收敛
          const r = await clickBidOrPass(page);
          if (r.act === 'raise') {
            raiseClicks++;
            if (r.unchanged) {
              rejectRaises++;
              if (s.hasPass) {
                await page.locator('#page-market button[onclick*="draftBidPass"]').first().click({ timeout: 3000 });
                passClicks++;
                rounds.push({ step, event: 'raise-reject-then-pass', slot: d.slot, bid: d.bid, alive: s.alive, toast: r.after && r.after.toast });
              } else {
                rounds.push({ step, event: 'raise-reject', slot: d.slot, toast: r.after && r.after.toast });
              }
            } else {
              rounds.push({
                step, event: 'raise', slot: d.slot,
                bidBefore: r.before.draft && r.before.draft.bid,
                bidAfter: r.after.draft && r.after.draft.bid,
                leader: r.after.draft && r.after.draft.leader,
                aliveBefore: r.before.alive, aliveAfter: r.after.alive,
                passedAfter: r.after.draft && r.after.draft.passedCount,
                phaseAfter: r.after.draft && r.after.draft.phase,
              });
            }
          } else if (r.act === 'pass') {
            passClicks++;
            rounds.push({ step, event: 'pass', slot: d.slot });
          }
          await page.waitForTimeout(50);
        } else {
          rounds.push({ step, event: 'wait-ai', slot: d.slot, alive: s.alive, passed: d.passedCount, slice: s.textSlice.slice(0, 100) });
          await page.waitForTimeout(100);
          if (step % 10 === 9) await page.evaluate(() => { try { renderAll(); } catch (e) {} });
        }
        continue;
      }

      if (d.phase === 'pick') {
        rounds.push({
          step, event: 'pick-phase', slot: d.slot, pool: d.pool,
          pickWraps: s.pickWrapCount, hintPick: s.hintPick, hintFull: s.hintFull,
          blockedCards: s.blockedCardCount,
        });
        if (s.pickWrapCount > 0) {
          const r = await clickFirstPickCard(page);
          pickClicks++;
          if (r.ok && r.afterRoster > r.beforeRoster) pickOk++;
          rounds.push({ step, event: 'pick-click', result: r });
          await page.waitForTimeout(80);
        } else if (s.hasSkip) {
          await page.locator('#page-market button[onclick*="draftSkip"]').first().click({ timeout: 3000 });
          rounds.push({ step, event: 'skip', slot: d.slot });
          await page.waitForTimeout(80);
        } else {
          rounds.push({ step, event: 'stuck-pick', slice: s.textSlice.slice(0, 180) });
          await page.waitForTimeout(120);
        }
        continue;
      }
      break;
    }

    const aliveVals = aliveSamples.map(a => a.alive).filter(x => x != null);
    const passedVals = aliveSamples.map(a => a.passedCount).filter(x => x != null);
    const aliveAvg = aliveVals.length ? aliveVals.reduce((a, b) => a + b, 0) / aliveVals.length : null;
    const aliveCold = aliveVals.filter(x => x <= 2).length;
    const aliveMid = aliveVals.filter(x => x >= 3 && x <= 6).length;
    const uniqueAlive = [...new Set(aliveVals)].sort((a, b) => a - b);
    const uniquePassed = [...new Set(passedVals)].sort((a, b) => a - b);

    console.log('DRAFT_LOOP_SUMMARY', JSON.stringify({
      raiseClicks, passClicks, rejectRaises, pickClicks, pickOk,
      rounds: rounds.length,
      aliveN: aliveVals.length,
      aliveAvg: aliveAvg && Number(aliveAvg.toFixed(2)),
      aliveCold, aliveMid, uniqueAlive, uniquePassed,
      lastRound: rounds[rounds.length - 1],
    }, null, 1));

    if (pickClicks === 0) {
      finding('BUG', 'draft-pick', '未能通过 UI 点击进入点名签约', 'raise=' + raiseClicks + ' pass=' + passClicks);
    } else if (pickOk < pickClicks) {
      finding('BUG', 'draft-pick', `点卡片未入队 ${pickClicks - pickOk}/${pickClicks}`, JSON.stringify(rounds.filter(r => r.event === 'pick-click').slice(-3)));
    } else {
      finding('PASS', 'draft-pick', `真实点击签约成功 ${pickOk} 人（点击 ${pickClicks} 次 · 叫价 ${raiseClicks} · 放弃 ${passClicks}）`);
    }

    // 竞争热度：观察「未放弃」是否长期 1~2
    if (aliveVals.length >= 4) {
      // 按 slot 分组看每个签位内的未放弃变化
      const bySlot = {};
      aliveSamples.forEach(a => {
        (bySlot[a.slot] = bySlot[a.slot] || []).push(a.alive);
      });
      const slotMins = Object.keys(bySlot).map(k => ({
        slot: Number(k), min: Math.min(...bySlot[k]), max: Math.max(...bySlot[k]), n: bySlot[k].length,
      }));
      const mins = slotMins.map(x => x.min);
      const everCold = slotMins.filter(x => x.min <= 2);
      if (everCold.length >= Math.ceil(slotMins.length * 0.5) && (aliveAvg == null || aliveAvg <= 3)) {
        finding('BUG', 'draft-heat', `竞拍过冷：过半签位「未放弃」最低≤2`, JSON.stringify({ aliveAvg, slotMins }));
      } else if (aliveCold / aliveVals.length > 0.5) {
        finding('WARN', 'draft-heat', `竞拍偏冷：${aliveCold}/${aliveVals.length} 次未放弃≤2，均值 ${aliveAvg}`, JSON.stringify({ uniqueAlive, slotMins }));
      } else {
        finding('PASS', 'draft-heat',
          `竞拍热度正常：未放弃均值 ${aliveAvg && aliveAvg.toFixed(2)}，范围 ${Math.min(...aliveVals)}~${Math.max(...aliveVals)}，样本 ${aliveVals.length}`,
          JSON.stringify({ uniqueAlive, uniquePassed, slotMins: slotMins.slice(0, 12) }));
      }
    } else {
      finding('WARN', 'draft-heat', '「未放弃」样本不足', JSON.stringify(aliveSamples.slice(0, 8)));
    }

    // ========== B. 边界：大名单 10/10（必须在选秀进行中测） ==========
    await bootTeam(page, '满员边界');
    await clickNav(page, 'market');
    s = await draftSnap(page);
    if (!s.draft || s.draft.done) {
      finding('WARN', 'boundary-full', '满员场景开局 draft 不可用', JSON.stringify(s.draft));
    } else {
      // 夹具：名单补到 10，保持 auction/pick 进行中
      await page.evaluate(() => {
        const s = S;
        let i = 0;
        while ((s.players || []).filter(p => !(p.kjia > 0)).length < 10 && i < 20) {
          const pos = POS_ORDER[i % POS_ORDER.length];
          s.players.push(genPlayer({
            id: 'fill_' + i + '_' + Math.random().toString(36).slice(2, 5),
            name: '补位' + i, pos, team: s.teamName,
            base: [70, 70, 70, 70], skill: { n: '补位', t: 'lane', d: 'test' },
            sig: 'x', career: 't', age0: 20, ageFrom: s.season || 1,
          }));
          i++;
        }
        try { save(); renderAll(); } catch (e) {}
      });
      await page.waitForTimeout(150);
      await clickNav(page, 'market');
      s = await draftSnap(page);
      console.log('FULL_AUCTION', JSON.stringify({
        roster: s.roster, phase: s.draft && s.draft.phase,
        hasBid: s.hasBid, hasPass: s.hasPass, hintFull: s.hintFull,
        pickWraps: s.pickWrapCount, toast: s.toast, slice: s.textSlice.slice(0, 220),
      }, null, 1));

      if (s.hintFull || /大名单已满/.test(s.textSlice)) {
        finding('PASS', 'boundary-full', '竞拍中满员有「大名单已满」明确提示', s.textSlice.match(/大名单已满[^\n|]*/g));
      } else {
        finding('BUG', 'boundary-full', '竞拍中 10/10 无「大名单已满」提示', s.textSlice);
      }
      if (s.hasBid) {
        finding('WARN', 'boundary-full', '满员竞拍阶段仍渲染「叫价」按钮', s.bidLabel);
        const beforeLeader = await page.evaluate(() => S.draft && S.draft.leader);
        await page.locator('#page-market button[onclick*="draftBidRaise"]').first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(100);
        const after = await draftSnap(page);
        const rejected = /大名单已满|无法再拍/.test(after.toast);
        const becameLeader = after.draft && after.draft.leader === (await page.evaluate(() => S.teamName));
        if (becameLeader && !rejected) {
          finding('BUG', 'boundary-full', '满员仍能叫价成功', JSON.stringify({ beforeLeader, after: after.draft, toast: after.toast }));
        } else {
          finding('PASS', 'boundary-full', '满员点叫价被拒', after.toast || 'no-toast-but-not-leader');
        }
      } else {
        finding('PASS', 'boundary-full', '满员不渲染叫价按钮');
      }

      // 强制进点名阶段，检查卡片与点击
      await page.evaluate(() => {
        if (S.draft && !S.draft.done) {
          S.draft.phase = 'pick';
          S.draft.leader = S.teamName;
          if (!(S.draft.pool || []).length) {
            S.draft.pool = S.draft.pool || [];
            S.draft.pool.push(genDraftProspect(S, 0, new Set()));
          }
          try { save(); renderAll(); } catch (e) {}
        }
      });
      await page.waitForTimeout(150);
      await clickNav(page, 'market');
      s = await draftSnap(page);
      console.log('FULL_PICK', JSON.stringify({
        roster: s.roster, phase: s.draft && s.draft.phase, pool: s.draft && s.draft.pool,
        hintFull: s.hintFull, pickWraps: s.pickWrapCount, hasSkip: s.hasSkip,
        slice: s.textSlice.slice(0, 260),
      }, null, 1));

      if (s.hintFull || /大名单已满|只能放弃/.test(s.textSlice)) {
        finding('PASS', 'boundary-full', '点名阶段满员有明确提示', s.textSlice.match(/大名单已满[^\n|]*|只能放弃[^\n|]*/g));
      } else {
        finding('BUG', 'boundary-full', '点名阶段满员无明确提示', s.textSlice);
      }

      if (s.pickWrapCount > 0) {
        const r = await clickFirstPickCard(page);
        if (r.ok && r.afterRoster > r.beforeRoster) {
          finding('BUG', 'boundary-full', '满员仍能点名签约入队', JSON.stringify(r));
        } else {
          finding('PASS', 'boundary-full', '满员点卡片未入队', JSON.stringify({ before: r.beforeRoster, after: r.afterRoster, toast: r.toast, reason: r.reason }));
        }
        finding('WARN', 'boundary-full', '满员仍渲染可点「点名签约」卡片（依赖 rosterGuard 拦）', 'pickWrapCount=' + s.pickWrapCount);
      } else {
        if (s.hasSkip) {
          finding('PASS', 'boundary-full', '满员无点名卡片，保留「放弃点名」');
        } else {
          finding('WARN', 'boundary-full', '满员点名阶段无卡片也无放弃按钮', s.textSlice.slice(0, 200));
        }
      }
    }

    // ========== C. 自家青训不可选 ==========
    await bootTeam(page, '青训拦截');
    await clickNav(page, 'market');
    await page.evaluate(() => {
      const s = S;
      if (!s.draft) return;
      s.draft.phase = 'pick';
      s.draft.leader = s.teamName;
      s.draft.done = false;
      s.draft.pool = s.draft.pool || [];
      // 塞入 1 名自家青训 + 1 名普通新秀
      const own = genDraftProspect(s, 1, new Set());
      own.id = 'drf_own_ui_' + Math.random().toString(36).slice(2, 6);
      own.fromClub = s.teamName;
      own.tags = [...(own.tags || []).filter(t => t !== '青训出身'), '青训出身'];
      const normal = genDraftProspect(s, 2, new Set());
      normal.id = 'drf_norm_ui_' + Math.random().toString(36).slice(2, 6);
      // 自家青训放最前，确保可见
      s.draft.pool = [own, normal, ...(s.draft.pool || [])];
      try { save(); renderAll(); } catch (e) {}
    });
    await page.waitForTimeout(150);
    await clickNav(page, 'market');
    s = await draftSnap(page);
    const youthUi = await page.evaluate(() => {
      const text = (document.getElementById('page-market') || {}).innerText || '';
      const wraps = [...document.querySelectorAll('#page-market [onclick*="draftPick"]')];
      const own = (S.draft && S.draft.pool || []).find(p => p.fromClub === S.teamName);
      const ownCardText = (() => {
        const cards = [...document.querySelectorAll('#page-market .pcard')];
        const hit = cards.find(c => own && (c.textContent || '').includes(own.name));
        return hit ? (hit.textContent || '').slice(0, 120) : null;
      })();
      return {
        hasBlockedText: /本队青训|不可选/.test(text),
        blockedCardCount: [...document.querySelectorAll('#page-market .pcard')].filter(c => /本队青训|不可选/.test(c.textContent || '')).length,
        wrapOnlicks: wraps.map(w => w.getAttribute('onclick')),
        ownId: own && own.id,
        ownName: own && own.name,
        ownInWrap: own ? wraps.some(w => (w.getAttribute('onclick') || '').includes(own.id)) : null,
        ownCardText,
        poolNames: (S.draft && S.draft.pool || []).slice(0, 4).map(p => p.name),
        pickWrapCount: wraps.length,
      };
    });
    console.log('OWN_YOUTH', JSON.stringify(youthUi, null, 1));
    if (youthUi.ownInWrap) {
      finding('BUG', 'boundary-youth', '自家青训卡仍可点名（挂 draftPick onclick）', JSON.stringify(youthUi));
      const r = await clickFirstPickCard(page);
      if (r.ok && r.afterRoster > r.beforeRoster) {
        finding('BUG', 'boundary-youth', '点击后自家青训入队', JSON.stringify(r));
      }
    } else if (youthUi.hasBlockedText || youthUi.blockedCardCount > 0) {
      finding('PASS', 'boundary-youth', '自家青训显示「不可选」且无点名入口', JSON.stringify({ blocked: youthUi.blockedCardCount, ownCardText: youthUi.ownCardText }));
    } else {
      finding('WARN', 'boundary-youth', '未见自家青训「不可选」UI', JSON.stringify(youthUi));
    }

    // 普通新秀应可点；自家青训引擎层也应拒
    const forceYouth = await page.evaluate(() => {
      const s = S;
      const own = (s.draft && s.draft.pool || []).find(p => p.fromClub === s.teamName);
      if (!own) return { skip: 'no-own' };
      const before = (s.players || []).length;
      const toasts = [];
      const o = window.toast;
      window.toast = (m) => { toasts.push(String(m)); try { o(m); } catch (_) {} };
      try { draftPick(s, own.id); } catch (e) { toasts.push('THROW:' + (e && e.message || e)); }
      window.toast = o;
      return {
        own: own.name, before, after: (s.players || []).length,
        grew: (s.players || []).length > before, toasts,
        stillInPool: (s.draft.pool || []).some(p => p.id === own.id),
      };
    });
    if (forceYouth.skip) {
      finding('INFO', 'boundary-youth', '引擎拦截测跳过', forceYouth.skip);
    } else if (forceYouth.grew) {
      finding('BUG', 'boundary-youth', 'draftPick 仍签入自家青训', JSON.stringify(forceYouth));
    } else {
      finding('PASS', 'boundary-youth', 'draftPick 拒绝自家青训', JSON.stringify(forceYouth));
    }

    // 正常卡应能签
    const pickNormal = await page.evaluate(() => {
      const s = S;
      const normal = (s.draft && s.draft.pool || []).find(p => p.fromClub !== s.teamName);
      if (!normal) return { skip: 'no-normal' };
      const before = (s.players || []).length;
      draftPick(s, normal.id);
      return { name: normal.name, before, after: (s.players || []).length, grew: (s.players || []).length > before };
    });
    if (pickNormal.skip) finding('INFO', 'boundary-youth', '普通新秀对照跳过', pickNormal.skip);
    else if (!pickNormal.grew) finding('BUG', 'boundary-youth', '普通新秀也无法点名', JSON.stringify(pickNormal));
    else finding('PASS', 'boundary-youth', '对照：普通新秀可点名入队', JSON.stringify(pickNormal));

    await scanDirty(page, 'after-boundary');

    // ========== D. 移动 390×844 FAB / nav ==========
    // 继续用当前档，扫各页
    const pagesToScan = ['club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall', 'biz'];
    const overlapResults = [];
    for (const p of pagesToScan) {
      try {
        await clickNav(page, p);
        await page.waitForTimeout(120);
        const o = await overlapProbe(page);
        o.page = p;
        overlapResults.push(o);
        await scanDirty(page, 'mobile-' + p);
        if (o.overlapFabBiz > 0) {
          finding('BUG', 'overlap', `page=${p} .page-fab 与 nav[biz] 重叠 ${o.overlapFabBiz}px²`, JSON.stringify({ fab: o.fab, biz: o.biz }));
        }
        if (o.overlapFabHall > 0) {
          finding('BUG', 'overlap', `page=${p} .page-fab 与 nav[hall] 重叠 ${o.overlapFabHall}px²`, JSON.stringify({ fab: o.fab, hall: o.hall }));
        }
        if (o.bizCenterHits && o.bizCenterHits.inFab) {
          finding('BUG', 'overlap', `page=${p} 经营按钮中心命中 page-fab`, JSON.stringify(o.bizCenterHits));
        }
        if (o.hallCenterHits && o.hallCenterHits.inFab) {
          finding('BUG', 'overlap', `page=${p} 荣誉馆按钮中心命中 page-fab`, JSON.stringify(o.hallCenterHits));
        }
      } catch (e) {
        finding('WARN', 'overlap', `扫页 ${p} 失败`, String(e && e.message || e));
      }
    }

    const anyBiz = overlapResults.filter(o => o.overlapFabBiz > 0);
    const anyHall = overlapResults.filter(o => o.overlapFabHall > 0);
    if (!anyBiz.length && !anyHall.length) {
      finding('PASS', 'overlap',
        '390×844 各页 .page-fab 与 biz/hall nav 均无重叠',
        JSON.stringify(overlapResults.map(o => ({ p: o.page, biz: o.overlapFabBiz, hall: o.overlapFabHall, fabY: o.fab && o.fab.y }))));
    }

    // 真实点击「经营」
    await clickNav(page, 'club');
    await page.waitForTimeout(100);
    const beforePage = await page.evaluate(() => {
      const on = document.querySelector('section.page.on');
      return on ? on.id : null;
    });
    const bizBtn = page.locator('#nav button[data-page="biz"]');
    await bizBtn.scrollIntoViewIfNeeded().catch(() => {});
    const box = await bizBtn.boundingBox();
    const clickInfo = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return {
        hitId: el && el.id,
        hitPage: el && el.dataset && el.dataset.page,
        inNav: !!(el && el.closest && el.closest('#nav')),
        inFab: !!(el && el.closest && el.closest('#page-fab')),
        hitText: el && (el.textContent || '').trim().slice(0, 8),
      };
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(200);
    const afterPage = await page.evaluate(() => {
      const on = document.querySelector('section.page.on');
      return {
        page: on ? on.id : null,
        fabOpen: document.getElementById('page-dock') && document.getElementById('page-dock').classList.contains('open'),
      };
    });
    console.log('BIZ_CLICK', JSON.stringify({ beforePage, clickInfo, afterPage }, null, 1));
    if (clickInfo.inFab) {
      finding('BUG', 'overlap', '点「经营」中心命中 page-fab', JSON.stringify(clickInfo));
    }
    if (afterPage.page !== 'page-biz') {
      finding('BUG', 'overlap', '点「经营」后未进入 page-biz', JSON.stringify({ beforePage, clickInfo, afterPage }));
    } else {
      finding('PASS', 'overlap', '真实点击「经营」命中 nav 并进入 page-biz', JSON.stringify(clickInfo));
    }

    // FAB 开 dock
    await clickNav(page, 'hall');
    await page.waitForTimeout(100);
    const fabBox = await page.locator('#page-fab').boundingBox().catch(() => null);
    if (fabBox) {
      await page.mouse.click(fabBox.x + fabBox.width / 2, fabBox.y + fabBox.height / 2);
      await page.waitForTimeout(150);
      const fabClick = await page.evaluate(() => {
        const dock = document.getElementById('page-dock');
        const nav = document.querySelector('nav');
        const dr = dock && dock.getBoundingClientRect();
        const nr = nav && nav.getBoundingClientRect();
        const overlap = (a, b) => {
          if (!a || !b) return 0;
          const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          return Math.round(x * y);
        };
        return {
          dockOpen: dock && dock.classList.contains('open'),
          dockNavOverlap: dr && nr ? overlap(dr, nr) : null,
          dock: dr && { y: dr.y, h: dr.height, bottom: dr.bottom },
          navY: nr && nr.y,
        };
      });
      if (fabClick.dockOpen && fabClick.dockNavOverlap > 0) {
        finding('BUG', 'overlap', 'page-dock 打开后与 nav 重叠', JSON.stringify(fabClick));
      } else if (fabClick.dockOpen) {
        finding('PASS', 'overlap', 'FAB 开 dock 且不压 nav', JSON.stringify(fabClick));
      }
    }

    // 桌面对照
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(150);
    await clickNav(page, 'market');
    const desk = await overlapProbe(page);
    if (desk.overlapFabBiz > 0 || desk.overlapFabHall > 0) {
      finding('WARN', 'overlap', '桌面 1280 下 fab 仍与 nav 重叠', JSON.stringify({ biz: desk.overlapFabBiz, hall: desk.overlapFabHall }));
    } else {
      finding('PASS', 'overlap', '桌面 1280 下 fab 与 nav 无重叠');
    }
    await shot(page, 'draft-ui-final-desktop');

    // ========== 写报告 ==========
    const passN = findings.filter(f => f.sev === 'PASS').length;
    const bugN = findings.filter(f => f.sev === 'BUG').length;
    const warnN = findings.filter(f => f.sev === 'WARN').length;

    const md = [];
    md.push('# 选秀大会 + 移动端 UI 重叠 —— 真实点击回归报告');
    md.push('');
    md.push('- 时间：' + new Date().toISOString());
    md.push('- 入口：`http://127.0.0.1:8931/game.html`');
    md.push('- 视口：390×844（移动）为主，1280×800 对照');
    md.push('- 方法：Playwright 真实 `fill / click / mouse.click`；evaluate 仅夹具与读数');
    md.push('- 约束：未改 `src/**`，未 commit');
    md.push('');
    md.push('## 结论总览');
    md.push('');
    md.push('| 级别 | 数量 |');
    md.push('|---|---|');
    md.push(`| BUG | ${bugN} |`);
    md.push(`| WARN | ${warnN} |`);
    md.push(`| PASS | ${passN} |`);
    md.push('');
    md.push('## 1. 转会期选秀：连续叫价 → 点名签约');
    md.push('');
    md.push('```json');
    md.push(JSON.stringify({
      raiseClicks, passClicks, rejectRaises, pickClicks, pickOk,
      roundsRecorded: rounds.length,
      aliveSamples: aliveSamples.length,
      aliveAvg,
      aliveRange: aliveVals.length ? [Math.min(...aliveVals), Math.max(...aliveVals)] : null,
      aliveColdCount: aliveCold,
      uniqueAlive,
      uniquePassed,
    }, null, 2));
    md.push('```');
    md.push('');
    md.push('### 「未放弃 N 队」采样（竞拍中观察）');
    md.push('');
    md.push('| step | slot | alive | passed | bid | leader | roster |');
    md.push('|---|---|---|---|---|---|---|');
    aliveSamples.slice(0, 50).forEach(a => {
      md.push(`| ${a.step} | ${a.slot} | ${a.alive} | ${a.passedCount} | ${a.bid} | ${a.leader || ''} | ${a.roster} |`);
    });
    if (aliveSamples.length > 50) md.push(`| … | | | | | | 共 ${aliveSamples.length} 条 |`);
    md.push('');
    md.push('### 关键轮次');
    md.push('');
    md.push('```json');
    md.push(JSON.stringify(rounds.filter(r => r.event !== 'wait-ai').slice(0, 50), null, 2));
    md.push('```');
    md.push('');
    md.push('## 2. 边界：大名单 10/10 与自家青训');
    md.push('');
    md.push('```json');
    md.push(JSON.stringify({ youthUi, forceYouth, pickNormal }, null, 2));
    md.push('```');
    md.push('');
    md.push('## 3. 移动端 390×844 FAB / nav');
    md.push('');
    md.push('| page | ovBiz | ovHall | fab.y | biz.y | fabCenter | bizCenter |');
    md.push('|---|---|---|---|---|---|---|');
    overlapResults.forEach(o => {
      const fh = o.fabCenterHits ? ((o.fabCenterHits.id || o.fabCenterHits.tag) + (o.fabCenterHits.inFab ? '(fab)' : o.fabCenterHits.inNav ? '(nav)' : '')) : '';
      const bh = o.bizCenterHits ? ((o.bizCenterHits.id || o.bizCenterHits.tag || '') + (o.bizCenterHits.inFab ? '(fab!)' : o.bizCenterHits.inNav ? '(nav)' : '')) : '';
      md.push(`| ${o.page} | ${o.overlapFabBiz} | ${o.overlapFabHall} | ${o.fab && o.fab.y} | ${o.biz && o.biz.y} | ${fh} | ${bh} |`);
    });
    md.push('');
    md.push('### 经营按钮真实点击');
    md.push('');
    md.push('```json');
    md.push(JSON.stringify({ beforePage, clickInfo, afterPage }, null, 2));
    md.push('```');
    md.push('');
    md.push('## 4. pageerror / 脏文本');
    md.push('');
    md.push('### pageerror');
    md.push('');
    if (pageErrors.length) pageErrors.forEach(e => md.push('- ' + e));
    else md.push('- （无）');
    md.push('');
    md.push('### 可见文本脏数据 undefined|NaN（已排除 script/style/toast）');
    md.push('');
    if (dirtyHits.length) {
      dirtyHits.forEach(d => { md.push(`- **${d.tag}**: ` + JSON.stringify(d.hits.slice(0, 5))); });
    } else {
      md.push('- （无）');
    }
    md.push('');
    md.push('## Findings');
    md.push('');
    findings.forEach((f, i) => {
      md.push(`### ${i + 1}. [${f.sev}] ${f.area} — ${f.title}`);
      md.push('');
      if (f.detail) {
        md.push('```');
        md.push(String(f.detail).slice(0, 1600));
        md.push('```');
      }
      md.push('');
    });
    md.push('## 复现');
    md.push('');
    md.push('```bash');
    md.push('node .bug-hunt/draft-ui-realtest.js');
    md.push('```');
    md.push('');
    md.push('## 说明');
    md.push('');
    md.push('- 主路径（开局、叫价、点名、扫页、点经营）全部真实点击。');
    md.push('- 满员 / 自家青训夹具用 evaluate 写状态后，再走 UI 读数与点击验证。');
    md.push('- `draftPick` 直调仅用于验证青训拦截层，不作为主路径证据。');
    md.push('');

    fs.writeFileSync(REPORT, md.join('\n'), 'utf8');
    console.log('REPORT_WRITTEN', REPORT);
    console.log('FINDINGS', JSON.stringify(findings.map(f => ({ sev: f.sev, area: f.area, title: f.title })), null, 1));
    console.log('PAGEERRORS', pageErrors.length, 'DIRTY', dirtyHits.length);
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
    finding('BUG', 'harness', '测试脚本 FATAL', String(e && e.stack || e));
    try {
      fs.writeFileSync(REPORT, '# FATAL\n\n```\n' + String(e && e.stack || e) + '\n```\n', 'utf8');
    } catch (_) {}
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

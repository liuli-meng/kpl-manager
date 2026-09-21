/* Playtest follow-up: 位置改造成功路径 + UI按钮触发 */
const { launch, clearAndStart, shot } = require('./pw.js');

(async () => {
  const { browser, page } = await launch();
  const report = { steps: [] };
  try {
    await clearAndStart(page);
    await page.evaluate(() => {
      const nameInput = document.querySelector('#new-team-name');
      if (nameInput) nameInput.value = '练级营';
      createTeam();
      goPage('train');
    });
    await page.waitForTimeout(400);

    // A) UI button path: set selects then click 确认改造 via doConvertPos after freeing lineup
    const uiConvert = await page.evaluate(() => {
      const p = S.players.find(x => x.pos === 'top') || S.players[0];
      const newPos = 'jg';
      // free the jg starter from lineup so convert is allowed
      const jgStarter = S.players.find(x => x.pos === 'jg' && S.lineup.includes(x.id));
      const lineupBefore = [...S.lineup];
      if (jgStarter) {
        S.lineup = S.lineup.filter(id => id !== jgStarter.id);
      }
      // also remove convert target if needed? convert requires target not blocked by OTHER player at newPos
      // If p is in lineup and another jg exists in lineup -> blocked. We removed jgStarter.
      // But p (top) is still in lineup; convertPos checks: lineup includes p AND some OTHER lineup player has pos===newPos
      // After removing jgStarter, no other jg in lineup -> OK

      const before = {
        pid: p.id, name: p.name, pos: p.pos, age: p.age, fund: S.fund,
        sig: p.sig,
        heroPoolCount: (p.heroPool||[]).length,
        heroPool: (p.heroPool||[]).map(h => ({n:h.n,lv:h.lv})),
        lineup: lineupBefore,
        lineupAfterFree: [...S.lineup],
      };

      // set UI selects
      const pSel = document.querySelector('#conv-player');
      const posSel = document.querySelector('#conv-pos');
      if (pSel) pSel.value = p.id;
      if (posSel) posSel.value = newPos;

      // capture toast
      let toastMsg = null;
      const origToast = toast;
      toast = (m) => { toastMsg = m; origToast(m); };

      // call UI entry (same as button onclick)
      doConvertPos();

      const p2 = S.players.find(x => x.id === p.id);
      return {
        before,
        after: {
          pos: p2.pos, fund: S.fund, sig: p2.sig,
          heroPoolCount: (p2.heroPool||[]).length,
          heroPool: (p2.heroPool||[]).map(h => ({n:h.n,lv:h.lv})),
          attrs: { ...p2.attrs },
        },
        fundDrop: before.fund - S.fund,
        toast: toastMsg,
        lineup: [...S.lineup],
        // shared heroes with lv preserved?
        shared: (p.heroPool||[]).filter(h => (p2.heroPool||[]).some(x => x.n === h.n)).map(h => {
          const n = (p2.heroPool||[]).find(x => x.n === h.n);
          return { n: h.n, beforeLv: h.lv, afterLv: n.lv };
        }),
      };
    });
    report.steps.push({ step: 'ui-doConvertPos-after-lineup-free', uiConvert });
    await page.waitForTimeout(400);
    await shot(page, 'pt_train_09_convert_success');

    // B) convertPos API directly with a second player
    const apiConvert = await page.evaluate(() => {
      const p = S.players.find(x => x.pos === 'mid') || S.players[1];
      const newPos = 'ad';
      // free ad starter
      const ad = S.players.find(x => x.pos === 'ad' && x.id !== p.id && S.lineup.includes(x.id));
      if (ad) S.lineup = S.lineup.filter(id => id !== ad.id);
      const before = { pos: p.pos, fund: S.fund, sig: p.sig, pool: (p.heroPool||[]).map(h=>({n:h.n,lv:h.lv})) };
      let toastMsg = null;
      const origToast = toast;
      toast = (m) => { toastMsg = m; origToast(m); };
      convertPos(S, p.id, newPos);
      const p2 = S.players.find(x => x.id === p.id);
      return {
        pid: p.id, name: p.name,
        before, after: { pos: p2.pos, fund: S.fund, sig: p2.sig, pool: (p2.heroPool||[]).map(h=>({n:h.n,lv:h.lv})) },
        fundDrop: before.fund - S.fund, toast: toastMsg,
      };
    });
    report.steps.push({ step: 'api-convertPos', apiConvert });
    await shot(page, 'pt_train_10_convert_api');

    // C) cost mismatch confirmation + promote button disabled when not ready
    const checks = await page.evaluate(() => {
      goPage('train');
      const recruitBtnText = [...document.querySelectorAll('#page-train button')].map(b=>(b.textContent||'').trim());
      // recruit then check promote disabled
      recruitRookie(S);
      const aca = S.academy[0];
      const promoteBtn = [...document.querySelectorAll('#page-train button')].find(b => /晋升|未达标|未满/.test(b.textContent||''));
      return {
        buttonLabels: recruitBtnText.filter(t => t.includes('改造') || t.includes('新秀') || t.includes('培养') || t.includes('晋升') || t.includes('未达')),
        rookie: { name: aca.name, age: aca.age, total: ['lane','farm','team','mind'].reduce((t,k)=>t+aca.attrs[k],0) },
        promoteBtnText: promoteBtn ? (promoteBtn.textContent||'').trim() : null,
        promoteDisabled: promoteBtn ? !!promoteBtn.disabled : null,
        // same-day academy train lock
        academyTrainedBefore: !!S.academyTrained,
      };
    });
    report.steps.push({ step: 'academy-promote-lock', checks });
    await shot(page, 'pt_train_11_academy_promote');

    // D) try promote anyway via API (should toast not ready)
    const promoteTry = await page.evaluate(() => {
      const r = S.academy[0];
      const beforeCount = S.players.length;
      let toastMsg = null;
      const origToast = toast;
      toast = (m) => { toastMsg = m; origToast(m); };
      promoteRookie(S, r.id);
      return { toast: toastMsg, playersBefore: beforeCount, playersAfter: S.players.length, stillInAcademy: S.academy.some(x=>x.id===r.id) };
    });
    report.steps.push({ step: 'promote-not-ready', promoteTry });

    // E) coach 新手教练 co12 is 青训助教 - any extra academy benefit?
    const coachInfo = await page.evaluate(() => ({
      coach: S.coach ? { id: S.coach.id, name: S.coach.name, desc: S.coach.desc || S.coach.d || null } : null,
      fund: S.fund,
    }));
    report.steps.push({ step: 'coach', coachInfo });

    await page.evaluate(() => goPage('club'));
    await shot(page, 'pt_train_12_close');

    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    console.error(e);
    report.error = String(e.stack || e);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})();

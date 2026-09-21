/* Playtest: 训练 / 青训营 / 位置改造 */
const { launch, clearAndStart, shot, call } = require('./pw.js');

(async () => {
  const { browser, page } = await launch();
  const report = { steps: [], issues: [], buttons: [] };

  try {
    await clearAndStart(page);
    await shot(page, 'pt_train_00_boot');

    // 1. createTeam '练级营'
    const createResult = await page.evaluate(() => {
      const nameInput = document.querySelector('#new-team-name');
      if (nameInput) nameInput.value = '练级营';
      // open start modal if not on
      const startModal = document.querySelector('#start-modal');
      if (startModal && !startModal.classList.contains('on')) {
        // try to click new game / create entry
        const btns = [...document.querySelectorAll('button')];
        const t = btns.find(b => /创建战队|新建|开始游戏|自建/.test(b.textContent || ''));
        if (t) t.click();
      }
      return {
        hasStartModal: !!startModal,
        modalOn: startModal ? startModal.classList.contains('on') : false,
        nameVal: nameInput ? nameInput.value : null,
        bodySnippet: (document.body.innerText || '').slice(0, 500),
      };
    });
    report.steps.push({ step: 'open-start', createResult });
    await shot(page, 'pt_train_01_start_modal');

    // If start modal not open, try calling createTeam after ensuring form
    const afterCreate = await page.evaluate(() => {
      const nameInput = document.querySelector('#new-team-name');
      if (nameInput) nameInput.value = '练级营';
      if (typeof createTeam === 'function') {
        createTeam();
        return { called: true, teamName: (typeof S !== 'undefined' && S) ? S.teamName : null, fund: (typeof S !== 'undefined' && S) ? S.fund : null, players: (typeof S !== 'undefined' && S) ? S.players.length : null, page: (typeof curPageName === 'function' ? curPageName() : document.querySelector('.page.on')?.id) };
      }
      return { called: false, reason: 'createTeam not found' };
    });
    report.steps.push({ step: 'createTeam', afterCreate });
    await page.waitForTimeout(600);
    await shot(page, 'pt_train_02_after_create');

    // 2. goPage train
    const goTrain = await page.evaluate(() => {
      if (typeof goPage === 'function') goPage('train');
      return {
        page: (typeof curPageName === 'function' ? curPageName() : document.querySelector('.page.on')?.id),
        trained: (typeof S !== 'undefined' && S) ? !!S.trained : null,
        fund: (typeof S !== 'undefined' && S) ? S.fund : null,
        players: (typeof S !== 'undefined' && S) ? S.players.map(p => ({ id: p.id, name: p.name, pos: p.pos, age: p.age, energy: p.energy, attrs: { ...p.attrs }, power: (typeof playerPower === 'function' ? playerPower(p) : null) })) : [],
        academy: (typeof S !== 'undefined' && S && S.academy) ? S.academy.length : 0,
      };
    });
    report.steps.push({ step: 'goPage-train', goTrain });
    await page.waitForTimeout(400);
    await shot(page, 'pt_train_03_train_page');

    // List all buttons text on train page
    const buttons = await page.evaluate(() => {
      const root = document.querySelector('#page-train') || document.querySelector('.page.on') || document.body;
      const btns = [...root.querySelectorAll('button')].map(b => ({
        text: (b.textContent || '').trim().replace(/\s+/g, ' '),
        disabled: !!b.disabled,
        cls: b.className,
        onclick: b.getAttribute('onclick') || '',
      }));
      const panels = [...root.querySelectorAll('.panel h3')].map(h => (h.textContent || '').trim().replace(/\s+/g, ' '));
      const selects = [...root.querySelectorAll('select')].map(s => ({
        id: s.id,
        options: [...s.options].map(o => ({ value: o.value, text: o.textContent })),
      }));
      return { buttons: btns, panels, selects, pageText: (root.innerText || '').slice(0, 4000) };
    });
    report.buttons = buttons.buttons;
    report.panels = buttons.panels;
    report.selects = buttons.selects;
    report.pageText = buttons.pageText;
    report.steps.push({ step: 'list-buttons', count: buttons.buttons.length, panels: buttons.panels });

    // 3. Evaluate train action on first player (attribute + fund)
    const trainBefore = await page.evaluate(() => {
      const p = S.players[0];
      return {
        pid: p.id, name: p.name, pos: p.pos, energy: p.energy,
        attrs: { ...p.attrs }, fund: S.fund, trained: !!S.trained, morale: p.morale,
      };
    });

    const trainAfter = await page.evaluate(() => {
      const p = S.players[0];
      const attrKey = 'lane'; // 对线
      const before = { attrs: { ...p.attrs }, fund: S.fund, energy: p.energy, trained: !!S.trained, morale: p.morale };
      let toastMsg = null;
      // capture toast if possible
      const origToast = typeof toast === 'function' ? toast : null;
      if (origToast) {
        window.__ptToast = null;
        try { toast = (m) => { window.__ptToast = m; origToast(m); }; } catch (e) {}
      }
      if (typeof doTrain === 'function') {
        doTrain(S, p.id, attrKey);
      }
      const p2 = S.players[0];
      return {
        before,
        after: { attrs: { ...p2.attrs }, fund: S.fund, energy: p2.energy, trained: !!S.trained, morale: p2.morale },
        toast: window.__ptToast || null,
        gain: (p2.attrs[attrKey] - before.attrs[attrKey]),
        fundDrop: (before.fund - S.fund),
        energyDrop: (before.energy - p2.energy),
        logLast: (S.log && S.log.length) ? S.log[S.log.length - 1] : ((S.events && S.events.length) ? S.events[S.events.length - 1] : null),
      };
    });
    report.steps.push({ step: 'doTrain-first-player', trainBefore, trainAfter });
    await page.waitForTimeout(300);
    await shot(page, 'pt_train_04_after_train');

    // Second train same day should be blocked
    const retrain = await page.evaluate(() => {
      const p = S.players[0];
      const fundBefore = S.fund;
      const beforeAttr = p.attrs.lane;
      if (typeof doTrain === 'function') doTrain(S, p.id, 'farm');
      return { fundBefore, fundAfter: S.fund, attrSame: p.attrs.lane === beforeAttr, trained: !!S.trained };
    });
    report.steps.push({ step: 'retrain-same-day', retrain });

    // 4. 青训营
    const academy = await page.evaluate(() => {
      const html = (document.querySelector('#page-train') || {}).innerHTML || '';
      const hasRecruit = html.includes('recruitRookie') || html.includes('招募新秀');
      const hasAcademyPanel = html.includes('青训营');
      const fundBefore = S.fund;
      let toastMsg = null;
      const origToast = typeof toast === 'function' ? toast : null;
      if (origToast) {
        window.__ptToast2 = null;
        try { toast = (m) => { window.__ptToast2 = m; origToast(m); }; } catch (e) {}
      }
      if (typeof recruitRookie === 'function') recruitRookie(S);
      toastMsg = window.__ptToast2 || null;
      const aca = S.academy || [];
      return {
        hasRecruit, hasAcademyPanel, fundBefore, fundAfter: S.fund, fundDrop: fundBefore - S.fund,
        academyCount: aca.length,
        rookies: aca.map(r => ({ id: r.id, name: r.name, pos: r.pos, age: r.age, potential: r.potential, attrs: { ...r.attrs }, total: ['lane','farm','team','mind'].reduce((t,k)=>t+r.attrs[k],0), wage: r.wage })),
        toast: toastMsg,
      };
    });
    report.steps.push({ step: 'academy-recruit', academy });
    await page.waitForTimeout(400);
    await shot(page, 'pt_train_05_academy');

    // Train rookie if any
    const rookieTrain = await page.evaluate(() => {
      const aca = S.academy || [];
      if (!aca.length) return { skipped: 'no rookie' };
      const r = aca[0];
      const before = { attrs: { ...r.attrs }, fund: S.fund, academyTrained: !!S.academyTrained };
      if (typeof trainRookie === 'function') trainRookie(S, r.id);
      const r2 = (S.academy || []).find(x => x.id === r.id);
      const keys = ['lane','farm','team','mind'];
      let gainKey = null, gain = 0;
      keys.forEach(k => {
        const d = r2.attrs[k] - before.attrs[k];
        if (d > 0) { gainKey = k; gain = d; }
      });
      return {
        before, after: { attrs: { ...r2.attrs }, fund: S.fund, academyTrained: !!S.academyTrained },
        gainKey, gain, fundDrop: before.fund - S.fund,
        logLast: (S.log && S.log.length) ? S.log[S.log.length - 1] : null,
      };
    });
    report.steps.push({ step: 'train-rookie', rookieTrain });
    await shot(page, 'pt_train_06_after_rookie_train');

    // 5. 位置改造
    const convert = await page.evaluate(() => {
      const btnText = [...(document.querySelectorAll('#page-train button') || [])].map(b => (b.textContent||'').trim()).filter(t => t.includes('改造'));
      const pSel = document.querySelector('#conv-player');
      const posSel = document.querySelector('#conv-pos');
      const selectInfo = {
        player: pSel ? { value: pSel.value, options: [...pSel.options].map(o => o.text) } : null,
        pos: posSel ? { value: posSel.value, options: [...posSel.options].map(o => ({v:o.value,t:o.text})) } : null,
      };
      // pick first player and a different position
      const p = S.players[0];
      const newPos = (typeof POS_ORDER !== 'undefined' ? POS_ORDER.find(x => x !== p.pos) : null) || 'mid';
      const before = {
        pid: p.id, name: p.name, pos: p.pos, age: p.age, fund: S.fund,
        sig: p.sig, heroPool: (p.heroPool||[]).map(h => ({n:h.n,lv:h.lv})),
        lineup: [...(S.lineup||[])],
        attrs: { ...p.attrs },
      };
      // set selects if present
      if (pSel) pSel.value = p.id;
      if (posSel) posSel.value = newPos;
      let toastMsg = null;
      const origToast = typeof toast === 'function' ? toast : null;
      if (origToast) {
        window.__ptToast3 = null;
        try { toast = (m) => { window.__ptToast3 = m; origToast(m); }; } catch (e) {}
      }
      if (typeof convertPos === 'function') convertPos(S, p.id, newPos);
      toastMsg = window.__ptToast3 || null;
      const p2 = S.players[0];
      return {
        btnText, selectInfo, newPos,
        before,
        after: {
          pid: p2.id, name: p2.name, pos: p2.pos, fund: S.fund,
          sig: p2.sig, heroPool: (p2.heroPool||[]).map(h => ({n:h.n,lv:h.lv})),
          attrs: { ...p2.attrs },
        },
        fundDrop: before.fund - S.fund,
        toast: toastMsg,
        logLast: (S.log && S.log.length) ? S.log[S.log.length - 1] : null,
      };
    });
    report.steps.push({ step: 'convert-pos', convert });
    await page.waitForTimeout(400);
    await shot(page, 'pt_train_07_after_convert');

    // Also inspect UI button label vs actual cost
    const costMismatch = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#page-train button')].map(b => (b.textContent||'').trim());
      const convBtn = btns.find(t => t.includes('改造'));
      // re-read convertPos cost from function source
      const src = typeof convertPos === 'function' ? convertPos.toString() : '';
      const m = src.match(/const cost\s*=\s*(\d+)/);
      const panelTag = [...document.querySelectorAll('#page-train .panel h3')].map(h => (h.textContent||'').trim()).filter(t => t.includes('改造'));
      return { convBtn, declaredCost: m ? m[1] : null, panelTag };
    });
    report.steps.push({ step: 'cost-label-check', costMismatch });

    // Final state snapshot
    const finalState = await page.evaluate(() => ({
      teamName: S.teamName,
      fund: S.fund,
      trained: !!S.trained,
      academyTrained: !!S.academyTrained,
      academyCount: (S.academy||[]).length,
      players: S.players.map(p => ({ id: p.id, name: p.name, pos: p.pos, age: p.age, energy: p.energy, attrs: { ...p.attrs }, sig: p.sig })),
      page: (typeof curPageName === 'function' ? curPageName() : null),
    }));
    report.finalState = finalState;

    // 6. Close - navigate away or just leave
    await page.evaluate(() => { if (typeof goPage === 'function') goPage('club'); });
    await page.waitForTimeout(300);
    await shot(page, 'pt_train_08_close_club');

    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    console.error('PLAYTEST ERROR', e);
    report.error = String(e && e.stack || e);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})();

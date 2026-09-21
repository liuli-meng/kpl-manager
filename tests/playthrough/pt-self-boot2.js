// Playtest phase 2: read S via call(), do market buy
const { launch, clearAndStart, shot, call } = require('./pw.js');

(async () => {
  const issues = [];
  const shots = [];
  const { browser, page } = await launch();

  try {
    await page.waitForTimeout(500);
    await clearAndStart(page);
    await page.waitForTimeout(700);

    await page.evaluate(() => {
      const el = document.getElementById('new-team-name');
      if (el) el.value = '雷霆战队';
      createTeam();
    });
    await page.waitForTimeout(500);

    // Read state via call (global lexical scope)
    const state = await call(page, `return {
      teamName: S.teamName,
      fund: S.fund,
      wageCap: S.wageCap,
      players: (S.players||[]).map(p=>p.name+'/'+p.pos),
      playerCount: (S.players||[]).length,
      preseason: S.preseason,
      transferWindow: S.transferWindow,
      marketCount: (S.market||[]).length,
      freeAgents: (S.freeAgents||[]).map(p=>({name:p.name,pos:p.pos,id:p.id,wage:p.wage,val:p.value||p.val})),
      transferListCount: (S.transferList||[]).length,
      transferListSample: (S.transferList||[]).slice(0,5).map(p=>({name:p.name,pos:p.pos,id:p.id,wage:p.wage,owner:p.ownerTeam,untouchable:p.untouchable})),
      mode: S.mode,
      day: S.day,
      season: S.season,
      coach: S.coach && S.coach.name
    };`);

    // Market action: prefer free agent, else buyPlayer on market, else openNegotiation
    const marketAction = await call(page, `
      const before = { n:(S.players||[]).length, fund:S.fund, fa:(S.freeAgents||[]).length, mk:(S.market||[]).length, tl:(S.transferList||[]).length };
      // 1) free agent
      if (typeof signFreeAgent==='function' && (S.freeAgents||[]).length) {
        const fa=S.freeAgents[0];
        try {
          const beforeFund=S.fund;
          signFreeAgent(S, fa.id);
          const after={ n:(S.players||[]).length, fund:S.fund, fa:(S.freeAgents||[]).length };
          // force re-render
          if (typeof goPage==='function') goPage('market');
          return { ok:true, method:'signFreeAgent', player:fa.name+'/'+fa.pos, before, after, fundedelta:beforeFund-S.fund };
        } catch(e) { return { ok:false, method:'signFreeAgent', reason:String(e&&e.message||e), before }; }
      }
      // 2) market buy
      if (typeof buyPlayer==='function' && (S.market||[]).length) {
        const mp=S.market[0];
        try {
          const beforeFund=S.fund;
          buyPlayer(S, mp);
          const after={ n:(S.players||[]).length, fund:S.fund, mk:(S.market||[]).length };
          if (typeof goPage==='function') goPage('market');
          return { ok:true, method:'buyPlayer', player:mp.name+'/'+mp.pos, before, after, fundedelta:beforeFund-S.fund };
        } catch(e) { return { ok:false, method:'buyPlayer', reason:String(e&&e.message||e), before }; }
      }
      // 3) negotiation
      if (typeof openNegotiation==='function' && (S.transferList||[]).length) {
        const tp=S.transferList.find(p=>!p.untouchable)||S.transferList[0];
        try {
          openNegotiation(S, tp.id);
          return { ok:true, method:'openNegotiation', player:tp.name+'/'+tp.pos, before };
        } catch(e) { return { ok:false, method:'openNegotiation', reason:String(e&&e.message||e), before }; }
      }
      return { ok:false, reason:'nothing to buy', before };
    `);

    await page.waitForTimeout(400);
    shots.push(await shot(page, 'pt_self_market_after_buy'));

    const afterBuy = await call(page, `return {
      players:(S.players||[]).map(p=>p.name+'/'+p.pos),
      fund:S.fund,
      freeAgents:(S.freeAgents||[]).length,
      market:(S.market||[]).length,
      wageBill:(S.players||[]).reduce((a,p)=>a+(p.wage||0),0)
    };`);

    // Also inspect market page buy buttons specifically
    const buyBtns = await page.evaluate(() => {
      const section = document.getElementById('page-market');
      if (!section) return [];
      return Array.from(section.querySelectorAll('button'))
        .map(b => ({ text: (b.innerText||'').trim().slice(0,80), onclick: b.getAttribute('onclick')||'' }))
        .filter(x => /签约|买|sign|buy|挖|nego/i.test(x.text + x.onclick));
    });

    const toast = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.toast, #toast, [class*="toast"]');
      return Array.from(nodes).map(n => (n.innerText||'').trim()).filter(Boolean).slice(0,5);
    });

    // Console/page errors already logged by helper; collect via a buffer if any
    const result = { state, marketAction, afterBuy, buyBtns: buyBtns.slice(0,20), buyBtnCount: buyBtns.length, toast, shots };
    console.log('===PLAYTEST_RESULT===');
    console.log(JSON.stringify(result, null, 2));
    console.log('===END===');
  } catch (e) {
    console.error('[fatal]', e);
  } finally {
    await browser.close();
  }
})();

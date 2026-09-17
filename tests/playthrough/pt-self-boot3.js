// Playtest phase 3: real market action with confirm handling
const { launch, clearAndStart, shot, call } = require('./pw.js');

(async () => {
  const { browser, page } = await launch();
  try {
    await page.waitForTimeout(400);
    await clearAndStart(page);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      document.getElementById('new-team-name').value = '雷霆战队';
      createTeam();
    });
    await page.waitForTimeout(400);

    // Auto-accept confirm dialogs
    page.on('dialog', async (d) => {
      console.log('[dialog]', d.type(), d.message().slice(0, 120));
      await d.accept();
    });

    const inventory = await call(page, `return {
      fund:S.fund, wageCap:S.wageCap,
      weeklyWage: (S.players||[]).reduce((a,p)=>a+(p.wage||0),0),
      freeAgents:(S.freeAgents||[]).map(p=>({id:p.id,name:p.name,pos:p.pos,wage:p.wage,signCost:p.signCost,ova:overall(p)})),
      market:(S.market||[]).map(p=>({id:p.id,name:p.name,pos:p.pos,wage:p.wage,ova:overall(p),cost:capFee(Math.round(valueOf(overall(p))*(p.discount||1)))})),
    };`);

    // Try cheapest market buy
    const marketAction = await call(page, `
      const list=(S.market||[]).slice().sort((a,b)=>capFee(Math.round(valueOf(overall(a))*(a.discount||1)))-capFee(Math.round(valueOf(overall(b))*(b.discount||1))));
      if(!list.length) return {ok:false,reason:'market empty'};
      const mp=list[0];
      const cost=capFee(Math.round(valueOf(overall(mp))*(mp.discount||1)));
      const before={n:(S.players||[]).length,fund:S.fund,weekly:(S.players||[]).reduce((a,p)=>a+(p.wage||0),0)};
      let r;
      try{ r=buyPlayer(S,mp); }catch(e){ return {ok:false,method:'buyPlayer',reason:String(e&&e.message||e),cost,player:mp.name}; }
      const after={n:(S.players||[]).length,fund:S.fund,weekly:(S.players||[]).reduce((a,p)=>a+(p.wage||0),0),market:(S.market||[]).length};
      return {ok:!!r, method:'buyPlayer', player:mp.name+'/'+mp.pos, cost, wage:mp.wage, before, after};
    `);

    await page.waitForTimeout(300);
    shots2 = await shot(page, 'pt_self_market_buy_real');

    // If buy failed, try free agent with cheapest signCost
    let faAction = null;
    if (!marketAction.ok) {
      faAction = await call(page, `
        const list=(S.freeAgents||[]).slice().sort((a,b)=>(a.signCost||0)-(b.signCost||0));
        if(!list.length) return {ok:false,reason:'no FA'};
        const fa=list[0];
        const before={n:(S.players||[]).length,fund:S.fund};
        try{ signFreeAgent(S, fa.id); }catch(e){ return {ok:false,reason:String(e&&e.message||e), signCost:fa.signCost}; }
        const after={n:(S.players||[]).length,fund:S.fund,fa:(S.freeAgents||[]).length};
        return {ok:after.n>before.n, player:fa.name, signCost:fa.signCost, wage:fa.wage, before, after};
      `);
      await page.waitForTimeout(300);
      await shot(page, 'pt_self_market_fa_try');
    }

    // If still no buy, try negotiation on a non-untouchable
    let nego = null;
    const stillFailed = !marketAction.ok && !(faAction && faAction.ok);
    if (stillFailed) {
      nego = await call(page, `
        const t=(S.transferList||[]).find(p=>!p.untouchable);
        if(!t) return {ok:false,reason:'all untouchable'};
        try{ openNegotiation(S, t.id); }catch(e){ return {ok:false,reason:String(e&&e.message||e)}; }
        return {ok:true, player:t.name+'/'+t.pos, id:t.id, modal: !!document.getElementById('app-modal') || (document.body.innerText||'').includes('谈判')};
      `);
      await page.waitForTimeout(300);
      await shot(page, 'pt_self_market_nego');
    }

    const finalState = await call(page, `return {
      players:(S.players||[]).map(p=>p.name+'/'+p.pos+'/w'+p.wage),
      fund:S.fund,
      weekly:(S.players||[]).reduce((a,p)=>a+(p.wage||0),0),
      market:(S.market||[]).length,
      freeAgents:(S.freeAgents||[]).length,
      log:(S.eventLog||[]).slice(-5)
    };`);

    const toasts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[class*="toast"], .toast, #toast')).map(n=>(n.innerText||'').trim()).filter(Boolean);
    });

    // Check pageerror via a second pass: capture during create
    console.log('===PLAYTEST_RESULT===');
    console.log(JSON.stringify({ inventory, marketAction, faAction, nego, finalState, toasts, shot: shots2 }, null, 2));
    console.log('===END===');
  } catch (e) {
    console.error('[fatal]', e);
  } finally {
    await browser.close();
  }
})();

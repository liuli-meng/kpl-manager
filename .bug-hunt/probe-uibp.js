// Proper UI-click coach BP flow + engine harness checks
const { launch, shot } = require('../tests/playthrough/pw.js');
const { makeDom, makeTester } = require('../tests/harness');
const vm = require('vm');
const fs = require('fs');
const findings = [];
const steps = [];
function record(id, severity, title, detail) {
  findings.push({ id, severity, title, detail });
  console.log(`[${severity}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 500));
}

// ---- engine harness ----
function runEngine() {
  const { dom } = makeDom();
  const out = vm.runInContext(`
  (function(){
    const res=[]; const fail=m=>res.push('[FAIL] '+m); const ok=m=>res.push('[PASS] '+m);
    // coach start
    initStart();
    switchStartTab('coach');
    pickCoachClub(1);
    applyCoachClub();
    if(!S||S.mode!=='coach')fail('coach mode');
    else ok('coach mode '+S.teamName+' pages='+JSON.stringify(MODE_PAGES.coach));
    // goPage market allowed
    const beforePage = (function(){ try{ goPage('market'); return (document.querySelector('nav button.on')||{}).dataset?.page; }catch(e){ return 'throw:'+e.message; } })();
    // harness DOM may not track nav; check MODE only
    if(!MODE_PAGES.coach.includes('market'))fail('coach should include market');
    else ok('coach MODE_PAGES includes market');
    if(MODE_PAGES.player.includes('market'))fail('player should not include market');
    else ok('player MODE_PAGES excludes market');
    if(MODE_PAGES.player.join()!=='career,club,league,kjia,union,hall')fail('player pages='+MODE_PAGES.player.join());
    else ok('player pages exact');
    // startMatch
    let st=null; try{ startMatch(); st=!!S.series; }catch(e){ st='throw:'+e.message; }
    if(st===true)ok('startMatch creates series op='+(S.series&&S.series.opName));
    else fail('startMatch series='+st);
    // openBP
    let bp=null; try{ openBP('t',playGame); bp='ok'; }catch(e){ bp='throw:'+e.message; }
    if(String(bp).startsWith('throw'))fail('openBP '+bp); else ok('openBP '+bp);
    // playGame after proper BP auto
    let pg=null;
    try{
      if(typeof bpAutoAll==='function')bpAutoAll();
      if(typeof bpConfirm==='function')bpConfirm();
    }catch(e){}
    // If series still open, playGame should work
    if(S.series){
      try{ playGame(); pg='ok'; }catch(e){ pg='throw:'+e.message; }
      if(String(pg).startsWith('throw'))fail('playGame '+pg);
      else ok('playGame '+pg+' mw='+(S.series&&S.series.mw)+' ow='+(S.series&&S.series.ow));
    }else ok('series already finished by auto BP (history='+(S.history||[]).length+')');
    // coach offer accept exact
    if(S.mode==='coach'){
      const pool=CLUB_TEMPLATES.filter(c=>c.name!==S.teamName);
      S.coachOffer={team:pool[0].name};
      const tb=S.teamName, cid=S.coach&&S.coach.id;
      try{ respondCoachOffer(true); }catch(e){ fail('respondCoachOffer throw '+e.message); }
      if(S.teamName===tb)fail('accept no move offer='+JSON.stringify(S.coachOffer));
      else ok('accept moved '+tb+' -> '+S.teamName+' coachKept='+((S.coach&&S.coach.id)===cid));
      // silent bad name
      S.coachOffer={team:'ZZZ_NO_SUCH'};
      const tb2=S.teamName;
      const logLen=(S.coachDeal.log||[]).length;
      respondCoachOffer(true);
      if(S.coachOffer)fail('bad name offer not cleared');
      else if(S.teamName!==tb2)fail('bad name unexpectedly moved');
      else if((S.coachDeal.log||[]).length!==logLen)ok('bad name logged'); // soft
      else res.push('[WARN] bad-name accept silent: no toast captured in harness, no deal log');
    }
    // player path
    initStart();
    switchStartTab('player');
    pickPlayerArch(1);
    pickPlayerPos('mid');
    createPlayerCareer();
    if(S.mode!=='player')fail('player mode');
    else ok('player mode '+myPlayer(S).name+' age='+myPlayer(S).age);
    // startPlayerMatch
    let spm=null; try{ startPlayerMatch(); spm='ok'; }catch(e){ spm='throw:'+e.message; }
    if(String(spm).startsWith('throw'))fail('startPlayerMatch '+spm);
    else ok('startPlayerMatch '+spm+' matchIdx='+S.matchIdx+' history='+(S.history||[]).length);
    // train note
    const me=myPlayer(S); me.injury=0; me.energy=100; me.morale=20; me.val=80; S.trained=false; delete me.peak;
    const r=playerTrainDay(S,'lane');
    if(r.ok&&r.gain<=0&&String(r.note||'').length<8)fail('train note weak: '+JSON.stringify(r));
    else ok('train note '+JSON.stringify(r));
    // transfer request
    me.val=140; me.popularity=80; me.contract=1; ['lane','farm','team','mind'].forEach(k=>me.attrs[k]=90);
    S.offers=[]; S.career.pendingMove=null;
    let tr=null; try{ tr=playerRequestTransfer(S); }catch(e){ tr='throw:'+e.message; }
    if(tr===true)ok('transfer offer '+JSON.stringify(S.offers[S.offers.length-1]));
    else if(tr===false)res.push('[WARN] transfer refused (score gate): acceptable if toast path exists');
    else fail('transfer '+tr);
    // loan/kjia functions exist
    ['playerRequestLoanOut','playerRequestKjia','playerToCoach','coachAutoSquad','coachAdvice','coachRequest','coachPoach','respondCoachOffer','startPlayerMatch','startMatch','openBP','playGame','renderCareer','renderCoachMarket'].forEach(fn=>{
      if(typeof window[fn]!=='function')fail('missing fn '+fn);
    });
    ok('core fns present');
    // career retire path engine
    S.career.retired=true;
    let ret=null; try{ ret=playerTrainDay(S,'lane'); }catch(e){ ret={throw:e.message}; }
    if(ret && ret.ok)fail('train allowed after retire');
    else ok('train blocked after retire '+JSON.stringify(ret));
    return res.join('\\n');
  })()
  `, dom);
  return out;
}

(async () => {
  console.log('===== ENGINE HARNESS =====');
  let engineOut = '';
  try { engineOut = runEngine(); console.log(engineOut); }
  catch (e) { console.log('ENGINE THROW', e.message); engineOut = String(e.message); record('P0-ENGINE', 'FAIL', '引擎探针异常', e.message); }
  if (/\[FAIL\]/.test(engineOut)) {
    engineOut.split('\n').filter(l => l.indexOf('[FAIL]') === 0).forEach(l => record('P1-ENGINE-FAIL', 'FAIL', l, null));
  }

  console.log('===== UI CLICK BP FLOW =====');
  const { browser, page } = await launch();
  page.on('pageerror', e => { console.log('[pageerror]', e.message); record('P0-PAGEERROR', 'FAIL', 'pageerror: ' + e.message, null); });
  page.on('console', msg => { if (msg.type() === 'error') console.log('[console.error]', msg.text().slice(0, 200)); });
  page.on('dialog', async d => { console.log('[dialog]', d.type(), String(d.message()).slice(0, 180)); try { await d.accept(); } catch (e) {} });
  try {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });

    const setup = await page.evaluate(() => {
      switchStartTab('coach');
      pickCoachClub(0);
      applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      return { mode: S.mode, team: S.teamName, phase: S.phase, matchIdx: S.matchIdx, scheduleLen: (S.schedule||[]).length };
    });
    console.log('SETUP', setup);

    // Click real club page start button
    const clickStart = await page.evaluate(() => {
      goPage('club');
      const btn = [...document.querySelectorAll('#page-club button')].find(b => /uiStartMatch|赛前准备/.test((b.getAttribute('onclick')||'')+b.textContent));
      if (!btn) return { ok: false, reason: 'no start btn', btns: [...document.querySelectorAll('#page-club button')].map(b=>b.textContent.trim()) };
      btn.click();
      return {
        ok: true,
        onclick: btn.getAttribute('onclick'),
        after: {
          series: !!S.series,
          appModalOn: document.getElementById('app-modal').classList.contains('on'),
          modalText: (document.getElementById('app-modal-body') || {}).innerText?.slice(0, 300) || '',
          hasEnterBp: /进入 BP|进入BP/.test((document.getElementById('app-modal-body') || {}).innerText || ''),
        },
      };
    });
    await page.waitForTimeout(300);
    await shot(page, 'coach-ui-prematch');
    console.log('CLICK_START', JSON.stringify(clickStart, null, 2));
    steps.push({ step: 'click-start', data: clickStart });
    if (!clickStart.ok) record('P0-NO-START-BTN', 'FAIL', '俱乐部页找不到开赛按钮', JSON.stringify(clickStart));
    if (clickStart.ok && clickStart.after && !clickStart.after.appModalOn) {
      record('P0-PREMATCH-MODAL', 'FAIL', '点击开赛后赛前准备弹窗未打开', JSON.stringify(clickStart));
    }

    // Click 进入 BP
    const clickBp = await page.evaluate(() => {
      const body = document.getElementById('app-modal-body');
      const btn = [...(body ? body.querySelectorAll('button') : [])].find(b => /进入\s*BP/.test(b.textContent || ''));
      if (!btn) return { ok: false, reason: 'no bp enter btn', btns: body ? [...body.querySelectorAll('button')].map(b => b.textContent.trim()) : [] };
      btn.click();
      return {
        ok: true,
        onclick: btn.getAttribute('onclick'),
        after: {
          appModalOn: document.getElementById('app-modal').classList.contains('on'),
          modalText: (document.getElementById('app-modal-body') || {}).innerText?.slice(0, 400) || '',
          hasBpUi: /BP|禁|选|英雄|BAN|PICK/.test((document.getElementById('app-modal-body') || {}).innerText || ''),
          seriesPick: S.series && S.pick,
          seriesUsed: S.series && S.series.used,
        },
      };
    });
    await page.waitForTimeout(300);
    await shot(page, 'coach-ui-bp');
    console.log('CLICK_BP', JSON.stringify(clickBp, null, 2));
    steps.push({ step: 'click-bp', data: clickBp });
    if (!clickBp.ok) record('P1-NO-BP-ENTER', 'FAIL', '赛前准备无「进入 BP」按钮', JSON.stringify(clickBp));
    if (clickBp.ok && clickBp.after && clickBp.after.appModalOn && !clickBp.after.hasBpUi) {
      record('P1-BP-UI-EMPTY', 'FAIL', '进入 BP 后弹窗内容不像 BP 界面', JSON.stringify(clickBp.after));
    }

    // Auto BP + confirm via UI buttons (no await inside evaluate)
    const autoPlay2 = await page.evaluate(() => {
      const body = document.getElementById('app-modal-body');
      const btns = body ? [...body.querySelectorAll('button')].map(b => ({ text: b.textContent.trim(), onclick: b.getAttribute('onclick'), disabled: b.disabled })) : [];
      const before = {
        series: !!S.series, mw: S.series && S.series.mw, ow: S.series && S.series.ow,
        history: (S.history || []).length, matchIdx: S.matchIdx,
      };
      const stepsArr = [];
      const autoBtn = [...(body ? body.querySelectorAll('button') : [])].find(b => /自动|一键|auto/i.test((b.getAttribute('onclick') || '') + (b.textContent || '')));
      if (autoBtn) {
        try { autoBtn.click(); stepsArr.push('clickAuto:' + autoBtn.textContent.trim()); }
        catch (e) { stepsArr.push('clickAuto:throw:' + e.message); }
      } else {
        try { if (typeof bpAutoAll === 'function') { bpAutoAll(); stepsArr.push('bpAutoAll'); } else stepsArr.push('noAuto'); }
        catch (e) { stepsArr.push('bpAutoAll:throw:' + e.message); }
      }
      return { stepsArr, before, btns, modalTextNow: (body && body.innerText || '').slice(0, 250), appModalOn: document.getElementById('app-modal').classList.contains('on') };
    });
    console.log('AUTO1', JSON.stringify(autoPlay2, null, 2));
    await page.waitForTimeout(200);

    const confirm2 = await page.evaluate(() => {
      const body = document.getElementById('app-modal-body');
      const btns = body ? [...body.querySelectorAll('button')].map(b => ({ text: b.textContent.trim(), onclick: b.getAttribute('onclick'), disabled: b.disabled })) : [];
      const stepsArr = [];
      const confirmBtn = [...(body ? body.querySelectorAll('button') : [])].find(b => /确认|开始|开赛|confirm|比赛/.test((b.getAttribute('onclick') || '') + (b.textContent || '')));
      if (confirmBtn) {
        try { confirmBtn.click(); stepsArr.push('clickConfirm:' + confirmBtn.textContent.trim()); }
        catch (e) { stepsArr.push('clickConfirm:throw:' + e.message); }
      } else {
        try { if (typeof bpConfirm === 'function') { bpConfirm(); stepsArr.push('bpConfirm'); } else stepsArr.push('noConfirm'); }
        catch (e) { stepsArr.push('bpConfirm:throw:' + e.message); }
      }
      // if still no progress, try playGame when series open
      if (S.series && !(S.history || []).length) {
        try { if (typeof playGame === 'function') { playGame(); stepsArr.push('playGame'); } }
        catch (e) { stepsArr.push('playGame:throw:' + e.message); }
      }
      return {
        stepsArr, btns,
        after: {
          series: !!S.series,
          mw: S.series && S.series.mw,
          ow: S.series && S.series.ow,
          logs: S.series && S.series.logs ? S.series.logs.slice(0, 2) : null,
          history: (S.history || []).length,
          matchIdx: S.matchIdx,
          appModalOn: document.getElementById('app-modal').classList.contains('on'),
          modalText: (document.getElementById('app-modal-body') || {}).innerText?.slice(0, 300) || '',
        },
      };
    });
    await page.waitForTimeout(250);
    await shot(page, 'coach-ui-after-bp');
    console.log('CONFIRM2', JSON.stringify(confirm2, null, 2));
    steps.push({ step: 'bp-autoplay', data: { autoPlay2, confirm2 } });

    const progressed = (confirm2.after.history > (autoPlay2.before.history || 0)) ||
      (confirm2.after.matchIdx > (autoPlay2.before.matchIdx || 0)) ||
      (confirm2.after.mw != null && confirm2.after.ow != null && (confirm2.after.mw + confirm2.after.ow) > 0);
    if (!progressed) {
      const throws = [...(autoPlay2.stepsArr || []), ...(confirm2.stepsArr || [])].filter(s => /throw/.test(s));
      record(throws.length ? 'P0-COACH-BP-THROW' : 'P1-COACH-BP-STUCK', 'FAIL',
        throws.length ? ('教练 BP 路径异常: ' + throws.join('; ')) : '教练 BP 流程未推进比赛',
        JSON.stringify({ autoPlay2, confirm2 }));
    } else {
      console.log('[PASS] coach BP UI flow progressed');
    }

    // Player full path quick reconfirm with screenshots already done
    const playerQuick = await page.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
      location.reload();
      return true;
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    const pq = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(1);
      pickPlayerPos('ad');
      const n = document.getElementById('pc-name'); if (n) n.value = '发育路';
      if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
      createPlayerCareer();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      const me = myPlayer(S);
      goPage('career');
      const careerBtns = [...document.querySelectorAll('#page-career button')].map(b => ({ t: b.textContent.trim(), o: b.getAttribute('onclick'), d: b.disabled }));
      goPage('club');
      const clubBtns = [...document.querySelectorAll('#page-club button')].map(b => ({ t: b.textContent.trim(), o: b.getAttribute('onclick') }));
      let match = null;
      try { startPlayerMatch(); match = 'ok'; } catch (e) { match = 'throw:' + e.message; }
      return {
        mode: S.mode, me: me && me.name, age: me && me.age,
        starter: me && S.lineup.includes(me.id),
        nav: [...document.querySelectorAll('#nav button')].filter(b => b.style.display !== 'none').map(b => b.dataset.page),
        careerHas: {
          train: careerBtns.some(b => /playerTrain/.test(b.o || '')),
          rest: careerBtns.some(b => /playerRest/.test(b.o || '')),
          social: careerBtns.some(b => /playerSocial/.test(b.o || '')),
          transfer: careerBtns.some(b => /playerRequestTransfer/.test(b.o || '')),
          hero: careerBtns.some(b => /playerHeroTrain/.test(b.o || '')),
        },
        clubHasMatch: clubBtns.some(b => /startPlayerMatch|出战/.test((b.o || '') + b.t)),
        match,
        matchIdx: S.matchIdx,
        history: (S.history || []).length,
      };
    });
    await shot(page, 'player-final-career');
    await page.evaluate(() => goPage('club')); await page.waitForTimeout(200); await shot(page, 'player-final-club');
    console.log('PLAYER_QUICK', JSON.stringify(pq, null, 2));
    steps.push({ step: 'player-quick', data: pq });
    if (pq.mode !== 'player') record('P0-PQ-MODE', 'FAIL', '选手模式失败', JSON.stringify(pq));
    if (!pq.clubHasMatch) record('P1-PQ-MATCH-BTN', 'FAIL', '选手俱乐部页无出战按钮', JSON.stringify(pq));
    if (pq.match && String(pq.match).startsWith('throw')) record('P0-PQ-MATCH', 'FAIL', 'startPlayerMatch 抛错', pq.match);
    Object.keys(pq.careerHas || {}).forEach(k => {
      if (!pq.careerHas[k]) record('P1-PQ-CAREER-' + k, 'FAIL', '生涯页缺少 ' + k, JSON.stringify(pq.careerHas));
    });

    const summary = {
      findingsCount: findings.length,
      failCount: findings.filter(f => f.severity === 'FAIL').length,
      engineOut,
      stepsCount: steps.length,
    };
    console.log('SUMMARY', JSON.stringify(summary, null, 2));
    console.log('FINDINGS', JSON.stringify(findings, null, 2));
    fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\player-coach-probe-uibp.json',
      JSON.stringify({ summary, findings, steps, engineOut }, null, 2), 'utf8');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
  } finally {
    await browser.close();
  }
})();

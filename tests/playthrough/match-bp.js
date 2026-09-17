// 比赛+BP 全流程关键 UX 演练
// 运行：node tests/playthrough/match-bp.js
const { launch, clearAndStart, shot, call, BASE } = require('./pw');

function log(...a){ console.log('[pw-match]', ...a); }
function fail(...a){ console.error('[pw-match:FAIL]', ...a); }

async function snapState(page){
  return page.evaluate(() => {
    const s = S;
    return {
      team: s.teamName,
      phase: s.phase,
      matchIdx: s.matchIdx,
      preseason: s.preseason,
      transferWindow: s.transferWindow,
      series: s.series ? {
        mw: s.series.mw, ow: s.series.ow, max: s.series.max,
        stage: s.series.stage, side: s.series.side,
        used: (s.series.used||[]).length,
        usedOpp: (s.series.usedOpp||[]).length,
        myBans: (s.series.myBans||[]).length,
        oppBans: (s.series.oppBans||[]).length,
        oppPicks: Object.keys(s.series.oppPicks||{}).length,
      } : null,
      draft: window._draft ? {
        idx: window._draft.idx,
        steps: window._draft.steps.length,
        myBans: window._draft.myBans.length,
        oppBans: window._draft.oppBans.length,
        myPicks: Object.keys(window._draft.myPicks).length,
        oppPicks: Object.keys(window._draft.oppPicks||{}).length,
        isPeak: !!window._draft.isPeak,
        phaseLabel: (typeof phaseLabel==='function') ? phaseLabel(window._draft) : null,
      } : null,
      modalOn: !!document.querySelector('#app-modal.on'),
      modalWide: !!document.querySelector('#app-modal.wide'),
      modalTitle: (document.querySelector('#app-modal-body h2')||{}).textContent||'',
      modalSnippet: (document.querySelector('#app-modal-body')||{innerText:''}).innerText.slice(0,400),
    };
  });
}

async function main(){
  const report = { checks: [], notes: [], errors: [], shots: [] };
  const ok = (name, pass, detail) => {
    report.checks.push({ name, pass: !!pass, detail: detail||'' });
    log(pass ? 'PASS' : 'FAIL', name, detail||'');
    if(!pass) report.errors.push(name + (detail?': '+detail:''));
  };

  const { browser, page } = await launch();
  // Auto-accept confirm() dialogs so skipTransfer / endPreseason / bpAutoAll work
  page.on('dialog', async d => {
    log('dialog:', d.type(), d.message().slice(0,80));
    await d.accept();
  });

  try {
    // ---------- 1. Boot clean, club career ----------
    await clearAndStart(page);
    await page.waitForTimeout(300);

    const boot = await page.evaluate(() => {
      const out = {};
      out.hasStart = !!document.querySelector('#start-modal');
      out.tabs = Array.from(document.querySelectorAll('[id^="tab-"]')).map(b=>b.id);
      out.globals = Object.keys(window).filter(k=>/match|bp|series|prematch|startMatch|openMatch|beginSeries|startCup|uiStart/i.test(k)).sort();
      return out;
    });
    report.globalsMatchBp = boot.globals;
    log('globals:', boot.globals.join(', '));

    const switched = await page.evaluate(() => {
      try { switchStartTab('club'); return true; } catch(e){ return 'throw:'+e.message; }
    });
    ok('switchStartTab(club)', switched===true, String(switched));

    await page.waitForTimeout(200);
    const clubs = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-ci]'));
      return cards.length;
    });
    ok('club cards visible', clubs>0, 'count='+clubs);

    const picked = await page.evaluate(() => {
      try { pickClub(0); return {ok:true, label:(document.querySelector('#club-apply-btn')||{textContent:''}).textContent, disabled:(document.querySelector('#club-apply-btn')||{disabled:true}).disabled}; }
      catch(e){ return {ok:false, err:e.message}; }
    });
    ok('pickClub(0)', picked.ok && !picked.disabled, JSON.stringify(picked));

    const applied = await page.evaluate(() => {
      try {
        applyClub();
        return {ok:true, team:S.teamName, preseason:S.preseason, transferWindow:S.transferWindow, lineup:S.lineup.length, players:S.players.length};
      } catch(e){ return {ok:false, err:e.message}; }
    });
    ok('applyClub()', applied.ok && !!applied.team, JSON.stringify(applied));
    await page.waitForTimeout(300);
    report.club = applied;
    await shot(page, 'mp_01_after_apply_club');
    report.shots.push('mp_01_after_apply_club.png');

    // ---------- 2. Skip transfer window ----------
    // Prefer evaluate path: force-end without walking 7 days of nextDay
    const skipped = await page.evaluate(() => {
      try {
        const before = { preseason:S.preseason, tw:S.transferWindow };
        // UI path: uiSkipTransfer uses confirm + skipTransferWindow (7-day loop)
        // Direct path for playtest speed: endPreseason-style unlock
        S.preseason = false;
        S.transferWindow = 0;
        if (typeof endTransferWindow === 'function') endTransferWindow(S);
        if (typeof autoFillLineup === 'function') autoFillLineup(S);
        save(); renderAll();
        return { ok:true, before, after:{ preseason:S.preseason, tw:S.transferWindow }, lineup:S.lineup.length };
      } catch(e){ return { ok:false, err:e.message }; }
    });
    ok('skip transfer window', skipped.ok && skipped.after.preseason===false, JSON.stringify(skipped));

    // Also verify the real skip entry exists
    const skipFns = await page.evaluate(() => ({
      uiSkipTransfer: typeof uiSkipTransfer,
      skipTransferWindow: typeof skipTransferWindow,
      endTransferWindow: typeof endTransferWindow,
      endPreseason: typeof endPreseason,
      uiEndPreseason: typeof uiEndPreseason,
      startMatch: typeof startMatch,
      uiStartMatch: typeof uiStartMatch,
      openBP: typeof openBP,
      playGame: typeof playGame,
      bpAuto: typeof bpAuto,
      bpSuggest: typeof bpSuggest,
      bpConfirm: typeof bpConfirm,
      autoPlayNext: typeof autoPlayNext,
      showSideChoice: typeof showSideChoice,
      finishSeries: typeof finishSeries,
    }));
    report.entryFns = skipFns;
    Object.keys(skipFns).forEach(k => ok('fn '+k, skipFns[k]==='function', skipFns[k]));

    // ---------- 3. startMatch path ----------
    const matchInfo = await page.evaluate(() => {
      const m = S.schedule[S.matchIdx];
      return m ? { round:m.round, opp:m.opp } : null;
    });
    log('upcoming match:', JSON.stringify(matchInfo));
    report.upcoming = matchInfo;
    ok('schedule has next match', !!matchInfo);

    const started = await page.evaluate(() => {
      try {
        startMatch();
        return { ok:true, hasSeries:!!S.series, modal:!!document.querySelector('#app-modal.on') };
      } catch(e){ return { ok:false, err:e.message, stack:(e.stack||'').split('\n')[0] }; }
    });
    ok('startMatch()', started.ok && started.hasSeries && started.modal, JSON.stringify(started));
    await page.waitForTimeout(400);
    await shot(page, 'mp_02_prematch_modal');
    report.shots.push('mp_02_prematch_modal.png');

    const pre = await snapState(page);
    report.prematch = pre;
    ok('prematch modal readable', pre.modalOn && /赛前准备|BP/.test(pre.modalTitle+pre.modalSnippet), pre.modalTitle);

    // Check prematch interactive controls
    const preUi = await page.evaluate(() => {
      const body = document.querySelector('#app-modal-body');
      if(!body) return {err:'no body'};
      const btns = Array.from(body.querySelectorAll('button')).map(b=>({
        t:(b.textContent||'').trim().slice(0,40),
        onclick:b.getAttribute('onclick')||'',
        disabled:b.disabled,
      }));
      return {
        hasVsPoster: !!body.querySelector('.vs-poster'),
        hasSwap: btns.some(b=>/换人/.test(b.t)),
        hasEnterBp: btns.some(b=>/进入 BP|进入BP|openBP/.test(b.t+b.onclick)),
        hasIntel: /对手情报/.test(body.innerText),
        hasLineup: /我方首发/.test(body.innerText),
        btnCount: btns.length,
        btns: btns.slice(0,12),
      };
    });
    report.prematchUi = preUi;
    ok('prematch VS poster', preUi.hasVsPoster);
    ok('prematch lineup rows', preUi.hasLineup);
    ok('prematch intel panel', preUi.hasIntel);
    ok('prematch enter-BP button', preUi.hasEnterBp, JSON.stringify(preUi.btns));

    // Try clicking 进入 BP via DOM (real UI path)
    const clickedBp = await page.evaluate(() => {
      const body = document.querySelector('#app-modal-body');
      const btn = Array.from(body.querySelectorAll('button')).find(b=>/进入 BP|进入BP/.test(b.textContent||''));
      if(!btn) return {ok:false, reason:'button not found'};
      btn.click();
      return {ok:true, t:btn.textContent.trim().slice(0,40)};
    });
    ok('click 进入 BP', clickedBp.ok, JSON.stringify(clickedBp));
    await page.waitForTimeout(500);
    await shot(page, 'mp_03_bp_initial');
    report.shots.push('mp_03_bp_initial.png');

    let bpState = await snapState(page);
    report.bpInitial = bpState;
    ok('BP modal open', bpState.modalOn && !!bpState.draft, JSON.stringify(bpState.draft));
    ok('BP title shows draft', /BP|两段式|盲选/.test(bpState.modalTitle), bpState.modalTitle);

    // Inspect BP UI structure
    const bpUi = await page.evaluate(() => {
      const body = document.querySelector('#app-modal-body');
      if(!body || !window._draft) return {err:'no draft'};
      const d = window._draft;
      const act = draftAction(d);
      return {
        phase: phaseLabel(d),
        step: Math.min(d.idx+1, d.isPeak?5:18),
        max: d.isPeak?5:18,
        side: d.sr && d.sr.side,
        act: act.type,
        hasBoard: !!body.querySelector('.bp-board'),
        hasCols: body.querySelectorAll('.bp-col').length,
        banSlots: body.querySelectorAll('.bp-slot.ban').length,
        pickSlots: body.querySelectorAll('.bp-slot.pick').length,
        heroBtns: body.querySelectorAll('.bp-hero').length,
        recBtns: body.querySelectorAll('.bp-hero.rec').length,
        hasVerdict: /预测胜率|有效战力/.test(body.innerText),
        hasOneKey: !!Array.from(body.querySelectorAll('button')).find(b=>/一键推荐/.test(b.textContent||'')),
        hasAuto: !!Array.from(body.querySelectorAll('button')).find(b=>/自动本局/.test(b.textContent||'')),
        hasAutoSeries: !!Array.from(body.querySelectorAll('button')).find(b=>/本系列赛自动/.test(b.textContent||'')),
        hasConfirm: !!Array.from(body.querySelectorAll('button')).find(b=>/确定出战/.test(b.textContent||'')),
        confirmDisabled: (()=>{const b=Array.from(body.querySelectorAll('button')).find(x=>/确定出战/.test(x.textContent||''));return b?b.disabled:null;})(),
        bodyHead: body.innerText.slice(0,250),
      };
    });
    report.bpUi = bpUi;
    log('BP UI:', JSON.stringify(bpUi, null, 0));
    ok('BP board rendered', bpUi.hasBoard && bpUi.hasCols===2, 'cols='+bpUi.hasCols);
    ok('BP ban slots (4/side)', bpUi.banSlots>=4, 'bans='+bpUi.banSlots);
    ok('BP pick slots (5/side)', bpUi.pickSlots>=5, 'picks='+bpUi.pickSlots);
    ok('BP has interactive hero buttons', bpUi.heroBtns>0, 'n='+bpUi.heroBtns);
    ok('BP has recommendation marks', bpUi.recBtns>0, 'n='+bpUi.recBtns);
    ok('BP live power/WR verdict', bpUi.hasVerdict);
    ok('BP has auto controls', bpUi.hasOneKey && bpUi.hasAuto && bpUi.hasAutoSeries);
    ok('BP phase label readable', !!bpUi.phase, bpUi.phase);

    // ---------- 4. Interactive BP: do a few real DOM clicks (not full auto) ----------
    // Step through ~6 player actions via .bp-hero buttons to prove interactivity
    let clickTrail = [];
    for (let i=0; i<8; i++) {
      const step = await page.evaluate(() => {
        const d = window._draft;
        if(!d) return {done:true, reason:'no draft'};
        const act = draftAction(d);
        if(act.type==='done') return {done:true, reason:'bp complete', idx:d.idx};
        // Prefer recommended button; else first available
        let btn = document.querySelector('#app-modal-body .bp-hero.rec')
          || document.querySelector('#app-modal-body .bp-hero.pos')
          || document.querySelector('#app-modal-body .bp-hero');
        if(!btn) {
          // pick phase may need position first
          if(act.type==='pick' && !d.curPos) {
            const posBtn = document.querySelector('#app-modal-body .bp-hero.pos');
            if(posBtn){ posBtn.click(); return {step:'choosePos', idx:d.idx, act:act.type}; }
          }
          return {done:false, reason:'no hero button', act:act.type, idx:d.idx, curPos:d.curPos};
        }
        const label = (btn.textContent||'').trim().slice(0,40);
        const beforeIdx = d.idx;
        btn.click();
        return {
          step: 'click',
          label,
          act: act.type,
          beforeIdx,
          afterIdx: window._draft ? window._draft.idx : null,
          afterAct: window._draft ? draftAction(window._draft).type : null,
        };
      });
      clickTrail.push(step);
      log('bp click', i, JSON.stringify(step));
      if(step.done) break;
      await page.waitForTimeout(120);
    }
    report.clickTrail = clickTrail;
    const advanced = clickTrail.some(s => s.afterIdx!=null && s.afterIdx > (s.beforeIdx||0));
    ok('BP DOM clicks advance draft', advanced || (clickTrail.some(s=>s.done)), JSON.stringify(clickTrail.slice(0,3)));

    await shot(page, 'mp_04_bp_mid_interactive');
    report.shots.push('mp_04_bp_mid_interactive.png');

    // ---------- 5. Complete this game via 一键推荐 + 确定出战 (or bpAuto) ----------
    const completed = await page.evaluate(() => {
      try {
        const d = window._draft;
        if(!d) return {ok:false, reason:'no draft'};
        // Fill remaining via suggest
        if(draftAction(d).type!=='done') bpSuggest();
        const afterSuggest = window._draft ? {
          idx: window._draft.idx,
          myPicks: Object.keys(window._draft.myPicks).length,
          myBans: window._draft.myBans.length,
          done: draftAction(window._draft).type==='done',
        } : null;
        bpConfirm();
        return {
          ok:true,
          afterSuggest,
          seriesGone: !S.series || S.series.mw+S.series.ow>0 || !window._draft,
          series: S.series ? {mw:S.series.mw, ow:S.series.ow, max:S.series.max} : null,
          modal: !!document.querySelector('#app-modal.on'),
          modalTitle: (document.querySelector('#app-modal-body h2')||{}).textContent||'',
        };
      } catch(e){ return {ok:false, err:e.message, stack:(e.stack||'').split('\n')[0]}; }
    });
    ok('bpSuggest+bpConfirm plays a game', completed.ok, JSON.stringify(completed));
    report.game1 = completed;
    await page.waitForTimeout(400);
    await shot(page, 'mp_05_after_game1');
    report.shots.push('mp_05_after_game1.png');

    const after1 = await snapState(page);
    report.afterGame1 = after1;
    log('after game1:', JSON.stringify(after1));

    // If series continues, openBP again or side choice may be showing
    const mid = await page.evaluate(() => {
      const body = document.querySelector('#app-modal-body');
      const txt = body ? body.innerText.slice(0,300) : '';
      const hasSide = /败方选边|蓝方|红方/.test(txt) && !!Array.from(body.querySelectorAll('button')).find(b=>/setSide/.test(b.getAttribute('onclick')||''));
      const btns = body ? Array.from(body.querySelectorAll('button')).map(b=>({
        t:(b.textContent||'').trim().slice(0,30),
        onclick:(b.getAttribute('onclick')||'').slice(0,50),
      })) : [];
      return { hasSeries:!!S.series, score:S.series?S.series.mw+':'+S.series.ow:null, hasSideChoice:hasSide, btns:btns.slice(0,10), head:txt.slice(0,200) };
    });
    report.midSeriesUi = mid;
    log('mid UI:', JSON.stringify(mid));

    // ---------- 6. Drive remaining games of the series ----------
    // Loop: if side choice → pick blue; if BP → auto this game; until series ends
    let seriesLoop = [];
    for (let g=0; g<8; g++) {
      const st = await page.evaluate(() => {
        if(!S.series) return {ended:true};
        const body = document.querySelector('#app-modal-body');
        const txt = body ? body.innerText : '';
        const sideBtn = body ? Array.from(body.querySelectorAll('button')).find(b=>/setSide\(/.test(b.getAttribute('onclick')||'')) : null;
        if(sideBtn) {
          sideBtn.click();
          return {action:'setSide', score:S.series.mw+':'+S.series.ow};
        }
        if(window._draft) {
          bpAuto(); // suggest + confirm → playGame
          return {action:'bpAuto', score:S.series?S.series.mw+':'+S.series.ow:null, draftAfter: !!window._draft};
        }
        // maybe prematch leftover
        if(/进入 BP|进入BP/.test(txt)) {
          const btn = Array.from(body.querySelectorAll('button')).find(b=>/进入 BP|进入BP/.test(b.textContent||''));
          if(btn){ btn.click(); return {action:'enterBP', score:S.series.mw+':'+S.series.ow}; }
        }
        // maybe need openBP again after a win (AI loses → auto side → openBP)
        return {action:'inspect', score:S.series.mw+':'+S.series.ow, head:txt.slice(0,120), draft:!!window._draft};
      });
      seriesLoop.push(st);
      log('series loop', g, JSON.stringify(st));
      if(st.ended) break;
      await page.waitForTimeout(250);
      // If no modal and series still alive, force openBP via startMatch resume path
      const needsOpen = await page.evaluate(() => {
        if(!S.series) return false;
        const on = !!document.querySelector('#app-modal.on');
        if(on) return false;
        try { startMatch(); return true; } catch(e){ return 'err:'+e.message; }
      });
      if(needsOpen===true) await page.waitForTimeout(200);
    }
    report.seriesLoop = seriesLoop;

    // If still stuck, force autoPlayNext until done
    let forceGuard=0;
    while(forceGuard++<10){
      const alive = await page.evaluate(() => {
        if(!S.series) return false;
        try {
          if(S.series && S.series.stage==='regular' && (S.series.mw+S.series.ow)===0 && !window._draft){
            // should not happen
          }
          if(!S.series) return false;
          // complete series by auto BP if mid-series without draft
          if(!window._draft && S.series && (S.series.mw < Math.ceil(S.series.max/2) && S.series.ow < Math.ceil(S.series.max/2))){
            // if side-choice modal, pick blue
            const sideBtn = Array.from(document.querySelectorAll('#app-modal-body button')).find(b=>/setSide\(/.test(b.getAttribute('onclick')||''));
            if(sideBtn){ sideBtn.click(); return true; }
            // resume / open next BP
            try {
              S.seriesAuto = true;
              autoPlayNext();
            } catch(e){
              try { openBP('自动续局', playGame); } catch(e2){}
            }
            return true;
          }
          return !!S.series;
        } catch(e){ return true; }
      });
      if(!alive) break;
      await page.waitForTimeout(200);
      const snap = await snapState(page);
      if(!snap.series) break;
    }

    const finalSnap = await snapState(page);
    report.finalState = finalSnap;
    ok('series ended cleanly (S.series cleared)', !finalSnap.series, JSON.stringify(finalSnap.series));
    ok('match modal shows result', finalSnap.modalOn && /胜|负|VS|vs|比赛|继续|推进/.test(finalSnap.modalTitle+finalSnap.modalSnippet), finalSnap.modalTitle);

    await shot(page, 'mp_06_series_result');
    report.shots.push('mp_06_series_result.png');

    // Inspect result modal quality
    const resultUi = await page.evaluate(() => {
      const body = document.querySelector('#app-modal-body');
      if(!body) return {err:'no body'};
      return {
        title: (body.querySelector('h2')||{textContent:''}).textContent,
        hasBand: !!body.querySelector('.result-band'),
        bandWin: !!(body.querySelector('.result-band.win')),
        bandLose: !!(body.querySelector('.result-band.lose')),
        hasMvp: !!body.querySelector('.mvp-card'),
        logLines: body.querySelectorAll('.logbox > div').length,
        hasContinue: !!Array.from(body.querySelectorAll('button')).find(b=>/继续|推进|进入转会/.test(b.textContent||'')),
        scoreText: (body.querySelector('.result-band')||{innerText:''}).innerText.replace(/\s+/g,' ').slice(0,80),
        head: body.innerText.slice(0,350),
      };
    });
    report.resultUi = resultUi;
    log('result UI:', JSON.stringify(resultUi));
    ok('result score band', resultUi.hasBand, resultUi.scoreText);
    ok('result live log lines', (resultUi.logLines||0)>3, 'lines='+resultUi.logLines);
    ok('result continue button', resultUi.hasContinue);
    // MVP card may be absent if no MVP was recorded — note only
    report.notes.push('SERIES MVP card present: ' + (resultUi.hasMvp?'yes':'no'));

    // Click continue — series should fully close and day advance
    const cont = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#app-modal-body button')).find(b=>/继续|推进|进入转会/.test(b.textContent||''));
      if(!btn) return {ok:false, reason:'no continue btn'};
      btn.click();
      return { ok:true, t:btn.textContent.trim().slice(0,40) };
    });
    ok('click continue after result', cont.ok, JSON.stringify(cont));
    await page.waitForTimeout(400);

    const afterCont = await page.evaluate(() => ({
      modalOn: !!document.querySelector('#app-modal.on'),
      series: !!S.series,
      matchIdx: S.matchIdx,
      phase: S.phase,
      day: S.day,
      page: (document.querySelector('.page.on')||{}).id || null,
    }));
    report.afterContinue = afterCont;
    ok('continue closes modal & advances', !afterCont.modalOn && !afterCont.series, JSON.stringify(afterCont));
    await shot(page, 'mp_07_after_continue');
    report.shots.push('mp_07_after_continue.png');

    // ---------- 7. Second match path: uiStartMatch from club page ----------
    const second = await page.evaluate(() => {
      try {
        // ensure we're past transfer
        S.preseason=false; S.transferWindow=0;
        uiStartMatch();
        return { ok:true, series:!!S.series, modal:!!document.querySelector('#app-modal.on') };
      } catch(e){ return {ok:false, err:e.message}; }
    });
    ok('uiStartMatch opens second prematch', second.ok && second.series && second.modal, JSON.stringify(second));
    await page.waitForTimeout(300);
    await shot(page, 'mp_08_second_prematch');
    report.shots.push('mp_08_second_prematch.png');

    // Use 自动本局 button from BP for contrast
    const autoPath = await page.evaluate(() => {
      try {
        closeModal('app-modal');
        openBP('自动路径测试', playGame);
        const before = window._draft ? window._draft.idx : -1;
        bpAuto();
        return {
          ok:true,
          series: S.series ? {mw:S.series.mw, ow:S.series.ow} : null,
          draftLeft: !!window._draft,
        };
      } catch(e){ return {ok:false, err:e.message}; }
    });
    ok('bpAuto path plays a game', autoPath.ok && autoPath.series && (autoPath.series.mw+autoPath.series.ow)>=1, JSON.stringify(autoPath));
    report.autoPath = autoPath;
    await page.waitForTimeout(300);
    await shot(page, 'mp_09_auto_path_result');
    report.shots.push('mp_09_auto_path_result.png');

    // Console/page errors already hooked; gather any collected
    report.done = true;

    // ---------- Summary ----------
    const passN = report.checks.filter(c=>c.pass).length;
    const failN = report.checks.filter(c=>!c.pass).length;
    console.log('\n========== MATCH+BP PLAYTHROUGH ==========');
    console.log('PASS', passN, '/ FAIL', failN, '/ TOTAL', report.checks.length);
    if(report.errors.length){
      console.log('Failures:');
      report.errors.forEach(e=>console.log('  -', e));
    }
    console.log('Shots:', report.shots.join(', '));
    console.log('Verdict:');
    console.log('  BP interactive:', report.checks.find(c=>c.name.includes('DOM clicks'))?.pass ? 'YES (DOM clicks advance)' : 'PARTIAL (auto APIs only)');
    console.log('  BP readable:', report.checks.find(c=>c.name.includes('BP board'))?.pass && report.checks.find(c=>c.name.includes('verdict'))?.pass ? 'YES' : 'CHECK');
    console.log('  Match ends cleanly:', report.checks.find(c=>c.name.includes('series ended'))?.pass ? 'YES' : 'CHECK');
    require('fs').writeFileSync('E:/sex/gui-test-screenshots/mp_report.json', JSON.stringify(report, null, 2));
    console.log('Report JSON: E:/sex/gui-test-screenshots/mp_report.json');
    console.log('==========================================');

  } catch(e){
    fail('script exception', e.message);
    console.error(e);
    try { await shot(page, 'mp_99_exception'); } catch(_){}
  } finally {
    await browser.close();
  }
  process.exit(report.errors.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

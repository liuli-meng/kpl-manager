/* 阵容/战术板/更衣室 playtest: createTeam → lineup cards → tactic switch → captain */
const { launch, clearAndStart, shot } = require('./pw.js');

(async () => {
  const issues = [];
  const shots = [];
  const report = { steps: [], playerCards: [], tactic: {}, captain: {} };
  const { browser, page } = await launch();

  try {
    await page.waitForTimeout(500);

    // ---- 1. Fresh start + createTeam '战术室' ----
    await clearAndStart(page);
    await page.waitForTimeout(700);

    // Dismiss tour if present
    await page.evaluate(() => {
      try { if (window._tour && typeof tourSkip === 'function') tourSkip(); } catch (e) {}
      try { closeModal('start-modal'); closeModal('app-modal'); } catch (e) {}
    });
    await page.waitForTimeout(200);

    const created = await page.evaluate(() => {
      const nameEl = document.getElementById('new-team-name');
      if (!nameEl) return { ok: false, reason: 'no #new-team-name' };
      nameEl.value = '战术室';
      if (typeof createTeam !== 'function') return { ok: false, reason: 'no createTeam' };
      try {
        createTeam();
        return {
          ok: true,
          teamName: S.teamName,
          selfBuilt: !!S.selfBuilt,
          fund: S.fund,
          playerCount: (S.players || []).length,
          lineup: S.lineup || [],
          tactic: S.tactic || null,
          tacticW: S.tacticW || null,
          captain: S.captain,
          page: document.querySelector('.page.on')?.id || null,
        };
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e) };
      }
    });
    report.steps.push({ step: 'createTeam', created });
    if (!created.ok) issues.push('createTeam failed: ' + created.reason);
    if (created.ok && created.teamName !== '战术室') issues.push('teamName mismatch: ' + created.teamName);
    if (created.ok && created.playerCount === 0) issues.push('created team has 0 players');
    if (created.ok && created.tactic) issues.push('unexpected initial tactic: ' + created.tactic);

    await page.waitForTimeout(400);
    // Close any tour that auto-opened after createTeam → goPage('market')
    await page.evaluate(() => {
      try { if (window._tour && typeof tourSkip === 'function') tourSkip(); } catch (e) {}
      try { closeModal('app-modal'); } catch (e) {}
    });
    await page.waitForTimeout(200);
    shots.push(await shot(page, 'lineup-tac-01-after-create'));

    // ---- 2. goPage('lineup') + screenshot + dump player cards ----
    await page.evaluate(() => { goPage('lineup'); });
    await page.waitForTimeout(400);
    // Close tour again if lineup guide popped
    await page.evaluate(() => {
      try { if (window._tour && typeof tourSkip === 'function') tourSkip(); } catch (e) {}
      try { closeModal('app-modal'); } catch (e) {}
    });
    await page.waitForTimeout(200);
    shots.push(await shot(page, 'lineup-tac-02-lineup'));

    const lineupDump = await page.evaluate(() => {
      const section = document.getElementById('page-lineup');
      if (!section) return { ok: false, reason: 'no #page-lineup' };

      const panels = [...section.querySelectorAll('.panel')].map(el => {
        const h = el.querySelector('h3');
        return h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 100) : '(no h3)';
      });

      const cards = [...section.querySelectorAll('.pcard')].map(el => ({
        text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        hasCaptainBtn: /任队长|摘袖标/.test(el.innerText || ''),
        hasCaptainTag: /队长/.test(el.innerText || ''),
        hasSellBtn: /出售/.test(el.innerText || ''),
        hasSwapBtn: /换下|放入首发/.test(el.innerText || ''),
      }));

      const tacticBtns = [...section.querySelectorAll('button')]
        .filter(b => (b.getAttribute('onclick') || '').includes('setTactic'))
        .map(b => ({
          text: (b.innerText || '').trim(),
          onclick: b.getAttribute('onclick') || '',
          title: b.getAttribute('title') || '',
          isPrimary: (b.className || '').includes('primary'),
        }));

      const captainBtns = [...section.querySelectorAll('button')]
        .filter(b => (b.getAttribute('onclick') || '').includes('setCaptain'))
        .map(b => ({
          text: (b.innerText || '').trim(),
          onclick: b.getAttribute('onclick') || '',
        }));

      const powerLine = (section.querySelector('.panel .dim')?.innerText || '').replace(/\s+/g, ' ').trim();
      const tacticHeader = [...section.querySelectorAll('.panel h3')]
        .map(h => h.textContent.replace(/\s+/g, ' ').trim())
        .find(t => t.includes('战术板')) || '';

      const pageText = (section.innerText || '');
      const overflowX = section.scrollWidth > section.clientWidth + 8;
      const navVisible = (() => {
        const btn = document.querySelector('nav button[data-page="lineup"]');
        return btn ? getComputedStyle(btn).display !== 'none' && btn.offsetParent !== null : false;
      })();

      return {
        ok: true,
        pageDisplay: getComputedStyle(section).display,
        textLen: pageText.trim().length,
        hasChinese: /[\u4e00-\u9fff]/.test(pageText),
        overflowX,
        navVisible,
        panels,
        cardCount: cards.length,
        cards,
        tacticBtns,
        captainBtnCount: captainBtns.length,
        captainBtns: captainBtns.slice(0, 8),
        powerLine,
        tacticHeader,
        hasTacticPanel: !!tacticHeader,
      };
    });
    report.steps.push({ step: 'goPage-lineup', lineupDump });
    if (!lineupDump.ok) issues.push('lineup dump failed: ' + lineupDump.reason);
    else {
      if (lineupDump.pageDisplay === 'none' || lineupDump.pageDisplay === 'missing') issues.push('lineup section display=' + lineupDump.pageDisplay);
      if (lineupDump.textLen < 50) issues.push('lineup empty textLen=' + lineupDump.textLen);
      if (!lineupDump.hasChinese) issues.push('lineup no Chinese text');
      if (lineupDump.overflowX) issues.push('lineup horizontal overflow');
      if (!lineupDump.navVisible) issues.push('lineup nav button not visible');
      if (lineupDump.cardCount === 0) issues.push('no player cards on lineup');
      if (!lineupDump.hasTacticPanel) issues.push('no 战术板 panel on lineup');
      if (lineupDump.tacticBtns.length === 0) issues.push('no setTactic buttons');
      if (lineupDump.captainBtnCount === 0) issues.push('no setCaptain buttons on lineup');
    }

    // Detailed player card data from S
    const playerData = await page.evaluate(() => {
      const ls = (typeof rosterLineup === 'function') ? rosterLineup(S) : S.players.filter(p => S.lineup.includes(p.id));
      const bn = (typeof rosterBench === 'function') ? rosterBench(S) : [];
      const pack = (p) => ({
        id: p.id,
        name: p.name,
        pos: p.pos,
        age: p.age,
        overall: (typeof overall === 'function') ? overall(p) : null,
        power: (typeof playerPower === 'function') ? playerPower(p, (typeof pickedHero === 'function') ? pickedHero(S, p) : p.sig) : null,
        attrs: p.attrs,
        skill: p.skill ? p.skill.n || p.skill.t : null,
        morale: p.morale,
        energy: p.energy,
        wage: p.wage,
        contract: p.contract,
        injury: p.injury,
        sig: p.sig,
        tags: p.tags || [],
        isCaptain: S.captain === p.id,
        inLineup: S.lineup.includes(p.id),
      });
      return {
        lineup: ls.map(pack),
        bench: bn.map(pack),
        teamPower: (typeof teamPower === 'function') ? teamPower(S) : null,
        captain: S.captain,
        tactic: S.tactic || null,
        tacticW: S.tacticW || null,
      };
    });
    report.playerCards = playerData.lineup;
    report.benchCards = playerData.bench;
    report.teamPowerInitial = playerData.teamPower;
    if (playerData.lineup.length === 0) issues.push('S.lineup has 0 starting players');

    // ---- 3. Tactic UI discovery + switch + verify power change ----
    const tacticBefore = await page.evaluate(() => {
      const t = (typeof tacticById === 'function') ? tacticById(S.tactic || 'balanced') : null;
      const powers = (typeof rosterLineup === 'function' ? rosterLineup(S) : []).map(p => ({
        id: p.id, name: p.name, pos: p.pos,
        power: playerPower(p, pickedHero(S, p)),
        attrs: p.attrs,
      }));
      return {
        tacticId: S.tactic || 'balanced',
        tacticName: t ? t.name : null,
        tacticW: S.tacticW || null,
        teamPower: teamPower(S),
        playerPowers: powers,
      };
    });
    report.tactic.before = tacticBefore;

    // Discover TACTICS list + each power under each tactic
    const tacticScan = await page.evaluate(() => {
      const results = [];
      const orig = { tactic: S.tactic, tacticW: S.tacticW ? { ...S.tacticW } : null };
      try {
        TACTICS.forEach(t => {
          // Apply weights without side effects by writing fields then computing
          S.tactic = t.id;
          S.tacticW = { ...t.w };
          const powers = rosterLineup(S).map(p => ({
            id: p.id, name: p.name, pos: p.pos,
            power: playerPower(p, pickedHero(S, p)),
          }));
          results.push({
            id: t.id,
            name: t.name,
            desc: t.desc,
            beats: t.beats,
            w: t.w,
            teamPower: teamPower(S),
            powers,
          });
        });
      } finally {
        S.tactic = orig.tactic;
        S.tacticW = orig.tacticW;
      }
      return {
        tactics: results,
        hasSetTactic: typeof setTactic === 'function',
        hasTacticById: typeof tacticById === 'function',
        hasTacticWGlobal: typeof tacticWeights === 'function',
      };
    });
    report.tactic.scan = tacticScan;
    if (!tacticScan.hasSetTactic) issues.push('setTactic function missing');

    // Pick a non-default tactic that maximizes |teamPower delta| vs current
    const switchTarget = await page.evaluate(() => {
      const curId = S.tactic || 'balanced';
      const curPow = teamPower(S);
      let best = null;
      TACTICS.forEach(t => {
        if (t.id === curId) return;
        S.tactic = t.id;
        S.tacticW = { ...t.w };
        const pow = teamPower(S);
        const delta = pow - curPow;
        if (!best || Math.abs(delta) > Math.abs(best.delta)) {
          best = { id: t.id, name: t.name, power: pow, delta };
        }
      });
      // restore
      const cur = tacticById(curId);
      S.tactic = cur.id;
      S.tacticW = cur.w ? { ...cur.w } : null;
      return { curId, curPow, target: best };
    });
    report.tactic.switchTarget = switchTarget;

    // Switch via UI-equivalent evaluate (setTactic)
    const switchResult = await page.evaluate((tid) => {
      if (typeof setTactic !== 'function') return { ok: false, reason: 'no setTactic' };
      const before = {
        tactic: S.tactic || 'balanced',
        tacticW: S.tacticW ? { ...S.tacticW } : null,
        teamPower: teamPower(S),
        playerPowers: rosterLineup(S).map(p => ({ id: p.id, name: p.name, power: playerPower(p, pickedHero(S, p)) })),
      };
      try {
        setTactic(tid);
        const after = {
          tactic: S.tactic,
          tacticW: S.tacticW ? { ...S.tacticW } : null,
          teamPower: teamPower(S),
          playerPowers: rosterLineup(S).map(p => ({ id: p.id, name: p.name, power: playerPower(p, pickedHero(S, p)) })),
        };
        // UI re-render check: primary button should match new tactic
        const primary = [...document.querySelectorAll('#page-lineup button')]
          .filter(b => (b.getAttribute('onclick') || '').includes('setTactic'))
          .filter(b => (b.className || '').includes('primary'))
          .map(b => (b.innerText || '').trim());
        const header = [...document.querySelectorAll('#page-lineup .panel h3')]
          .map(h => h.textContent.replace(/\s+/g, ' ').trim())
          .find(t => t.includes('战术板')) || '';
        return {
          ok: true,
          before,
          after,
          powerDelta: after.teamPower - before.teamPower,
          tacticWMatches: JSON.stringify(after.tacticW) === JSON.stringify(tacticById(tid).w),
          primaryButtons: primary,
          tacticHeader: header,
        };
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e) };
      }
    }, switchTarget.target ? switchTarget.target.id : 'team');

    report.tactic.switchResult = switchResult;
    if (!switchResult.ok) issues.push('setTactic switch failed: ' + switchResult.reason);
    else {
      if (switchResult.powerDelta === 0 && switchTarget.target && switchTarget.target.delta !== 0) {
        issues.push('setTactic applied but teamPower did not change (delta=0, expected ' + switchTarget.target.delta + ')');
      }
      if (!switchResult.tacticWMatches) issues.push('S.tacticW does not match tacticById weights');
      if (!switchResult.primaryButtons.length) issues.push('after switch: no primary tactic button in UI');
      // header should show current tactic name (use scan for the human name)
      const switchedId = switchResult.after.tactic;
      const switchedName = (tacticScan.tactics.find(t => t.id === switchedId) || {}).name || switchedId;
      if (!switchResult.tacticHeader.includes(switchedName)) {
        issues.push('tactic header does not show new tactic: header=' + switchResult.tacticHeader + ' expect=' + switchedName);
      }
    }

    await page.waitForTimeout(300);
    shots.push(await shot(page, 'lineup-tac-03-after-tactic-switch'));

    // ---- 4. Captain appoint ----
    // Pick first lineup player as captain target
    const captainTarget = await page.evaluate(() => {
      const ls = rosterLineup(S);
      if (!ls.length) return null;
      // Prefer someone who is not already captain
      const p = ls.find(x => S.captain !== x.id) || ls[0];
      return {
        id: p.id,
        name: p.name,
        pos: p.pos,
        alreadyCaptain: S.captain === p.id,
        moraleBefore: p.morale,
        teamPowerBefore: teamPower(S),
        allMoraleBefore: rosterLineup(S).map(x => ({ id: x.id, name: x.name, morale: x.morale })),
      };
    });
    report.captain.target = captainTarget;

    const captainResult = await page.evaluate((cid) => {
      if (typeof setCaptain !== 'function') return { ok: false, reason: 'no setCaptain' };
      try {
        setCaptain(cid);
        const p = S.players.find(x => x.id === cid);
        const inLineup = S.lineup.includes(cid);
        const cardHasTag = [...document.querySelectorAll('#page-lineup .pcard')].some(el => {
          return (el.innerText || '').includes('队长') && (el.innerText || '').includes(p ? p.name : '');
        });
        const btnLabels = [...document.querySelectorAll('#page-lineup button')]
          .filter(b => (b.getAttribute('onclick') || '').includes('setCaptain'))
          .map(b => (b.innerText || '').trim());
        return {
          ok: true,
          captainId: S.captain,
          captainName: p ? p.name : null,
          inLineup,
          teamPower: teamPower(S),
          moraleAfter: rosterLineup(S).map(x => ({ id: x.id, name: x.name, morale: x.morale })),
          cardHasCaptainTag: cardHasTag,
          btnLabels,
          hasStripLabel: btnLabels.some(t => t === '摘袖标'),
          hasAppointLabel: btnLabels.some(t => t === '任队长'),
        };
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e) };
      }
    }, captainTarget.id);

    report.captain.appoint = captainResult;
    if (!captainResult.ok) issues.push('setCaptain failed: ' + captainResult.reason);
    else {
      if (captainResult.captainId !== captainTarget.id) issues.push('S.captain not set to target: got ' + captainResult.captainId);
      if (!captainResult.cardHasCaptainTag) issues.push('captain tag not visible on player card');
      if (!captainResult.hasStripLabel) issues.push('no 摘袖标 button after appoint');
      // Captain in lineup should bump teamPower by ~2%
      if (captainTarget && captainTarget.teamPowerBefore) {
        const ratio = captainResult.teamPower / captainTarget.teamPowerBefore;
        if (ratio < 1.005 || ratio > 1.05) {
          issues.push('captain teamPower ratio unexpected: ' + ratio.toFixed(4) + ' (expect ~1.02)');
        }
      }
      // Morale: captain +5, others +3
      const capMorale = captainResult.moraleAfter.find(x => x.id === captainTarget.id);
      if (capMorale && captainTarget.moraleBefore != null) {
        const d = capMorale.morale - captainTarget.moraleBefore;
        // clamp 20-100 may cap
        if (d < 0) issues.push('captain morale decreased after appoint: ' + d);
      }
    }

    await page.waitForTimeout(300);
    shots.push(await shot(page, 'lineup-tac-04-captain'));

    // Toggle off (摘袖标) to verify reverse path
    const stripResult = await page.evaluate((cid) => {
      try {
        setCaptain(cid); // toggle off
        return {
          ok: true,
          captainAfterToggle: S.captain,
          stripped: S.captain !== cid,
          teamPower: teamPower(S),
        };
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e) };
      }
    }, captainTarget.id);
    report.captain.strip = stripResult;
    if (!stripResult.ok) issues.push('setCaptain strip failed: ' + stripResult.reason);
    else if (!stripResult.stripped) issues.push('captain not stripped on second setCaptain call');

    // Re-appoint so end state has a captain (more realistic)
    await page.evaluate((cid) => { try { setCaptain(cid); } catch (e) {} }, captainTarget.id);
    await page.waitForTimeout(200);

    // Final UI state
    const finalState = await page.evaluate(() => ({
      teamName: S.teamName,
      tactic: S.tactic,
      tacticName: tacticById(S.tactic || 'balanced').name,
      tacticW: S.tacticW,
      captain: S.captain,
      captainName: (S.players.find(p => p.id === S.captain) || {}).name || null,
      teamPower: teamPower(S),
      lineupCount: S.lineup.length,
      playerCount: S.players.length,
      page: document.querySelector('.page.on')?.id || null,
    }));
    report.final = finalState;
    shots.push(await shot(page, 'lineup-tac-05-final'));

    // ---- 5. Close (leave lineup; no open modals) ----
    const closeResult = await page.evaluate(() => {
      try { closeModal('app-modal'); closeModal('start-modal'); } catch (e) {}
      const openModals = [...document.querySelectorAll('.modal.on, .modal[style*="display: block"]')]
        .map(m => m.id || m.className);
      return { openModals, page: document.querySelector('.page.on')?.id || null };
    });
    report.steps.push({ step: 'close', closeResult });

    // Console/page errors from launch hook are logged by helper; capture any residual toast
    const toast = await page.evaluate(() => {
      const t = document.querySelector('.toast, #toast, [class*="toast"]');
      return t ? (t.innerText || '').trim() : '';
    });
    report.toast = toast;
    report.issues = issues;
    report.shots = shots;

    console.log('===PLAYTEST_RESULT===');
    console.log(JSON.stringify(report, null, 2));
    console.log('===END===');
  } catch (e) {
    console.error('[fatal]', e);
    issues.push('fatal: ' + (e && e.message || e));
    console.log('===PLAYTEST_RESULT===');
    console.log(JSON.stringify({ issues, shots, report }, null, 2));
    console.log('===END===');
  } finally {
    await browser.close();
  }
})();

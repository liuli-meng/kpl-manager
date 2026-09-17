// Playthrough: 二队K甲 flow
const { launch, clearAndStart, shot, call } = require('./pw');

(async () => {
  const { browser, page } = await launch();
  const issues = [];
  page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));

  await clearAndStart(page);

  // 1) createTeam '二队总管'
  const created = await page.evaluate(() => {
    const nameEl = document.querySelector('#new-team-name');
    if (!nameEl) return { ok: false, err: 'no #new-team-name' };
    nameEl.value = '二队总管';
    try {
      createTeam();
      return {
        ok: true,
        team: S && S.teamName,
        players: S ? S.players.length : 0,
        lineup: S ? S.lineup.length : 0,
        day: S ? S.day : null,
        preseason: S ? !!S.preseason : null,
        transferWindow: S ? S.transferWindow : null,
      };
    } catch (e) {
      return { ok: false, err: e.message, stack: e.stack };
    }
  });
  console.log('CREATE', JSON.stringify(created, null, 2));
  await shot(page, 'kjia-01-after-create');

  // 2) goPage('kjia') + screenshot + S.kjia dump
  await page.evaluate(() => goPage('kjia'));
  await page.waitForTimeout(300);
  await shot(page, 'kjia-02-page-initial');

  const dump1 = await page.evaluate(() => {
    if (!S) return { err: 'no S' };
    const k = S.kjia;
    if (!k) return { err: 'S.kjia missing', keys: Object.keys(S).filter(x => /k/i.test(x)) };
    return {
      my: k.my,
      champ: k.champ,
      rd: k.rd,
      day: k.day,
      roundsLen: k.rounds.length,
      teams: k.teams,
      teamsCount: k.teams.length,
      powers: k.powers,
      tablesKeys: Object.keys(k.tables || {}),
      resultsLen: (k.results || []).length,
      squadCount: (k.squad || []).length,
      squadSample: (k.squad || []).slice(0, 3).map(p => ({ id: p.id, name: p.name, pos: p.pos, tags: p.tags })),
      demoted: (S.players || []).filter(p => p.kjia > 0).map(p => p.id),
      playersCount: (S.players || []).length,
      lineup: S.lineup,
      pageHtmlLen: (document.querySelector('#page-kjia') || {}).innerHTML?.length || 0,
      pageHasPanel: !!document.querySelector('#page-kjia .panel'),
      pageHasScoreboard: /积分榜/.test(document.querySelector('#page-kjia')?.innerHTML || ''),
      pageHasRoster: /二队班底/.test(document.querySelector('#page-kjia')?.innerHTML || ''),
    };
  });
  console.log('KJIA_INITIAL', JSON.stringify(dump1, null, 2));

  // 3) send down a bench/start player
  // createTeam fills exactly 5 starters (one per pos) — no true bench; send a starter
  const sendRes = await page.evaluate(() => {
    const bench = S.players.filter(p => (S.lineup || []).indexOf(p.id) < 0);
    const target = bench[0] || S.players[S.players.length - 1];
    if (!target) return { ok: false, err: 'no player' };
    const before = {
      id: target.id,
      name: target.name,
      pos: target.pos,
      inLineup: (S.lineup || []).indexOf(target.id) >= 0,
      kjia: target.kjia || 0,
      powerFn: typeof sendKjia,
      loanDown: typeof loanDown,
      kjiaSend: typeof kjiaSend,
    };
    try {
      sendKjia(target.id); // lineup-page single-arg form
    } catch (e) {
      return { ok: false, before, err: e.message };
    }
    const p = S.players.find(x => x.id === target.id);
    return {
      ok: true,
      before,
      after: {
        kjia: p ? p.kjia : null,
        stillInRoster: !!p,
        stillInLineup: (S.lineup || []).indexOf(target.id) >= 0,
        demotedCount: S.players.filter(x => x.kjia > 0).length,
        kjiaSquadHas: typeof kjiaSquad === 'function' && kjiaSquad(S).some(x => x.id === target.id),
        teamPower: typeof kjiaTeamPower === 'function' ? kjiaTeamPower(S) : null,
        lastLog: (S.eventLog || [])[0],
      },
    };
  });
  console.log('SEND_KJIA', JSON.stringify(sendRes, null, 2));

  // re-render kjia page after send
  await page.evaluate(() => goPage('kjia'));
  await page.waitForTimeout(200);
  await shot(page, 'kjia-03-after-send');

  // 4) advance days to see match progress
  const advance = await page.evaluate(() => {
    const targetId = (S.players.find(p => p.kjia > 0) || {}).id;
    const marks = [];
    for (let i = 0; i < 16; i++) {
      try {
        nextDay(S);
      } catch (e) {
        return { ok: false, err: e.message, at: i, stack: e.stack, marks };
      }
      if (S.kjia.day % 2 === 0) {
        marks.push({
          day: S.day,
          kjiaDay: S.kjia.day,
          rd: S.kjia.rd,
          results0: S.kjia.results[0] || null,
          playerKjia: (S.players.find(p => p.id === targetId) || {}).kjia,
          stats: (S.players.find(p => p.id === targetId) || {}).kjiaStats || null,
        });
      }
    }
    return {
      ok: true,
      day: S.day,
      kjiaDay: S.kjia.day,
      rd: S.kjia.rd,
      resultsLen: S.kjia.results.length,
      results: S.kjia.results.slice(0, 5),
      tables: S.kjia.tables,
      champ: S.kjia.champ,
      player: S.players.find(p => p.id === targetId)
        ? {
            id: targetId,
            kjia: S.players.find(p => p.id === targetId).kjia,
            stats: S.players.find(p => p.id === targetId).kjiaStats || null,
            log: S.players.find(p => p.id === targetId).kjiaLog || [],
            kjiaGain: S.players.find(p => p.id === targetId).kjiaGain || 0,
          }
        : null,
      marks,
    };
  });
  console.log('ADVANCE', JSON.stringify(advance, null, 2));

  await page.evaluate(() => goPage('kjia'));
  await page.waitForTimeout(200);
  await shot(page, 'kjia-04-after-advance');

  const dumpFinal = await page.evaluate(() => {
    const k = S.kjia;
    const demoted = S.players.filter(p => p.kjia > 0);
    return {
      rd: k.rd,
      day: k.day,
      champ: k.champ,
      resultsCount: k.results.length,
      demotedCount: demoted.length,
      demotedSample: demoted.map(p => ({ name: p.name, kjia: p.kjia, stats: p.kjiaStats })),
      pageHasDemotedPanel: /下放选手表现/.test(document.querySelector('#page-kjia')?.innerHTML || ''),
      pageHtmlSnippet: (document.querySelector('#page-kjia')?.innerText || '').slice(0, 400),
    };
  });
  console.log('FINAL', JSON.stringify(dumpFinal, null, 2));
  console.log('ISSUES', JSON.stringify(issues));

  await browser.close();
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});

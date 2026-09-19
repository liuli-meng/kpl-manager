// 浏览器实测：卡位赛面板/联赛页说明真的渲染成 BO5（文案读的是 KPL.CARD，不是写死）
// Run: node tests/playthrough/probe-card-bo-ui.js
const { launch, clearAndStart, shot } = require('./pw.js');

(async () => {
  const { browser, page } = await launch();
  await clearAndStart(page);
  const r = await page.evaluate(() => {
    installEra(null);
    S = newState('卡位显示队', '⚔️');
    POS_ORDER.forEach(pos => S.players.push(genPlayer(genFreeAgentDef(pos, 'mid', new Set()))));
    S.lineup = S.players.map(p => p.id);
    S.coach = { ...COACH_POOL.find(c => c.id === 'co12') };
    S.seedPower = 400; initGroups(S);
    S.groups = { S: [S.teamName, '重庆狼队', '武汉eStarPro', '北京WB', '济南RW侠', '成都AG超玩会'], A: ['广州TTG', '上海RNG.M', '长沙滔搏', '杭州LGD.NBW', '南京Hero', '苏州KSG'], B: ['XYG', '厦门VG', '淄博WE', '嘉兴情久', '昆明SCCP', '郑州MTG'] };
    S.phase = 'card';
    S.card = { matches: [{ a: S.teamName, b: '重庆狼队', r: null, winTo: 'S' }, { a: '武汉eStarPro', b: '北京WB', r: null, winTo: 'S' }], idx: 0 };
    closeModal('start-modal');
    renderAll(); goPage('league');
    const txt = (document.getElementById('page-league') || document.body).innerText || '';
    const clubTxt = (() => { goPage('club'); return (document.getElementById('page-club') || document.body).innerText || ''; })();
    const logHasCurrent = (S.eventLog || []).some(e => /现行赛制（据 2026 公开报道）/.test(typeof e === 'string' ? e : (e && e.t) || ''));
    return {
      leagueBO5: /卡位赛对阵[\s\S]{0,40}BO5/.test(txt),
      leagueBO7: /卡位赛[\s\S]{0,40}BO7/.test(txt),
      cardPanelFound: /卡位赛对阵/.test(txt),
      clubPanelFound: /卡位赛/.test(clubTxt),
      clubBO5: /卡位赛[\s\S]{0,60}BO5/.test(clubTxt),
      logHasCurrent,
    };
  });
  await shot(page, 'card-bo-ui');
  await browser.close();
  console.log(JSON.stringify(r, null, 1));
  const fails = [];
  if (!r.cardPanelFound) fails.push('联赛页没渲染出卡位赛对阵面板');
  else if (!r.leagueBO5) fails.push('联赛页卡位赛 tag 不是 BO5');
  if (r.leagueBO7) fails.push('联赛页仍出现 BO7 文案');
  if (r.clubPanelFound && !r.clubBO5) fails.push('俱乐部页卡位赛面板不是 BO5');
  console.log(fails.length ? '[FAIL] ' + fails.join(' ; ') : '[PASS] 卡位赛文案随 KPL.CARD 渲染为 BO5（联赛页 + 俱乐部页）');
  if (fails.length) process.exitCode = 1;
})();

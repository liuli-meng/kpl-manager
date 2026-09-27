const { launch, clearAndStart, shot } = require('../tests/playthrough/pw.js');
(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  await clearAndStart(page);
  // 满员 + 点名
  const full = await page.evaluate(() => {
    document.getElementById('new-team-name').value = '满员测试';
    createTeam();
    while (S.players.length < ROSTER_MAX) {
      const pos = POS_ORDER[S.players.length % 5];
      const def = PLAYER_POOL.find(x => x.pos === pos && !S.players.some(y => y.id === x.id));
      if (!def) break;
      S.players.push(genPlayer(def));
    }
    initDraft(S, true);
    // 推到本人 pick
    let g = 0;
    while (S.draft.phase !== 'pick' && !S.draft.done && g++ < 40) {
      if (S.draft.phase === 'auction') draftBidPass(S);
      else break;
    }
    // 若直接没进 pick（满员后 AI 跑完），强制造一个 pick 轮
    if (S.draft.phase !== 'pick') {
      S.draft.done = false;
      S.draft.phase = 'pick';
      S.draft.slot = 0;
    }
    goPage('market');
    const pickWraps = document.querySelectorAll('#page-market [onclick*="draftPick"]');
    const btns = [...document.querySelectorAll('#page-market button')].filter(b => /点名签约/.test(b.textContent || ''));
    const before = {
      roster: S.players.length,
      slot: S.draft.slot,
      done: S.draft.done,
      phase: S.draft.phase,
      pickWrap: pickWraps.length,
      signBtns: btns.length,
      hint: [...document.querySelectorAll('#page-market .hint')].map(h => h.textContent).filter(t => /大名单已满|不能点名|放弃点名/.test(t)).slice(0, 3),
    };
    // 尝试点卡片（若仍有）
    let toast = '';
    if (pickWraps[0]) {
      pickWraps[0].click();
      toast = (document.querySelector('#toast') || {}).textContent || '';
    }
    return {
      before,
      after: {
        roster: S.players.length,
        slot: S.draft.slot,
        done: S.draft.done,
        phase: S.draft.phase,
        toast,
      },
    };
  });
  console.log('FULL', JSON.stringify(full, null, 2));

  // 超上限按钮
  const cap = await page.evaluate(() => {
    document.getElementById('new-team-name').value = '超上限测试';
    // 重开
    try { localStorage.clear(); } catch (e) {}
    createTeam();
    S.fund = 10;
    initDraft(S, true);
    goPage('market');
    const btn = [...document.querySelectorAll('#page-market button')].find(b => /叫价/.test(b.textContent || ''));
    return {
      fund: S.fund,
      max: draftTeamMaxBid(S, S.teamName, S.draft.slot),
      btnText: btn && btn.textContent.trim(),
      disabled: btn && btn.disabled,
      title: btn && btn.getAttribute('onclick'),
    };
  });
  console.log('CAP', JSON.stringify(cap, null, 2));
  await shot(page, 'fix-full-cap');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

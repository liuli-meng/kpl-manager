// Player career playthrough
const { launch, shot, clearAndStart } = require('./pw.js');

(async () => {
  const { browser, page } = await launch();
  const logs = [];
  const step = (msg, data) => {
    logs.push({ msg, data });
    console.log('[STEP]', msg, data !== undefined ? JSON.stringify(data).slice(0, 600) : '');
  };

  try {
    // 1. clear + reload + wait start modal; pre-skip tour so career screenshots are clean
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });

    const startModal = await page.evaluate(() => {
      const m = document.querySelector('#start-modal');
      return {
        exists: !!m,
        hasOn: m ? m.classList.contains('on') : false,
        tabs: [...document.querySelectorAll('#start-modal [id^="tab-"]')].slice(0, 6).map(b => ({ id: b.id, text: b.textContent.trim().slice(0, 20) })),
      };
    });
    step('start modal after clear+reload', startModal);

    // 2. switch to player tab, pick mid + arch 0
    await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerPos('mid');
      pickPlayerArch(0);
    });
    await page.waitForTimeout(200);

    const playerPage = await page.evaluate(() => {
      const box = document.querySelector('#pc-teams');
      const teams = window._pcTeams || [];
      return {
        _pcPos: _pcPos,
        _pcArch: _pcArch,
        _pcTeam: _pcTeam,
        _pcTeams: teams.map(c => ({ name: c.name, players: c.players ? c.players.length : 0 })),
        teamCardCount: box ? box.querySelectorAll('.club-card').length : 0,
        nameInput: (document.querySelector('#pc-name') || {}).value,
        createBtn: !!document.querySelector('[onclick="createPlayerCareer()"]'),
        tabPlayerOn: (document.querySelector('#tab-player') || {}).classList?.contains?.('on') ?? false,
      };
    });
    step('player tab after pick', playerPage);

    // ensure team selected + name
    await page.evaluate(() => {
      if (!_pcTeam && window._pcTeams && window._pcTeams.length) {
        pickPlayerTeam(window._pcTeams[0].name);
      }
      const nameEl = document.querySelector('#pc-name');
      if (nameEl) nameEl.value = '试玩中单';
    });

    // 3. create career
    await page.evaluate(() => { createPlayerCareer(); });
    await page.waitForTimeout(400);

    // skip tour if it opened (in case km_tour didn't stick)
    await page.evaluate(() => {
      if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip();
    });
    await page.waitForTimeout(150);

    const afterCreate = await page.evaluate(() => {
      const me = myPlayer(S);
      return {
        S_mode: S.mode,
        S_teamName: S.teamName,
        careerExists: !!S.career,
        meId: me ? me.id : null,
        meName: me ? me.name : null,
        mePos: me ? me.pos : null,
        meAge: me ? me.age : null,
        meAttrs: me ? me.attrs : null,
        meOverall: me ? overall(me) : null,
        mePower: me ? playerPower(me) : null,
        starter: me && S.lineup ? S.lineup.includes(me.id) : null,
        playersCount: S.players.length,
        careerPageOn: document.querySelector('#page-career')?.classList.contains('on') ?? false,
        careerHtmlLen: document.querySelector('#page-career')?.innerHTML?.length || 0,
        tourOn: _tour.on,
      };
    });
    step('after createPlayerCareer', afterCreate);

    // 4. screenshots career / club / league
    await page.evaluate(() => goPage('career'));
    await page.waitForTimeout(250);
    await shot(page, 'pc_01_career');

    await page.evaluate(() => goPage('club'));
    await page.waitForTimeout(250);
    await shot(page, 'pc_02_club');

    await page.evaluate(() => goPage('league'));
    await page.waitForTimeout(250);
    await shot(page, 'pc_03_league');

    // 5. player daily actions on career page
    await page.evaluate(() => goPage('career'));
    await page.waitForTimeout(200);

    const beforeTrain = await page.evaluate(() => {
      const me = myPlayer(S);
      return {
        has_playerTrain: typeof playerTrain === 'function',
        has_uiNextDay: typeof uiNextDay === 'function',
        has_nextDay: typeof nextDay === 'function',
        stats: S.career?.stats ? { ...S.career.stats } : null,
        meAttrs: me ? { ...me.attrs } : null,
        meEnergy: me ? me.energy : null,
        mePower: me ? playerPower(me) : null,
        careerBtns: [...document.querySelectorAll('#page-career button')].map(b => ({
          text: b.textContent.trim(),
          disabled: b.disabled,
          onclick: b.getAttribute('onclick'),
        })),
      };
    });
    step('before train', beforeTrain);

    await page.evaluate(() => { playerTrain('lane'); });
    await page.waitForTimeout(150);

    const afterTrain = await page.evaluate(() => {
      const me = myPlayer(S);
      return {
        stats: S.career?.stats ? { ...S.career.stats } : null,
        meAttrs: me ? { ...me.attrs } : null,
        meEnergy: me ? me.energy : null,
        mePower: me ? playerPower(me) : null,
      };
    });
    step('after playerTrain(lane)', afterTrain);

    await shot(page, 'pc_04_after_train');

    // advance a day
    const dayBefore = await page.evaluate(() => ({
      day: S.day,
      split: S.split,
      matchIdx: S.matchIdx,
      dateLabel: typeof gameDateLabel === 'function' ? gameDateLabel(S) : null,
    }));
    await page.evaluate(() => {
      if (typeof uiNextDay === 'function') uiNextDay(S);
      else nextDay(S);
    });
    await page.waitForTimeout(400);

    const dayAfter = await page.evaluate(() => ({
      day: S.day,
      split: S.split,
      matchIdx: S.matchIdx,
      dateLabel: typeof gameDateLabel === 'function' ? gameDateLabel(S) : null,
      meName: myPlayer(S)?.name,
      stats: S.career?.stats ? { ...S.career.stats } : null,
      navVisible: [...document.querySelectorAll('#nav button')].filter(b => b.style.display !== 'none').map(b => b.dataset.page),
    }));
    step('day advance', { before: dayBefore, after: dayAfter });

    await shot(page, 'pc_05_after_nextday');

    // 6. nav reduced check
    const navFinal = await page.evaluate(() => ({
      visible: [...document.querySelectorAll('#nav button')].filter(b => b.style.display !== 'none').map(b => ({ page: b.dataset.page, text: b.textContent.trim() })),
      hidden: [...document.querySelectorAll('#nav button')].filter(b => b.style.display === 'none').map(b => b.dataset.page),
      modePagesPlayer: MODE_PAGES.player,
      header: document.querySelector('.hd-name')?.innerText?.slice(0, 120) || null,
    }));
    step('nav final', navFinal);

    // extra: try social
    const ops = await page.evaluate(() => {
      const names = ['playerRest', 'playerSocial', 'playerMedia', 'playerSocialize', 'playerLocker', 'playerMeal'];
      const found = {};
      names.forEach(n => { found[n] = typeof window[n]; });
      found._careerBtns = [...document.querySelectorAll('#page-career button')].map(b => b.textContent.trim());
      return found;
    });
    step('player ops available', ops);

    // find social-looking buttons and click one
    const socialClick = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#page-career button')];
      const target = btns.find(b => /聚餐|陪练|直播|社交|媒体/.test(b.textContent) && !b.disabled);
      if (target) {
        target.click();
        return 'clicked: ' + target.textContent.trim();
      }
      if (typeof playerSocial === 'function') { playerSocial(); return 'called playerSocial'; }
      return 'no social action available';
    });
    await page.waitForTimeout(200);
    const afterSocial = await page.evaluate(() => ({
      stats: S.career?.stats ? { ...S.career.stats } : null,
      popularity: myPlayer(S)?.popularity,
    }));
    step('social attempt', { click: socialClick, after: afterSocial });

    await shot(page, 'pc_06_final_career');

    console.log('=== ALL STEPS OK ===');
    console.log('STEPS:', logs.map(l => l.msg).join(' | '));
  } catch (e) {
    console.error('PLAYTHROUGH ERROR', e);
    try { await shot(page, 'pc_ERROR'); } catch (e2) {}
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

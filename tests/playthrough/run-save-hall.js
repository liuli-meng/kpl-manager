// Playthrough: 新手引导 + 荣誉馆 + 存档
const { launch, clearAndStart, shot, call } = require('./pw');

const TEAM = '存档测试';
const results = [];
function ok(m) { results.push('[PASS] ' + m); console.log('[PASS] ' + m); }
function fail(m) { results.push('[FAIL] ' + m); console.log('[FAIL] ' + m); }
function info(m) { results.push('[INFO] ' + m); console.log('[INFO] ' + m); }

(async () => {
  const { browser, page } = await launch();
  try {
    // ── 1. clear + reload start modal; createTeam '存档测试' ──
    await clearAndStart(page);
    await shot(page, 'save_01_start_modal');

    const startOn = await page.evaluate(() => {
      const m = document.getElementById('start-modal');
      return m && m.classList.contains('on');
    });
    if (startOn) ok('① 开局弹窗已打开');
    else fail('① 开局弹窗未打开');

    // Type team name and create
    await page.evaluate((name) => {
      const inp = document.getElementById('new-team-name');
      if (inp) { inp.value = name; if (typeof refreshCrUI === 'function') refreshCrUI(); }
    }, TEAM);
    await page.waitForTimeout(200);

    await page.evaluate(() => { createTeam(); });
    await page.waitForTimeout(600);

    const afterCreate = await page.evaluate(() => ({
      teamName: S && S.teamName,
      startOn: document.getElementById('start-modal').classList.contains('on'),
      modalOn: document.getElementById('app-modal').classList.contains('on'),
      tourOn: typeof _tour !== 'undefined' && _tour && _tour.on,
      tourMode: typeof _tour !== 'undefined' && _tour && _tour.mode,
      tourI: typeof _tour !== 'undefined' && _tour && _tour.i,
      toastText: (document.getElementById('toast') || {}).textContent || '',
    }));
    info('① createTeam 后: team=' + afterCreate.teamName + ' startOn=' + afterCreate.startOn + ' tourOn=' + afterCreate.tourOn + ' tourMode=' + afterCreate.tourMode);
    if (afterCreate.teamName === TEAM) ok('① 战队创建成功: ' + afterCreate.teamName);
    else fail('① 战队名不符: ' + afterCreate.teamName);
    if (!afterCreate.startOn) ok('① start-modal 已关闭');
    else fail('① start-modal 仍打开');

    // ── 2. Tour / guide auto-open check ──
    if (afterCreate.tourOn) {
      ok('② 新手引导自动打开 mode=' + afterCreate.tourMode + ' i=' + afterCreate.tourI);
      await shot(page, 'save_02_tour_auto');
      const tourTitle = await page.evaluate(() => {
        const h = document.querySelector('#app-modal-body h2');
        return h ? h.textContent : '';
      });
      info('② 引导标题: ' + tourTitle);

      // Step through quick tour via tourNext
      let steps = 0;
      for (let i = 0; i < 10; i++) {
        const st = await page.evaluate(() => {
          const on = typeof _tour !== 'undefined' && _tour && _tour.on;
          if (!on) return { on: false };
          const n = _tour.mode === 'quick' ? (typeof quickSteps === 'function' ? quickSteps().length : 3) : (typeof tourSteps === 'function' ? tourSteps().length : 0);
          return { on: true, i: _tour.i, n, mode: _tour.mode };
        });
        if (!st.on) break;
        steps++;
        await shot(page, 'save_02_tour_step_' + st.i + '_' + st.mode);
        if (st.i < st.n - 1) {
          await page.evaluate(() => { tourNext(); });
          await page.waitForTimeout(200);
        } else {
          // last step → finish
          await page.evaluate(() => { tourFinish(); });
          await page.waitForTimeout(200);
          break;
        }
      }
      const tourDone = await page.evaluate(() => ({
        tourOn: typeof _tour !== 'undefined' && _tour && _tour.on,
        tourKey: localStorage.getItem('km_tour'),
        modalOn: document.getElementById('app-modal').classList.contains('on'),
      }));
      info('② 步进次数=' + steps + ' tourOn=' + tourDone.tourOn + ' km_tour=' + tourDone.tourKey);
      if (!tourDone.tourOn) ok('② 引导已走完/关闭');
      else fail('② 引导仍开启');
    } else {
      // Tour may not auto-open if km_tour already set, or because we went to market (maybeStartTour on goPage)
      info('② 引导未自动打开（可能 km_tour 已有标记，或 goPage 路径未触发）— 手动 startTour');
      // Check if we're on market page after createTeam (expected)
      const pageNow = await page.evaluate(() => {
        const b = document.querySelector('nav button.on');
        return b ? b.dataset.page : null;
      });
      info('② 当前页: ' + pageNow);

      // Manually start full tour and step through a few, then skip
      await page.evaluate(() => { startTour(); });
      await page.waitForTimeout(300);
      const tourAfterManual = await page.evaluate(() => ({
        on: typeof _tour !== 'undefined' && _tour && _tour.on,
        mode: _tour && _tour.mode,
        i: _tour && _tour.i,
      }));
      if (tourAfterManual.on) {
        ok('② 手动 startTour 成功 mode=' + tourAfterManual.mode);
        await shot(page, 'save_02_tour_manual');
        // Step through 3 times then skip
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => { tourNext(); });
          await page.waitForTimeout(200);
        }
        await shot(page, 'save_02_tour_mid');
        await page.evaluate(() => { tourSkip(); });
        await page.waitForTimeout(200);
        const afterSkip = await page.evaluate(() => ({
          on: typeof _tour !== 'undefined' && _tour && _tour.on,
          key: localStorage.getItem('km_tour'),
          modalOn: document.getElementById('app-modal').classList.contains('on'),
        }));
        if (!afterSkip.on) ok('② tourSkip 成功关闭引导');
        else fail('② tourSkip 后引导仍开启');
      } else {
        fail('② startTour 未能打开引导');
      }
    }

    // ── 3. goPage('hall') + screenshot + empty state ──
    await page.evaluate(() => { goPage('hall'); });
    await page.waitForTimeout(400);
    await shot(page, 'save_03_hall');

    const hallInfo = await page.evaluate((team) => {
      const el = document.getElementById('page-hall');
      const html = (el && el.innerHTML) || '';
      const text = (el && el.innerText) || '';
      return {
        htmlLen: html.length,
        title: (html.match(/([^<]+) 荣誉馆/) || [])[1] || '',
        hasHonorsWall: html.includes('本队荣誉墙'),
        hasDynasty: html.includes('王朝纪录'),
        hasChamps: html.includes('历届冠军'),
        hasFmvp: html.includes('FMVP'),
        hasAwards: html.includes('赛季最佳阵容'),
        emptyHonors: html.includes('还没有冠军/亚军记录'),
        emptyDynasty: html.includes('暂无王朝'),
        emptyChamps: html.includes('本赛季尚未产生冠军'),
        emptyFmvp: html.includes('总决赛最有价值选手尚未产生'),
        emptyAwards: html.includes('赛季结束后自动评选一阵/二阵'),
        teamInHall: html.includes(team),
        textSnippet: text.slice(0, 300),
      };
    }, TEAM);
    info('③ 荣誉馆 len=' + hallInfo.htmlLen + ' title=' + hallInfo.title + ' teamInHall=' + hallInfo.teamInHall);
    if (hallInfo.hasHonorsWall && hallInfo.hasDynasty && hallInfo.hasChamps && hallInfo.hasFmvp && hallInfo.hasAwards) {
      ok('③ 荣誉馆五区块齐全');
    } else {
      fail('③ 荣誉馆区块缺失: wall=' + hallInfo.hasHonorsWall + ' dynasty=' + hallInfo.hasDynasty + ' champs=' + hallInfo.hasChamps + ' fmvp=' + hallInfo.hasFmvp + ' awards=' + hallInfo.hasAwards);
    }
    if (hallInfo.emptyHonors) ok('③ 空态文案（本队荣誉墙）: 还没有冠军/亚军记录');
    else info('③ 本队荣誉墙非空态');
    if (hallInfo.emptyDynasty) ok('③ 空态文案（王朝）: 暂无王朝');
    if (hallInfo.emptyChamps) ok('③ 空态文案（历届冠军）: 本赛季尚未产生冠军');
    if (hallInfo.emptyFmvp) ok('③ 空态文案（FMVP）: 总决赛最有价值选手尚未产生');
    if (hallInfo.emptyAwards) ok('③ 空态文案（最佳阵容）: 赛季结束后自动评选一阵/二阵');
    if (hallInfo.teamInHall) ok('③ 荣誉馆显示队名 ' + TEAM);

    // ── 4. openSaveMgmt + exportSave ──
    await page.evaluate(() => { openSaveMgmt(); });
    await page.waitForTimeout(300);
    await shot(page, 'save_04_save_mgmt');

    const saveModal = await page.evaluate(() => {
      const m = document.getElementById('app-modal');
      const body = document.getElementById('app-modal-body');
      const html = (body && body.innerHTML) || '';
      const ta = document.getElementById('save-io');
      return {
        on: m && m.classList.contains('on'),
        hasTitle: html.includes('存档管理'),
        hasSlots: html.includes('槽1') && html.includes('槽2') && html.includes('槽3'),
        hasExport: html.includes('exportSave'),
        hasTourReplay: html.includes('startTour'),
        hasIo: !!ta,
        curSlotLabel: html.includes('(当前)'),
      };
    });
    if (saveModal.on && saveModal.hasTitle) ok('④ 存档管理弹窗已打开');
    else fail('④ 存档管理弹窗异常 on=' + saveModal.on + ' title=' + saveModal.hasTitle);
    if (saveModal.hasSlots) ok('④ 三槽位 UI 齐全');
    if (saveModal.hasExport && saveModal.hasIo) ok('④ 导出入口 + #save-io 存在');

    // exportSave: fills #save-io with b64
    await page.evaluate(() => { save(); exportSave(); });
    await page.waitForTimeout(200);
    const exportResult = await page.evaluate(() => {
      const ta = document.getElementById('save-io');
      const v = (ta && ta.value) || '';
      let decodedOk = false, decodedTeam = '', decodedHasPlayers = false;
      try {
        // UTF-8 safe b64 decode (plain atob mangles Chinese)
        const bin = atob(v);
        const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
        const d = JSON.parse(new TextDecoder('utf-8').decode(bytes));
        decodedOk = true;
        decodedTeam = d.teamName || '';
        decodedHasPlayers = Array.isArray(d.players) && d.players.length > 0;
      } catch (e) {}
      return {
        len: v.length,
        nonEmpty: v.length > 0,
        looksB64: /^[A-Za-z0-9+/=]+$/.test(v.slice(0, 200)),
        prefix: v.slice(0, 40),
        decodedOk,
        decodedTeam,
        decodedHasPlayers,
      };
    });
    info('④ exportSave: len=' + exportResult.len + ' looksB64=' + exportResult.looksB64 + ' decodedOk=' + exportResult.decodedOk + ' team=' + exportResult.decodedTeam + ' players=' + exportResult.decodedHasPlayers);
    if (exportResult.nonEmpty && exportResult.looksB64) ok('④ exportSave 产出非空 b64（长度 ' + exportResult.len + '）');
    else fail('④ exportSave 内容异常: len=' + exportResult.len + ' b64=' + exportResult.looksB64);
    if (exportResult.decodedOk && exportResult.decodedTeam === TEAM && exportResult.decodedHasPlayers) {
      ok('④ b64 解码成功: team=' + exportResult.decodedTeam + ' players=' + exportResult.decodedHasPlayers);
    } else {
      fail('④ b64 解码校验失败: ' + JSON.stringify(exportResult));
    }
    await shot(page, 'save_04b_export_filled');

    // Capture original save fingerprint before slot switch
    const beforeSlots = await page.evaluate(() => ({
      curSlot,
      teamName: S && S.teamName,
      fund: S && S.fund,
      players: S && S.players && S.players.length,
      saveKey: typeof slotKey === 'function' ? slotKey() : null,
      rawLen: (localStorage.getItem(typeof slotKey === 'function' ? slotKey() : '') || '').length,
    }));
    info('④ 切槽前: slot=' + beforeSlots.curSlot + ' team=' + beforeSlots.teamName + ' rawLen=' + beforeSlots.rawLen);

    // ── 5. setSlot(2) then setSlot(1) ──
    await page.evaluate(() => { setSlot(2); });
    await page.waitForTimeout(400);
    await shot(page, 'save_05_slot2');
    const slot2 = await page.evaluate(() => ({
      curSlot,
      startOn: document.getElementById('start-modal').classList.contains('on'),
      appModalOn: document.getElementById('app-modal').classList.contains('on'),
      S: !!S,
      teamName: S && S.teamName,
      raw: !!localStorage.getItem('esport_manager_save_v3_2'),
    }));
    info('⑤ setSlot(2): curSlot=' + slot2.curSlot + ' S=' + slot2.S + ' startOn=' + slot2.startOn + ' slot2raw=' + slot2.raw);
    if (slot2.curSlot === 2) ok('⑤ 已切到槽2（空槽 → 开局引导）');
    else fail('⑤ 槽号未切到 2: ' + slot2.curSlot);
    if (!slot2.S && slot2.startOn) ok('⑤ 槽2 空档正确进入开局弹窗');

    // Restore slot 1
    await page.evaluate(() => { setSlot(1); });
    await page.waitForTimeout(400);
    await shot(page, 'save_05b_slot1_restore');
    const slot1 = await page.evaluate(() => ({
      curSlot,
      teamName: S && S.teamName,
      fund: S && S.fund,
      players: S && S.players && S.players.length,
      rawLen: (localStorage.getItem('esport_manager_save_v3') || '').length,
    }));
    info('⑤ setSlot(1) 还原: slot=' + slot1.curSlot + ' team=' + slot1.teamName + ' fund=' + slot1.fund + ' players=' + slot1.players);
    if (slot1.curSlot === 1 && slot1.teamName === TEAM) ok('⑤ 槽1 还原成功 team=' + slot1.teamName);
    else fail('⑤ 槽1 还原失败: slot=' + slot1.curSlot + ' team=' + slot1.teamName);
    if (slot1.players === beforeSlots.players) ok('⑤ 阵容人数一致: ' + slot1.players);
    else info('⑤ 阵容人数: before=' + beforeSlots.players + ' after=' + slot1.players);

    // ── 6. Reload — save persists ──
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    await shot(page, 'save_06_after_reload');
    const afterReload = await page.evaluate(() => ({
      hasS: typeof S !== 'undefined' && !!S,
      teamName: S && S.teamName,
      curSlot,
      startOn: document.getElementById('start-modal').classList.contains('on'),
      rawLen: (localStorage.getItem('esport_manager_save_v3') || '').length,
      tourKey: localStorage.getItem('km_tour'),
    }));
    info('⑥ reload 后: team=' + afterReload.teamName + ' slot=' + afterReload.curSlot + ' startOn=' + afterReload.startOn + ' rawLen=' + afterReload.rawLen);
    if (afterReload.hasS && afterReload.teamName === TEAM) {
      ok('⑥ 刷新后存档仍在: S.teamName=' + afterReload.teamName);
    } else {
      fail('⑥ 刷新后存档丢失: S=' + afterReload.hasS + ' team=' + afterReload.teamName);
    }
    if (!afterReload.startOn) ok('⑥ 刷新后未弹出开局弹窗（直接进档）');
    else fail('⑥ 刷新后误弹开局弹窗');

    // Hall still OK after reload
    await page.evaluate(() => { goPage('hall'); });
    await page.waitForTimeout(300);
    const hallAfter = await page.evaluate((team) => {
      const el = document.getElementById('page-hall');
      return { teamInHall: ((el && el.innerHTML) || '').includes(team) };
    }, TEAM);
    if (hallAfter.teamInHall) ok('⑥ 刷新后荣誉馆仍显示队名');

    // ── 7. Close modals ──
    await page.evaluate(() => {
      try { closeModal('app-modal'); } catch (e) {}
      try { closeModal('start-modal'); } catch (e) {}
    });
    await page.waitForTimeout(200);
    await shot(page, 'save_07_closed');
    const closed = await page.evaluate(() => ({
      app: document.getElementById('app-modal').classList.contains('on'),
      start: document.getElementById('start-modal').classList.contains('on'),
    }));
    if (!closed.app && !closed.start) ok('⑦ 弹窗已全部关闭');
    else info('⑦ 残留弹窗: app=' + closed.app + ' start=' + closed.start);

  } catch (e) {
    fail('脚本异常: ' + (e && e.message));
    console.error(e);
  } finally {
    await browser.close();
  }

  const fails = results.filter(r => r.startsWith('[FAIL]'));
  console.log('\n========== SUMMARY ==========');
  results.forEach(r => console.log(r));
  console.log('------------------------------');
  console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL PASS');
  process.exit(fails.length ? 1 : 0);
})();

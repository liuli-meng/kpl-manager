/* Manager-mode full-flow bug hunt across 5 scenarios.
 * Run: node tests/playthrough/manager-bug-hunt.js
 * Requires: python -m http.server 8931 in project root (or KPL_BASE).
 * Reports JSON + writes summary to .bug-hunt/manager-report.md (via caller or --write).
 */
const fs = require('fs');
const path = require('path');
const { launch, clearAndStart, shot } = require('./pw.js');

const SCENARIOS = ['normal', 'debt', 'exodus', 'cap', 'cursed'];
const PAGES = ['club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall', 'biz'];
const REPORT = path.join('E:\\sex\\kpl-manager\\.bug-hunt', 'manager-report.md');
const JSON_OUT = path.join('E:\\sex\\kpl-manager\\.bug-hunt', 'manager-bug-hunt.json');

const bugs = [];
function bug(sc, sev, title, detail) {
  bugs.push({ sc, scenario: sc, sev, title, detail });
  console.log(`[${sev}][${sc}] ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 240));
}

async function dismissOverlays(page) {
  await page.evaluate(() => {
    try { if (typeof tourSkip === 'function' && window._tour) tourSkip(); } catch (e) {}
    try { closeModal('start-modal'); } catch (e) {}
    try { closeModal('app-modal'); } catch (e) {}
    try {
      document.querySelectorAll('.modal-bg.on, .modal.on').forEach(el => el.classList.remove('on'));
    } catch (e) {}
  });
  await page.waitForTimeout(120);
}

async function snapPage(page) {
  return page.evaluate(() => {
    const root = document.getElementById('app') || document.body;
    const text = (root.innerText || '');
    const dirty = [];
    text.split('\n').forEach(ln => {
      const t = ln.trim();
      if (t && /\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b|Infinity|万万|%%/.test(t)) dirty.push(t.slice(0, 120));
    });
    const dead = [];
    const emptyBtn = [];
    const clippedHint = [];
    document.querySelectorAll('[onclick]').forEach(el => {
      const code = el.getAttribute('onclick') || '';
      [...code.matchAll(/(?:^|[;&\s])([A-Za-z_$][\w$]*)\s*\(/g)].forEach(m => {
        const fn = m[1];
        if (fn === 'window' || fn === 'this') return;
        try {
          if (typeof window[fn] !== 'function') dead.push(fn + ' <- ' + code.slice(0, 80));
        } catch (e) {}
      });
      const label = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const isBtn = el.tagName === 'BUTTON' || /btn/.test(el.className || '');
      if (isBtn && !label && !el.getAttribute('title') && !el.querySelector('img,svg,i')) {
        emptyBtn.push(code.slice(0, 80));
      }
      // clipped/empty hint: buttons whose text is only emoji/symbol with no word
      if (isBtn && label && label.length <= 2 && /[\u{1F300}-\u{1FAFF}]/u.test(label) === false && !/[A-Za-z\u4e00-\u9fa5]/.test(label)) {
        clippedHint.push(label + ' | ' + code.slice(0, 60));
      }
    });
    // empty panel hints that look like missing copy
    const emptyHints = [];
    document.querySelectorAll('.hint, .dim, .s-desc, .power').forEach(el => {
      const t = (el.textContent || '').trim();
      if (t === '—' || t === 'undefined' || t === 'null' || t === 'NaN') emptyHints.push(t + ' in ' + (el.closest('.panel') ? (el.closest('.panel').querySelector('h3') || {textContent:'?'}).textContent.slice(0,40) : '?'));
    });
    const onCloses = [];
    document.querySelectorAll('.modal-bg.on, #app-modal.on, #start-modal.on').forEach(m => {
      const id = m.id || m.className;
      const body = (m.innerText || '').slice(0, 200);
      const hasClose = !!m.querySelector('[onclick*="closeModal"], .modal-close, [onclick*="close"]');
      onCloses.push({ id, hasClose, body: body.slice(0, 80) });
    });
    const act = (typeof nextAction === 'function' && typeof S === 'object' && S) ? nextAction(S) : null;
    const actFns = act ? [act.fn, act.type, 'uiDoNextAction'] : [];
    const pageHasAct = act ? actFns.some(fn => (document.body.innerHTML || '').includes(fn)) : null;
    // broader: any button whose onclick mentions the action type or common entry
    const actBtnTexts = act ? [...document.querySelectorAll('button')].map(b => (b.textContent||'').trim()).filter(t => t && /开赛|转会|推进|比赛|季后|卡位|杯|年度|结束|准备|BP/i.test(t)).slice(0, 12) : [];
    return {
      phase: (typeof S === 'object' && S) ? S.phase : null,
      preseason: (typeof S === 'object' && S) ? !!S.preseason : null,
      dirty: [...new Set(dirty)].slice(0, 10),
      dead: [...new Set(dead)].slice(0, 12),
      emptyBtn: [...new Set(emptyBtn)].slice(0, 8),
      clippedHint: [...new Set(clippedHint)].slice(0, 8),
      emptyHints: [...new Set(emptyHints)].slice(0, 8),
      onCloses,
      nextAction: act,
      pageHasAct,
      actBtnTexts,
      page: document.querySelector('.page.on') ? document.querySelector('.page.on').id : null,
    };
  });
}

function mergeFindings(sc, stage, snap, consoleBuf) {
  if (snap.dead && snap.dead.length) {
    bug(sc, 'P0', `${stage}: onclick 断链`, snap.dead.join(' | '));
  }
  if (snap.dirty && snap.dirty.length) {
    bug(sc, 'P1', `${stage}: 渲染脏文本`, snap.dirty.join(' | '));
  }
  if (snap.emptyBtn && snap.emptyBtn.length) {
    bug(sc, 'P1', `${stage}: 按钮文案为空`, snap.emptyBtn.join(' | '));
  }
  // Filter intentional dismiss-hint "×" (has title) — not a clipped-label bug
  const clipped = (snap.clippedHint || []).filter(s => !/dismissHint/.test(s));
  if (clipped.length) {
    bug(sc, 'P2', `${stage}: 按钮文案疑似被裁/无文字`, clipped.join(' | '));
  }
  if (snap.emptyHints && snap.emptyHints.length) {
    bug(sc, 'P2', `${stage}: 说明文案为空/占位`, snap.emptyHints.slice(0, 4).join(' | '));
  }
  if (snap.onCloses) {
    snap.onCloses.forEach(m => {
      if (!m.hasClose) bug(sc, 'P1', `${stage}: 弹窗可能无法关闭`, `${m.id} body=${m.body}`);
    });
  }
  if (snap.nextAction && snap.pageHasAct === false) {
    bug(sc, 'P0', `${stage}: nextAction 有值但页面找不到对应按钮`,
      `nextAction=${JSON.stringify(snap.nextAction)} page=${snap.page} 按钮文案样本=${(snap.actBtnTexts||[]).join('/')}`);
  }
  if (consoleBuf && consoleBuf.errors && consoleBuf.errors.length) {
    const recent = consoleBuf.errors.filter(e =>
      (e.stage === stage || e.sc === sc) && e.stage !== 'marker' && !/--- scenario/.test(e.msg || '')
    ).slice(-6);
    if (recent.length) bug(sc, 'P0', `${stage}: console.error/pageerror`, recent.map(e => e.msg).join(' || '));
  }
}

async function sweepPages(page, sc, stage, consoleBuf) {
  for (const pg of PAGES) {
    await page.evaluate((p) => { try { goPage(p); } catch (e) { window.__goPageErr = e.message; } }, pg);
    await page.waitForTimeout(80);
    const err = await page.evaluate(() => { const e = window.__goPageErr; delete window.__goPageErr; return e || null; });
    if (err) bug(sc, 'P0', `${stage}: goPage('${pg}') 抛错`, err);
    const snap = await snapPage(page);
    mergeFindings(sc, `${stage}/${pg}`, snap, consoleBuf);
  }
}

async function tryClickButtons(page, sc, stage, filterRe, consoleBuf) {
  // Click a bounded set of action buttons and record throws / state changes
  return page.evaluate(({ filterRe }) => {
    const UI = new RegExp(filterRe);
    const out = [];
    const clearToast = () => { try { const t = document.getElementById('toast'); if (t) t.innerText = ''; } catch (e) {} };
    const cands = [...document.querySelectorAll('button[onclick]')].filter(el => {
      const code = el.getAttribute('onclick') || '';
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return UI.test(t) || UI.test(code);
    }).slice(0, 20);
    for (const el of cands) {
      const code = el.getAttribute('onclick') || '';
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      clearToast();
      const before = {
        phase: S && S.phase, preseason: S && S.preseason, fund: S && S.fund,
        players: S && S.players && S.players.length, day: S && S.day,
        transferWindow: S && S.transferWindow, lineup: S && S.lineup && S.lineup.length,
        trained: S && !!S.trained,
      };
      try {
        el.click();
        const after = {
          phase: S && S.phase, preseason: S && S.preseason, fund: S && S.fund,
          players: S && S.players && S.players.length, day: S && S.day,
          transferWindow: S && S.transferWindow, lineup: S && S.lineup && S.lineup.length,
          trained: S && !!S.trained,
        };
        const toastText = (() => {
          const nodes = document.querySelectorAll('#toast, .toast, [class*="toast"]');
          return [...nodes].map(n => (n.innerText || '').trim()).filter(Boolean).join(' / ').slice(0, 120);
        })();
        const changed = JSON.stringify(before) !== JSON.stringify(after);
        out.push({ text, code: code.slice(0, 70), before, after, changed, toastText });
        try { closeModal('app-modal'); } catch (e) {}
        try { closeModal('start-modal'); } catch (e) {}
      } catch (e) {
        out.push({ text, code: code.slice(0, 70), threw: (e.message || String(e)).slice(0, 120) });
      }
    }
    return out;
  }, { filterRe });
}

function evaluateClicks(sc, stage, clicks) {
  clicks.forEach(c => {
    if (c.threw) {
      bug(sc, 'P0', `${stage}: 按钮点击抛错`, `${c.text} | ${c.code} | ${c.threw}`);
      return;
    }
    // Only flag when BEFORE state still shows the action is pending, toast explains failure, AND state stuck
    const pending = (
      (/结束转会|跳过剩余|uiEndPreseason|uiSkipTransfer/.test(c.text + c.code) && c.before && c.before.preseason === true) ||
      (/推进一天|uiNextDay/.test(c.text + c.code) && c.before && c.before.day != null) ||
      (/签约|买|直签|买断|buyPlayer|signFreeAgent/.test(c.text + c.code) && c.before && c.before.fund > 0) ||
      (/挂牌|listPlayer|出售|openSellNego/.test(c.text + c.code)) ||
      (/训练|doTrain/.test(c.text + c.code) && c.before && !c.before.trained) ||
      (/开赛|uiStartMatch|startMatch|卡位|季后|startCard|startPlayoff|uiDoNextAction/.test(c.text + c.code))
    );
    const guardToast = c.toastText && /失败|不足|无法|不能|请先|没有可进行|不在转会期|合同还剩|已拥有|该选手不在|已被|还剩|未满|作废|确定/.test(c.toastText);
    const successToast = c.toastText && /已挂牌|已撤牌|加盟|续约|正式开始|已退出|完成|晋升|签约/.test(c.toastText) && !/失败|不足|无法/.test(c.toastText);
    if (pending && !c.changed && c.toastText && !guardToast && !successToast) {
      bug(sc, 'P1', `${stage}: toast 后状态未变（疑似卡住）`,
        `${c.text} toast=${c.toastText} before=${JSON.stringify(c.before)}`);
    } else if (pending && !c.changed && c.toastText && /没有可进行的比赛/.test(c.toastText) && /uiDoNextAction|卡位|季后|开赛/.test(c.text + c.code)) {
      bug(sc, 'P0', `${stage}: 比赛入口按钮 toast「没有可进行的比赛」且状态未变`,
        `${c.text} | ${c.code} | toast=${c.toastText}`);
    }
  });
}

async function bootScenario(page, sc, consoleBuf) {
  await clearAndStart(page);
  await page.waitForTimeout(350);
  await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });

  // Start modal: open if not on, pick scenario
  const startInfo = await page.evaluate((sc) => {
    const out = { opened: false, scenarioBtns: [], desc: '', pickResult: null, tabs: [] };
    try {
      const sm = document.getElementById('start-modal');
      if (!sm || !sm.classList.contains('on')) {
        if (typeof initStart === 'function') initStart();
        out.opened = true;
      }
      out.tabs = [...document.querySelectorAll('[id^="tab-"]')].map(b => b.id).filter(id => !/body$/.test(id));
      out.scenarioBtns = [...document.querySelectorAll('[id^="sc-btn-"]')].map(b => ({
        id: b.id, text: (b.textContent || '').trim(), disabled: !!b.disabled,
        onclick: b.getAttribute('onclick') || '',
      }));
      // pick each scenario once in this pass for button existence
      // pick target
      try { pickScenario(sc); out.pickResult = { ok: true, _scenario: (typeof _scenario !== 'undefined' ? _scenario : null) }; }
      catch (e) { out.pickResult = { ok: false, err: e.message }; }
      const d = document.getElementById('sc-desc');
      out.desc = d ? (d.textContent || '') : '(missing #sc-desc)';
      out.scHighlight = (document.getElementById('sc-btn-' + sc) || {}).className || '';
    } catch (e) {
      out.err = e.message;
    }
    return out;
  }, sc);

  if (startInfo.err) bug(sc, 'P0', '开局弹窗: initStart/pickScenario 抛错', startInfo.err);
  if (startInfo.pickResult && startInfo.pickResult.ok === false) {
    bug(sc, 'P0', '开局弹窗: pickScenario 抛错', startInfo.pickResult.err);
  }
  const expectedBtns = ['normal','debt','exodus','cap','cursed'].map(id => 'sc-btn-' + id);
  expectedBtns.forEach(id => {
    if (!startInfo.scenarioBtns.some(b => b.id === id)) {
      bug(sc, 'P0', '开局弹窗: 剧本按钮缺失', id);
    }
  });
  if (!startInfo.desc || startInfo.desc === '(missing #sc-desc)' || !String(startInfo.desc).trim()) {
    bug(sc, 'P1', '开局弹窗: 剧本说明为空，用户不知道选什么', String(startInfo.desc));
  }
  if (startInfo.scHighlight && !/primary/.test(startInfo.scHighlight)) {
    bug(sc, 'P2', '开局弹窗: pickScenario 后按钮未高亮', `class=${startInfo.scHighlight}`);
  }

  // Also scan start modal for dead handlers
  const startDead = await page.evaluate(() => {
    const modal = document.getElementById('start-modal');
    const scope = modal && modal.classList.contains('on') ? modal : document;
    const dead = [];
    scope.querySelectorAll('[onclick]').forEach(el => {
      const code = el.getAttribute('onclick') || '';
      [...code.matchAll(/(?:^|[;&\s])([A-Za-z_$][\w$]*)\s*\(/g)].forEach(m => {
        if (m[1] === 'window' || m[1] === 'this') return;
        if (typeof window[m[1]] !== 'function') dead.push(m[1] + ' <- ' + code.slice(0, 70));
      });
    });
    const empty = [...scope.querySelectorAll('button')].filter(b => !(b.textContent||'').trim() && !b.title).map(b => b.getAttribute('onclick'));
    return { dead: [...new Set(dead)], empty, tabSelf: !!(document.getElementById('tab-self')), tabClub: !!(document.getElementById('tab-club')) };
  });
  if (startDead.dead.length) bug(sc, 'P0', '开局弹窗: onclick 断链', startDead.dead.join(' | '));
  if (startDead.empty.length) bug(sc, 'P1', '开局弹窗: 按钮文案为空', startDead.empty.join(' | '));
  if (!startDead.tabSelf || !startDead.tabClub) {
    bug(sc, 'P0', '开局弹窗: 缺少经理模式/执教入口', `self=${startDead.tabSelf} club=${startDead.tabClub}`);
  }

  // Create team via UI path
  const created = await page.evaluate((sc) => {
    try { pickScenario(sc); } catch (e) { return { ok: false, stage: 'pick', err: e.message }; }
    const nameEl = document.querySelector('#new-team-name');
    if (!nameEl) return { ok: false, stage: 'name-input', err: 'missing #new-team-name' };
    // ensure self tab body visible
    try { switchStartTab('self'); } catch (e) {}
    nameEl.value = '猎手' + sc.slice(0, 2);
    try { createTeam(); } catch (e) { return { ok: false, stage: 'createTeam', err: e.message, stack: (e.stack||'').split('\n')[1] }; }
    return {
      ok: true,
      mode: S.mode, scenario: S.scenario, teamName: S.teamName,
      fund: S.fund, wageCap: S.wageCap, preseason: S.preseason,
      transferWindow: S.transferWindow, players: S.players.length,
      lineup: S.lineup.length, coach: !!S.coach, seedPower: S.seedPower,
      market: (S.market||[]).length, freeAgents: (S.freeAgents||[]).length,
      transferList: (S.transferList||[]).length,
      page: document.querySelector('.page.on') ? document.querySelector('.page.on').id : null,
      modalOn: !!(document.getElementById('start-modal') && document.getElementById('start-modal').classList.contains('on')),
      eventLog: (S.eventLog||[]).slice(0, 6).map(e => e.txt || String(e)),
    };
  }, sc);

  if (!created.ok) {
    bug(sc, 'P0', `createTeam 失败 @${created.stage}`, created.err);
    return null;
  }
  if (created.scenario !== sc) bug(sc, 'P0', 'createTeam 未应用所选剧本', `expect ${sc} got ${created.scenario}`);
  if (created.modalOn) bug(sc, 'P1', 'createTeam 后开局弹窗未关闭', '#start-modal still .on');
  if (created.mode !== 'manager') bug(sc, 'P1', 'createTeam 身份不是 manager', created.mode);
  if (!created.coach) bug(sc, 'P1', 'createTeam 未自动签教练', JSON.stringify(created));

  // Scenario-specific expected effects
  if (sc === 'normal') {
    if (created.fund !== 1300) bug(sc, 'P1', 'normal 剧本资金异常', String(created.fund));
  }
  if (sc === 'debt') {
    if (created.fund !== 330) bug(sc, 'P0', 'debt 剧本资金未生效', `fund=${created.fund} expect 330`);
    if (created.wageCap !== 120) bug(sc, 'P0', 'debt 剧本工资帽未生效', `cap=${created.wageCap} expect 120`);
  }
  if (sc === 'cap') {
    if (created.wageCap !== 90) bug(sc, 'P0', 'cap 剧本工资帽未生效', `cap=${created.wageCap} expect 90`);
  }
  if (sc === 'exodus') {
    if (created.players !== 4) bug(sc, 'P0', 'exodus 剧本未减员', `players=${created.players} expect 4`);
  }
  if (sc === 'cursed') {
    const mor = await page.evaluate(() => S.players.map(p => p.morale));
    if (!mor.every(m => m === 50)) bug(sc, 'P0', 'cursed 剧本士气未统一 50', JSON.stringify(mor));
  }

  await dismissOverlays(page);
  return created;
}

async function transferPhase(page, sc, consoleBuf) {
  await page.evaluate(() => goPage('market'));
  await page.waitForTimeout(150);
  await dismissOverlays(page);

  const marketUI = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#page-market button, #page-club button')].map(b => ({
      text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      onclick: b.getAttribute('onclick') || '',
      disabled: !!b.disabled,
    }));
    return {
      transferWindow: S.transferWindow,
      fund: S.fund,
      market: (S.market||[]).length,
      freeAgents: (S.freeAgents||[]).length,
      transferList: (S.transferList||[]).length,
      listed: (S.listed||[]).length,
      buttons: btns.filter(b => /买|签|谈|挖|挂|续|出|刷|租|结束|跳过|推进/i.test(b.text + b.onclick)),
      allSample: btns.slice(0, 30),
    };
  });

  // Required entry points visible
  const need = [
    [/结束转会期|uiEndPreseason/, '结束转会期入口'],
    [/跳过|uiSkipTransfer/, '跳过转会期入口'],
    [/推进一天|uiNextDay/, '推进一天入口'],
  ];
  const marketHtml = await page.evaluate(() => (document.getElementById('page-market') || {}).innerHTML || '');
  const clubHtml = await page.evaluate(() => (document.getElementById('page-club') || {}).innerHTML || '');
  const both = marketHtml + clubHtml;
  need.forEach(([re, label]) => {
    if (!re.test(both)) bug(sc, 'P0', `转会期: 缺少${label}`, re.toString());
  });

  // Buy cheapest market player if possible
  const buy = await page.evaluate(() => {
    const list = (S.market || []).slice().sort((a, b) => {
      const ca = capFee(Math.round(valueOf(overall(a)) * (a.discount || 1)));
      const cb = capFee(Math.round(valueOf(overall(b)) * (b.discount || 1)));
      return ca - cb;
    });
    if (!list.length) return { ok: false, reason: 'market empty' };
    const p = list[0];
    const cost = capFee(Math.round(valueOf(overall(p)) * (p.discount || 1)));
    const before = { n: S.players.length, fund: S.fund };
    // Prefer UI button if present
    const btn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('onclick') || '').includes('buyPlayer') && (b.getAttribute('onclick') || '').includes(p.id));
    let method = 'fn';
    try {
      if (btn) { btn.click(); method = 'ui-click'; }
      else buyPlayer(S, p);
    } catch (e) {
      return { ok: false, method, err: e.message, cost, player: p.name };
    }
    return { ok: S.players.length > before.n || S.fund < before.fund, method, player: p.name, cost, before, after: { n: S.players.length, fund: S.fund }, toast: (document.querySelector('#toast')||{innerText:''}).innerText };
  });
  if (!buy.ok && buy.reason !== 'market empty') {
    bug(sc, 'P1', '转会市场: 买断/签约失败', JSON.stringify(buy));
  }

  // Direct sign free agent
  const fa = await page.evaluate(() => {
    const list = (S.freeAgents || []).slice().sort((a, b) => (a.signCost || 0) - (b.signCost || 0));
    if (!list.length) return { ok: false, reason: 'no FA' };
    const p = list[0];
    const before = { n: S.players.length, fund: S.fund };
    try { signFreeAgent(S, p.id); } catch (e) { return { ok: false, err: e.message, player: p.name }; }
    return { ok: S.players.length > before.n, player: p.name, cost: p.signCost, before, after: { n: S.players.length, fund: S.fund } };
  });
  if (!fa.ok && fa.reason !== 'no FA') bug(sc, 'P1', '自由市场直签失败', JSON.stringify(fa));

  // Negotiation open on a non-untouchable transferList entry
  const nego = await page.evaluate(() => {
    const t = (S.transferList || []).find(p => !p.untouchable && !S.players.some(x => x.id === p.id));
    if (!t) return { ok: false, reason: 'no negotiable' };
    try { openNegotiation(S, t.id); } catch (e) { return { ok: false, err: e.message }; }
    const modal = document.getElementById('app-modal');
    const on = !!(modal && modal.classList.contains('on'));
    const body = modal ? (modal.innerText || '') : '';
    const hasClose = !!(modal && modal.querySelector('[onclick*="closeModal"], [onclick*="close"]'));
    const dead = [];
    if (on) {
      modal.querySelectorAll('[onclick]').forEach(el => {
        const code = el.getAttribute('onclick') || '';
        [...code.matchAll(/(?:^|[;&\s])([A-Za-z_$][\w$]*)\s*\(/g)].forEach(m => {
          if (m[1] !== 'window' && m[1] !== 'this' && typeof window[m[1]] !== 'function') dead.push(m[1]);
        });
      });
    }
    return { ok: on, player: t.name, hasClose, bodySnippet: body.slice(0, 180), dead: [...new Set(dead)] };
  });
  if (nego.ok === false && nego.reason !== 'no negotiable') bug(sc, 'P1', '转会谈判: openNegotiation 未打开弹窗', JSON.stringify(nego));
  if (nego.ok) {
    if (nego.dead && nego.dead.length) bug(sc, 'P0', '转会谈判弹窗: onclick 断链', nego.dead.join(','));
    const fullText = await page.evaluate(() => {
      const m = document.getElementById('app-modal');
      return m ? (m.innerText || '') : '';
    });
    const hasExit = /negoQuit|放弃|closeModal/.test(fullText) || await page.evaluate(() => typeof negoQuit === 'function');
    if (!hasExit) bug(sc, 'P1', '转会谈判弹窗: 无关闭/放弃出口', fullText.slice(0, 160));
    if (!fullText || /undefined|NaN/.test(fullText.slice(0, 400))) {
      bug(sc, 'P1', '转会谈判弹窗: 文案脏/空', fullText.slice(0, 160));
    }
    const closed = await page.evaluate(() => {
      try { negoQuit(); } catch (e) { return { threw: e.message }; }
      const modal = document.getElementById('app-modal');
      return { stillOn: !!(modal && modal.classList.contains('on')), hasFn: typeof negoQuit === 'function' };
    });
    if (closed.threw) bug(sc, 'P0', 'negoQuit 抛错', closed.threw);
    else if (closed.stillOn) bug(sc, 'P0', 'negoQuit 后谈判弹窗仍打开（无法关闭）', JSON.stringify(closed));
    await page.evaluate(() => { try { closeModal('app-modal'); } catch (e) {} });
  }

  // List a bench player (swap out of lineup first if needed)
  const list = await page.evaluate(() => {
    const p = (S.players || []).find(x => !S.lineup.includes(x.id) && !x.loan && !x.loanOut && !(x.kjia > 0));
    if (!p) {
      // force one off lineup
      const starter = S.lineup[S.lineup.length - 1];
      const sp = S.players.find(x => x.id === starter);
      if (!sp) return { ok: false, reason: 'no player to list' };
      try { swapPlayer(sp.id); } catch (e) {}
      const p2 = S.players.find(x => x.id === sp.id);
      if (!p2 || S.lineup.includes(p2.id)) return { ok: false, reason: 'swap failed' };
      try { listPlayer(S, p2.id); } catch (e) { return { ok: false, err: e.message, player: p2.name }; }
      return { ok: (S.listed || []).some(x => x.id === p2.id), player: p2.name, listed: (S.listed || []).length };
    }
    try { listPlayer(S, p.id); } catch (e) { return { ok: false, err: e.message, player: p.name }; }
    return { ok: (S.listed || []).some(x => x.id === p.id), player: p.name, listed: (S.listed || []).length };
  });
  if (!list.ok) bug(sc, 'P1', '挂牌出售失败', JSON.stringify(list));

  // Renew negotiation on an expiring/short-contract player
  const renew = await page.evaluate(() => {
    const p = (S.players || []).find(x => !x.loan && (x.contract == null || x.contract <= 1)) || S.players[0];
    if (!p) return { ok: false, reason: 'no players' };
    try { openRenewNego(S, p.id); } catch (e) { return { ok: false, err: e.message, player: p.name }; }
    const modal = document.getElementById('app-modal');
    const on = !!(modal && modal.classList.contains('on'));
    const body = modal ? (modal.innerText || '') : '';
    const hasSubmit = !!(modal && modal.querySelector('[onclick*="submitRenewNego"]'));
    const hasClose = !!(modal && modal.querySelector('[onclick*="closeModal"]'));
    return { ok: on || (p.contract || 0) > 1, player: p.name, contract: p.contract, on, hasSubmit, hasClose, bodySnippet: body.slice(0, 160) };
  });
  if (renew.on) {
    if (!renew.hasSubmit) bug(sc, 'P0', '续约谈判弹窗: 无「提出报价」按钮', renew.bodySnippet);
    if (!renew.hasClose) bug(sc, 'P1', '续约谈判弹窗: 无关闭/先不谈', renew.bodySnippet);
    // try submit once
    const sub = await page.evaluate(() => {
      const before = { fund: S.fund, contracts: S.players.map(p => p.contract) };
      try {
        if (typeof submitRenewNego === 'function') submitRenewNego();
      } catch (e) { return { threw: e.message }; }
      const modal = document.getElementById('app-modal');
      return {
        before,
        after: { fund: S.fund, contracts: S.players.map(p => p.contract) },
        modalStill: !!(modal && modal.classList.contains('on')),
        toast: (document.querySelector('#toast') || { innerText: '' }).innerText.slice(0, 100),
      };
    });
    if (sub.threw) bug(sc, 'P0', '续约报价抛错', sub.threw);
    await page.evaluate(() => { try { closeModal('app-modal'); } catch (e) {} });
  } else if (renew.ok === false && renew.reason !== 'no players') {
    bug(sc, 'P2', '续约谈判: 未能打开（合同未到期属正常）', JSON.stringify(renew));
  }

  // UI click sweep on market page for transfer-related buttons
  const clicks = await tryClickButtons(page, sc, 'transfer-clicks', /签约|买|谈|挂|续|直签|刷新|结束转会|跳过|推进一天/i, consoleBuf);
  evaluateClicks(sc, 'transfer-clicks', clicks);

  return { marketUI, buy, fa, nego, list, renew, clicks: clicks.length };
}

async function lineupTrainPhase(page, sc) {
  await page.evaluate(() => goPage('lineup'));
  await page.waitForTimeout(120);
  const lineupSnap = await snapPage(page);
  mergeFindings(sc, 'lineup', lineupSnap, null);

  const lineupInfo = await page.evaluate(() => {
    const ls = rosterLineup(S);
    const miss = POS_ORDER.filter(pos => !ls.some(x => x.pos === pos));
    const tactics = [...document.querySelectorAll('button[onclick*="setTactic"]')].map(b => (b.textContent||'').trim());
    return {
      lineup: ls.length, miss, players: S.players.length,
      tactic: S.tactic || 'balanced', tactics,
      weeklyWage: weeklyWage(S), wageCap: S.wageCap,
    };
  });
  if (!lineupInfo.tactics || lineupInfo.tactics.length < 4) {
    bug(sc, 'P1', '阵容/战术: 战术按钮不足', JSON.stringify(lineupInfo.tactics));
  }

  // set each tactic
  const tacticTry = await page.evaluate(() => {
    const ids = (typeof TACTICS !== 'undefined') ? TACTICS.map(t => t.id) : [];
    const results = [];
    ids.forEach(id => {
      try { setTactic(id); results.push({ id, ok: S.tactic === id }); }
      catch (e) { results.push({ id, err: e.message }); }
    });
    return results;
  });
  tacticTry.forEach(t => {
    if (t.err) bug(sc, 'P0', 'setTactic 抛错', `${t.id}: ${t.err}`);
    else if (!t.ok) bug(sc, 'P1', 'setTactic 未生效', `${t.id} -> ${S && ''}`);
  });

  // If exodus left a hole, try harder to fill via market/FA
  if (lineupInfo.miss.length) {
    const fill = await page.evaluate((miss) => {
      const results = [];
      miss.forEach(pos => {
        const fa = (S.freeAgents || []).find(p => p.pos === pos);
        const mk = (S.market || []).find(p => p.pos === pos);
        const src = fa || mk;
        if (!src) {
          // force-gen a low FA and attach to freeAgents then sign path
          try {
            const def = genFreeAgentDef(pos, 'low');
            const p = genPlayer(def);
            p.signCost = Math.max(50, Math.round(valueOf(overall(p)) * 0.6));
            p.freeAgent = true; p.contract = 1;
            S.freeAgents = (S.freeAgents || []).concat([p]);
            if (S.fund >= p.signCost) { signFreeAgent(S, p.id); results.push({ pos, ok: true, name: p.name, via: 'gen-FA' }); }
            else { S.players.push(p); results.push({ pos, ok: true, name: p.name, via: 'force-push' }); }
          } catch (e) { results.push({ pos, ok: false, err: e.message, reason: 'no candidate' }); }
          return;
        }
        try {
          if (fa) signFreeAgent(S, fa.id);
          else buyPlayer(S, mk);
          results.push({ pos, ok: true, name: src.name });
        } catch (e) {
          try { S.players.push(src); results.push({ pos, ok: true, name: src.name, via: 'force-push-after-err' }); }
          catch (e2) { results.push({ pos, ok: false, err: e.message }); }
        }
      });
      try { autoFillLineup(S); } catch (e) {}
      save(); renderAll();
      return { results, missAfter: POS_ORDER.filter(pos => !rosterLineup(S).some(x => x.pos === pos)), players: S.players.length };
    }, lineupInfo.miss);
    fill.results.forEach(r => {
      if (!r.ok && r.reason !== 'no candidate') bug(sc, 'P1', `exodus 补位失败 ${r.pos}`, r.err || r.reason);
    });
    if (fill.missAfter.length) {
      bug(sc, 'P1', '转会期后仍有位置空缺（市场/资金无法补齐）', JSON.stringify(fill.missAfter));
    }
  }

  // Train
  await page.evaluate(() => goPage('train'));
  await page.waitForTimeout(120);
  const trainSnap = await snapPage(page);
  mergeFindings(sc, 'train', trainSnap, null);

  const train = await page.evaluate(() => {
    const p = (S.players || []).slice().sort((a, b) => overall(b) - overall(a))[0];
    if (!p) return { ok: false, reason: 'no players' };
    const key = ['lane', 'farm', 'team', 'mind'].sort((a, b) => p.attrs[a] - p.attrs[b])[0];
    const before = { fund: S.fund, trained: !!S.trained, attr: p.attrs[key], energy: p.energy, name: p.name };
    // Prefer UI button
    const btn = [...document.querySelectorAll('button')].find(b => {
      const c = b.getAttribute('onclick') || '';
      return c.includes('doTrain') && c.includes(p.id) && c.includes(key);
    });
    let method = 'fn';
    try {
      if (btn && !btn.disabled) { btn.click(); method = 'ui'; }
      else doTrain(S, p.id, key);
    } catch (e) {
      return { ok: false, err: e.message, before, player: p.name, key };
    }
    return {
      ok: !!S.trained || p.attrs[key] > before.attr || S.fund < before.fund,
      method, before,
      after: { fund: S.fund, trained: !!S.trained, attr: p.attrs[key], energy: p.energy },
      player: p.name, key,
      toast: (document.querySelector('#toast') || { innerText: '' }).innerText.slice(0, 80),
    };
  });
  if (!train.ok && train.reason !== 'no players') bug(sc, 'P1', '训练: doTrain 未产生状态变化', JSON.stringify(train));

  // Rookie recruit if academy empty
  const aca = await page.evaluate(() => {
    const before = (S.academy || []).length;
    if (!before && S.fund >= 50) {
      try { recruitRookie(S); } catch (e) { return { ok: false, err: e.message }; }
    }
    return { ok: (S.academy || []).length >= before, before, after: (S.academy || []).length, fund: S.fund };
  });
  if (aca.err) bug(sc, 'P1', '青训招募抛错', aca.err);

  return { lineupInfo, tacticTry, train, aca };
}

async function leagueMatchPhase(page, sc, consoleBuf) {
  // endPreseason via UI function (confirm auto-accepted)
  const ended = await page.evaluate(() => {
    const before = { preseason: S.preseason, tw: S.transferWindow, phase: S.phase, players: S.players.length };
    try {
      autoFillLineup(S);
      const miss = POS_ORDER.filter(pos => !S.players.some(p => p.pos === pos && !p.loan));
      if (miss.length) {
        // last-chance fill from FA/market/gen
        miss.forEach(pos => {
          const cand = (S.freeAgents || []).find(p => p.pos === pos)
            || (S.market || []).find(p => p.pos === pos)
            || null;
          if (!cand) {
            const def = (typeof genFreeAgentDef === 'function') ? genFreeAgentDef(pos, 'low') : null;
            if (def) { try { S.players.push(genPlayer(def)); } catch (e) {} }
            return;
          }
          try {
            if ((S.freeAgents || []).some(x => x.id === cand.id)) signFreeAgent(S, cand.id);
            else buyPlayer(S, cand);
          } catch (e) {
            try { S.players.push(cand); } catch (e2) {}
          }
        });
        autoFillLineup(S);
      }
      const miss2 = POS_ORDER.filter(pos => !S.players.some(p => p.pos === pos && !p.loan));
      if (miss2.length) return { ok: false, reason: 'missing pos', miss: miss2, before, faPos: (S.freeAgents||[]).map(p=>p.pos), mkPos: (S.market||[]).map(p=>p.pos) };
      if (typeof uiEndPreseason === 'function') uiEndPreseason(S);
      else endPreseason(S);
    } catch (e) {
      return { ok: false, err: e.message, before };
    }
    return {
      ok: S.preseason === false,
      before,
      after: { preseason: S.preseason, tw: S.transferWindow, phase: S.phase, matchIdx: S.matchIdx, schedule: (S.schedule || []).length },
      toast: (document.querySelector('#toast') || { innerText: '' }).innerText.slice(0, 100),
    };
  });
  if (!ended.ok) {
    const sev = (ended.reason === 'missing pos') ? 'P1' : 'P0';
    bug(sc, sev,
      ended.reason === 'missing pos'
        ? '结束转会期被位置空缺挡住（剧本空位未能补齐）'
        : '结束转会期失败/未切换 phase',
      JSON.stringify(ended));
  } else if (ended.after.preseason === true) bug(sc, 'P0', 'toast/确认后 preseason 仍为 true', JSON.stringify(ended));

  await page.evaluate(() => goPage('club'));
  await page.waitForTimeout(150);
  const clubSnap = await snapPage(page);
  mergeFindings(sc, 'club-after-endPreseason', clubSnap, consoleBuf);

  // nextAction vs UI
  const na = await page.evaluate(() => {
    const act = nextAction(S);
    const html = (document.getElementById('page-club') || {}).innerHTML || '';
    const body = document.body.innerHTML || '';
    const has = act ? (
      html.includes(act.fn) || html.includes('uiDoNextAction') ||
      body.includes(act.fn) || body.includes('uiDoNextAction') ||
      (act.label && [...document.querySelectorAll('button')].some(b => (b.textContent||'').includes(act.label.slice(0, 6))))
    ) : null;
    // collect club page primary buttons
    const btns = [...document.querySelectorAll('#page-club button')].map(b => ({
      text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50),
      onclick: (b.getAttribute('onclick') || '').slice(0, 80),
    })).filter(b => b.text);
    return { act, has, btns, phase: S.phase, schedule: (S.schedule||[]).length, matchIdx: S.matchIdx };
  });
  if (na.act && na.has === false) {
    bug(sc, 'P0', '开赛后: nextAction 有值但俱乐部页找不到对应按钮',
      `act=${JSON.stringify(na.act)} btns=${na.btns.map(b => b.text).join(' / ')}`);
  }

  // Auto-play first series
  const series = await page.evaluate(() => {
    window.kmAutoAdvance = true;
    S.seriesAuto = true;
    const before = { phase: S.phase, matchIdx: S.matchIdx, history: (S.history || []).length, series: !!S.series };
    try {
      if (S.preseason) return { ok: false, reason: 'still preseason', before };
      const m = (S.schedule || [])[S.matchIdx];
      if (!m) return { ok: false, reason: 'no schedule', before };
      if (typeof uiStartMatch === 'function') uiStartMatch();
      else startMatch();
      // If BP modal open, force auto
      let guard = 0;
      while (S.series && guard++ < 30) {
        if (!S.seriesAuto) S.seriesAuto = true;
        if (typeof autoPlayNext === 'function') autoPlayNext();
        else if (typeof bpAuto === 'function') bpAuto();
        else break;
      }
      // After series may need another click for afterMatch
      if (S._afterMatch) {
        const fn = S._afterMatch; S._afterMatch = null;
        try { fn(); } catch (e) { return { ok: false, err: 'afterMatch: ' + e.message, before }; }
      }
    } catch (e) {
      return { ok: false, err: e.message, before, stack: (e.stack||'').split('\n').slice(0,3).join(' | ') };
    }
    return {
      ok: true,
      before,
      after: {
        phase: S.phase, matchIdx: S.matchIdx, history: (S.history || []).length,
        series: !!S.series, day: S.day, trained: !!S.trained,
      },
      historyTail: (S.history || []).slice(-2).map(h => `${h.opp} ${h.win?'W':'L'} ${h.score}`),
      modalOn: !!(document.getElementById('app-modal') && document.getElementById('app-modal').classList.contains('on')),
    };
  });
  if (!series.ok) {
    const sev = (series.reason === 'still preseason' || series.reason === 'missing pos') ? 'P1' : 'P0';
    bug(sc, sev, '联赛开赛/BP自动系列赛未能推进', JSON.stringify(series));
  } else if (series.after.history <= series.before.history && series.after.phase === series.before.phase && series.after.matchIdx === series.before.matchIdx) {
    bug(sc, 'P0', '系列赛推进后 phase/matchIdx/history 均未变化（卡住）', JSON.stringify(series));
  }

  // Close any leftover modal and re-check nextAction
  await dismissOverlays(page);
  await page.evaluate(() => goPage('club'));
  await page.waitForTimeout(100);
  const na2 = await page.evaluate(() => {
    const act = nextAction(S);
    const html = (document.getElementById('page-club') || {}).innerHTML || '';
    const has = act ? (html.includes(act.fn) || html.includes('uiDoNextAction') || [...document.querySelectorAll('button')].some(b => (b.textContent||'').includes((act.label||'').slice(0, 6)))) : null;
    return { act, has, phase: S.phase, matchIdx: S.matchIdx, history: (S.history||[]).length };
  });
  if (na2.act && na2.has === false) {
    bug(sc, 'P0', '系列赛后: nextAction 有值但页面无按钮', JSON.stringify(na2));
  }

  // Engine probe: force card phase and check club card panel button correctness
  const cardProbe = await page.evaluate(() => {
    const out = {};
    try {
      const me = S.teamName;
      const opp = (AI_TEAMS.find(t => t.name !== me) || { name: '对手' }).name;
      S.phase = 'card';
      S.preseason = false;
      S.card = { idx: 0, matches: [{ a: me, b: opp, r: null }] };
      if (typeof renderClub === 'function') renderClub(); else if (typeof renderAll === 'function') renderAll();
      const html = (document.getElementById('page-club') || {}).innerHTML || '';
      out.hasCardPanel = html.includes('卡位赛') || html.includes('card');
      const btns = [...document.querySelectorAll('#page-club button')].map(b => ({
        text: (b.textContent||'').replace(/\s+/g,' ').trim(),
        onclick: b.getAttribute('onclick') || '',
      }));
      out.cardBtns = btns.filter(b => /卡位|uiDoNextAction|startCard/i.test(b.text + b.onclick));
      out.buggyOnclick = btns.filter(b => /uiDoNextAction\s*\(\s*['"]/.test(b.onclick));
      out.correctOnclick = btns.filter(b => /uiDoNextAction\s*\(\s*S\s*\)/.test(b.onclick) || /(^|[^A-Za-z])startCard\s*\(/.test(b.onclick));
      const cardBtn = [...document.querySelectorAll('#page-club button')].find(b => /进行卡位赛|uiDoNextAction|startCard/.test((b.textContent||'')+(b.getAttribute('onclick')||'')));
      if (cardBtn) {
        const before = { series: !!S.series, phase: S.phase, mw: S.series && S.series.mw };
        let threw = null, toast = '';
        try {
          // clear toast
          try { const t=document.getElementById('toast'); if(t) t.innerText=''; } catch(e){}
          cardBtn.click();
          toast = (document.querySelector('#toast') || { innerText: '' }).innerText.slice(0, 120);
        } catch (e) { threw = e.message; }
        out.clickResult = { before, after: { series: !!S.series, phase: S.phase }, threw, toast, onclick: cardBtn.getAttribute('onclick') };
        // engine direct path
        try {
          try { const t=document.getElementById('toast'); if(t) t.innerText=''; } catch(e){}
          S.seriesAuto = true; window.kmAutoAdvance = true;
          startCard();
          out.startCardDirect = { series: !!S.series, phase: S.phase, seriesStage: S.series && S.series.stage, toast: (document.querySelector('#toast')||{innerText:''}).innerText.slice(0,80) };
        } catch (e) { out.startCardDirect = { err: e.message }; }
      } else {
        out.noCardBtn = true;
        out.htmlSnippet = html.includes('卡位赛') ? html.slice(html.indexOf('卡位赛'), html.indexOf('卡位赛')+400) : '(no 卡位赛 in html)';
      }
    } catch (e) {
      out.err = e.message;
    }
    return out;
  });
  if (cardProbe.err) bug(sc, 'P0', '卡位赛面板探测抛错', cardProbe.err);
  if (cardProbe.buggyOnclick && cardProbe.buggyOnclick.length) {
    const b = cardProbe.buggyOnclick[0];
    const cr = cardProbe.clickResult || {};
    const toast = cr.toast || '';
    const stuck = !cr.threw && !(cr.after && cr.after.series) && /没有可进行|当前没有/.test(toast);
    const fallbackSuppressed = !(cardProbe.correctOnclick || []).length;
    bug(sc, 'P0',
      stuck
        ? '卡位赛按钮 uiDoNextAction(\'startCard\') → nextAction(字符串)=null，点击无效且兜底被抑制'
        : '卡位赛按钮 onclick 参数错误（uiDoNextAction 传字符串而非 S）',
      `onclick=${b.onclick} toast=${toast} clickSeries=${cr.after && cr.after.series} startCardDirect=${JSON.stringify(cardProbe.startCardDirect||null)} correctBtn=${(cardProbe.correctOnclick||[]).length}`);
  }
  if (cardProbe.noCardBtn) {
    bug(sc, 'P0', '卡位赛 phase 下俱乐部页无进行按钮', JSON.stringify(cardProbe).slice(0, 300));
  }

  // Playoff button pattern — use buildPlayoff-shaped object (lb4/lbf as objects not null)
  const poProbe = await page.evaluate(() => {
    const me = S.teamName;
    const opp = (AI_TEAMS.find(t => t.name !== me) || { name: 'X' }).name;
    const blank = () => ({ a: null, b: null, r: null });
    S.phase = 'playoff';
    S.preseason = false;
    S.playoff = {
      wb: [{ a: me, b: opp, r: null }, { a: opp, b: me, r: null }],
      lb: [{ a: opp, b: opp, r: null }, { a: me, b: opp, r: null }],
      lb2: [{ a: opp, b: null, r: null }, { a: me, b: null, r: null }],
      lb3: [blank(), blank()],
      wf: blank(), lb4: blank(), lbf: blank(),
      final: { a: me, b: opp, r: null }, champ: null,
    };
    let renderErr = null;
    try { renderClub(); } catch (e) { renderErr = 'club:' + e.message; }
    let leagueErr = null;
    try { goPage('league'); } catch (e) { leagueErr = e.message; }
    try { goPage('club'); renderClub(); } catch (e) {}
    const btns = [...document.querySelectorAll('#page-club button')].map(b => ({
      text: (b.textContent||'').replace(/\s+/g,' ').trim(),
      onclick: b.getAttribute('onclick') || '',
    }));
    return {
      renderErr, leagueErr,
      playoffBtns: btns.filter(b => /季后|uiDoNextAction|startPlayoff|快进/i.test(b.text + b.onclick)),
      buggy: btns.filter(b => /uiDoNextAction\s*\(\s*['"]/.test(b.onclick)),
      correct: btns.filter(b => /uiDoNextAction\s*\(\s*S\s*\)/.test(b.onclick) || /startPlayoff\s*\(/.test(b.onclick)),
    };
  });
  if (poProbe.err) bug(sc, 'P0', '季后赛面板探测抛错', poProbe.err);
  if (poProbe.renderErr) bug(sc, 'P0', '季后赛 phase 下 renderClub 抛错', poProbe.renderErr);
  if (poProbe.leagueErr) bug(sc, 'P0', '季后赛 phase 下 goPage(league) 抛错 — 联赛页打不开', poProbe.leagueErr);
  if (poProbe.buggy && poProbe.buggy.length && !(poProbe.correct||[]).length) {
    bug(sc, 'P0', '季后赛按钮 uiDoNextAction(字符串) 参数错误且无正确入口', JSON.stringify(poProbe.buggy));
  } else if (poProbe.buggy && poProbe.buggy.length) {
    bug(sc, 'P1', '季后赛按钮存在错误 onclick（同时也有正确入口）', JSON.stringify(poProbe.buggy));
  }

  // Incomplete playoff (null slots) → renderLeague robustness (real save-edge case)
  const nullPo = await page.evaluate(() => {
    const savedPo = S.playoff;
    const savedPhase = S.phase;
    S.phase = 'playoff';
    S.playoff = {
      wb: [{ a: 'A', b: 'B', r: null }], lb: [{ a: 'C', b: 'D', r: null }],
      lb2: [{ a: 'E', b: null, r: null }], lb3: [{ a: null, b: null, r: null }],
      wf: { a: null, b: null, r: null }, lb4: null, lbf: null,
      final: { a: null, b: null, r: null }, champ: null,
    };
    let err = null;
    try { goPage('league'); } catch (e) { err = e.message; }
    // restore so later sweeps are not poisoned
    try { S.playoff = savedPo; S.phase = savedPhase; goPage('club'); } catch (e) {}
    return err ? { ok: false, err } : { ok: true };
  });
  if (!nullPo.ok) {
    bug(sc, 'P1', 'renderLeague 在季后赛空槽位(lb4/lbf=null)时抛错 — 联赛页崩溃',
      nullPo.err + ' | ui.js renderLeague pMatch(pf.lb4/lbf) 未判空（残缺对阵树/旧档边缘）');
  }

  // Reset phase to something sane for remaining page sweeps
  await page.evaluate(() => {
    try {
      if (S.history && S.history.length) {
        // leave as-is if league progressed
      }
      renderAll();
    } catch (e) {}
  });

  return { ended, na, series, cardProbe, poProbe };
}

async function sidePagesPhase(page, sc, consoleBuf) {
  const results = {};
  for (const pg of ['kjia', 'union', 'hall', 'biz', 'league']) {
    const goErr = await page.evaluate((p) => {
      try { goPage(p); return null; } catch (e) { return e.message; }
    }, pg);
    if (goErr) {
      bug(sc, 'P0', `side: goPage('${pg}') 抛错（页面打不开）`, goErr);
      // try to continue
      await page.evaluate(() => { try { goPage('club'); } catch (e) {} });
      results[pg] = { goErr };
      continue;
    }
    await page.waitForTimeout(100);
    const snap = await snapPage(page);
    mergeFindings(sc, `side/${pg}`, snap, consoleBuf);
    results[pg] = { dead: snap.dead, dirty: snap.dirty, emptyBtn: snap.emptyBtn };
  }

  // Union history + era start entry
  const union = await page.evaluate(() => {
    const out = {};
    try {
      setUnionMode('hist');
      const html = (document.getElementById('page-union') || {}).innerHTML || '';
      out.hist = html.includes('历代联盟') || html.includes('历届');
      out.hasEraBtn = html.includes('gotoEraStart');
      const dead = [];
      document.querySelectorAll('#page-union [onclick]').forEach(el => {
        const code = el.getAttribute('onclick') || '';
        [...code.matchAll(/(?:^|[;&\s])([A-Za-z_$][\w$]*)\s*\(/g)].forEach(m => {
          if (m[1] !== 'window' && m[1] !== 'this' && typeof window[m[1]] !== 'function') dead.push(m[1]+' <- '+code.slice(0,60));
        });
      });
      out.dead = [...new Set(dead)];
      setUnionMode('now');
    } catch (e) { out.err = e.message; }
    return out;
  });
  if (union.err) bug(sc, 'P0', '联盟页历代切换抛错', union.err);
  if (union.dead && union.dead.length) bug(sc, 'P0', '联盟页 onclick 断链', union.dead.join(' | '));
  if (union.hist === false) bug(sc, 'P1', '联盟页: 历代联盟内容未渲染', JSON.stringify(union));

  // Hall
  const hall = await page.evaluate(() => {
    const html = (document.getElementById('page-hall') || {}).innerHTML || '';
    return { len: html.length, hasContent: html.length > 80, snippet: html.slice(0, 120) };
  });
  if (!hall.hasContent) bug(sc, 'P1', '荣誉馆页面几乎为空', hall.snippet);

  // Biz: sponsor / board / prefs
  const biz = await page.evaluate(() => {
    const html = (document.getElementById('page-biz') || {}).innerHTML || '';
    const out = {
      hasSponsor: /赞助/.test(html),
      hasWageCap: /工资帽/.test(html),
      hasHonors: /荣誉室|荣誉馆/.test(html),
      hasPrefs: /本机偏好|简化模式|高对比/.test(html),
      hasBoard: /董事会|信任/.test(html),
      dead: [],
    };
    document.querySelectorAll('#page-biz [onclick]').forEach(el => {
      const code = el.getAttribute('onclick') || '';
      [...code.matchAll(/(?:^|[;&\s])([A-Za-z_$][\w$]*)\s*\(/g)].forEach(m => {
        if (m[1] !== 'window' && m[1] !== 'this' && typeof window[m[1]] !== 'function') out.dead.push(m[1] + ' <- ' + code.slice(0, 60));
      });
    });
    // toggle prefs
    try {
      const before = { simple: typeof simpleMode === 'function' ? simpleMode() : null };
      if (typeof toggleSimpleMode === 'function') toggleSimpleMode();
      const mid = typeof simpleMode === 'function' ? simpleMode() : null;
      if (typeof toggleSimpleMode === 'function') toggleSimpleMode(); // restore
      out.prefsToggle = { before: before.simple, mid, restored: typeof simpleMode === 'function' ? simpleMode() : null };
    } catch (e) { out.prefsErr = e.message; }
    return out;
  });
  if (!biz.hasSponsor) bug(sc, 'P1', '经营页: 缺少赞助商区块', JSON.stringify(biz).slice(0,200));
  if (!biz.hasPrefs) bug(sc, 'P2', '经营页: 缺少本机偏好区块', '');
  if (biz.dead && biz.dead.length) bug(sc, 'P0', '经营页 onclick 断链', biz.dead.join(' | '));
  if (biz.prefsErr) bug(sc, 'P1', '经营页偏好切换抛错', biz.prefsErr);
  if (biz.prefsToggle && biz.prefsToggle.before === biz.prefsToggle.mid) {
    bug(sc, 'P1', '经营页: 简化模式开关点击后状态未变', JSON.stringify(biz.prefsToggle));
  }

  // Board panel on club page
  await page.evaluate(() => goPage('club'));
  await page.waitForTimeout(80);
  const board = await page.evaluate(() => {
    const html = (document.getElementById('page-club') || {}).innerHTML || '';
    return {
      hasBoard: /董事会|信任/.test(html),
      snippet: (html.match(/董事会[\s\S]{0,120}/) || [''])[0],
    };
  });
  if (!board.hasBoard) bug(sc, 'P2', '俱乐部页: 未见董事会/信任信息', board.snippet);

  // Advance day / calendar buttons
  const advance = await page.evaluate(() => {
    const html = document.body.innerHTML || '';
    const hasDay = /推进一天|uiNextDay/.test(html);
    const hasCal = /推进赛历|uiAdvanceCalendar|calendarNextLabel/.test(html);
    // Try uiNextDay if preseason leftover or in season
    let dayTry = null;
    try {
      const before = { day: S.day, trained: !!S.trained, fund: S.fund };
      if (S.preseason) {
        dayTry = { skipped: 'still preseason — transfer day' };
      } else {
        // only if not mid-series
        if (!S.series) {
          uiNextDay(S);
          dayTry = { before, after: { day: S.day, trained: !!S.trained, fund: S.fund }, changed: before.day !== S.day || before.fund !== S.fund || before.trained !== S.trained };
        } else dayTry = { skipped: 'mid-series' };
      }
    } catch (e) { dayTry = { err: e.message }; }
    return { hasDay, hasCal, dayTry };
  });
  if (advance.dayTry && advance.dayTry.err) bug(sc, 'P0', '推进一天抛错', advance.dayTry.err);
  if (advance.dayTry && advance.dayTry.skipped === undefined && advance.dayTry.changed === false) {
    bug(sc, 'P1', '推进一天后 day/fund/trained 均无变化', JSON.stringify(advance.dayTry));
  }

  return { results, union, hall, biz, board, advance };
}

async function coachEntryProbe(page, sc) {
  // Manager identity also needs 执教现役俱乐部 entry to work (self + club)
  await clearAndStart(page);
  await page.waitForTimeout(300);
  const probe = await page.evaluate(() => {
    const out = {};
    try {
      if (typeof initStart === 'function') initStart();
      try { switchStartTab('club'); } catch (e) { out.tabErr = e.message; }
      const cards = document.querySelectorAll('#tab-club-body .club-card, #tab-club-body [data-ci]');
      out.clubCards = cards.length;
      const applyBtn = document.getElementById('club-apply-btn');
      out.applyInitiallyDisabled = applyBtn ? !!applyBtn.disabled : 'missing';
      if (cards.length) {
        try { pickClub(0); } catch (e) { out.pickErr = e.message; }
      }
      out.afterPickDisabled = applyBtn ? !!applyBtn.disabled : 'missing';
      out.tip = (document.getElementById('club-pick-tip') || {}).textContent || '';
      // Apply club
      if (applyBtn && !applyBtn.disabled) {
        try { applyClub(); out.applied = { team: S.teamName, mode: S.mode, preseason: S.preseason, players: S.players.length, fund: S.fund }; }
        catch (e) { out.applyErr = e.message; }
      } else {
        out.applyBlocked = true;
      }
    } catch (e) { out.err = e.message; }
    return out;
  });
  if (probe.err || probe.tabErr) bug(sc, 'P0', '执教入口: 切换/初始化抛错', probe.err || probe.tabErr);
  if (!probe.clubCards) bug(sc, 'P0', '执教入口: 俱乐部卡片为 0', JSON.stringify(probe));
  if (probe.pickErr) bug(sc, 'P0', '执教入口: pickClub 抛错', probe.pickErr);
  if (probe.applyInitiallyDisabled === false && probe.clubCards) {
    bug(sc, 'P2', '执教入口: 未选俱乐部时按钮已可点', JSON.stringify(probe));
  }
  if (probe.afterPickDisabled === true) bug(sc, 'P0', '执教入口: pickClub 后开始按钮仍 disabled（点不亮）', JSON.stringify(probe));
  if (probe.applyErr) bug(sc, 'P0', '执教入口: applyClub 抛错', probe.applyErr);
  if (probe.applyBlocked && probe.afterPickDisabled === false) bug(sc, 'P0', '执教入口: 按钮看似可点但未 apply', JSON.stringify(probe));
  return probe;
}

async function main() {
  const consoleBuf = { errors: [] };
  const { browser, page } = await launch();
  page.on('dialog', async (d) => {
    try { await d.accept(); } catch (e) {}
  });
  page.on('pageerror', (e) => {
    const msg = '[pageerror] ' + e.message;
    consoleBuf.errors.push({ sc: consoleBuf._sc || '*', stage: 'runtime', msg });
    console.error('[pageerror]', e.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (/--- scenario/.test(text)) return;
      const m = '[console.error] ' + text;
      consoleBuf.errors.push({ sc: consoleBuf._sc || '*', stage: 'runtime', msg: m });
      console.error('[console.error]', text);
    }
  });

  const summary = {};
  // Coach/club entry once
  console.log('=== coach/club entry probe ===');
  summary.coachEntry = await coachEntryProbe(page, 'entry');

  for (const sc of SCENARIOS) {
    console.log('\n========== SCENARIO', sc, '==========');
    consoleBuf._sc = sc;
    consoleBuf.errors = consoleBuf.errors.filter(e => e.stage !== 'marker' || e.sc !== sc);
    try {
      const created = await bootScenario(page, sc, consoleBuf);
      if (!created) { summary[sc] = { boot: false }; continue; }
      await shot(page, `mgr_${sc}_boot`);
      await sweepPages(page, sc, 'after-boot', consoleBuf);

      const transfer = await transferPhase(page, sc, consoleBuf);
      await shot(page, `mgr_${sc}_market`);
      await sweepPages(page, sc, 'after-transfer', consoleBuf);

      const lineup = await lineupTrainPhase(page, sc);
      await shot(page, `mgr_${sc}_lineup`);

      const league = await leagueMatchPhase(page, sc, consoleBuf);
      await shot(page, `mgr_${sc}_league`);

      const sides = await sidePagesPhase(page, sc, consoleBuf);
      await shot(page, `mgr_${sc}_biz`);

      await sweepPages(page, sc, 'final', consoleBuf);
      summary[sc] = { created, transfer, lineup, league, sides };
    } catch (e) {
      bug(sc, 'P0', '剧本流程中断（脚本/页面致命错误）', e.message);
      console.error('[scenario-fatal]', sc, e);
      summary[sc] = { fatal: e.message };
    }
  }
  consoleBuf._sc = '*';

  // Cross-scenario: nextAction fn existence for all types
  const fnProbe = await page.evaluate(() => {
    const fns = ['uiEndPreseason','uiStartMatch','startPlayerMatch','startCard','startPlayoff','uiStartCup','uiFinishAnnual','uiAsiadStep','uiAdvanceCalendar','uiDoNextAction','endPreseason','autoPlayNext','bpAuto','buyPlayer','signFreeAgent','listPlayer','openRenewNego','openNegotiation','openSellNego','sendKjia','setTactic','upgradeSponsor','toggleSimpleMode','gotoEraStart','applyClub','applyCoachClub','createTeam','pickScenario','applyScenario','applyEraClub'];
    const missing = fns.filter(f => typeof window[f] !== 'function');
    // static scan of game.html-ish onclick strings is done in browser DOM; also check common uiDoNextAction misuse in source via rendered templates
    return { missing, total: fns.length };
  });
  if (fnProbe.missing.length) bug('*', 'P0', '全局关键函数缺失', fnProbe.missing.join(','));

  await browser.close();

  // Merge engine-probe findings if present
  try {
    const engPath = path.join('E:\\sex\\kpl-manager\\.bug-hunt', 'engine-probe.json');
    if (fs.existsSync(engPath)) {
      const eng = JSON.parse(fs.readFileSync(engPath, 'utf8'));
      (eng.bugs || []).forEach(b => {
        const title = b.title || b.t;
        const detail = b.detail != null ? b.detail : b.d;
        const sev = b.sev || 'P1';
        if (!bugs.some(x => x.title === title)) {
          bugs.push({ sc: 'engine', scenario: 'engine', sev, title, detail });
        }
      });
    }
  } catch (e) { console.warn('merge engine probe failed', e.message); }

  // Deduplicate bugs
  const seen = new Set();
  const uniq = bugs.filter(b => {
    const k = b.sc + '|' + b.sev + '|' + b.title + '|' + String(b.detail).slice(0, 80);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const p0 = uniq.filter(b => b.sev === 'P0');
  const p1 = uniq.filter(b => b.sev === 'P1');
  const p2 = uniq.filter(b => b.sev === 'P2');

  // Write markdown report
  const lines = [];
  lines.push('# Manager Mode Bug Hunt Report');
  lines.push('');
  lines.push(`- Date: ${new Date().toISOString()}`);
  lines.push(`- Identity: manager（另探测执教现役俱乐部入口一次）`);
  lines.push(`- Scenarios: ${SCENARIOS.join(' / ')}`);
  lines.push(`- Method: Playwright + game.html；page.evaluate 加速（pickScenario/createTeam/uiEndPreseason/autoPlayNext/startCard）；DOM 扫死链/脏文本/nextAction 不一致；engine harness 探针（tests/playthrough/manager-engine-probe.js）`);
  lines.push(`- Scripts: tests/playthrough/manager-bug-hunt.js, tests/playthrough/manager-engine-probe.js`);
  lines.push(`- Totals: **P0=${p0.length} · P1=${p1.length} · P2=${p2.length}**`);
  lines.push('');
  lines.push('> FAIL 判定：onclick 断链/抛错；toast 后 phase 卡住；nextAction 有值但无按钮；弹窗关不掉/确认无状态变化；console.error/pageerror；按钮文案裁切导致不知道点哪。');
  lines.push('');

  const order = ['engine', 'entry', ...SCENARIOS, '*'];
  const bySc = {};
  uniq.forEach(b => { (bySc[b.sc] = bySc[b.sc] || []).push(b); });

  order.forEach(sc => {
    const list = bySc[sc];
    if (!list || !list.length) return;
    lines.push(`## Scenario: ${sc}`);
    lines.push('');
    list.sort((a, b) => ({ P0: 0, P1: 1, P2: 2 }[a.sev] - { P0: 0, P1: 1, P2: 2 }[b.sev]));
    list.forEach(b => {
      lines.push(`### [${b.sev}] ${b.title}`);
      lines.push('');
      lines.push(`- **剧本/范围**: ${b.sc}`);
      lines.push(`- **优先级**: ${b.sev}`);
      lines.push(`- **复现/证据**: ${String(b.detail || '(see probe)').replace(/\n/g, ' ')}`);
      lines.push(`- **期望**: 入口按钮可点且状态推进；文案完整；无 pageerror；nextAction 与 UI 一致`);
      lines.push(`- **实际**: ${String(b.detail || '').slice(0, 400)}`);
      lines.push(`- **涉及**: 见证据中的函数/选择器`);
      lines.push('');
    });
  });

  // Also list scenarios that ran clean
  SCENARIOS.forEach(sc => {
    if (!bySc[sc] || !bySc[sc].length) {
      lines.push(`## Scenario: ${sc}`);
      lines.push('');
      lines.push('_本剧本扫描未记录到独立 bug（或共用 engine/跨剧本问题，见 P0 清单）。_');
      lines.push('');
    }
  });

  lines.push('---');
  lines.push('');
  lines.push('## P0 清单（汇总）');
  lines.push('');
  if (!p0.length) lines.push('_本轮未发现 P0。_');
  else p0.forEach((b, i) => lines.push(`${i + 1}. **[${b.sc}] ${b.title}**\n   - ${String(b.detail).slice(0, 220).replace(/\n/g, ' ')}`));
  lines.push('');
  lines.push('## 修复建议（仅报告，未改代码）');
  lines.push('');
  lines.push('1. **P0** `src/js/ui.js` `clubCardPanel` / `clubPlayoffPanel`：将 `uiDoNextAction(\'startCard\')` / `uiDoNextAction(\'startPlayoff\')` 改为 `uiDoNextAction(S)` 或直接 `startCard()` / `startPlayoff()`。');
  lines.push('2. **P0** `clubPhasePanel` 兜底条件 `html.indexOf(\'uiDoNextAction\')<0` 会被死按钮字符串误抑制——应改为检测 **可执行** 入口（例如 `html.indexOf(act.fn)` 或 `html.indexOf(\'uiDoNextAction(S)\')`）。');
  lines.push('3. **P1** `renderLeague` `pMatch`：对 `pf.lb4/pf.lbf/pf.wf/pf.final` 做 `m&&` 判空，避免残缺季后赛树导致联赛页崩溃。');
  lines.push('');
  lines.push('## 备注');
  lines.push('');
  lines.push('- **未修改** src/**、game.html、package.json；未 commit。');
  lines.push('- 脚本：`tests/playthrough/manager-bug-hunt.js`、`tests/playthrough/manager-engine-probe.js`');
  lines.push('- JSON：`.bug-hunt/manager-bug-hunt.json`、`.bug-hunt/engine-probe.json`');
  lines.push('- 部分探测在浏览器内临时伪造 phase（card/playoff）以验证按钮绑定与联赛页渲染，不依赖真实打完常规赛。');
  lines.push('');

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, lines.join('\n'), 'utf8');
  fs.writeFileSync(JSON_OUT, JSON.stringify({ bugs: uniq, fnProbe, p0: p0.length, p1: p1.length, p2: p2.length, summaryKeys: Object.keys(summary) }, null, 2), 'utf8');

  console.log('\n========== SUMMARY ==========');
  console.log('P0', p0.length, 'P1', p1.length, 'P2', p2.length);
  console.log('Report:', REPORT);
  p0.forEach(b => console.log('P0:', b.sc, b.title, String(b.detail).slice(0, 120)));
  if (p0.length) process.exitCode = 1;
}

main().catch(e => { console.error('[fatal]', e); process.exit(1); });

// 运行时全站扫雷：三种身份 × 所有页面 × 只读型弹窗/按钮
// 抓四类真问题：① 渲染脏文本（undefined/NaN/[object Object]/null/Infinity/单位重复）
//              ② onclick 断链（属性里的函数名在 window 上不存在）
//              ③ 重复 DOM id（$() 只命中第一个，会让状态写错节点）
//              ④ 页面级 console/pageerror
// Run: node tests/playthrough/sweep-all.js      （需先 python -m http.server 8931）
//      node tests/playthrough/sweep-all.js --save=saves/KPL存档_AG_2026年_槽1.json
//      （--save 用真实存档跑，只扫它自身身份；造档才扫三种身份）
const fs = require('fs');
const { launch, clearAndStart } = require('./pw.js');

const SAVE_ARG = (process.argv.find(a => a.startsWith('--save=')) || '').slice(7);

const PAGES = ['club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall', 'biz', 'career'];
// 只做 UI 动作（开面板/切页/排序），不碰引擎与存档写入
const UI_RE_SRC = '^(open|show|close|toggle|sort|goPage|render|set|view|pick|filter|expand|collapse|switch|tab|nav)[A-Za-z0-9_]*$';

const BOOT = (mode) => {
  // 测试侧组阵容（与 tests/harness.js 的 fillRoster 同源，浏览器里没有）
  const used = new Set();
  const fill = (st, band) => {
    POS_ORDER.forEach(pos => st.players.push(genPlayer(genFreeAgentDef(pos, band, used))));
    st.lineup = st.players.map(p => p.id);
    return st;
  };
  try {
    installEra(null);
    S = newState('扫雷队', '⚔️');
    S.mode = mode;
    fill(S, 'mid');
    for (let i = 0; i < 4; i++) S.players.push(genPlayer(genFreeAgentDef(POS_ORDER[i % 5], 'low', used)));
    if (S.players[6]) S.players[6].kjia = 20;      // 下放分支
    S.coach = { ...COACH_POOL.find(c => c.id === 'co12') };
    S.seedPower = 420; initGroups(S);
    S.preseason = true; S.transferWindow = 5;
    buildTransferMarket(S); refreshMarket(S);
    if (mode === 'player') { S.myPlayerId = S.players[0].id; }
    renderAll();
    return { ok: true, players: S.players.length, fund: S.fund };
  } catch (e) { return { ok: false, err: e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim() }; }
};

(async () => {
  const R = { errors: [], dirty: [], deadHandlers: [], dupIds: [], uiClickFail: [], pages: {} };
  const { browser, page } = await launch();
  page.on('pageerror', e => R.errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') R.errors.push('[console.error] ' + m.text()); });

  const MODES = SAVE_ARG ? ['存档自带身份'] : ['manager', 'player', 'coach'];
  let RAW = null;
  if (SAVE_ARG) {
    const o = JSON.parse(fs.readFileSync(SAVE_ARG, 'utf8'));
    RAW = JSON.stringify(o && o.kplSave && o.data ? o.data : o);
  }
  const BOOT_SAVE = (raw) => {
    try {
      localStorage.setItem('esport_manager_save_v3', raw);
      localStorage.setItem('esport_manager_curslot', '1');
      return { ok: true };
    } catch (e) { return { ok: false, err: e.message }; }
  };

  for (const mode of MODES) {
    await clearAndStart(page);
    let boot;
    if (RAW) {
      boot = await page.evaluate(BOOT_SAVE, RAW);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      boot = await page.evaluate(() => (typeof S === 'object' && S)
        ? { ok: true, mode: S.mode, season: S.season, phase: S.phase, players: (S.players || []).length, fund: S.fund }
        : { ok: false, err: '读真实存档后 S 仍为空' });
    } else {
      boot = await page.evaluate(BOOT, mode);
    }
    R.pages[mode] = { boot };
    if (!boot.ok) continue;

    for (const pg of PAGES) {
      const res = await page.evaluate(({ pg }) => {
        const out = { page: pg, dirty: [], dead: [], dup: [] };
        if (!(typeof S === 'object' && S)) { out.err = 'S 已被前一次点击清空'; return out; }
        try { goPage(pg); } catch (e) { out.err = e.message; return out; }
        const root = document.getElementById('app') || document.body;
        (root.innerText || '').split('\n').forEach(ln => {
          const t = ln.trim();
          if (t && /\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b|Infinity|万万|%%/.test(t)) out.dirty.push(t.slice(0, 110));
        });
        document.querySelectorAll('[onclick]').forEach(el => {
          const code = el.getAttribute('onclick') || '';
          [...code.matchAll(/(?:^|[;&]\s*)([A-Za-z_$][\w$]*)\s*\(/g)].forEach(m => {
            if (typeof window[m[1]] !== 'function') out.dead.push(m[1] + ' <- ' + code.slice(0, 70));
          });
        });
        const seen = {};
        document.querySelectorAll('[id]').forEach(el => { seen[el.id] = (seen[el.id] || 0) + 1; });
        Object.keys(seen).forEach(id => { if (seen[id] > 1) out.dup.push(id + '×' + seen[id]); });
        out.dirty = [...new Set(out.dirty)].slice(0, 8);
        out.dead = [...new Set(out.dead)].slice(0, 8);
        out.dup = [...new Set(out.dup)].slice(0, 12);
        return out;
      }, { pg });
      if (res.err) R.errors.push(`[${mode}/${pg}] goPage 抛错: ${res.err}`);
      res.dirty.forEach(d => R.dirty.push(`[${mode}/${pg}] ${d}`));
      res.dead.forEach(d => R.deadHandlers.push(`[${mode}/${pg}] ${d}`));
      res.dup.forEach(d => R.dupIds.push(`[${mode}/${pg}] ${d}`));

      // 只点「纯 UI」按钮/元素，点完立刻回到本页重渲染，避免状态漂移污染后页
      const clicked = await page.evaluate(({ pg, uiRe }) => {
        const log = [];
        const UI = new RegExp(uiRe);
        const cands = [...document.querySelectorAll('[onclick]')].filter(el => {
          const code = el.getAttribute('onclick') || '';
          const m = code.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);
          // setSlot(n) 切到空槽本就该回开局页（S 置空 + toast），不是 bug，跳过
          return m && UI.test(m[1]) && !/^\s*setSlot\s*\(/.test(code);
        }).slice(0, 25);
        for (const el of cands) {
          const code = el.getAttribute('onclick') || '';
          try {
            new Function(code).call(el);
            const m = document.querySelector('.modal-bg.on .modal');
            if (m) {
              const bad = (m.innerText || '').split('\n').map(s => s.trim())
                .filter(t => t && /\bundefined\b|\bNaN\b|\[object Object\]|Infinity|万万/.test(t)).slice(0, 3);
              if (bad.length) log.push({ code, dirty: bad });
              try { closeModal(); } catch (e) {}
            }
            if (!(typeof S === 'object' && S)) { log.push({ code, threw: '点击后 S 被置空' }); break; }
          } catch (e) { log.push({ code, threw: (e.message || String(e)).slice(0, 90) }); }
        }
        if (typeof S === 'object' && S) goPage(pg); // 复位（S 已空则交给下面的重建）
        return log;
      }, { pg, uiRe: UI_RE_SRC });
      clicked.forEach(c => R.uiClickFail.push(`[${mode}/${pg}] ${c.code} → ` + (c.threw ? 'throw ' + c.threw : 'dirty ' + c.dirty.join(' ⏐ '))));
      if (!RAW && clicked.some(c => /S 被置空/.test(c.threw || ''))) {
        const re = await page.evaluate(BOOT, mode);
        R.pages[mode]['reboot@' + pg] = re.ok ? 'ok' : re.err;
      }
    }
  }

  await browser.close();
  console.log(JSON.stringify(R, null, 1));
  console.log('=== 汇总 errors=' + R.errors.length + ' dirty=' + R.dirty.length + ' deadHandlers=' + R.deadHandlers.length
    + ' dupIds=' + R.dupIds.length + ' uiClickFail=' + R.uiClickFail.length + ' ===');
})();

// C. 运行时 playwright 探针：开局后遍历 goPage + modal，收集 pageerror/console.error/__errLog
// 运行: node .bug-hunt/playwright-runtime.js
// 需要本地静态服务 game.html（默认 http://127.0.0.1:8931）
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.KPL_PORT || 8931);
const BASE = `http://127.0.0.1:${PORT}`;

function tryRequirePlaywright() {
  const candidates = [
    'E:/sex/.workbuddy/tmp/node_modules/playwright-core',
    'playwright-core',
    'playwright',
  ];
  for (const c of candidates) {
    try { return require(c); } catch (_) {}
  }
  return null;
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = (req.url || '/').split('?')[0];
      if (url === '/') url = '/game.html';
      const file = path.join(ROOT, url.replace(/^\//, '').replace(/\//g, path.sep));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      const ext = path.extname(file).toLowerCase();
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', () => resolve(null)); // port busy → reuse
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

const PAGES = ['career', 'club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall', 'biz'];
const MODALS = [
  { name: 'saveMgmt', fn: 'openSaveMgmt' },
  { name: 'rules', fn: "typeof openRules==='function'?openRules():(typeof showRules==='function'?showRules():null)" },
  { name: 'prefs', fn: "typeof openPrefs==='function'?openPrefs():null" },
  { name: 'guide', fn: "typeof startTour==='function'?startTour():null" },
];

(async () => {
  const pw = tryRequirePlaywright();
  if (!pw) {
    const out = { ok: false, reason: 'playwright not available', errors: [], notes: ['skip'] };
    fs.writeFileSync(path.join(__dirname, 'playwright-runtime-result.json'), JSON.stringify(out, null, 2));
    console.log('SKIP playwright: module not found');
    process.exitCode = 0;
    return;
  }

  const server = await startStaticServer();
  const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();

  const errors = [];
  const consoleErrors = [];
  const pageErrors = [];
  const notes = [];
  const navErrors = [];
  const modalErrors = [];

  page.on('pageerror', (e) => {
    pageErrors.push(e.message);
    errors.push('[pageerror] ' + e.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      consoleErrors.push(t);
      errors.push('[console.error] ' + t);
    }
  });
  page.on('dialog', async (d) => {
    notes.push('[dialog] ' + d.type() + ' ' + String(d.message()).slice(0, 120));
    try { await d.accept(); } catch (_) {}
  });

  try {
    await page.goto(BASE + '/game.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);

    // 清档 + 开局
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const create = await page.evaluate(() => {
      const el = document.getElementById('new-team-name') || document.querySelector('input[placeholder*="队名"], input[type="text"]');
      if (el) el.value = '运行时探针';
      const fns = ['createTeam', 'createClub', 'startNewGame', 'newGame'].filter(n => typeof window[n] === 'function');
      if (!fns.length) return { ok: false, reason: 'no create fn', hasS: !!window.S };
      try {
        window[fns[0]]();
        return {
          ok: true, fn: fns[0],
          teamName: window.S && S.teamName,
          players: window.S && S.players && S.players.length,
          preseason: window.S && S.preseason,
          phase: window.S && S.phase,
        };
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e), fn: fns[0] };
      }
    });
    notes.push('create: ' + JSON.stringify(create));
    await page.waitForTimeout(600);

    // 遍历 goPage
    for (let pass = 1; pass <= 2; pass++) {
      for (const p of PAGES) {
        const r = await page.evaluate((name) => {
          try {
            if (typeof goPage !== 'function') return { ok: false, reason: 'no goPage' };
            goPage(name);
            // 读 __errLog 若有
            return { ok: true, page: name, errLog: window.__errLog || null };
          } catch (e) {
            return { ok: false, reason: String((e && e.message) || e), page: name };
          }
        }, p);
        if (!r.ok) navErrors.push(`pass${pass}/${p}: ${r.reason}`);
        if (r.errLog && (Array.isArray(r.errLog) ? r.errLog.length : true)) {
          notes.push(`__errLog@${p}: ` + JSON.stringify(r.errLog).slice(0, 300));
        }
        await page.waitForTimeout(60);
      }
    }
    await page.waitForTimeout(200);

    // 打开各 modal / 关键 UI 函数
    const uiProbes = [
      { name: 'renderAll', code: 'renderAll(); return {ok:true};' },
      { name: 'openSaveMgmt', code: "if(typeof openSaveMgmt==='function'){openSaveMgmt();return {ok:true};}return {ok:false,reason:'missing'};" },
      { name: 'closeModal', code: "if(typeof closeModal==='function'){closeModal('app-modal');return {ok:true};}return {ok:false};" },
      { name: 'renderClubPhase', code: "goPage('club'); return {ok:true, phase:S&&S.phase, preseason:S&&S.preseason};" },
      { name: 'nextAction', code: "if(typeof nextAction==='function'){const a=nextAction(S);return {ok:true,action:a};}return {ok:false};" },
      { name: 'uiDoNextAction', code: "if(typeof uiDoNextAction==='function'){try{uiDoNextAction(S);}catch(e){return {ok:false,reason:e.message};}return {ok:true};}return {ok:false};" },
      { name: 'goPage-market', code: "goPage('market'); return {ok:true};" },
      { name: 'goPage-lineup', code: "goPage('lineup'); return {ok:true};" },
      { name: 'goPage-league', code: "goPage('league'); return {ok:true};" },
      { name: 'save-load-roundtrip', code: "try{save();return {ok:true};}catch(e){return {ok:false,reason:e.message}};" },
    ];

    for (const up of uiProbes) {
      const r = await page.evaluate((code) => {
        try {
          // eslint-disable-next-line no-new-func
          return new Function(code)();
        } catch (e) {
          return { ok: false, reason: String(e && e.message || e) };
        }
      }, up.code);
      notes.push('ui:' + up.name + ' ' + JSON.stringify(r));
      if (r && r.ok === false && r.reason) modalErrors.push(up.name + ': ' + r.reason);
      await page.waitForTimeout(80);
    }

    // 点击 nav 按钮真实事件
    const clickNav = await page.evaluate(() => {
      const results = [];
      const btns = [...document.querySelectorAll('nav button[data-page]')];
      for (const b of btns) {
        try {
          b.click();
          results.push({ page: b.dataset.page, ok: true });
        } catch (e) {
          results.push({ page: b.dataset.page, ok: false, reason: e.message });
        }
      }
      return results;
    });
    notes.push('clickNav: ' + JSON.stringify(clickNav));
    clickNav.filter(x => !x.ok).forEach(x => navErrors.push('click/' + x.page + ': ' + x.reason));

    // 提取页面内动态生成的 onclick 并抽样 typeof
    const onclickCheck = await page.evaluate(() => {
      const htmls = [];
      document.querySelectorAll('section.page, #app-modal-body, #header, #nav').forEach(el => htmls.push(el.innerHTML || ''));
      const all = htmls.join('\n');
      const re = /on(?:click|change|input)\s*=\s*["']([A-Za-z_$][\w$]*)\s*\(/gi;
      const names = new Set();
      let m;
      while ((m = re.exec(all))) names.add(m[1]);
      const missing = [];
      const ok = [];
      names.forEach(n => {
        if (typeof window[n] === 'function') ok.push(n);
        else missing.push({ fn: n, type: typeof window[n] });
      });
      return { total: names.size, ok: ok.length, missing };
    });
    notes.push('onclickCheck: ' + JSON.stringify(onclickCheck));

    // __errLog final
    const errLogFinal = await page.evaluate(() => window.__errLog || null);
    if (errLogFinal) notes.push('__errLog final: ' + JSON.stringify(errLogFinal).slice(0, 500));

    const Ssnap = await page.evaluate(() => window.S ? {
      teamName: S.teamName, phase: S.phase, preseason: S.preseason,
      players: (S.players || []).length, day: S.day, season: S.season,
      _migErr: S._migErr || null,
    } : null);

    const report = {
      ok: create.ok && navErrors.length === 0 && pageErrors.length === 0,
      base: BASE,
      create,
      Ssnap,
      pageErrors,
      consoleErrors,
      navErrors,
      modalErrors,
      onclickRuntimeMissing: onclickCheck.missing,
      onclickRuntimeTotal: onclickCheck.total,
      notes,
      errorCount: errors.length,
    };
    const outPath = path.join(__dirname, 'playwright-runtime-result.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('=== playwright runtime ===');
    console.log('create:', JSON.stringify(create));
    console.log('S:', JSON.stringify(Ssnap));
    console.log('pageErrors:', pageErrors.length, pageErrors.slice(0, 8));
    console.log('consoleErrors:', consoleErrors.length, consoleErrors.slice(0, 8));
    console.log('navErrors:', navErrors);
    console.log('modalErrors:', modalErrors);
    console.log('runtime onclick missing:', JSON.stringify(onclickCheck.missing));
    console.log('Result:', outPath);
  } catch (e) {
    const out = { ok: false, reason: String(e && e.stack || e), errors, notes };
    fs.writeFileSync(path.join(__dirname, 'playwright-runtime-result.json'), JSON.stringify(out, null, 2));
    console.error('playwright probe failed:', e);
    process.exitCode = 4;
  } finally {
    try { await browser.close(); } catch (_) {}
    try { if (server) server.close(); } catch (_) {}
  }
})();

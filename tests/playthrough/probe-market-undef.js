// 定位：真实存档（第 2 季 · 赛季中）转会页出现 "undefined万" —— 到底哪个字段缺
// Run: node tests/playthrough/probe-market-undef.js
const fs = require('fs');
const { launch, clearAndStart } = require('./pw.js');

const SAVE = process.argv[2] || 'saves/KPL存档_AG_2026年_槽1.json';
const o = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
const RAW = JSON.stringify(o && o.kplSave && o.data ? o.data : o);

(async () => {
  const { browser, page } = await launch();
  await clearAndStart(page);
  await page.evaluate(({ raw }) => {
    localStorage.setItem('esport_manager_save_v3', raw);
    localStorage.setItem('esport_manager_curslot', '1');
  }, { raw: RAW });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const out = { season: S.season, phase: S.phase, preseason: !!S.preseason, hits: [], suspects: [] };
    goPage('market');
    const root = document.getElementById('app') || document.body;
    // 找出含 undefined万 的最内层节点
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const bad = [];
    while (walk.nextNode()) {
      const t = walk.currentNode.nodeValue || '';
      if (/undefined\s*万|NaN\s*万/.test(t)) {
        let el = walk.currentNode.parentElement, row = el;
        for (let i = 0; i < 6 && row && row.parentElement; i++) {
          if (row.classList && (row.classList.contains('pcard') || row.tagName === 'TR' || row.classList.contains('sponsor') || row.classList.contains('match'))) break;
          row = row.parentElement;
        }
        bad.push({ text: t.trim().slice(0, 40), cls: el.className, rowCls: row.className, rowTxt: (row.innerText || '').replace(/\s+/g, ' ').slice(0, 160) });
      }
    }
    out.hits = bad.slice(0, 6);
    // 逐字段体检：市场里所有对象的"万"字段是否齐
    const chk = (tag, arr, fields) => (arr || []).forEach((p, i) => {
      const miss = fields.filter(f => p[f] === undefined || p[f] === null || (typeof p[f] === 'number' && !isFinite(p[f])));
      if (miss.length) out.suspects.push({ tag, i, id: p.id, name: p.name, pos: p.pos, miss, wage: p.wage, ovr: p.ovr });
    });
    chk('transferList', S.transferList, ['signCost', 'wage', 'ovr']);
    chk('freeAgents', S.freeAgents, ['signCost', 'wage', 'ovr']);
    chk('players', S.players, ['wage', 'ovr', 'val']);
    chk('rookies(选秀池)', S.draft && S.draft.pool, ['signCost', 'wage', 'ovr']);
    out.counts = { transferList: (S.transferList || []).length, freeAgents: (S.freeAgents || []).length, players: (S.players || []).length };
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();

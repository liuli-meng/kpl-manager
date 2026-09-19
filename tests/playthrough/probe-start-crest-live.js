// 浏览器实测：开局页自建队 → 敲队名 / 点配色 → 队徽预览与高亮实时跟随（修复回归 + 出图）
// Run: node tests/playthrough/probe-start-crest-live.js
const { launch, clearAndStart, shot } = require('./pw.js');

(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 780 } });
  await clearAndStart(page);
  const r = await page.evaluate(() => {
    const out = {};
    const body = document.querySelector('#tab-self-body');
    const prev = () => body.querySelector('.cr-preview').innerHTML;
    const onIdx = root => [...root.querySelectorAll('.cr-sw')].findIndex(b => b.classList.contains('on'));
    const nameInput = body.querySelector('#new-team-name');
    out.beforeLen = prev().length;
    nameInput.value = '星河';
    nameInput.dispatchEvent(new Event('input'));
    out.afterTypeName = prev().includes('星河');
    out.shapeBefore = [...body.querySelectorAll('.cr-shape')].findIndex(b => b.classList.contains('primary'));
    [...body.querySelectorAll('.cr-shape')][2].click();
    out.shapeAfter = [...body.querySelectorAll('.cr-shape')].findIndex(b => b.classList.contains('primary'));
    [...body.querySelectorAll('.cr-sw')][5].click();
    out.swatchAfter = onIdx(body);
    return out;
  });
  await shot(page, 'start-crest-live');
  console.log(JSON.stringify(r, null, 1));
  const fails = [];
  if (!r.afterTypeName) fails.push('敲队名后预览未更新');
  if (r.shapeAfter < 0 || r.shapeAfter === r.shapeBefore && r.shapeBefore === 2) fails.push('切外形无反应');
  if (r.swatchAfter !== 5) fails.push('点配色无反应，实际高亮 ' + r.swatchAfter);
  console.log(fails.length ? '[FAIL] ' + fails.join(' ; ') : '[PASS] 开局页队徽编辑器实时反馈正常');
  await browser.close();
  if (fails.length) process.exitCode = 1;
})();

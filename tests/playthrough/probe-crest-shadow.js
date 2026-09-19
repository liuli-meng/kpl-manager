// 回归：队徽编辑器「可见实例」定位 —— 开过一次「自定义队徽」弹窗后，弹窗里的旧副本仍留在
// DOM（closeModal 不清 innerHTML）且文档顺序更靠前。修复前 refreshCrUI() 用
// document.getElementById('cr-builder'/'cr-preview')，全部打到那份隐藏副本上，表现为
// 「开局页敲队名/点配色毫无反应，但选择其实已静默生效」。
// Run: node tests/playthrough/probe-crest-shadow.js   （需先 python -m http.server 8931）
const { launch, clearAndStart } = require('./pw.js');

(async () => {
  const { browser, page } = await launch();
  await clearAndStart(page);
  await page.evaluate(() => {
    installEra(null);
    S = newState('扫雷队', '⚔️');
    S.coach = { ...COACH_POOL.find(c => c.id === 'co12') };
    renderAll();
    openCrestEdit();          // 玩家改过一次队徽
    closeModal('app-modal');  // 关闭：旧副本留在 DOM 里
    S = null; initStart();    // 回到开局页（换槽/重开走的就是这条路）
  });
  const r = await page.evaluate(() => {
    const out = { dup: document.querySelectorAll('.cr-builder').length };
    const startBody = document.querySelector('#tab-self-body');
    const modalBody = document.querySelector('#app-modal');
    const onIdx = root => [...root.querySelectorAll('.cr-sw')].findIndex(b => b.classList.contains('on'));
    out.modalOnBefore = onIdx(modalBody); // 弹窗副本按它自己渲染时的 _crSw 高亮（可能是官方配色下标）
    // ① 开局页敲队名 → 只有开局页那份预览该变
    const nameInput = startBody.querySelector('#new-team-name');
    nameInput.value = '星河战队';
    refreshCrUI();
    out.startPreviewUpdated = startBody.querySelector('.cr-preview').innerHTML.includes('星河');
    out.modalPreviewUntouched = !modalBody.querySelector('.cr-preview').innerHTML.includes('星河');
    // ② 开局页点第 5 个配色 → 高亮该落在可见的那份上，隐藏副本保持自己那份不动
    [...startBody.querySelectorAll('.cr-sw')][4].click();
    out.startSwatchOnIdx = onIdx(startBody);
    out.modalSwatchOnIdx = onIdx(modalBody);
    // ③ 反向：进游戏后再开弹窗（弹窗可见、开局页隐藏）→ 该更新弹窗那份
    S = newState('星河战队', '⚔️'); renderAll();
    try { closeModal('start-modal'); } catch (e) {}
    openCrestEdit();
    const mSw = [...modalBody.querySelectorAll('.cr-sw')];
    const target = (onIdx(modalBody) + 3) % mSw.length;
    mSw[target].click();
    out.modalWant = target;
    out.modalSwatchOnIdx2 = onIdx(modalBody);
    out.startSwatchOnIdx2 = onIdx(startBody);
    closeModal('app-modal');
    return out;
  });
  await browser.close();

  const fails = [];
  if (r.dup < 2) fails.push('两份编辑器实例未同时存在（场景没搭起来），dup=' + r.dup);
  if (!r.startPreviewUpdated) fails.push('开局页敲队名后，可见的队徽预览没更新');
  if (!r.modalPreviewUntouched) fails.push('隐藏弹窗副本被误更新（作用域又跑出去了）');
  if (r.startSwatchOnIdx !== 4) fails.push('配色高亮没落在可见实例上，start=' + r.startSwatchOnIdx);
  if (r.modalSwatchOnIdx !== r.modalOnBefore) fails.push('隐藏副本配色被误高亮，modal=' + r.modalSwatchOnIdx + ' 应为 ' + r.modalOnBefore);
  if (r.modalSwatchOnIdx2 !== r.modalWant) fails.push('弹窗内点配色没反应，modal=' + r.modalSwatchOnIdx2 + ' 应为 ' + r.modalWant);
  if (r.startSwatchOnIdx2 === r.modalWant) fails.push('弹窗可见时开局页副本被误更新');
  console.log(JSON.stringify(r, null, 1));
  if (fails.length) { fails.forEach(f => console.log('[FAIL] ' + f)); process.exitCode = 1; }
  else console.log('[PASS] 队徽编辑器始终作用于可见实例');
})();

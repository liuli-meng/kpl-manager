// 复现：队徽编辑弹窗与开局页共用 id → refreshCrUI 打到隐藏的那份，弹窗里点配色/外形无反馈
// Run: node tests/playthrough/probe-crest-dupid.js
const { launch, clearAndStart } = require('./pw.js');

(async () => {
  const { browser, page } = await launch();
  await clearAndStart(page);
  await page.evaluate(() => {
    installEra(null);
    S = newState('扫雷队', '⚔️');
    S.coach = { ...COACH_POOL.find(c => c.id === 'co12') };
    renderAll();
  });
  const r = await page.evaluate(() => {
    const out = {};
    openCrestEdit();
    out.modalOn = !!document.querySelector('#app-modal.on');
    out.builderCount = document.querySelectorAll('.cr-builder').length;
    out.swatchCount = document.querySelectorAll('.cr-builder .cr-sw').length;
    // 弹窗里第 3 个配色按钮
    const modalSw = document.querySelectorAll('#app-modal .cr-builder .cr-sw')[2];
    out.beforeModal = (document.querySelector('#app-modal .cr-builder .cr-preview') || { innerHTML: '(弹窗内没有预览节点)' }).innerHTML.length;
    out.beforeGlobal = document.getElementById('cr-preview') ? document.getElementById('cr-preview').innerHTML.length : -1;
    out.firstIsInStartScreen = document.getElementById('cr-builder').closest('#app-modal') === null;
    modalSw.click();
    out.afterModal = (document.querySelector('#app-modal .cr-builder .cr-preview') || { innerHTML: '' }).innerHTML.length;
    out.afterGlobal = document.getElementById('cr-preview') ? document.getElementById('cr-preview').innerHTML.length : -1;
    out.modalSwatchOn = [...document.querySelectorAll('#app-modal .cr-builder .cr-sw')].map(b => b.classList.contains('on'));
    out.savedCrSw = typeof _crSw !== 'undefined' ? _crSw : '(无)';
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();

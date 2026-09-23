/* iOS / 微信抖音等 WKWebView 内置浏览器的导出兜底门禁。
 背景（真事故，2026-09-22）：a[download] + blob: 在 WKWebView 里不被支持（WebKit bug 216918），
 点击后 WebKit 会退化成「打开这个 blob 链接」→ 整页被替换成
 「Safari浏览器打不开该网页。错误是：未能完成操作。（WebKitBlobResource错误1。）」，
 且地址栏停在已失效的 blob: 上，**刷新也回不到游戏**——用户表现为「苹果浏览器打不开」。
 也正因为地址栏停住了，用户下次按刷新仍在刷那个死 blob，故障看起来是永久性的。

 本用例锁两件事：
 ① UA 判定：微信/抖音/裸 WKWebView = 不可用；Safari 本体（iOS/macOS）与桌面 = 可用
 ② 行为：判定不可用时，fallbackDownload **绝不创建 <a>**；判定可用时必须创建（反向验证，
    否则这条门禁可能永远通过） */
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');

const T = makeTester('iOS内置浏览器导出兜底');
const { dom } = makeDom();

const UA = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  safariIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  wechatIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003128) NetType/WIFI Language/zh_CN',
  douyinIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Douyin/27.5.0',
  qqIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/8.9.90 MQQBrowser/6.2',
  wkwebviewBare: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};
function setUA(key) {
  const isIOS = /iPhone|iPad/.test(UA[key]);
  dom.navigator = { userAgent: UA[key], platform: isIOS ? 'iPhone' : 'Win32', maxTouchPoints: isIOS ? 5 : 0 };
}
const blocked = () => vm.runInContext('blobDLBlocked()', dom);

T.check(typeof vm.runInContext('blobDLBlocked', dom) === 'function', 'state.js 应导出 blobDLBlocked()');
setUA('desktop'); T.check(blocked() === false, '桌面 Chrome 不该判为不可用');
setUA('safariMac'); T.check(blocked() === false, 'macOS Safari 不该判为不可用');
setUA('safariIOS'); T.check(blocked() === false, 'iOS Safari 本体不该判为不可用（它支持 blob 下载）');
setUA('wechatIOS'); T.check(blocked() === true, '微信 iOS 必须判为不可用');
setUA('douyinIOS'); T.check(blocked() === true, '抖音 iOS 必须判为不可用');
setUA('qqIOS'); T.check(blocked() === true, '手机 QQ 必须判为不可用');
setUA('wkwebviewBare'); T.check(blocked() === true, '裸 WKWebView（无 Version/ 无 app 标记）必须判为不可用');

/* ---- 行为断言：桩掉 createElement 与 URL，只数「下载锚点 <a>」被建了几次 ---- */
/* 只数 tag==='a'：_shareWrap 自己也要 createElement('canvas')，数总数会把画布算进来。
   沙箱里没有 URL —— 不桩它的话 createObjectURL 抛 ReferenceError，反向验证永远测不到锚点。 */
dom.URL = { createObjectURL: () => 'blob:mock-object-url', revokeObjectURL: () => {} };
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return () => ({ width: 8 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
  },
  set: () => true,
});
let aCreated = 0;
dom.document.createElement = function (tag) {
  if (tag === 'a') aCreated++;
  return {
    classList: { add() {}, remove() {} }, style: {}, dataset: {}, disabled: false,
    innerHTML: '', value: '', textContent: '', width: 0, height: 0,
    getContext: () => ctxStub, toBlob: cb => cb(null), toDataURL: () => 'data:image/png;base64,AAAA',
    click() {}, remove() {}, setAttribute() {}, appendChild() {}, addEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
  };
};
dom.document.body.appendChild = function () {};
const modalBody = dom.document.getElementById('app-modal-body');
const modalBg = dom.document.getElementById('app-modal');
let modalOn = 0;
modalBg.classList = { add() { modalOn++; }, remove() {} };

/* ① 存档导出：判定不可用时立刻走 onFail，且一个 <a> 都不许建 */
setUA('wechatIOS'); aCreated = 0; modalOn = 0; dom.__fail = false;
vm.runInContext("fallbackDownload({size:1},'x.json',function(){__fail=true})", dom);
T.check(dom.__fail === true, '内置浏览器下 fallbackDownload 应立刻回调 onFail');
T.check(aCreated === 0, '内置浏览器下 fallbackDownload 不得创建下载锚点 <a>（正是它把整页害成报错页）');

/* ② 反向验证：桌面 UA 必须照旧建锚点，否则门禁可能永远通过 */
setUA('desktop'); aCreated = 0; dom.__fail = false;
vm.runInContext("fallbackDownload({size:1},'x.json',function(){__fail=true})", dom);
T.check(aCreated >= 1, '桌面浏览器下 fallbackDownload 仍应尝试创建下载锚点 <a>（反向验证）');

/* ③ 分享图：内置浏览器改页内 <img data:> + 长按保存，不再走下载 */
setUA('wechatIOS'); aCreated = 0; modalOn = 0; modalBody.innerHTML = '';
vm.runInContext('_shareWrap(function(){})', dom);
T.check(/<img src="data:image\/png/.test(modalBody.innerHTML), '内置浏览器：分享图应改为页内 <img data:URL> 展示');
T.check(/长按/.test(modalBody.innerHTML), '内置浏览器：应给出「长按保存」提示');
T.check(modalOn >= 1, '内置浏览器：应弹出分享图弹窗');
T.check(aCreated === 0, '内置浏览器：分享图不得创建下载锚点 <a>');

/* ④ 反向验证：桌面 UA 仍走下载锚点，不弹页内弹窗 */
setUA('desktop'); aCreated = 0; modalOn = 0;
vm.runInContext('_shareWrap(function(){})', dom);
T.check(aCreated >= 1, '桌面浏览器：分享图仍应走下载锚点（反向验证）');
T.check(modalOn === 0, '桌面浏览器：不该弹页内分享图弹窗');

T.report();

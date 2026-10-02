// BGM 系统门禁：开关/音量/情境钩子/无 AudioContext 降级/设置面板
// + AudioContext 桩：钉死「关→开竞态」「和弦计时器」「振荡器数量」
// 运行：node tests/verify-bgm.js
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');
const T = makeTester('BGM');
const { dom } = makeDom();

// harness 把 setTimeout 桩成空函数——竞态用例需要可控假计时
const timers = [];
dom.setTimeout = (fn, ms) => {
  const id = timers.length + 1;
  timers.push({ id, fn, ms, at: Date.now() + (ms || 0) });
  return id;
};
dom.clearTimeout = (id) => {
  const i = timers.findIndex((t) => t.id === id);
  if (i >= 0) timers.splice(i, 1);
};
function flushTimers() {
  const list = timers.splice(0, timers.length);
  list.forEach((t) => {
    try { t.fn(); } catch (e) { /* ignore */ }
  });
  return list.length;
}

const out = vm.runInContext(`
(function(){
  const R=[];
  let checks=0;
  const ok=(c,m)=>{checks++;if(!c)R.push(m);};

  // ① 变量初始化
  ok(_bgmVolume>=0&&_bgmVolume<=1,'_bgmVolume 未初始化: '+_bgmVolume);
  ok(typeof playBGM==='function'&&typeof toggleBGM==='function'&&typeof setBgmVolume==='function','API 缺失');
  ok(typeof bgmOnMoment==='function'&&typeof detectAndPlayBGM==='function','钩子缺失');
  ok(typeof bgmSettingsPanelHtml==='function','设置面板 HTML 缺失');

  // ② 无 AudioContext：不抛错
  const oldAC=window.AudioContext;window.AudioContext=undefined;window.webkitAudioContext=undefined;
  let e1=null,e2=null;
  try{playBGM('idle');playBGM('win');}catch(e){e1=e.message;}
  try{toggleBGM();toggleBGM();}catch(e){e2=e.message;}
  window.AudioContext=oldAC;
  ok(!e1,'无 AudioContext playBGM 抛错: '+e1);
  ok(!e2,'toggleBGM 抛错: '+e2);

  // ③ setBgmVolume 边界
  setBgmVolume(150);ok(_bgmVolume===1,'volume>100 未封顶: '+_bgmVolume);
  setBgmVolume(-10);ok(_bgmVolume===0,'volume<0 未封底: '+_bgmVolume);
  setBgmVolume(35);ok(Math.abs(_bgmVolume-0.35)<1e-9,'volume=35 未生效: '+_bgmVolume);

  // ④ bgmOnMoment 分流（关着安静 / 开着不抛）
  _bgmOn=false;bgmOnMoment('title');
  _bgmOn=true;
  let e3=null;
  try{bgmOnMoment('title');bgmOnMoment('win');bgmOnMoment('lose');bgmOnMoment('peak');}catch(e){e3=e.message;}
  ok(!e3,'bgmOnMoment 抛错: '+e3);

  // ⑤ 设置面板
  const html=bgmSettingsPanelHtml();
  ok(html.indexOf('toggleBGM')>=0,'面板无 BGM 开关');
  ok(html.indexOf('setBgmVolume')>=0,'面板无音量滑杆');
  ok(html.indexOf('toggleSfx')>=0,'面板无 SFX 开关');

  // ===== AudioContext 桩 =====
  const calls={osc:0};
  class FakeGain{
    constructor(){this.gain={
      value:0,
      setValueAtTime(v){this.value=v;},
      linearRampToValueAtTime(v){this.value=v;},
      exponentialRampToValueAtTime(v){this.value=v;},
      setTargetAtTime(v){this.value=v;},
      cancelScheduledValues(){},
    };}
    connect(){return this;}
  }
  class FakeOsc{
    constructor(){this.type='sine';this.frequency={value:0};calls.osc++;}
    connect(){return this;}
    start(){}
    stop(){}
  }
  class FakeAC{
    constructor(){this.state='running';this.currentTime=0;this.destination={};}
    resume(){}
    createOscillator(){return new FakeOsc();}
    createGain(){return new FakeGain();}
  }
  window.AudioContext=FakeAC;window.webkitAudioContext=FakeAC;
  _bgmAc=null;_bgmNode=null;_bgmTimer=[];_bgmOn=true;

  // ⑥ 开 pad → 4 振荡器
  playIdlePad();
  ok(_bgmNode&&_bgmNode.oscs&&_bgmNode.oscs.length===4,'开 pad 振荡器数='+(_bgmNode&&_bgmNode.oscs&&_bgmNode.oscs.length)+' 应为 4');

  // ⑦ 重复 playIdlePad 不叠层
  const pad1=calls.osc;
  playIdlePad();
  ok(calls.osc-pad1===0,'重复 playIdlePad 不应再建振荡器，实际 +'+(calls.osc-pad1));

  // ⑧ 关→立刻开（竞态核心）
  stopBGM(280); // 排队清理
  playIdlePad(); // 窗口内重开
  ok(_bgmNode&&_bgmNode.oscs&&_bgmNode.oscs.length===4,'关→开后应有 4 振荡器，实际 '+(_bgmNode&&_bgmNode.oscs&&_bgmNode.oscs.length));
  const nodeAfterReopen=_bgmNode;

  // ⑨ win：多 timer 句柄 + ≥6 振荡器
  const beforeWin=calls.osc;
  playChordBGM('win');
  ok(_bgmTimer.length>=2,'win 应登记 ≥2 个计时器句柄，实际 '+_bgmTimer.length);

  // 导出给 Node 侧 flush：把「清理回调」真正跑一遍
  this.__bgmProbe={
    R:R,ok:ok,calls:calls,checks:()=>checks,
    nodeAfterReopen:nodeAfterReopen,
    beforeWin:beforeWin,
    timersLen:()=>_bgmTimer.length,
    node:()=>_bgmNode,
    stopBGM:stopBGM,
  };
  return R;
})()
`, dom);

const probe = dom.__bgmProbe;
// 跑掉 stopBGM 的清理回调 + win 和弦延迟（假计时一次性 flush）
const flushed = flushTimers();

if (probe) {
  probe.ok(probe.node() === probe.nodeAfterReopen, '清理回调不得换掉当前节点');
  probe.ok(
    probe.node() && probe.node().oscs && probe.node().oscs.length === 4,
    '清理后仍应有 4 振荡器（UI 开+有声），实际 ' +
      (probe.node() && probe.node().oscs && probe.node().oscs.length)
  );
  probe.ok(probe.calls.osc - probe.beforeWin >= 6, 'win 和弦振荡器 ' + (probe.calls.osc - probe.beforeWin) + ' 应 ≥6');
  probe.stopBGM(50);
  flushTimers();
  probe.ok(probe.timersLen() === 0, 'stopBGM 应清空全部 chord 计时器，实际 ' + probe.timersLen());
}

// 再扫一遍 R（probe.ok 已写入同一个数组）
const list = (probe && probe.R) || out || [];
const totalChecks = probe ? probe.checks() : 20;
for (let i = 0; i < totalChecks - list.length; i++) T.ok();
list.forEach((m) => T.fail(m));
T.report();

// BGM 系统门禁：开关/音量/情境钩子/无 AudioContext 降级/设置面板
// 运行：node tests/verify-bgm.js
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');
const T = makeTester('BGM');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const R=[];
  const ok=(c,m)=>{if(!c)R.push(m);};

  // ① 变量初始化：默认关、音量有限、不抛错
  ok(_bgmVolume>=0&&_bgmVolume<=1,'_bgmVolume 未初始化: '+_bgmVolume);
  ok(typeof playBGM==='function'&&typeof toggleBGM==='function'&&typeof setBgmVolume==='function','API 缺失');
  ok(typeof bgmOnMoment==='function'&&typeof detectAndPlayBGM==='function','钩子缺失');
  ok(typeof bgmSettingsPanelHtml==='function','设置面板 HTML 缺失');

  // ② 无 AudioContext / 默认关：调用不抛错
  const oldAC=window.AudioContext;window.AudioContext=undefined;
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

  // ④ bgmOnMoment 分流
  _bgmOn=false;
  bgmOnMoment('title'); // 关着时应安静
  _bgmOn=true;
  let e3=null;
  try{bgmOnMoment('title');bgmOnMoment('win');bgmOnMoment('lose');bgmOnMoment('peak');}catch(e){e3=e.message;}
  ok(!e3,'bgmOnMoment 抛错: '+e3);

  // ⑤ 设置面板含开关与滑杆
  const html=bgmSettingsPanelHtml();
  ok(html.indexOf('toggleBGM')>=0,'面板无 BGM 开关');
  ok(html.indexOf('setBgmVolume')>=0,'面板无音量滑杆');
  ok(html.indexOf('toggleSfx')>=0,'面板无 SFX 开关');

  // ⑥ playChordBGM / playIdlePad 不炸（有 AudioContext 桩时）
  try{
    if(typeof playIdlePad==='function')playIdlePad();
    if(typeof playChordBGM==='function')playChordBGM('win');
  }catch(e){R.push('pad/chord 抛错: '+e.message);}

  return R;
})()
`, dom);

out.forEach(m => T.check(false, m));
T.report();

/* ================= 背景音乐（BGM）系统（程序化合成，无资源文件；默认关闭）==================
 目标（P2「从有音效到有表演」）：极轻循环 pad + 胜/负/夺冠三段和弦。
 约束：零外部素材、默认音量低、无 AudioContext 时静默降级；开关独立于 SFX，互不拖累。 */
let _bgmOn=false,_bgmNode=null,_bgmVolume=0.35,_bgmAc=null,_bgmTimer=null;
try{
 _bgmOn=localStorage.getItem('km_bgm')==='1';
 const v=parseFloat(localStorage.getItem('km_bgm_vol'));
 if(isFinite(v))_bgmVolume=Math.max(0,Math.min(1,v/100));
}catch(_){}

const BGM={
 // idle：C 大调分解 pad，持续极低音量，营造“思考/管理”
 idle:{freqs:[261.63,329.63,392.00,392.00*1.003],type:'sine',vol:0.006},
 // win：大三和弦上行（C-E-G → E-G-B）
 win:{chords:[[523.25,659.25,783.99],[659.25,783.99,987.77]],delays:[0,160],vol:0.035},
 // lose：小调下行，低沉但不绝望
 lose:{chords:[[261.63,311.13,392.00],[246.94,293.66,369.99]],delays:[0,140],vol:0.03},
 // title：夺冠/王朝明亮琶音
 title:{chords:[[523.25,659.25,783.99],[659.25,783.99,987.77],[783.99,987.77,1174.66],[1046.50,1318.51,1567.98]],delays:[0,120,240,380],vol:0.04}
};

function _bgmEnsureAc(){
 try{
  if(!_bgmAc)_bgmAc=new (window.AudioContext||window.webkitAudioContext)();
  if(_bgmAc.state==='suspended')_bgmAc.resume();
  return _bgmAc;
 }catch(_){return null;}
}
function _bgmOk(){return !!( _bgmOn && (window.AudioContext||window.webkitAudioContext));}

/* 停掉当前 pad（含淡出） */
function stopBGM(fadeMs){
 if(_bgmTimer){clearTimeout(_bgmTimer);_bgmTimer=null;}
 if(!_bgmNode)return;
 try{
  const t=fadeMs==null?280:fadeMs;
  if(_bgmNode.oscs&&_bgmNode.oscs.length)fadeControl(false,t);
  else if(_bgmNode.stop)try{_bgmNode.stop();}catch(_){}
  setTimeout(()=>{
   if(_bgmNode&&_bgmNode.oscs){
    _bgmNode.oscs.forEach(x=>{try{x.o.stop();}catch(_){}});
    _bgmNode.oscs=[];
   }
   if(_bgmNode&&_bgmNode.mode==='idle')_bgmNode=null;
  },t+40);
 }catch(_){_bgmNode=null;}
}

/* 持续 pad：振荡器常驻，音量 _bgmVolume 实时可调 */
function playIdlePad(){
 if(!_bgmOk())return;
 const ac=_bgmEnsureAc();if(!ac)return;
 if(_bgmNode&&_bgmNode.mode==='idle'&&_bgmNode.oscs&&_bgmNode.oscs.length)return;
 if(_bgmNode&&_bgmNode.mode!=='idle')stopBGM(120);
 try{
  const now=ac.currentTime,oscs=[];
  BGM.idle.freqs.forEach(f=>{
   const o=ac.createOscillator(),g=ac.createGain();
   o.type=BGM.idle.type;o.frequency.value=f;
   const target=Math.max(0.0002,BGM.idle.vol*_bgmVolume);
   g.gain.setValueAtTime(0,now);
   g.gain.linearRampToValueAtTime(target,now+1.1);
   o.connect(g);g.connect(ac.destination);
   o.start(now);
   oscs.push({o,g,baseVol:BGM.idle.vol});
  });
  _bgmNode={ac,mode:'idle',oscs};
 }catch(e){try{console.warn('BGM idle fail',e&&e.message);}catch(_){}}
}

/* 情境和弦：win / lose / title */
function playChordBGM(mode){
 if(!_bgmOk())return;
 const ac=_bgmEnsureAc();if(!ac)return;
 const cfg=BGM[mode];if(!cfg)return;
 try{
  // 和弦叠在 pad 上，不打断 idle
  cfg.chords.forEach((chord,i)=>{
   const delay=cfg.delays[i]||0;
   _bgmTimer=setTimeout(()=>{
    if(!_bgmOn)return;
    const t0=ac.currentTime;
    chord.forEach((f,j)=>{
     const o=ac.createOscillator(),g=ac.createGain();
     o.type='triangle';o.frequency.value=f;
     const peak=Math.max(0.0003,(cfg.vol||0.03)*_bgmVolume);
     const at=t0+j*0.02;
     g.gain.setValueAtTime(0.0001,at);
     g.gain.exponentialRampToValueAtTime(peak,at+0.03);
     g.gain.exponentialRampToValueAtTime(0.0001,at+0.55);
     o.connect(g);g.connect(ac.destination);
     o.start(at);o.stop(at+0.6);
    });
   },delay);
  });
 }catch(e){try{console.warn('BGM chord fail',e&&e.message);}catch(_){}}
}

/**
 * 播放情境音。idle=循环 pad；win/lose/title=短和弦（可叠在 pad 上）
 */
function playBGM(mode){
 if(!_bgmOk())return;
 if(mode==='idle'){playIdlePad();return;}
 if(mode==='win'||mode==='lose'||mode==='title')playChordBGM(mode);
}

function toggleBGM(){
 _bgmOn=!_bgmOn;
 try{localStorage.setItem('km_bgm',_bgmOn?'1':'0');}catch(_){}
 if(_bgmOn){playIdlePad();toast(' BGM 已开启');}
 else{stopBGM();toast(' BGM 已关闭');}
 try{if(S)renderHeader();}catch(_){}
}

function setBgmVolume(percent){
 const p=Math.max(0,Math.min(100,Number(percent)||0));
 _bgmVolume=p/100;
 try{localStorage.setItem('km_bgm_vol',String(p));}catch(_){}
 // 已在播的 pad 平滑跟手（滑杆拖动不 toast，免得刷屏）
 if(_bgmNode&&_bgmNode.oscs&&_bgmNode.ac){
  const now=_bgmNode.ac.currentTime;
  _bgmNode.oscs.forEach(osc=>{
   try{osc.g.gain.setTargetAtTime(Math.max(0.0002,osc.baseVol*_bgmVolume),now,0.08);}catch(_){}
  });
 }
 try{const el=document.getElementById('bgm-vol-display');if(el)el.textContent=p+'%';}catch(_){}
}

/* 淡入淡出（供停 pad / 换景用） */
function fadeControl(fadeIn,duration){
 if(!_bgmNode||!_bgmNode.ac||!_bgmNode.oscs||!_bgmNode.oscs.length)return;
 const dur=duration||500,now=_bgmNode.ac.currentTime;
 _bgmNode.oscs.forEach(osc=>{
  try{
   const cur=osc.g.gain.value;
   osc.g.gain.cancelScheduledValues(now);
   osc.g.gain.setValueAtTime(cur,now);
   const target=fadeIn?Math.max(0.0002,osc.baseVol*_bgmVolume):0.0001;
   osc.g.gain.exponentialRampToValueAtTime(target,now+dur/1000);
  }catch(_){}
 });
}

/* 情景感知：日常 pad + 赛果和弦 */
function detectAndPlayBGM(){
 if(!_bgmOk())return;
 try{
  const cur=document.querySelector('.page.on');
  const id=cur&&cur.id?cur.id.replace('page-',''):'';
  if(id==='club'||id==='biz'||id==='hall'||id==='career'||id==='league')playIdlePad();
 }catch(_){playIdlePad();}
}

/* 演出钩子：夺冠/胜负叠和弦（SFX 照旧，BGM 独立开关） */
function bgmOnMoment(sfxKey){
 if(!_bgmOn)return;
 try{
  if(sfxKey==='title'||sfxKey==='fmvp'||sfxKey==='dynasty')playBGM('title');
  else if(sfxKey==='win'||sfxKey==='gold')playBGM('win');
  else if(sfxKey==='lose')playBGM('lose');
  else if(sfxKey==='comeback'||sfxKey==='peak')playBGM('win');
 }catch(_){}
}

// 首次用户手势后才能起 AudioContext（浏览器自动播放策略）
function _bgmUnlock(){
 if(_bgmOn)playIdlePad();
 document.removeEventListener('pointerdown',_bgmUnlock);
 document.removeEventListener('keydown',_bgmUnlock);
}
document.addEventListener('pointerdown',_bgmUnlock);
document.addEventListener('keydown',_bgmUnlock);
try{
 if(document.readyState==='complete')setTimeout(detectAndPlayBGM,600);
 else document.addEventListener('DOMContentLoaded',()=>setTimeout(detectAndPlayBGM,600));
}catch(_){}

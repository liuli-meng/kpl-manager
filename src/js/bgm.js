/* ================= 背景音乐（BGM）系统（程序化合成，无资源文件；默认关闭）================== */
// 策略：极简环境音 + 情境和弦，全部 WebAudio 实时合成。与 SFX 共用同一开关，默认音量极低不打扰。
let _bgmOn=false, _bgmNode=null; // 通过 localStorage 'km_bgm'控制
try{_bgmOn=localStorage.getItem('km_bgm')==='1';}catch(_){}

const BGM = {
  // idle: 持续的低频 Pad（C 大调和弦分解），营造“思考/管理”氛围
  idle:{freqs:[261.63,329.63,392.00],type:'sine',dur:0.5,vol:0.008},
  // win: 胜利时的大三度和弦（C-E-G），明亮上升
  win:{chords:[[523.25,659.25,783.99],[659.25,783.99,987.77]],delays:[0,120]},
  // lose: 小调下行（C-Bb-A），低沉但不过度悲观
  lose:{chords:[[261.63,311.13,392.00],[246.94,293.66,369.99]],delays:[0,100]}
};

/**
 * 播放情境音
 * @param {'idle'|'win'|'lose'} mode
 */
function playBGM(mode){
  if(!_bgmOn||!window.AudioContext)return;
  try{
    const ac=_bgmNode?_bgmNode.ac:(new (window.AudioContext||window.webkitAudioContext)());
    if(ac.state==='suspended')ac.resume();
    
    if(mode==='idle'){
      // 持续 pad：低频正弦波循环播放，音量极小不打扰
      if(_bgmNode&&_bgmNode.mode==='idle')return; // 已在播放则不重复
      
      const now=ac.currentTime;
      const oscs=[];
      
      BGM.idle.freqs.forEach((f, index) => {
        const o=ac.createOscillator(),g=ac.createGain();
        o.type=BGM.idle.type;o.frequency.value=f;
        
        // 淡入效果：0 → 目标音量
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(BGM.idle.vol * _bgmVolume, now + 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, now+2.0);
        
        o.connect(g);g.connect(ac.destination);
        o.start(now);o.stop(now+2.0);
        
        oscs.push({o, g, baseVol: BGM.idle.vol});
      });
      
      _bgmNode={ac,mode:'idle',oscs,stop:()=>oscs.forEach(x=>x.o.stop())};
    }else if(mode==='win'||mode==='lose'){
      // 情境和弦：短暂触发特定情绪的和弦序列
      const cfg=mode==='win'?BGM.win:BGM.lose;
      cfg.chords.forEach((c,i)=>{
        setTimeout(()=>{
          c.forEach((f,delayOffset)=>{
            const o=ac.createOscillator(),g=ac.createGain();
            o.type='sine';o.frequency.value=f;
            g.gain.setValueAtTime(BGM.idle.vol*0.02,ac.currentTime+delayOffset/1000);
            g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+(delayOffset+200)/1000);
            o.connect(g);g.connect(ac.destination);
            o.start();o.stop(ac.currentTime+0.5);
          });
        },cfg.delays[i]||0);
      });
    }
  }catch(e){console.warn('BGM fail:',e.message);}
}

/**
 * 切换 BGM 开关
 */
function toggleBGM(){
  _bgmOn=!_bgmOn;
  try{localStorage.setItem('km_bgm',_bgmOn?'1':'0');if(_bgmNode)_bgmNode.stop();}catch(_){}
  toast(_bgmOn?'BGM 已开启':'BGM 已关闭');
  
  // 更新 header 按钮状态
  try{if(S)renderHeader();}catch(_){}
  
  // 如果开启，立即播放当前页面对应的情景音
  if(_bgmOn) detectAndPlayBGM();
}

/**
 * 情景感知：根据页面类型自动播放
 */
function detectAndPlayBGM() {
  if (!_bgmOn || !window.AudioContext) return;
  
  const currentPage = document.querySelector('.page.on');
  const pageId = currentPage ? currentPage.id.replace('page-', '') : '';
  
  // 先淡出旧 BGM（如果有）
  if(_bgmNode && _bgmNode.oscs && _bgmNode.oscs.length > 0) {
    fadeControl(false, 300);
  }
  
  switch(pageId) {
    case 'club':
    case 'biz':
    case 'hall':
      // 管理/荣誉页面：idle pad
      playBGM('idle');
      break;
      
    case 'match-result':
      // 比赛结算：根据胜负
      const isWin = JSON.parse(localStorage.getItem('kw_last_match_result') || '{}').isWin;
      if(isWin !== undefined) {
        setTimeout(() => playBGM(isWin ? 'win' : 'lose'), 350);
      }
      break;
  }
}

// 页面加载后自动检测
document.addEventListener('DOMContentLoaded', () => {
  // 延迟确保所有模块已加载
  setTimeout(detectAndPlayBGM, 1000);
});

/**
 * 设置 BGM 音量 (0-100)
 * @param {number} percent - 0 to 100
 */
function setBgmVolume(percent) {
  _bgmVolume = Math.max(0, Math.min(1, percent/100));
  try{localStorage.setItem('km_bgm_vol', Math.round(_bgmVolume*100));}catch(_){}
  toast(`BGM 音量已调整为 ${Math.round(_bgmVolume*100)}%`);
  
  // 动态调整当前播放的 BGM 音量（平滑过渡）
  if(_bgmNode && _bgmNode.oscs) {
    const now = _bgmNode.ac.currentTime;
    _bgmNode.oscs.forEach(osc => {
      osc.g.gain.setTargetAtTime(
        osc.baseVol * _bgmVolume,
        now,
        0.1
      );
    });
  }
}

/**
 * 淡入淡出控制
 * @param {boolean} fadeIn - true: 淡入，false: 淡出
 * @param {number} duration - 持续时间 (ms)，默认 500ms
 */
function fadeControl(fadeIn, duration=500) {
  if(!_bgmNode || !_bgmNode.ac || !_bgmNode.oscs || _bgmNode.oscs.length === 0) return;
  
  const now = _bgmNode.ac.currentTime;
  const targetGain = fadeIn ? _bgmVolume : 0;
  const currentGain = _bgmNode.oscs[0].g.gain.value;
  
  // 取消之前的自动化曲线
  _bgmNode.oscs.forEach(osc => {
    osc.g.gain.cancelScheduledValues(now);
    
    // 使用线性或指数 ramp 实现平滑过渡
    osc.g.gain.setValueAtTime(currentGain, now);
    osc.g.gain.exponentialRampToValueAtTime(
      targetGain > 0 ? targetGain * osc.baseVol : 0.0001,
      now + duration / 1000
    );
  });
  
  // 淡出完成后停止所有振荡器
  if(!fadeIn) {
    setTimeout(() => {
      if(_bgmNode && _bgmNode.oscs) {
        _bgmNode.oscs.forEach(osc => {
          try { osc.o.stop(); } catch(_) {}
        });
        _bgmNode.oscs = [];
      }
    }, duration);
  }
}

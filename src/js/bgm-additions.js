
/**
 * 设置 BGM 音量 (0-100)
 * @param {number} percent - 0 to 100
 */
function setBgmVolume(percent) {
  _bgmVolume = Math.max(0, Math.min(1, percent/100));
  try{localStorage.setItem('km_bgm_vol', Math.round(_bgmVolume*100));}catch(_){}
  toast(`BGM 音量已调整为 ${Math.round(_bgmVolume*100)}%`);
  
  // 动态调整当前播放的 BGM 音量
  if(_bgmNode && _bgmNode.ac) {
    const now = _bgmNode.ac.currentTime;
    _bgmNode.oscs.forEach(osc => {
      osc.g.gain.setTargetAtTime(
        _bgmNode.baseVol * _bgmVolume,
        now,
        0.1
      );
    });
  }
}

/**
 * 淡入淡出控制
 */
function fadeTo(targetState, duration=500) {
  if(!_bgmNode || !_bgmNode.ac) return;
  
  const now = _bgmNode.ac.currentTime;
  const targetGain = targetState ? _bgmVolume : 0;
  const currentGain = _bgmNode.oscs.length > 0 ? 1 : 0;
  
  _bgmNode.oscs.forEach(osc => {
    osc.g.gain.cancelScheduledValues(now);
    osc.g.gain.setValueAtTime(currentGain, now);
    osc.g.gain.linearRampToValueAtTime(targetGain * _bgmVolume, now + duration/1000);
  });
  
  setTimeout(() => {
    if(!targetState) {
      _bgmNode.oscs.forEach(osc => osc.o.stop());
      _bgmNode.oscs = [];
    }
  }, duration);
}

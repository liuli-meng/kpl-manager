/* BGM 设置面板 HTML —— 存档管理弹窗注入（与 main.js 共用一份，避免双面板） */
function bgmSettingsPanelHtml(){
 const sfxStatus=_sfxOn?'关闭':'开启';
 const bgmStatus=_bgmOn?'关闭':'开启';
 const volPercent=Math.round((_bgmVolume||0)*100);
 return `
 <div class="panel mt8" id="audio-settings-panel" style="background:var(--card2)">
  <h3>音效设置</h3>
  <div style="margin-bottom:12px">
   <label>SFX 音效
    <button onclick="toggleSfx()" class="btn sm">${_sfxOn?'gold':'primary'}">${sfxStatus}</button>
   </label>
   <div class="hint" style="font-size:11px;margin-top:4px">点击/胜利/失败等短时音效</div>
  </div>
  <div style="margin-bottom:12px">
   <label>BGM 背景音乐
    <button onclick="toggleBGM()" class="btn sm">${_bgmOn?'gold':'primary'}">${bgmStatus}</button>
   </label>
   <div class="hint" style="font-size:11px;margin-top:4px">日常管理轻循环 pad + 胜/负/夺冠情境和弦（默认关，音量极低）</div>
  </div>
  <div>
   <label>BGM 音量
    <input type="range" min="0" max="100" value="${volPercent}"
     oninput="setBgmVolume(this.value)">
    <span id="bgm-vol-display" style="display:inline-block;width:40px;text-align:right;font-weight:bold;color:var(--accent)">${volPercent}%</span>
   </label>
   <div class="hint" style="font-size:11px;margin-top:4px">拖动滑块实时调整 0-100%</div>
  </div>
 </div>`;
}

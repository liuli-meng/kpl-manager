/* BGM 设置面板 - 在存档管理界面中添加音效控制面板 */

/**
 * 生成 BGM 设置面板 HTML
 */
function bgmSettingsPanelHtml() {
  const sfxStatus = _sfxOn ? '关闭' : '开启';
  const bgmStatus = _bgmOn ? '关闭' : '开启';
  const volPercent = Math.round(_bgmVolume * 100);
  
  return `
  <div class="panel mt8" style="background:var(--card2);border-color:var(--accent-primary)">
    <h3>🎵 音效设置</h3>
    
    <!-- SFX 开关 -->
    <div style="margin-bottom:12px">
      <label>SFX 音效
        <button onclick="toggleSfx()" class="btn sm">${_sfxOn?'gold':'primary'}">${sfxStatus}</button>
      </label>
      <div class="hint" style="font-size:11px;margin-top:4px">点击/胜利/失败等短时音效</div>
    </div>
    
    <!-- BGM 开关 -->
    <div style="margin-bottom:12px">
      <label>BGM 背景音乐
        <button onclick="toggleBGM()" class="btn sm">${_bgmOn?'gold':'primary'}">${bgmStatus}</button>
      </label>
      <div class="hint" style="font-size:11px;margin-top:4px">自动播放情景音乐：日常管理 (idle)、胜利庆祝、失利低沉</div>
    </div>
    
    <!-- BGM 音量滑块 -->
    <div>
      <label>BGM 音量
        <input type="range" min="0" max="100" value="${volPercent}" 
               oninput="setBgmVolume(this.value);document.getElementById('bgm-vol-display').textContent=this.value+'%'">
        <span id="bgm-vol-display" style="display:inline-block;width:40px;text-align:right;font-weight:bold;color:var(--accent-primary)">
          ${volPercent}%
        </span>
      </label>
      <div class="hint" style="font-size:11px;margin-top:4px">拖动滑块实时调整，范围 0-100%</div>
    </div>
  </div>`;
}

// 将 BGM 设置面板注入到 openSaveMgmt
const originalOpenSaveMgmt = window.openSaveMgmt;
if(originalOpenSaveMgmt) {
  window.openSaveMgmt = function() {
    // 调用原始函数
    originalOpenSaveMgmt();
    
    // 在 modal body 开头插入 BGM 面板
    const modalBody = document.getElementById('app-modal-body');
    if(modalBody && modalBody.innerHTML.indexOf('音效设置') === -1) {
      const html = modalBody.innerHTML;
      const insertPoint = html.indexOf('<h2>') + '<h2>存档管理</h2>'.length;
      
      if(insertPoint > 0) {
        modalBody.innerHTML = 
          html.substring(0, insertPoint) + 
          '\n\n' + bgmSettingsPanelHtml() +
          '\n' + html.substring(insertPoint);
      }
    }
  };
}

console.log('[BGM Settings] Panel injection ready');

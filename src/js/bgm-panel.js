/* BGM Settings Panel - Auto-injects into Save Management modal */

window.addEventListener('DOMContentLoaded', () => {
  // Override openSaveMgmt to inject BGM panel
  const originalOpenSaveMgmt = window.openSaveMgmt;
  if(originalOpenSaveMgmt) {
    window.openSaveMgmt = function() {
      const result = originalOpenSaveMgmt();
      
      // Inject BGM panel after the modal appears
      setTimeout(() => {
        const body = document.getElementById('app-modal-body');
        if(!body || body.innerHTML.indexOf('音效设置') !== -1) return;
        
        const bgmPanel = `
        <div class="panel mt8" style="background:var(--card2);border-color:var(--accent-primary)">
          <h3>🎵 音效设置</h3>
          
          <!-- SFX -->
          <div style="margin-bottom:12px">
            <label>SFX 音效
              <button onclick="toggleSfx()" class="btn sm">${_sfxOn?'gold':'primary'}">${_sfxOn?'关闭':'开启'}</button>
            </label>
            <div class="hint" style="font-size:11px;margin-top:4px">点击/胜利/失败等短时音效</div>
          </div>
          
          <!-- BGM Switch -->
          <div style="margin-bottom:12px">
            <label>BGM 背景音乐
              <button onclick="toggleBGM()" class="btn sm">${_bgmOn?'gold':'primary'}">${_bgmOn?'关闭':'开启'}</button>
            </label>
            <div class="hint" style="font-size:11px;margin-top:4px">情景音乐：日常管理 (idle)、胜利庆祝、失利低沉</div>
          </div>
          
          <!-- Volume Slider -->
          <div>
            <label>BGM 音量
              <input type="range" min="0" max="100" value="${Math.round(_bgmVolume*100)}" 
                     oninput="setBgmVolume(this.value);document.getElementById('bgm-vol-display').textContent=this.value+'%'">
              <span id="bgm-vol-display" style="display:inline-block;width:40px;text-align:right;font-weight:bold;color:var(--accent-primary)">
                ${Math.round(_bgmVolume*100)}%
              </span>
            </label>
            <div class="hint" style="font-size:11px;margin-top:4px">拖动滑块调整，范围 0-100%</div>
          </div>
        </div>`;
        
        // Insert at beginning of modal body
        body.insertBefore(document.createElement('div'), body.firstChild).innerHTML = bgmPanel;
      }, 50);
    };
    
    console.log('[BGM] Panel injection ready');
  }
});

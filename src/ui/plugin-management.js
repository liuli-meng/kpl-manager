/**
 * Plugin Management UI - 模组管理界面
 * 在存档管理中添加模组控制面板
 */

// 注册钩子，在打开存档管理时注入模组面板
if (window.pluginManager && window.pluginLoader) {
  
  // 监听加载完成事件
  window.addEventListener('DOMContentLoaded', () => {
    console.log('[Plugin Management] UI ready');
  });
  
  /**
   * 生成模组设置面板 HTML
   */
  function pluginManagementPanelHtml() {
    const loadedPackages = window.pluginLoader.listLoadedPackages();
    const registeredPlugins = window.pluginManager.getPlugins();
    
    return `
      <div class="panel mt8" style="background:var(--card2);border-color:var(--cyan)">
        <h3>📦 模组管理</h3>
        
        <!-- 已注册插件列表 -->
        ${registeredPlugins.length > 0 ? `
        <div style="margin-bottom:12px">
          <h4>已激活模组</h4>
          <div class="mod-list" style="margin-top:6px">
            ${registeredPlugins.map(p => `
              <div class="mod-item" style="padding:6px;margin-bottom:4px;background:rgba(0,0,0,.2);border-radius:4px">
                <strong>${p.name}</strong> v${p.version}
                <span style="float:right;font-size:11px;color:var(--text-secondary)">
                  ${p.hooksCount || 0}个钩子
                </span>
              </div>
            `).join('')}
          </div>
        </div>` : ''}
        
        <!-- 导入球员包说明 -->
        <div style="margin-top:8px;padding:8px;background:rgba(66,153,225,.1);border-radius:4px">
          <h4 style="margin-top:0">💡 如何导入球员数据？</h4>
          <ol style="margin:4px 0;padding-left:20px;font-size:12px">
            <li>准备 JSON 格式的球员数据包</li>
            <li>点击下方「导入球员包」按钮</li>
            <li>选择文件并确认导入</li>
            <li>新球员将自动添加到转会市场</li>
          </ol>
        </div>
        
        <!-- 导入按钮区（需要实际实现） -->
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm primary" onclick="openModImportModal()" title="从文件导入球员数据包">
            📥 导入球员包
          </button>
          
          ${loadedPackages.length > 0 ? `
          <button class="btn sm" onclick="showInstalledPackages()" title="查看所有已安装的球员包">
            📋 查看已安装 (${loadedPackages.length})
          </button>
          ` : ''}
        </div>
        
        <!-- 已安装包信息（展开式） -->
        <div id="installed-packages-info" class="panel" style="margin-top:8px;display:none">
          <h4>已安装的球员包</h4>
          <div id="packages-list"></div>
        </div>
      </div>`;
  }
  
  /**
   * 打开模组导入模态框
   */
  function openModImportModal() {
    $('#app-modal-body').innerHTML = `
      <h2>📥 导入球员数据包</h2>
      <p style="font-size:13px;margin-bottom:12px">请选择 JSON 格式的球员数据包文件导入</p>
      
      <input type="file" id="mod-import-file" accept=".json,application/json" 
             style="width:100%;padding:12px;background:var(--card2);border:1px solid var(--line);border-radius:8px;margin-bottom:12px">
      
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px">
        <button class="btn sm primary" onclick="importModFile()">导入</button>
        <button class="btn sm" onclick="closeModal('app-modal')">取消</button>
      </div>
      
      <div class="hint mt8">
        <strong>提示：</strong>确保你的游戏版本与数据包要求的版本兼容<br>
        导入的球员会自动添加到转会市场，等待购买
      </div>
    `;
    
    $('#app-modal').classList.add('on');
    
    // 绑定文件选择事件
    document.getElementById('mod-import-file').addEventListener('change', handleModFileSelect);
  }
  
  /**
   * 处理文件选择
   */
  function handleModFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const jsonData = JSON.parse(event.target.result);
        
        // 显示预览信息
        $('#app-modal-body').innerHTML = `
          <h2>📦 数据包预览</h2>
          <div style="padding:12px;background:var(--card2);border-radius:8px;margin-bottom:12px">
            <strong>文件名：</strong>${file.name}<br>
            <strong>版本：</strong>${jsonData.version || '未知'}<br>
            <strong>作者：</strong>${jsonData.author || '未知'}<br>
            <strong>描述：</strong>${jsonData.description || '无描述'}<br>
            <strong>球员数量：</strong>${jsonData.players?.length || 0}<br>
            ${jsonData.compatibility?.minGameVersion ? `<strong>最低版本：</strong>v${jsonData.compatibility.minGameVersion}` : ''}
          </div>
          
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px">
            <button class="btn sm primary" onclick="confirmModImport('${encodeURIComponent(JSON.stringify(jsonData))}')">确认导入</button>
            <button class="btn sm" onclick="closeModal('app-modal')">返回</button>
          </div>
        `;
        
      } catch (e) {
        alert(`❌ 解析失败：${e.message}`);
        openModImportModal();
      }
    };
    reader.readAsText(file);
  }
  
  /**
   * 确认导入
   */
  function confirmModImport(encodedJson) {
    try {
      const jsonData = JSON.parse(decodeURIComponent(encodedJson));
      const result = window.pluginLoader.processPlayerPack(jsonData);
      
      $('#app-modal-body').innerHTML = `
        <h2>✅ 导入完成</h2>
        <div style="padding:12px;background:${result.success?'#4caf50':'#f44336'};color:#fff;border-radius:8px;margin-bottom:12px">
          <strong>${result.success ? '成功' : '部分失败'}</strong><br>
          导入了 ${result.importedCount || 0} 名球员
          ${result.errors?.length ? `<br><span style="color:#ffeb3b">${result.errors.length} 个错误</span>` : ''}
        </div>
        
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn sm primary" onclick="closeModal('app-modal')">确定</button>
          ${result.warnings?.length ? `<button class="btn sm" onclick="alert('警告：${result.warnings.join("\\n")}')">查看警告</button>` : ''}
        </div>
      `;
      
      $('#app-modal').classList.add('on');
      
    } catch (e) {
      alert(`❌ 导入失败：${e.message}`);
      openModImportModal();
    }
  }
  
  /**
   * 显示已安装包列表
   */
  function showInstalledPackages() {
    const packages = window.pluginLoader.listLoadedPackages();
    
    if (packages.length === 0) {
      alert('暂无已安装的球员包');
      return;
    }
    
    let html = '<table class="tbl"><thead><tr><th>版本号</th><th>数量</th><th>操作</th></tr></thead>';
    html += packages.map(p => `
      <tr>
        <td>v${p.version}</td>
        <td>${p.playerIds.length}名球员</td>
        <td>
          <button class="btn sm" onclick="clearPackage('${p.version}')">清除</button>
        </td>
      </tr>
    `).join('');
    html += '</table>';
    
    $('#app-modal-body').innerHTML = `
      <h2>📦 已安装的球员包</h2>
      ${html}
      <div style="margin-top:12px;text-align:center">
        <button class="btn sm" onclick="closeModal('app-modal')">关闭</button>
      </div>
    `;
    
    $('#app-modal').classList.add('on');
  }
  
  /**
   * 清除指定版本的所有球员
   */
  function clearPackage(version) {
    const removed = window.pluginLoader.clearPackage(version);
    if (removed > 0) {
      alert(`已清除 v${version} 版本的 ${removed} 名球员`);
    } else {
      alert('未找到该版本的球员');
    }
  }
  
  /**
   * 全局暴露函数供模板调用
   */
  window.openModImportModal = openModImportModal;
  window.showInstalledPackages = showInstalledPackages;
  window.clearPackage = clearPackage;
  
  // 将面板函数挂载到 window 以便模板调用
  window.pluginManagementPanelHtml = pluginManagementPanelHtml;
  
  console.log('[Plugin Management UI] Ready');
}

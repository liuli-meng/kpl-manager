/**
 * Plugin Loader - 插件加载管理器
 * 负责从文件加载、解析和注册插件
 */

class PluginLoader {
  constructor(pluginEngine, sandboxRunner) {
    this.pluginEngine = pluginEngine;
    this.sandboxRunner = sandboxRunner;
    this.loadedPlugins = new Set(); // 已加载插件 ID
    this.loadQueue = []; // 待加载队列
    
    console.log('[PluginLoader] Initialized');
  }
  
  /**
   * 从本地 JSON 文件加载插件包
   * @param {string} filePath - 文件路径 (file://)
   * @returns {Promise<Object>} 加载结果
   */
  async loadFromJsonFile(filePath) {
    try {
      if (!filePath.startsWith('file://')) {
        throw new Error('Only local file:// URLs are allowed for security');
      }
      
      const fs = require('fs');
      const jsonContent = fs.readFileSync(filePath, 'utf8');
      const packageData = JSON.parse(jsonContent);
      
      return await this.processPlayerPack(packageData);
      
    } catch (e) {
      console.error(`[PluginLoader] Failed to load from ${filePath}: ${e.message}`);
      throw e;
    }
  }
  
  /**
   * 处理玩家数据包
   * @param {Object} packageData - 数据包内容
   * @returns {Promise<Object>} 处理结果
   */
  async processPlayerPack(packageData) {
    const result = {
      success: false,
      importedCount: 0,
      errors: [],
      warnings: []
    };
    
    // 验证版本兼容性
    const compatResult = this.checkCompatibility(packageData);
    if (!compatResult.valid) {
      result.warnings.push(...compatResult.messages);
    }
    
    // 导入每个玩家
    if (packageData.players && Array.isArray(packageData.players)) {
      for (const player of packageData.players) {
        try {
          // 缓存到全局
          window.importedPlayersCache.set(player.importId || player.name, {
            ...player,
            packVersion: packageData.version
          });
          
          result.importedCount++;
          
          // 触发生成钩子（如果该玩家已经存在）
          window.pluginManager.emit('onPlayerCreated', player);
          
        } catch (e) {
          result.errors.push({
            playerId: player.importId || 'unknown',
            error: e.message
          });
        }
      }
      
      result.success = result.errors.length === 0;
    }
    
    console.log(`[PluginLoader] Loaded ${result.importedCount} players`);
    return result;
  }
  
  /**
   * 检查版本兼容性
   * @param {Object} packageData - 数据包
   * @returns {Object} 检查结果
   */
  checkCompatibility(packageData) {
    const messages = [];
    const valid = true;
    
    // 检查游戏版本要求
    const minVer = parseInt(packageData.compatibility?.minGameVersion?.replace('.', '') || '0');
    const maxVer = parseInt(packageData.compatibility?.maxGameVersion?.replace('.', '') || '999');
    const currentVer = parseInt(KM_BUILD.replace(/[^0-9]/g, ''));
    
    if (currentVer < minVer) {
      messages.push(`⚠️ 当前版本过低，需要 v${packageData.compatibility.minGameVersion}`);
      // 这里不应该 throw，只是警告
    }
    
    if (currentVer > maxVer) {
      messages.push(`⚠️ 当前版本可能不兼容，建议更新到 v${packageData.compatibility.maxGameVersion}`);
    }
    
    return { valid, messages };
  }
  
  /**
   * 列出已加载的插件包
   * @returns {Array} 插件包列表
   */
  listLoadedPackages() {
    const cache = window.importedPlayersCache || new Map();
    const packages = new Map();
    
    cache.forEach((data, id) => {
      if (data.packVersion) {
        if (!packages.has(data.packVersion)) {
          packages.set(data.packVersion, new Set());
        }
        packages.get(data.packVersion).add(id);
      }
    });
    
    return Array.from(packages.entries()).map(([version, ids]) => ({
      version,
      count: ids.size,
      playerIds: Array.from(ids)
    }));
  }
  
  /**
   * 清除指定插件包的数据
   * @param {string} version - 版本号
   */
  clearPackage(version) {
    const cache = window.importedPlayersCache;
    if (!cache) return;
    
    let removed = 0;
    for (const [id, data] of cache.entries()) {
      if (data.packVersion === version) {
        cache.delete(id);
        removed++;
      }
    }
    
    console.log(`[PluginLoader] Cleared ${removed} players from v${version}`);
    return removed;
  }
}

// 导出全局实例
window.PluginLoader = PluginLoader;
if (typeof window.pluginManager !== 'undefined' && typeof window.sandboxRunner !== 'undefined') {
  window.pluginLoader = new PluginLoader(window.pluginManager, window.sandboxRunner);
}

console.log('[KPL Manager] Plugin loader ready');

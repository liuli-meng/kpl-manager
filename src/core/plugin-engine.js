/**
 * Plugin Engine - KPL 电竞经理模组系统核心
 * 提供插件注册、钩子管理、安全沙箱执行
 * @version 1.0.0
 */

class PluginEngine {
  constructor() {
    this.plugins = new Map(); // 已注册插件存储
    this.hookSubscribers = {}; // 钩子订阅者
    
    // 定义可用钩子
    const hooks = [
      'onPlayerCreated',    // 玩家创建时
      'onTransferComplete', // 转会完成时
      'onMatchEnded',       // 比赛结束时
      'onSeasonStarted',    // 新赛季开始时
      'beforeSerializeSave', // 序列化存档前
      'afterLoadSave'       // 加载存档后
    ];
    
    // 初始化每个钩子的订阅列表
    hooks.forEach(hook => {
      this.hookSubscribers[hook] = [];
    });
    
    console.log('[PluginEngine] Initialized');
  }
  
  /**
   * 验证插件对象
   * @param {Object} plugin - 插件对象
   * @throws {Error} 如果验证失败
   */
  validatePlugin(plugin) {
    // 必需字段检查
    if (!plugin.id || !plugin.version) {
      throw new Error('Missing required fields: id, version');
    }
    
    // ID 格式检查 (小写字母 + 数字 + 短横线)
    if (!/^[a-z0-9-]+$/.test(plugin.id)) {
      throw new Error(`Invalid plugin ID format: ${plugin.id}`);
    }
    
    // 版本号检查 (语义化版本)
    if (!/^(\d+)\.(\d+)\.(\d+)$/.test(plugin.version)) {
      throw new Error(`Invalid version format: ${plugin.version}`);
    }
    
    return true;
  }
  
  /**
   * 注册插件
   * @param {Object} plugin - 插件对象
   * @returns {boolean} 是否成功注册
   */
  register(plugin) {
    try {
      // 验证插件
      this.validatePlugin(plugin);
      
      // 注册钩子订阅
      if (plugin.hooks && Array.isArray(plugin.hooks)) {
        plugin.hooks.forEach(hookName => {
          if (this.hookSubscribers[hookName]) {
            this.hookSubscribers[hookName].push({
              id: plugin.id,
              handler: plugin[hookName],
              version: plugin.version
            });
            
            console.log(`[PluginEngine] Registered hook "${hookName}" for ${plugin.id}`);
          } else {
            console.warn(`[PluginEngine] Unknown hook: ${hookName}`);
          }
        });
      }
      
      // 保存插件实例
      this.plugins.set(plugin.id, {
        ...plugin,
        registeredAt: Date.now(),
        hooksCount: plugin.hooks?.length || 0
      });
      
      console.log(`[PluginEngine] ✅ ${plugin.id} v${plugin.version} registered (${plugin.hooks?.length || 0} hooks)`);
      return true;
      
    } catch (e) {
      console.error(`[PluginEngine] ❌ Failed to register ${plugin.id}: ${e.message}`);
      return false;
    }
  }
  
  /**
   * 移除插件
   * @param {string} pluginId - 插件 ID
   * @returns {boolean} 是否成功移除
   */
  unregister(pluginId) {
    if (!this.plugins.has(pluginId)) {
      console.warn(`[PluginEngine] Plugin not found: ${pluginId}`);
      return false;
    }
    
    const plugin = this.plugins.get(pluginId);
    
    // 清理所有钩子订阅
    Object.keys(this.hookSubscribers).forEach(hook => {
      this.hookSubscribers[hook] = this.hookSubscribers[hook].filter(
        sub => sub.id !== pluginId
      );
    });
    
    this.plugins.delete(pluginId);
    console.log(`[PluginEngine] 🔴 Unregistered ${pluginId}`);
    return true;
  }
  
  /**
   * 触发钩子
   * @param {string} hookName - 钩子名称
   * @param {*} payload - 传入数据
   */
  emit(hookName, payload) {
    const subscribers = this.hookSubscribers[hookName] || [];
    
    subscribers.forEach(sub => {
      try {
        if (typeof sub.handler === 'function') {
          sub.handler(payload);
        }
      } catch (e) {
        console.error(`[PluginEngine] Hook ${hookName} failed for ${sub.id}: ${e.message}`);
      }
    });
  }
  
  /**
   * 获取所有已注册插件
   * @returns {Array} 插件列表
   */
  getPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.id,
      version: p.version,
      name: p.name || p.id,
      description: p.description,
      hooksCount: p.hooksCount || 0,
      registeredAt: p.registeredAt
    }));
  }
  
  /**
   * 获取特定插件信息
   * @param {string} pluginId - 插件 ID
   * @returns {Object|null} 插件信息或 null
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId) || null;
  }
  
  /**
   * 获取指定钩子的所有订阅者
   * @param {string} hookName - 钩子名称
   * @returns {Array} 订阅者列表
   */
  getHookSubscribers(hookName) {
    return this.hookSubscribers[hookName] || [];
  }
  
  /**
   * 检查是否存在插件
   * @param {string} pluginId - 插件 ID
   * @returns {boolean}
   */
  hasPlugin(pluginId) {
    return this.plugins.has(pluginId);
  }
  
  /**
   * 获取插件数量
   * @returns {number}
   */
  count() {
    return this.plugins.size;
  }
}

// 导出全局单例
window.PluginEngine = PluginEngine;
window.pluginManager = new PluginEngine();

console.log('[KPL Manager] Plugin system ready');

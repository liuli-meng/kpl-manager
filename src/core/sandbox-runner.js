/**
 * Plugin Sandbox - 安全执行插件代码的沙箱环境
 * 防止恶意代码执行，提供安全隔离的运行环境
 */

class PluginSandbox {
  constructor() {
    // 允许的全局变量
    this.allowedGlobals = [
      'console',
      'Math',
      'Date',
      'JSON',
      'Array',
      'Object',
      'String',
      'Number',
      'Boolean',
      'Promise',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'window'
    ];
    
    // 禁止的危险 API
    this.blockedGlobals = [
      'fetch',
      'XMLHttpRequest',
      'fs',
      'require',
      'module',
      'process',
      'global',
      'eval',
      'Function',
      'execFileSync',
      'spawnSync'
    ];
    
    console.log('[PluginSandbox] Initialized');
  }
  
  /**
   * 在沙箱环境中安全执行插件代码
   * @param {string} code - 要执行的代码
   * @param {Object} context - 上下文对象
   * @returns {*} 执行结果
   */
  safeRun(code, context = {}) {
    const vm = require('vm');
    
    // 构建受限沙箱环境
    const sandbox = {};
    
    // 添加允许的全局变量
    this.allowedGlobals.forEach(name => {
      if (typeof window[name] !== 'undefined') {
        try {
          sandbox[name] = window[name];
        } catch (_) {}
      }
    });
    
    // 添加自定义上下文
    Object.assign(sandbox, context);
    
    // 明确禁止危险 API
    this.blockedGlobals.forEach(name => {
      sandbox[name] = undefined;
    });
    
    try {
      // 使用 vm 模块在隔离环境中执行
      const script = new vm.Script(code);
      
      // 执行超时保护
      const result = script.runInContext(vm.createContext(sandbox), {
        timeout: 5000, // 5 秒超时
        displayErrors: false
      });
      
      return result;
      
    } catch (e) {
      console.error(`[PluginSandbox] Execution failed for plugin: ${e.message}`);
      throw new Error('Plugin execution aborted for safety');
    }
  }
  
  /**
   * 验证插件签名 (可选功能)
   * @param {Object} plugin - 插件对象
   * @param {string} publicKey - 公钥 (预留)
   */
  verifySignature(plugin, publicKey) {
    // TODO: 实现签名验证逻辑
    // 当前阶段仅输出哈希供调试
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(JSON.stringify(plugin)).digest('hex');
    
    console.log(`[PluginSandbox] Plugin signature hash: ${hash.substring(0, 16)}...`);
  }
  
  /**
   * 加载外部插件代码
   * @param {string} url - 插件 URL
   * @returns {Promise<Object>} 插件对象
   */
  async loadFromUrl(url) {
    // 安全检查：只允许本地文件
    if (!url.startsWith('file://')) {
      throw new Error('External URLs blocked for security');
    }
    
    try {
      const fs = require('fs');
      const code = fs.readFileSync(url, 'utf8');
      
      return await this.safeRun(code, {
        pluginManager: window.pluginManager,
        require: undefined,
        module: undefined
      });
      
    } catch (e) {
      console.error(`[PluginSandbox] Failed to load from URL ${url}: ${e.message}`);
      throw e;
    }
  }
}

// 导出全局单例
window.PluginSandbox = PluginSandbox;
window.sandboxRunner = new PluginSandbox();

console.log('[KPL Manager] Sandbox ready');

/**
 * 示例插件：自定义选手导入器 v1.0.0
 * 功能：允许从 JSON 文件导入自定义选手数据
 */

// 插件元数据
const pluginMetadata = {
  id: 'player-importer',
  version: '1.0.0',
  name: '自定义选手导入',
  author: 'KPL Manager Team',
  description: '从 JSON 文件导入自定义选手数据，支持明星选手包',
  hooks: ['onPlayerCreated'],
  permissions: ['read_file']
};

// 导入的选手数据缓存
const importedPlayersCache = new Map();

/**
 * 处理新创建的球员
 * @param {Object} playerData - 球员数据对象
 */
function onPlayerCreated(playerData) {
  // 检查是否为导入的选手
  if (playerData.customImported && playerData.importId) {
    const importKey = playerData.importId;
    
    // 查找匹配的导入数据
    const importData = importedPlayersCache.get(importKey);
    
    if (importData) {
      applyCustomStats(playerData, importData);
      console.log(`[Plugin] Applied custom stats for ${playerData.name}`);
    }
  }
}

/**
 * 应用自定义统计
 * @param {Object} target - 目标球员
 * @param {Object} source - 来源数据
 */
function applyCustomStats(target, source) {
  if (!source) return;
  
  // 四维属性
  if (source.base && Array.isArray(source.base)) {
    target.base = [...target.base]; // 复制数组避免修改原数据
    for (let i = 0; i < Math.min(4, source.base.length); i++) {
      target.base[i] = source.base[i];
    }
  }
  
  // 技能
  if (source.skill) {
    target.skill = { ...source.skill };
  }
  
  // 招牌英雄
  if (source.sig) {
    target.sig = source.sig;
  }
  
  // 英雄池
  if (source.heroPool && Array.isArray(source.heroPool)) {
    target.heroPool = [...source.heroPool];
  }
  
  // 比赛统计数据
  if (source.stats) {
    target.stats = { ...source.stats };
  }
  
  // 荣誉成就
  if (source.achievements && Array.isArray(source.achievements)) {
    target.achievements = [...source.achievements];
  }
  
  // 合同信息
  if (source.contract) {
    target.contract = { ...source.contract };
  }
  
  // 更新基础战力
  updateBasePower(target);
  
  console.log(`[Plugin] Custom stats applied to ${target.name}`);
}

/**
 * 更新基础战力值
 * @param {Object} player - 球员对象
 */
function updateBasePower(player) {
  // 根据四维计算基础战力
  const [ovr, fp, tp, atk] = player.base;
  const power = Math.round((ovr + fp + tp + atk) / 4);
  
  if (power > player.power) {
    player.power = power;
  }
}

/**
 * 注册到插件系统
 */
function register() {
  if (typeof pluginManager !== 'undefined') {
    const result = pluginManager.register({
      ...pluginMetadata,
      onPlayerCreated,
      importedPlayersCache
    });
    
    if (result) {
      console.log('[Player Importer Plugin] Successfully registered');
    } else {
      console.error('[Player Importer Plugin] Registration failed');
    }
  } else {
    console.warn('[Player Importer Plugin] pluginManager not found');
  }
}

// 自动注册
register();

// 导出工具函数供外部调用
if (typeof window !== 'undefined') {
  window.importedPlayersCache = importedPlayersCache;
  window.addImportedPlayer = function(importId, data) {
    importedPlayersCache.set(importId, data);
    console.log(`[Player Importer] Added player with ID: ${importId}`);
  };
}

console.log('[Player Importer] Plugin loaded');

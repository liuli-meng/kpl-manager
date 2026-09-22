/**
 * Core State - 存档状态管理核心
 * 提供状态创建、默认值、迁移逻辑
 */

// 存档版本
const CORE_SAVE_VERSION = 4;

// 默认赛季设置
const DEFAULT_SEASON = {
  season: 1,
  split: 'spring',
  phase: 'r1',
  day: 1,
  transferWindow: 7
};

// 玩家基础结构
const PLAYER_TEMPLATE = {
  id: '',
  name: '',
  pos: 'mid',
  base: [70, 70, 70, 70],
  skill: null,
  sig: '',
  heroPool: [],
  age: 18,
  contract: null,
  stats: { kda: 0, mvpRate: 0 },
  morale: 70,
  fitness: 100,
  power: 0,
  value: 100
};

// 主教练模板
const COACH_TEMPLATE = {
  id: '',
  name: '',
  bonus: 0,
  type: 'BALANCED'
};

// 完整默认状态结构
const DEFAULT_STATE = {
  // 基本信息
  teamName: '',
  icon: '队',
  mode: 'manager',
  
  // 经济
  fund: 1300,
  wageCap: 150,
  
  // 阵容
  players: [],
  lineup: [],
  coach: COACH_TEMPLATE,
  
  // 赛程
  ...DEFAULT_SEASON,
  schedule: [],
  matchIdx: 0,
  
  // 杯赛结构
  playoff: null,
  challenger: null,
  ewc: null,
  ag: null,
  annual: null,
  
  // 荣誉
  championships: 0,
  fmvpHonor: [],
  honors: [],
  achieved: {},
  
  // 其他数据
  eventLog: [],
  history: { logs: [] },
  board: { trust: 60, fired: false },
  
  // 存档元数据
  version: CORE_SAVE_VERSION,
  exported: true
};

/**
 * 创建新存档实例
 * @param {string} teamName - 俱乐部名称
 * @param {string} teamIcon - 队徽图标
 * @returns {Object} 新的状态实例
 */
function newState(teamName, teamIcon) {
  const state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  state.teamName = teamName;
  state.icon = teamIcon;
  return state;
}

/**
 * 克隆状态对象 (深拷贝)
 * @param {Object} state - 原始状态
 * @returns {Object} 复制的副本
 */
function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

/**
 * 检查状态是否有效
 * @param {Object} state - 待检查的状态
 * @returns {boolean} 是否有效
 */
function isValidState(state) {
  if (!state || !state.teamName) return false;
  if (!Array.isArray(state.players)) return false;
  if (!state.version || typeof state.version !== 'number') return false;
  return true;
}

/**
 * 获取当前状态的签名哈希 (用于检测变化)
 * @param {Object} state - 状态对象
 * @returns {string} 签名字符串
 */
function getStateSignature(state) {
  try {
    const sigParts = [
      state.day,
      state.season,
      state.phase,
      state.fund,
      state.players.length,
      state.lineup.length,
      state.championships
    ];
    return sigParts.join('|');
  } catch (_) {
    return 'invalid';
  }
}

// 导出给全局使用
window.CORE_SAVE_VERSION = CORE_SAVE_VERSION;
window.DEFAULT_STATE = DEFAULT_STATE;
window.newState = newState;
window.cloneState = cloneState;
window.isValidState = isValidState;
window.getStateSignature = getStateSignature;

console.log('[Core State] Loaded successfully');

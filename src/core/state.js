/**
 * CoreState — 备用/参考状态工具（不覆盖主游戏全局）
 *
 * ⚠ 历史坑：本文件曾导出 window.newState，会覆盖 js/state.js 的完整 newState，
 *   而 createTeam/applyClub 依赖完整版 —— 浏览器里开档会坏。测试沙箱只加载 js/，
 *   所以门禁绿了也发现不了。
 * 现约定：本文件只挂 window.CoreState.*，禁止再抢全局函数名。
 */
(function () {
  const CORE_SAVE_VERSION = 4;

  const DEFAULT_SEASON = {
    season: 1,
    split: 'spring',
    phase: 'r1',
    day: 1,
    transferWindow: 7
  };

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

  const COACH_TEMPLATE = {
    id: '',
    name: '',
    bonus: 0,
    type: 'BALANCED'
  };

  const DEFAULT_STATE = {
    teamName: '',
    icon: '队',
    mode: 'manager',
    fund: 1300,
    wageCap: 150,
    players: [],
    lineup: [],
    coach: COACH_TEMPLATE,
    season: 1,
    split: 'spring',
    phase: 'r1',
    day: 1,
    transferWindow: 7,
    schedule: [],
    matchIdx: 0,
    playoff: null,
    challenger: null,
    ewc: null,
    ag: null,
    annual: null,
    championships: 0,
    fmvpHonor: [],
    honors: [],
    achieved: {},
    eventLog: [],
    history: { logs: [] },
    board: { trust: 60, fired: false },
    version: CORE_SAVE_VERSION,
    exported: true
  };

  function newState(teamName, teamIcon) {
    const state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    state.teamName = teamName;
    state.icon = teamIcon;
    return state;
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function isValidState(state) {
    if (!state || !state.teamName) return false;
    if (!Array.isArray(state.players)) return false;
    return true;
  }

  function getStateSignature(state) {
    try {
      return [
        state.day,
        state.season,
        state.phase,
        state.fund,
        state.players.length,
        state.lineup.length,
        state.championships
      ].join('|');
    } catch (_) {
      return 'invalid';
    }
  }

  window.CoreState = {
    CORE_SAVE_VERSION: CORE_SAVE_VERSION,
    DEFAULT_SEASON: DEFAULT_SEASON,
    DEFAULT_STATE: DEFAULT_STATE,
    PLAYER_TEMPLATE: PLAYER_TEMPLATE,
    COACH_TEMPLATE: COACH_TEMPLATE,
    newState: newState,
    cloneState: cloneState,
    isValidState: isValidState,
    getStateSignature: getStateSignature
  };

  console.log('[CoreState] reference utils on window.CoreState (main game keeps js/state.js newState)');
})();

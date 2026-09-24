/* permission — 模式权限集中化（Phase1）
 * 把散落的 if (s.mode==='player'/'coach') 收成 canOperate / blockReason。
 * 只回答「能不能做」；文案展示差异仍留在 UI 层。
 * 新增模式时改本表，不要再去业务函数里撒 mode 判断。
 * 私有函数加 _ 前缀，避免与全局门面同名（audit-static 查 function 重名）。
 *
 * 模式：
 *  manager 经理=全权经营
 *  coach   教练=只管竞技（排阵/BP/战术/申请引援）
 *  player  选手=只管自己生涯
 */
const Permissions = (function () {
  /** action -> 允许的 mode 集合；缺省仅 manager */
  const RULES = {
    // 俱乐部经营 / 转会
    buyPlayer: ['manager'],
    sellPlayer: ['manager'],
    releasePlayer: ['manager'],
    renewPlayer: ['manager'],
    listPlayer: ['manager'],
    delistPlayer: ['manager'],
    refreshMarket: ['manager'],
    endTransferWindow: ['manager'],
    signFreeAgent: ['manager'],
    loanOut: ['manager'],
    loanIn: ['manager', 'coach'],
    // 教练/阵容
    manageLineup: ['manager', 'coach'],
    setTactic: ['manager', 'coach'],
    setCaptain: ['manager', 'coach'],
    setCoach: ['manager'],
    fireCoach: ['manager'],
    signCoach: ['manager'],
    // 比赛
    startMatch: ['manager', 'coach'],
    playerStartMatch: ['player'],
    startCard: ['manager', 'coach'],
    startPlayoff: ['manager', 'coach'],
    startCup: ['manager', 'coach'],
    openBP: ['manager', 'coach'],
    // 青训 / 选秀 / 转位置
    recruitRookie: ['manager'],
    trainRookie: ['manager'],
    promoteRookie: ['manager'],
    convertPos: ['manager'],
    draft: ['manager'],
    // K甲 / 国家队
    kjiaDown: ['manager'],
    kjiaRecall: ['manager'],
    natCampPick: ['manager', 'coach'],
    // 商业 / 董事会
    upgradeSponsor: ['manager'],
    clubChoice: ['manager'],
    respondOffer: ['manager'],
    // 选手生涯
    playerTrain: ['player'],
    playerRequestTransfer: ['player'],
    playerRequestLoanOut: ['player'],
    playerRequestKjia: ['player'],
    playerRespondOffer: ['player'],
    playerMedia: ['player'],
    playerToCoach: ['player'],
    // 教练申请
    coachRequest: ['coach'],
    coachPoachAccept: ['coach'],
    // 通用
    exportSave: ['manager', 'coach', 'player'],
    resetGame: ['manager', 'coach', 'player'],
  };

  const MODE_LABEL = {
    manager: '经理模式',
    coach: '教练生涯',
    player: '选手生涯',
  };

  const ACTION_LABEL = {
    buyPlayer: '买人/谈判',
    sellPlayer: '出售',
    releasePlayer: '解约',
    renewPlayer: '续约',
    listPlayer: '挂牌',
    delistPlayer: '摘牌',
    refreshMarket: '刷新市场',
    endTransferWindow: '结束转会期',
    signFreeAgent: '签自由球员',
    loanOut: '租出',
    loanIn: '租借',
    manageLineup: '调整首发',
    setTactic: '切换战术',
    setCaptain: '任命队长',
    setCoach: '任命教练',
    fireCoach: '解雇教练',
    signCoach: '签约教练',
    startMatch: '开始比赛',
    playerStartMatch: '开始比赛',
    startCard: '卡位赛',
    startPlayoff: '季后赛',
    startCup: '杯赛',
    openBP: '进入 BP',
    recruitRookie: '招募青训',
    trainRookie: '培养青训',
    promoteRookie: '提拔青训',
    convertPos: '转位置',
    draft: '选秀大会',
    kjiaDown: '下放 K 甲',
    kjiaRecall: '召回 K 甲',
    natCampPick: '亚运征召',
    upgradeSponsor: '升级赞助',
    clubChoice: '俱乐部关系决策',
    respondOffer: '回应报价',
    playerTrain: '训练',
    playerRequestTransfer: '申请转会',
    playerRequestLoanOut: '申请租借',
    playerRequestKjia: '申请 K 甲',
    playerRespondOffer: '回应报价',
    playerMedia: '媒体互动',
    playerToCoach: '转职教练',
    coachRequest: '向俱乐部申请',
    coachPoachAccept: '接受豪门邀约',
    exportSave: '导出存档',
    resetGame: '重新开局',
  };

  function _modeOf(s) {
    return (s && s.mode) || 'manager';
  }

  function _canOperate(action, s) {
    const modes = RULES[action];
    if (!modes) {
      try { console.warn('[permission] unknown action:', action); } catch (_) {}
      return _modeOf(s) === 'manager';
    }
    return modes.indexOf(_modeOf(s)) >= 0;
  }

  function _blockReason(action, s) {
    if (_canOperate(action, s)) return '';
    const m = _modeOf(s);
    const label = ACTION_LABEL[action] || action;
    if (m === 'player') return '选手生涯不能操作「' + label + '」（由俱乐部/经纪处理）';
    if (m === 'coach') return '教练生涯不能操作「' + label + '」（由俱乐部打理，请用申请入口）';
    return '当前模式不能操作「' + label + '」';
  }

  function _denyIfBlocked(action, s) {
    if (_canOperate(action, s)) return false;
    const reason = _blockReason(action, s);
    try { if (typeof toast === 'function') toast(' ' + reason); } catch (_) {}
    return true;
  }

  return {
    RULES: RULES,
    MODE_LABEL: MODE_LABEL,
    ACTION_LABEL: ACTION_LABEL,
    canOperate: _canOperate,
    blockReason: _blockReason,
    denyIfBlocked: _denyIfBlocked,
    modeOf: _modeOf,
  };
})();

function canOperate(action, s) { return Permissions.canOperate(action, s); }
function blockReason(action, s) { return Permissions.blockReason(action, s); }
function denyIfBlocked(action, s) { return Permissions.denyIfBlocked(action, s); }

/* phases — 赛季/杯赛 phase 枚举与跳转守卫（Phase2）
 * 禁止业务代码再写死 'r1'/'playoff' 等魔法字符串做分支时优先读 PHASES.*。
 * setPhase(s, next, meta) 会校验合法跳转；非法跳转在开发探针下告警并拒绝写入。
 *
 * 时间线（联赛内）:
 *   r1 → r2 → card → r3 → playoff → champion|eliminated
 * 赛季间杯赛（由 advanceCalendar / cups.js 安装）:
 *   champion|eliminated → challenger → (split summer) → ewc → [asiad] → annual → 下一季 r1
 */
const PHASES = {
  R1: 'r1',
  R2: 'r2',
  CARD: 'card',
  R3: 'r3',
  PLAYOFF: 'playoff',
  CHAMPION: 'champion',
  ELIMINATED: 'eliminated',
  CHALLENGER: 'challenger',
  EWC: 'ewc',
  ASIAD: 'asiad',
  ANNUAL: 'annual',
};

/** 合法后继。空数组 = 终局（仅允许被 newSeason/startSplit 重置） */
const PHASE_NEXT = {
  r1: ['r2', 'eliminated', 'champion'], // champion 仅极端补完路径
  r2: ['card', 'r3', 'eliminated', 'playoff'], // r3 直通：卡位赛后胜者/跳过
  card: ['r3', 'eliminated'],
  r3: ['playoff', 'eliminated', 'champion'],
  playoff: ['champion', 'eliminated'],
  champion: ['challenger', 'ewc', 'asiad', 'annual', 'r1'],
  eliminated: ['challenger', 'ewc', 'asiad', 'annual', 'r1'],
  challenger: ['ewc', 'asiad', 'annual', 'r1', 'r2', 'card', 'r3'], // 挑杯后开夏/直接年总
  ewc: ['asiad', 'annual', 'r1'],
  asiad: ['annual', 'r1'],
  annual: ['r1'],
};

const PHASE_LABEL = {
  r1: '常规赛·第一轮',
  r2: '常规赛·第二轮',
  card: '卡位赛',
  r3: '常规赛·第三轮',
  playoff: '季后赛',
  champion: '赛季结束·夺冠',
  eliminated: '赛季结束·止步',
  challenger: '挑战者杯',
  ewc: 'EWC 电竞世界杯',
  asiad: '亚运会',
  annual: 'KPL 年度总决赛',
};

function _phaseTrace() {
  try { return typeof StateStore !== 'undefined' && StateStore.traceOn(); }
  catch (_) { return false; }
}

function isKnownPhase(p) {
  return Object.prototype.hasOwnProperty.call(PHASE_NEXT, p);
}

function canTransition(from, to) {
  if (!isKnownPhase(from) || !isKnownPhase(to)) return false;
  // 同值幂等（重复 set）允许
  if (from === to) return true;
  return PHASE_NEXT[from].indexOf(to) >= 0;
}

/**
 * 写 phase（带守卫）。force=true 时跳过守卫（迁移/测试钩子专用）。
 * 返回 {ok, from, to, reason}
 */
function setPhase(s, to, meta) {
  const from = s && s.phase;
  const force = !!(meta && meta.force);
  const who = (meta && meta.who) || 'setPhase';
  if (!s) return { ok: false, from: from, to: to, reason: 'no-state' };
  if (!isKnownPhase(to)) {
    if (_phaseTrace()) try { console.warn('[phase] unknown target', to); } catch (_) {}
    return { ok: false, from: from, to: to, reason: 'unknown-target' };
  }
  if (!force && from != null && !canTransition(from, to)) {
    if (_phaseTrace()) try { console.warn('[phase] illegal', from, '->', to, who); } catch (_) {}
    try { if (typeof gameLog !== 'undefined') gameLog.warn('phase', 'illegal ' + from + ' -> ' + to, { who: who }); } catch (_) {}
    return { ok: false, from: from, to: to, reason: 'illegal-transition' };
  }
  s.phase = to;
  try { if (typeof StateStore !== 'undefined') StateStore.logChange({ who: who, note: 'phase:' + from + '→' + to }, ['phase']); } catch (_) {}
  return { ok: true, from: from, to: to, reason: '' };
}

/** 便捷：守卫失败则 toast 并返回 false */
function setPhaseOrWarn(s, to, meta) {
  const r = setPhase(s, to, meta);
  if (!r.ok && r.reason === 'illegal-transition') {
    try { if (typeof toast === 'function') toast(' 赛程状态无法从「' + (PHASE_LABEL[r.from] || r.from) + '」跳到「' + (PHASE_LABEL[to] || to) + '」'); } catch (_) {}
  }
  return r.ok;
}

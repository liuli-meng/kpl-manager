/* stateStore — 状态薄门面（Phase1）
 * 目标：统一「读当前档 / 换档 / 增量补丁 / 变更探针 / 崩溃快照」，不拦截旧代码的 s.xxx= 裸写。
 * 约定：
 *  - 业务状态本体仍是全局可变对象 S（及 f(s) 参数），本文件不做 Proxy 强制拦截
 *  - 新代码优先用 patchState(getState(), partial, meta)；旧代码继续 s.x= 亦可
 *  - 开发探针：localStorage km_trace=1 时记录变更环（谁改、字段、时间）
 *  - 私有函数加 _ 前缀，避免与全局门面同名（audit-static 查 function 重名）
 */
const StateStore = (function () {
  const TRACE_KEY = 'km_trace';
  const CRASH_KEY = 'km_crash_snapshot';
  const LOG_MAX = 80;
  let _changeLog = [];
  let _trace = null;

  function _traceOn() {
    if (_trace === null) {
      try { _trace = localStorage.getItem(TRACE_KEY) === '1'; }
      catch (_) { _trace = false; }
    }
    return _trace;
  }

  function _now() { return Date.now(); }

  function _logChange(meta, keys) {
    if (!_traceOn()) return;
    const entry = {
      t: _now(),
      who: (meta && meta.who) || 'unknown',
      keys: keys || [],
      note: (meta && meta.note) || '',
    };
    _changeLog.push(entry);
    if (_changeLog.length > LOG_MAX) _changeLog = _changeLog.slice(-LOG_MAX);
    try { console.debug('[state]', entry.who, entry.keys.join(','), entry.note); }
    catch (_) {}
  }

  function _readState() {
    return (typeof S !== 'undefined' && S) ? S : null;
  }

  function _replaceState(next, meta) {
    if (typeof S === 'undefined') {
      throw new Error('stateStore.setState: global S not declared');
    }
    S = next;
    _logChange(meta || { who: 'setState', note: 'replace' }, ['*']);
    return S;
  }

  function _applyPatch(partial, meta) {
    const target = (meta && meta.target) || _readState();
    if (!target || !partial || typeof partial !== 'object') return target;
    const keys = Object.keys(partial);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      target[k] = partial[k];
    }
    _logChange(meta || { who: 'patchState' }, keys);
    return target;
  }

  function _writeCrashSnapshot(tag, err) {
    try {
      const s = _readState();
      const payload = {
        t: _now(),
        tag: String(tag || 'err'),
        msg: String((err && err.message) || err || 'unknown'),
        stack: (err && err.stack) ? String(err.stack).slice(0, 2000) : '',
        team: s && s.teamName,
        season: s && s.season,
        phase: s && s.phase,
        day: s && s.day,
        mode: s && s.mode,
        state: null,
      };
      try {
        if (typeof serializeForSave === 'function') payload.state = serializeForSave(s);
        else payload.state = JSON.stringify(s);
      } catch (_) {
        try { payload.state = JSON.stringify({ teamName: s && s.teamName, phase: s && s.phase }); }
        catch (__ ) { payload.state = null; }
      }
      const raw = JSON.stringify(payload);
      localStorage.setItem(CRASH_KEY, raw);
      try { localStorage.setItem(CRASH_KEY + '_' + _now(), raw); } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }

  function _readCrashSnapshot() {
    try {
      const raw = localStorage.getItem(CRASH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function _clearCrashSnapshot() {
    try { localStorage.removeItem(CRASH_KEY); } catch (_) {}
  }

  function _freezeStatics(objs) {
    (objs || []).forEach(function (o) {
      if (o && typeof o === 'object') {
        try { Object.freeze(o); } catch (_) {}
      }
    });
  }

  return {
    getState: _readState,
    setState: _replaceState,
    patchState: _applyPatch,
    logChange: _logChange,
    changeLog: function () { return _changeLog.slice(); },
    clearChangeLog: function () { _changeLog = []; },
    writeCrashSnapshot: _writeCrashSnapshot,
    readCrashSnapshot: _readCrashSnapshot,
    clearCrashSnapshot: _clearCrashSnapshot,
    freezeStatics: _freezeStatics,
    traceOn: _traceOn,
    CRASH_KEY: CRASH_KEY,
    TRACE_KEY: TRACE_KEY,
  };
})();

/* 便捷全局门面（与旧代码并存，不强制替换） */
function getState() { return StateStore.getState(); }
function setState(next, meta) { return StateStore.setState(next, meta); }
function patchState(partial, meta) { return StateStore.patchState(partial, meta); }
function writeCrashSnapshot(tag, err) { return StateStore.writeCrashSnapshot(tag, err); }

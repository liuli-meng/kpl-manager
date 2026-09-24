/* gameLog — 分类游戏日志（Phase1）
 * 与 s.eventLog（玩家可见时间线）分离：这里是工程排查日志（AI 操作/状态变更/异常）。
 * 环形缓冲，可导出；生产默认只记 warn+，km_trace=1 时全量。
 */
const gameLog = (function () {
  const MAX = 200;
  let buf = [];
  let verbose = null;

  function isVerbose() {
    if (verbose === null) {
      try {
        verbose = (function(){try{return typeof StateStore !== 'undefined' && StateStore.traceOn();}catch(e){return false;}})() ||
          localStorage.getItem('km_trace') === '1';
      } catch (_) { verbose = false; }
    }
    return verbose;
  }

  function push(cat, msg, data, level) {
    const lv = level || 'info';
    if (!isVerbose() && lv === 'info') return;
    buf.push({
      t: Date.now(),
      cat: String(cat || 'sys'),
      msg: String(msg || ''),
      level: lv,
      data: data === undefined ? null : tryJson(data),
    });
    if (buf.length > MAX) buf = buf.slice(-MAX);
  }

  function tryJson(v) {
    try { return JSON.parse(JSON.stringify(v)); }
    catch (_) { return String(v); }
  }

  return {
    info: function (cat, msg, data) { push(cat, msg, data, 'info'); },
    warn: function (cat, msg, data) { push(cat, msg, data, 'warn'); },
    error: function (cat, msg, data) { push(cat, msg, data, 'error'); },
    ai: function (msg, data) { push('ai', msg, data, 'info'); },
    transfer: function (msg, data) { push('transfer', msg, data, 'info'); },
    match: function (msg, data) { push('match', msg, data, 'info'); },
    board: function (msg, data) { push('board', msg, data, 'info'); },
    dump: function () { return buf.slice(); },
    clear: function () { buf = []; },
    exportText: function () {
      return buf.map(function (e) {
        return new Date(e.t).toISOString() + ' [' + e.level + '][' + e.cat + '] ' + e.msg +
          (e.data ? ' ' + JSON.stringify(e.data) : '');
      }).join('\n');
    },
  };
})();

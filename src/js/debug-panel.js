/* debug-panel — Phase4 轻量调试面板
 * 默认关闭；localStorage km_debug=1（或 URL ?km_debug=1）时才挂载。
 * 只读展示：档状态摘要 / gameLog / 崩溃快照 / __errLog / StateStore 变更环。
 * 不写业务状态、不进平衡门禁路径；生产可随包分发，玩家误开也只是多一块浮层。
 */
const DebugPanel = (function () {
  const KEY = 'km_debug';
  let _on = false;
  let _el = null;

  function enabled() {
    try {
      if (localStorage.getItem(KEY) === '1') return true;
      if (typeof location !== 'undefined' && /[?&]km_debug=1/.test(location.search || '')) return true;
    } catch (_) {}
    return false;
  }

  function _txt(v) {
    if (v == null) return '—';
    try { return typeof v === 'string' ? v : JSON.stringify(v); }
    catch (_) { return String(v); }
  }

  function _stateSummary() {
    const s = (typeof getState === 'function' && getState()) || (typeof S !== 'undefined' ? S : null);
    if (!s) return '<div class="dim">（无档）</div>';
    const b = s.board || {};
    /* 读档完整性：_migErr 以前只写不读（全仓唯一读者是测试），_lastAudit 同样。
       这两条是「存档静默损坏」的唯一线索，必须能在面板上直接看到。 */
    const mig = s._migErr ? '<span class="red">' + _txt(s._migErr) + '</span>' : '<span class="green">无</span>';
    const issues = (s._lastAudit && s._lastAudit.issues && s._lastAudit.issues.length) ? s._lastAudit.issues.length : 0;
    return '<table class="dbg-tbl">' +
      '<tr><td>队名</td><td>' + _txt(s.teamName) + '</td></tr>' +
      '<tr><td>身份</td><td>' + _txt(s.mode || 'manager') + '</td></tr>' +
      '<tr><td>赛季/日</td><td>' + _txt(s.season) + ' / ' + _txt(s.day) + '</td></tr>' +
      '<tr><td>阶段</td><td>' + _txt(s.phase) + ' · ' + _txt(s.split) + '</td></tr>' +
      '<tr><td>资金</td><td>' + _txt(s.fund) + '</td></tr>' +
      '<tr><td>信任度</td><td>' + _txt(b.trust) + (b.fired ? ' · 已解约' : '') + '</td></tr>' +
      '<tr><td>名单</td><td>' + ((s.players && s.players.length) || 0) + ' 人 · 首发 ' + ((s.lineup && s.lineup.length) || 0) + '</td></tr>' +
      '<tr><td>读档完整性</td><td>' + mig + '</td></tr>' +
      '<tr><td>结构审计</td><td>' + (issues ? '<span class="red">' + issues + ' 项</span>' : '<span class="green">0 项</span>') + '</td></tr>' +
      '</table>';
  }

  function _logList(items, fmt) {
    if (!items || !items.length) return '<div class="dim">（空）</div>';
    return '<pre class="dbg-pre">' + items.slice(-40).map(fmt).join('\n') + '</pre>';
  }

  function render() {
    if (!_el) return;
    const logs = (typeof gameLog !== 'undefined' && gameLog.dump) ? gameLog.dump() : [];
    const crash = (typeof StateStore !== 'undefined' && StateStore.readCrashSnapshot) ? StateStore.readCrashSnapshot() : null;
    const changes = (typeof StateStore !== 'undefined' && StateStore.changeLog) ? StateStore.changeLog() : [];
    const errs = (typeof window !== 'undefined' && window.__errLog) ? window.__errLog : [];

    _el.innerHTML =
      '<div class="dbg-hd"><b>调试面板</b>' +
      '<span class="dim" style="margin-left:8px;font-size:11px">km_debug=1</span>' +
      '<button class="btn sm" style="float:right" onclick="DebugPanel.hide()">关闭</button></div>' +
      '<div class="dbg-sec"><b>档状态</b>' + _stateSummary() + '</div>' +
      '<div class="dbg-sec"><b>异常 __errLog</b>' +
        _logList(errs, e => new Date(e.t).toISOString().slice(11, 19) + ' [' + e.tag + '] ' + e.m) +
      '</div>' +
      '<div class="dbg-sec"><b>崩溃快照</b>' +
        (crash
          ? '<pre class="dbg-pre">' + _txt({ t: crash.t, tag: crash.tag, msg: crash.msg, team: crash.team, phase: crash.phase, day: crash.day })
            + (crash.state ? '\n（含完整存档快照，可恢复）' : '\n（无存档内容）') + '</pre>' +
            (crash.state ? '<button class="btn sm" onclick="DebugPanel.restoreCrash()">恢复此快照</button>' : '')
          : '<div class="dim">（无）</div>') +
        '<button class="btn sm" onclick="DebugPanel.clearCrash()">清除快照</button>' +
      '</div>' +
      '<div class="dbg-sec"><b>gameLog（近 40）</b>' +
        _logList(logs, e => new Date(e.t).toISOString().slice(11, 19) + ' [' + e.level + '][' + e.cat + '] ' + e.msg) +
        '<button class="btn sm" onclick="DebugPanel.exportLog()">导出日志</button>' +
      '</div>' +
      '<div class="dbg-sec"><b>stateStore 变更环</b>' +
        _logList(changes, e => new Date(e.t).toISOString().slice(11, 19) + ' ' + e.who + ' ' + (e.keys || []).join(',') + ' ' + (e.note || '')) +
      '</div>';
  }

  function mount() {
    if (_el || typeof document === 'undefined') return;
    _el = document.createElement('div');
    _el.id = 'km-debug-panel';
    _el.style.cssText = [
      'position:fixed', 'right:8px', 'bottom:64px', 'width:min(360px,92vw)', 'max-height:55vh',
      'overflow:auto', 'z-index:9998', 'background:rgba(20,24,32,.96)', 'color:#e8ecf4',
      'border:1px solid rgba(232,195,74,.35)', 'border-radius:10px', 'padding:10px 12px',
      'font:12px/1.5 ui-monospace,Consolas,monospace', 'display:none',
      'box-shadow:0 8px 28px rgba(0,0,0,.45)'
    ].join(';');
    document.body.appendChild(_el);
    // 内联最小样式类
    if (!document.getElementById('km-debug-style')) {
      const st = document.createElement('style');
      st.id = 'km-debug-style';
      st.textContent = [
        '#km-debug-panel .dbg-hd{margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(232,195,74,.2)}',
        '#km-debug-panel .dbg-sec{margin:10px 0}',
        '#km-debug-panel .dbg-pre{white-space:pre-wrap;word-break:break-all;max-height:140px;overflow:auto;background:rgba(0,0,0,.25);padding:6px;border-radius:6px;margin:4px 0}',
        '#km-debug-panel .dbg-tbl td{padding:1px 6px 1px 0;vertical-align:top}',
        '#km-debug-panel .dbg-tbl td:first-child{color:#b8a88a;white-space:nowrap}',
        '#km-debug-panel .dim{color:#8a93a6}',
        '#km-debug-panel .btn{cursor:pointer;border:1px solid rgba(232,195,74,.3);background:transparent;color:#e8c34a;border-radius:6px;padding:2px 8px;margin:2px 4px 2px 0;font-size:11px}',
        '#km-debug-panel .btn:hover{background:rgba(232,195,74,.15)}'
      ].join('');
      document.head.appendChild(st);
    }
    render();
    _el.style.display = 'block';
    _on = true;
  }

  return {
    enabled: enabled,
    isOn: function () { return _on; },
    show: function () { mount(); if (_el) { render(); _el.style.display = 'block'; _on = true; } },
    hide: function () { if (_el) _el.style.display = 'none'; _on = false; },
    toggle: function () { if (_on) this.hide(); else this.show(); },
    refresh: render,
    clearCrash: function () {
      try { if (typeof StateStore !== 'undefined') StateStore.clearCrashSnapshot(); } catch (_) {}
      render();
    },
    /* 崩溃快照以前只有「写」没有「读」：stateStore 里存了整份序列化存档（payload.state），
       却只在面板上显示元信息，玩家拿不回来。这里接上真实导入链路（applyImport：
       清洗 → 解包 → 版本校验 → 迁移 → 落盘），成功后照常覆盖当前槽。 */
    restoreCrash: function () {
      try {
        const crash = (typeof StateStore !== 'undefined' && StateStore.readCrashSnapshot) ? StateStore.readCrashSnapshot() : null;
        if (!crash || !crash.state) { alert('快照里没有可恢复的存档内容'); return; }
        const raw = typeof crash.state === 'string' ? crash.state : JSON.stringify(crash.state);
        if (typeof applyImport !== 'function') { alert('当前环境不支持恢复（applyImport 缺失）'); return; }
        if (!confirm('用崩溃快照（' + new Date(crash.t).toLocaleString() + ' · ' + (crash.team || '未知队') + '）覆盖当前进度？')) return;
        applyImport(JSON.parse(raw), '崩溃快照');
        render();
      } catch (e) {
        try { alert('恢复失败：' + ((e && e.message) || e)); } catch (_) {}
      }
    },
    exportLog: function () {
      try {
        const text = (typeof gameLog !== 'undefined' && gameLog.exportText) ? gameLog.exportText() : '';
        const blob = new Blob([text || '(empty)'], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'km-gamelog-' + Date.now() + '.txt';
        a.click();
      } catch (_) {}
    },
    boot: function () {
      if (!enabled()) return;
      // DOM 就绪后再挂；沙箱/无 body 环境静默跳过
      try {
        if (document.body) mount();
        else document.addEventListener('DOMContentLoaded', mount);
      } catch (_) {}
    },
  };
})();

// 自动引导：默认关闭，开了 km_debug 才挂
try { DebugPanel.boot(); } catch (_) {}

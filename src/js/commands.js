/* commands — 领域动作 Command 包装（Phase2）
 * 目的：把「校验 → 改状态 → 副作用 → 变更摘要」收成可测入口；
 * 不追求撤销/回放，不引入事件总线。旧函数仍是内部实现，本文件只做门面。
 *
 * 每条 Command 返回：
 *   {ok, name, skipped?, reason?, summary?}
 */
const Commands = (function () {
  function _ok(name, summary) {
    try { if (typeof gameLog !== 'undefined') gameLog.info('cmd', name, summary || null); } catch (_) {}
    return { ok: true, name: name, summary: summary || null };
  }
  function _skip(name, reason) {
    try { if (typeof gameLog !== 'undefined') gameLog.warn('cmd', name + ' skipped: ' + reason); } catch (_) {}
    return { ok: false, skipped: true, name: name, reason: reason };
  }

  /** 推进一天（日结） */
  function nextDayCommand(s) {
    s = s || (typeof getState === 'function' ? getState() : null);
    if (!s) return _skip('nextDay', 'no-state');
    if (s.board && s.board.fired) return _skip('nextDay', 'board-fired');
    const dayBefore = s.day;
    if (typeof nextDayStep === 'function') nextDayStep(s);
    else if (typeof nextDay === 'function') nextDay(s);
    else return _skip('nextDay', 'impl-missing');
    if (typeof save === 'function') { try { save(); } catch (e) {} }
    if (typeof renderAll === 'function') { try { renderAll(); } catch (e) {} }
    return _ok('nextDay', { day: dayBefore + '→' + s.day, fund: s.fund });
  }

  /** 推进赛段（常规赛轮次） */
  function advancePhaseCommand(s) {
    s = s || (typeof getState === 'function' ? getState() : null);
    if (!s) return _skip('advancePhase', 'no-state');
    const from = s.phase;
    if (typeof advancePhase !== 'function') return _skip('advancePhase', 'impl-missing');
    // 仅允许从常规赛轮次推进
    if (!['r1', 'r2', 'r3'].includes(from)) return _skip('advancePhase', 'not-in-round:' + from);
    advancePhase(s);
    return _ok('advancePhase', { from: from, to: s.phase });
  }

  /** 结算系列赛（包装 finishSeries，便于统一日志） */
  function finishSeriesCommand(finalWin) {
    if (typeof finishSeries !== 'function') return _skip('finishSeries', 'impl-missing');
    const s = (typeof getState === 'function' ? getState() : null);
    const meta = s && s.series ? { mw: s.series.mw, ow: s.series.ow, max: s.series.max } : null;
    finishSeries(!!finalWin);
    return _ok('finishSeries', { win: !!finalWin, before: meta });
  }

  /** AI 转会窗（开赛前整联盟买卖） */
  function aiTransferWindowCommand(s) {
    s = s || (typeof getState === 'function' ? getState() : null);
    if (!s) return _skip('aiTransferWindow', 'no-state');
    if (typeof aiTransferWindow !== 'function') return _skip('aiTransferWindow', 'impl-missing');
    aiTransferWindow(s);
    return _ok('aiTransferWindow', null);
  }

  /** 结束转会期 */
  function endTransferWindowCommand(s) {
    s = s || (typeof getState === 'function' ? getState() : null);
    if (!s) return _skip('endTransferWindow', 'no-state');
    if (typeof denyIfBlocked === 'function' && denyIfBlocked('endTransferWindow', s)) {
      return _skip('endTransferWindow', 'denied');
    }
    if (typeof endTransferWindow !== 'function') return _skip('endTransferWindow', 'impl-missing');
    endTransferWindow(s);
    return _ok('endTransferWindow', null);
  }

  return {
    nextDay: nextDayCommand,
    advancePhase: advancePhaseCommand,
    finishSeries: finishSeriesCommand,
    aiTransferWindow: aiTransferWindowCommand,
    endTransferWindow: endTransferWindowCommand,
  };
})();

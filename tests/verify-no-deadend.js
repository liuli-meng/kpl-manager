// ⚠ 诊断脚本，**未挂进 npm test**：它现在会产生假红，别把它的结论当门禁用。
//    已确认可信：player 模式（2 赛季 · 覆盖 r1/r2/r3/card/playoff/champion/挑杯/EWC/亚运/年总，无死锁）。
//    已知假红：manager / coach 会在 3001 步内跑不满 2 赛季——审计阶段用 JSON 往返还原 S，
//    对这两条身份路径有副作用（丢 undefined/函数型字段 + 激活页顺序变化），驱动因此原地打转。
//    真正钉住这轮两个 bug 的是 tests/verify-playoff-entry.js（8 项断言，已做反向验证）。
//    要修的方向：还原时改用逐字段 diff 或直接每轮重建沙箱，而不是 JSON.parse 回写 S。
//    2026-09-19 追记：本探针报的「亚运推进赛程前两次点击静默无反馈」是**它自己的假红**——
//    签名里的 eventLog.length 被 slice(0,200) 封顶，长局里恒为 200，而这两次点击只结算 QF/SF
//    （只写日志与对阵表，day/phase 都不动）。签名现已补上「最新日志文本 + 四类杯赛对阵进度」；
//    实测正常点击为 6→10→12 条日志、对阵逐轮补齐。真正会静默的只有一种：S.ag 结构丢失
//    （现在 uiAsiadStep 会 toast 说明，由 tests/verify-coach-mode.js ⑧ 钉住）。
// 「游戏状态必须持续推进」不变量门禁
// ─────────────────────────────────────────────────────────────
// 为什么要它：这轮之前的门禁全是"引擎能不能跑完"，而玩家真正遇到的是
// 「按钮在、点了没反应」和「弹窗里一个按钮都没有」。这类死锁不抛异常，
// console 零报错也照样锁死——所以断言必须落在**状态推进**上，而不是"有没有报错"。
//
// 不变量（三身份各自跑 2 个赛季）：
//   ① 弹窗打开时，玩家只能对弹窗做事；弹窗内必须至少有一个 <button>
//   ② 每步从"当前真能点"的 onclick 里试，试完必须让**游戏状态签名**变化
//   ③ 连续 STUCK 步状态签名不变 = 死锁/空转，报红并 dump 现场
// 注意两个曾经踩过的假结果：
//   · 扫全部页面的缓存 innerHTML 会把已消失的按钮算成出口（renderAll 只重写激活页）
//   · 把"弹窗内容长度变了"当进度，会让"反复重开赛前面板"看起来像在推进（空转）
// 运行：node tests/verify-no-deadend.js [--mode=manager|player|coach] [--seasons=2] [--max=4000]
const vm = require('vm');
const { makeDom } = require('./harness');

const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a && a.split('=')[1]; };
const ONLY = arg('mode');
const SEASONS = +(arg('seasons') || 2);
const MAX = +(arg('max') || 4000);
const STUCK = +(arg('stuck') || 12);          // 连续多少步状态纹丝不动判死
const PAGES = ['club', 'league', 'market', 'lineup', 'train', 'kjia', 'union', 'hall', 'biz', 'career'];
// 纯装饰/导航噪声：点了不改变任何竞技状态。名单要**尽量窄**——
// 宽了会把真出口误杀：'setSide' 曾被当噪声，而它是 KPL「败方选边」的必经一步，
// 结果把正常流程误报成死锁（假红）。BP 相关（bpPickPos/bpBackToTo/bpAuto…）一律不算噪声。
const NOISE = /^(goPage|closeModal|shareHonorCard|shareCareerCard|copySave|exportSave|togglePanel|pfold|setSort|sortMarket|setTab|dismissHint|hideHint|setPanelCollapsed|renderEraBtns|noop)\b/;

function makeSandbox() {
  const { dom } = makeDom();
  // 桩元素按选择器**懒创建**，patch 时缓存还是空的：必须包住取值函数，在元素第一次
  // 被取出的一刻把 classList 换成有状态的，否则后创建的元素仍是空壳（踩过）。
  const upgrade = el => {
    if (!el || el.__stateful) return el;
    el.__stateful = true;
    const set = new Set();
    el.classList = {
      add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; on ? set.add(c) : set.delete(c); return on; },
      contains: c => set.has(c), _set: set,
    };
    return el;
  };
  const raw = dom.document;
  ['getElementById', 'querySelector', 'createElement'].forEach(k => {
    if (typeof raw[k] !== 'function') return;
    const orig = raw[k].bind(raw);
    raw[k] = (...a) => upgrade(orig(...a));
  });
  return { dom };
}
// 只看游戏状态：日期/赛段/轮次/系列赛进度/阵容/资金/荣誉…（刻意不含弹窗内容长度）
// 必须包含 window._draft：BP 选人在"确定出战"之前只写 _draft，不碰 S——
// 早先版本没算它，导致在 BP 面板里正常点 12 步被判成空转（假红）。
// 也必须包含杯赛对阵进度：亚运「推进赛程」前两次点击只结算 QF/SF（phase 仍是 asiad、day 不动），
// 而 eventLog 用 unshift+slice(0,200) 封顶——长局里长度恒为 200，早先版本因此把两次正常点击报成
// 「静默无反馈」的假红（2026-09-19 实测：6→10→12 条日志、对阵表逐轮补齐，只是签名看不见）。
// 顺带把 eventLog 换成「长度 + 最新一条前 30 字」，封顶后仍能分辨「真推进」与「真原地不动」。
const stateSig = dom => vm.runInContext(`JSON.stringify([S.day,S.season,S.phase,S.stage,S.split,
  Math.round(S.fund),S.players.length,S.lineup.length,S.series?1:0,S.series?S.series.mw:0,S.series?S.series.ow:0,
  S.matchIdx,(S.playoff&&S.playoff.final&&S.playoff.final.r)||'',S.champion?1:0,S.eliminated?S.eliminated.length:0,
  Object.keys(S.achieved||{}).length,(S.eventLog||[]).length,((S.eventLog||[])[0]||{}).txt?String(((S.eventLog||[])[0]||{}).txt).slice(0,30):'',S.board&&S.board.fired?1:0,
  (function(){const c=[];['challenger','ewc','ag','annual'].forEach(k=>{const o=S[k];if(o)c.push(k+(o.champ?'!'+o.champ:
    ':'+['qf','sf','wb1','lb1','wf','final','rounds','brk'].reduce((n,rr)=>{const v=o[rr];
      return n+(Array.isArray(v)?v.filter(x=>x&&x.r).length:(v&&v.r)?1:0);},0)));});return c.join('/');})(),
  window._draft?['d'+window._draft.idx,'p'+Object.keys(window._draft.myPicks||{}).length,'b'+(window._draft.myBans||[]).length].join('_'):'nodraft'])`, dom);
const modalState = dom => vm.runInContext(`(function(){
  const ids=['app-modal','start-modal'].filter(id=>document.getElementById(id).classList.contains('on'));
  return {ids, body:id=>document.getElementById(id+'-body').innerHTML||''};
})()`, dom);

// 收集"此刻真能点"的 onclick：弹窗开着就只看弹窗（真人被模态挡住），否则逐页强制重渲染后再看
function candidates(dom) {
  return vm.runInContext(`(function(){
    const PAGES=${JSON.stringify(PAGES)}, NOISE=${NOISE.toString()};
    const re=/onclick="([^"]+)"/g;
    const grab=html=>{const o=[];let m;while((m=re.exec(html)))o.push(m[1]);return o;};
    // 噪声判定要看**整条语句**：'closeModal(...);openBP(...)' 以 closeModal 开头，
    // 但它才是真正的推进入口（赛前面板的「进入 BP」）——按前缀滤会把它误杀（踩过）。
    const ADV=/\b(uiNextDay|uiDoNextAction|uiStartMatch|uiEndPreseason|uiSkipTransfer|startCard|startPlayoff|uiStartCup|uiAdvanceCalendar|uiFinishAnnual|uiAsiadStep|startPlayerMatch|closeMatchContinue|uiNoGoEmergency|uiNoGoDefer|openBP|setSide|playGame|bpConfirm)\b/;
    const isAdv=c=>ADV.test(c);
    const isNoise=c=>c.split(';').map(x=>x.trim()).filter(Boolean).every(seg=>NOISE.test(seg));
    const keep=a=>[...new Set(a)].filter(c=>c.indexOf('(')>=0&&!isNoise(c));
    const ms=['app-modal','start-modal'].filter(id=>document.getElementById(id).classList.contains('on'));
    if(ms.length){
      let out=[]; ms.forEach(id=>out=out.concat(grab(document.getElementById(id+'-body').innerHTML||'')));
      const kept=keep(out);
      // 信息型弹窗（选手档案/规则说明）只有一个「关闭」——真人关掉就继续，不算死锁。
      // 早先版本把它判成"没有推进入口"，是假红。
      if(!kept.length&&out.length) return {from:'modal-dismiss:'+ms.join(','), calls:out, adv:[], dismissOnly:true, raw:out};
      return {from:'modal:'+ms.join(','), calls:kept, adv:kept.filter(isAdv), raw:out, 弹窗正文:(document.getElementById(ms[0]+'-body').innerHTML||'').slice(0,600)};
    }
    const active=(typeof MODE_PAGES!=='undefined'&&MODE_PAGES[S.mode])||PAGES;
    let out=[];
    for(const p of PAGES){
      if(active.indexOf(p)<0)continue;
      const el=document.getElementById('page-'+p); if(!el)continue;
      try{ goPage(p); }catch(e){ continue; }
      el.innerHTML='';                       // 丢掉上一轮的陈旧 HTML
      try{ renderPage(p); }catch(e){ continue; }
      out=out.concat(grab(el.innerHTML||''));
    }
    return {from:'pages', calls:keep(out), adv:keep(out).filter(isAdv), raw:out};
  })()`, dom);
}

function startMode(dom, mode) {
  vm.runInContext(`(function(){
    ${JSON.stringify(mode) === '"manager"' ? `const e=document.getElementById('new-team-name'); e.value='扫描队'; createTeam();` : ''}
    ${JSON.stringify(mode) === '"player"' ? `const e=document.getElementById('pc-name'); e.value='扫描仔'; _pcTeam=CLUB_TEMPLATES[0].name; window._pcTeams=[CLUB_TEMPLATES[0]]; createPlayerCareer();` : ''}
    ${JSON.stringify(mode) === '"coach"' ? `_coachPick=0; applyCoachClub();` : ''}
    closeModal('start-modal'); closeModal('app-modal'); renderAll();
  })()`, dom);
}

const results = [];
for (const mode of (ONLY ? [ONLY] : ['manager', 'player', 'coach'])) {
  const { dom } = makeSandbox();
  let dead = null, iter = 0, lastSig = null, stuck = 0, closed = 0;
  const visited = new Set();   // 覆盖率凭据：这一局真的走过哪些赛段
  try { startMode(dom, mode); } catch (e) { results.push({ mode, iters: 0, seasons: 0, dead: { kind: '开局即失败', err: e.message } }); continue; }
  const s0 = vm.runInContext('S.season', dom);

  while (iter++ < MAX) {
    if (vm.runInContext('S.season', dom) - s0 >= SEASONS) break;
    vm.runInContext('try{renderAll()}catch(e){}', dom);
    visited.add(vm.runInContext('S.phase', dom));

    // ① 弹窗开着必须有按钮
    const ms = modalState(dom);
    if (ms.ids.length) {
      const body = vm.runInContext(`(document.getElementById(${JSON.stringify(ms.ids[0])}+'-body').innerHTML||'')`, dom);
      if (!/<button/.test(body)) { dead = { kind: '弹窗内无可点按钮（真人卡死）', iter, modal: ms.ids[0], 片段: body.slice(0, 200) }; break; }
    }

    const c = candidates(dom);
    if (c.dismissOnly) {   // 信息型弹窗（选手档案/规则说明）只有关闭按钮：关掉继续，不计空转
      for (const call of c.calls) { try { vm.runInContext('try{' + call + '}catch(e){}', dom); } catch (e) { } }
      continue;
    }
    if (!c.calls.length) { dead = { kind: '当前状态没有任何可点的推进入口（死锁）', iter, 来源: c.from, 原始onclick: (c.raw||[]).slice(0,10), 弹窗正文: c.弹窗正文, 状态: JSON.parse(stateSig(dom)) }; break; }

    const before = stateSig(dom), beforeModal = modalState(dom).ids.join(',');
    const observable = () => stateSig(dom) !== before || modalState(dom).ids.join(',') !== beforeModal;

    // ── 审计（与驱动分离）：此刻屏幕上每个「推进类」按钮都必须留下可观察后果。
    //    逐个试之前先快照 S、试完立刻还原——否则一轮里连点多个推进按钮会把节奏打乱
    //    （第一版就因此 3001 步跑不满一个赛季）。
    //    只断言"存在一条能用的出口"不够：反向验证过，把 uiDoNextAction('startPlayoff')
    //    的 bug 退回去，探针能从别的页面绕过去，"没有死锁"的结论就是假的，
    //    而那颗按钮在真人手里确实是死的。
    // 只在没有弹窗时做按钮审计：BP/赛前弹窗开着时点一下再还原，会把 _draft 与弹窗 HTML 弄成
    // 不一致的状态，驱动就困在"弹窗里全是失效按钮"里出不来（manager/coach 因此 3001 步跑不满赛季）
    if (!modalState(dom).ids.length) {
    const snap = vm.runInContext('JSON.stringify(S)', dom);
    const deadBtns = [];
    for (const call of (c.adv || [])) {
      try { vm.runInContext('try{' + call + '}catch(e){}', dom); } catch (e) { }
      if (!observable()) deadBtns.push(call);
      // 还原时必须把弹窗开合也复原：S 是数据、弹窗是 UI 状态，只还原 S 会把审计点开的弹窗
      // 留在原地，下一轮 candidates 就困在弹窗里追按钮（manager/coach 因此 3001 步跑不满赛季）
      vm.runInContext('S=JSON.parse(' + JSON.stringify(snap) + ');window._draft=null;', dom);
      const want = JSON.stringify(beforeModal ? beforeModal.split(',') : []);
      vm.runInContext(`['app-modal','start-modal'].forEach(id=>{const el=document.getElementById(id);
        el.classList[${want}.indexOf(id)>=0?'add':'remove']('on');});`, dom);
      vm.runInContext('try{renderAll()}catch(e){}', dom);
    }
    if (deadBtns.length) { dead = { kind: '推进类按钮点了毫无反应（死按钮）', iter, 死按钮: deadBtns.slice(0, 6), 状态: JSON.parse(stateSig(dom)), 来源: c.from }; break; }
    }

    // ── 驱动：挑一条真的改变状态的出口往前走
    let moved = false;
    for (const call of c.calls) {
      try { vm.runInContext('try{' + call + '}catch(e){}', dom); } catch (e) { }
      if (observable()) { moved = true; break; }
    }
    if (!moved) {
      stuck = stateSig(dom) === lastSig ? stuck + 1 : 0;
      lastSig = stateSig(dom);
      if (stuck >= STUCK) {
        dead = { kind: '连续 ' + STUCK + ' 轮所有出口都不改变游戏状态（死按钮 / 空转）', iter, 状态: JSON.parse(stateSig(dom)), 出口样本: c.calls.slice(0, 8), 来源: c.from, 弹窗: modalState(dom).ids };
        break;
      }
    } else { stuck = 0; closed = 0; lastSig = stateSig(dom); }
  }
  const done = vm.runInContext('S.season', dom) - s0;
  if (!dead && done < SEASONS) dead = { kind: '步数耗尽但未跑满 ' + SEASONS + ' 个赛季（推进效率异常）', iter, 完成赛季: done };
  results.push({ mode, iters: iter, seasons: done, dead, 走过赛段: [...visited].join(','), 末态: JSON.parse(stateSig(dom)) });
}

let bad = 0;
for (const r of results) {
  if (r.dead) { bad++; console.log(`[FAIL] ${r.mode}: 第 ${r.dead.iter} 轮 → ${r.dead.kind}`); console.log('   ' + JSON.stringify(r.dead, null, 1).split('\n').join('\n   ')); }
  else console.log(`[PASS] ${r.mode}: ${r.iters} 步 · 跨 ${r.seasons} 赛季 · 走过赛段 ${r.走过赛段}`);
}
if (bad) { console.log('[FAIL] 不变量门禁未通过'); process.exitCode = 1; }
else console.log('[PASS] 三身份状态推进不变量全部通过');

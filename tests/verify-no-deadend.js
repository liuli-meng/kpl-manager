// 三身份状态推进不变量门禁 —— **已挂进 npm test**（默认固定种子 424242 · 三身份各 2 赛季）
//
// 2026-09-20 用 --trace 重开这条探针，发现它上一版报的「manager/coach 空转=JSON 还原副作用」
// 是被四条自身缺陷挡住的错归因——每一条都足以让"红和绿都不能信"：
//   ① 推进类白名单 ADV 原先写在传给 vm 的模板字面量里 → 反斜杠-b 被模板解析成退格符，
//      正则永远匹配不到 → adv 恒为空 → 「每颗推进按钮都要留下可观察后果」的审计一次都没跑过。
//   ② 驱动把「只是开了个装饰弹窗」当成推进：manager/coach 的 club 页有 openCrestEdit()
//      （改队徽，选手档按 renderClub 的条件没有这颗），于是与弹窗里的 resetCrest() 来回弹。
//   ③ observable() 看不见「同一个 app-modal 容器换了面板」：点「进入 BP」把面板从
//      「赛前准备」换成「无法出战 · 阵容缺位」（ids 没变、状态签名没变）被判成空转。
//   ④ 审计用 S=JSON.parse(snap) 整体还原会切断别名：快照里 S.matches['po_胜者组决赛'] 与
//      S.playoff.wf 本是同一对象，往返后成两份 → m.r 写在副本上 → 对阵表永不推进，
//      coach 因此在 4001 轮里原地重派同一场（还原后补 rebuildMatchStore 才断根）。
//      注：当时"coach 卡季后赛"我一度判成引擎 bug，是拿同一局按玩家路径（不跑审计）打了一遍
//      才排除的——wf 待赛 → 记上胜者 → 总决赛 → 夺冠，三轮收敛、写回正常。
//
// 挂进门禁的资格（三条都要过，缺一条就还是诊断脚本）：
//   确定性：同种子连跑三次逐字节一致；
//   不是碰巧绿：另扫 12 个种子（1/42/999/777/31337/8080…）三身份均跑满 2 赛季无死锁；
//   能报红：把 uiStartMatch 掏空成"按钮还在、点了什么都不做"→ manager 第 9 轮、coach 第 1 轮
//            必报「推进类按钮点了毫无反应（死按钮）」，且固定种子下轮号可复现。
// 它抓不到的（不是漏判）：撤掉 uiDoNextAction 的字符串入参归一化仍全绿——现存调用点传的都是 S，
// 那行只是旧调用形式的防御，没有按钮会因此变死。排查偶发用 --seed=random / --seed=N / --trace。
// 另外别只靠它：本轮四条教练欠账是被 tests/verify-coach-mode.js（8 项，逐条退回都验过报红）
// 与 tests/sim-yearend.js 的教练档两档 ×8 年钉住的。

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
const { makeDom, seedMath } = require('./harness');

const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a && a.split('=')[1]; };
const ONLY = arg('mode');
const SEASONS = +(arg('seasons') || 2);
const MAX = +(arg('max') || 4000);
const STUCK = +(arg('stuck') || 12);          // 连续多少步状态纹丝不动判死
// 种子：默认固定 ⇒ 同一份代码必得同一条轨迹（这是把它挂进 npm test 的前提——
// 不带种子的探针当门禁只会带来偶发红）。排查偶发问题时用 --seed=random 或 --seed=<整数>。
const DEFAULT_SEED = 424242;
const SEED_ARG = arg('seed');
const RANDOM_SEED = SEED_ARG === 'random';
const SEED = RANDOM_SEED ? (Math.floor(Math.random() * 1e9) || 1) : (parseInt(SEED_ARG, 10) || DEFAULT_SEED);
// --trace：逐轮打「这一轮看到了哪些出口、哪个真的动了、状态简报」。
// 空转类问题只能这样看轨迹——光看末态会误判（探针自己就因签名饱和报过两次假红）。
const TRACE = process.argv.includes('--trace');
const PAGES = ['club', 'league', 'market', 'lineup', 'train', 'kjia', 'union', 'hall', 'biz', 'career'];
// 纯装饰/导航噪声：点了不改变任何竞技状态。名单要**尽量窄**——
// 宽了会把真出口误杀：'setSide' 曾被当噪声，而它是 KPL「败方选边」的必经一步，
// 结果把正常流程误报成死锁（假红）。BP 相关（bpPickPos/bpBackToTo/bpAuto…）一律不算噪声。
// 「推进类」出口白名单。⚠ 必须像 NOISE 一样以「值」传进沙箱：原先它直接写在传给 vm 的模板
// 字面量里，模板会先把反斜杠-b 解析成退格控制符（charCode 8），沙箱收到的正则永远匹配不到——
// 后果不是报错而是静默失效：adv 恒为空，「每颗推进类按钮都要留下可观察后果」的审计整轮没跑过，
// 驱动也没法优先走推进类出口（2026-09-20 --trace 实测：club 页候选里明明有 uiStartMatch()，adv数=0）。
const ADV = /\b(uiNextDay|uiDoNextAction|uiStartMatch|uiEndPreseason|uiSkipTransfer|startCard|startPlayoff|uiStartCup|uiAdvanceCalendar|uiFinishAnnual|uiAsiadStep|startPlayerMatch|closeMatchContinue|uiNoGoEmergency|uiNoGoDefer|openBP|setSide|playGame|bpConfirm)\b/;
const NOISE = /^(goPage|closeModal|shareHonorCard|shareCareerCard|copySave|exportSave|togglePanel|pfold|setSort|sortMarket|setTab|dismissHint|hideHint|setPanelCollapsed|renderEraBtns|noop)\b/;

function makeSandbox() {
  const { dom } = makeDom();
  // 每个身份都用同一个种子重新起：这样 --mode=coach 单独跑出来的轨迹，与三身份连跑时
  // 那条 coach 轨迹逐轮一致（否则"复现 coach 第 617 轮"这件事要靠前面两个身份跑没跑过）
  seedMath(dom, SEED);
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
// 弹窗身份：同一个 #app-modal 容器会从「赛前准备」换成「无法出战 · 阵容缺位」——
// ids 不变、状态签名也不变，早先的 observable() 因此看不见这一步正常推进，
// 把「点进入 BP 弹出缺位四条出口」连续 12 轮报成空转（2026-09-20 取证：手动点确实换了面板）。
// 判据用「标题 + 排序后的按钮集合」而不是内容长度：反复重开同一个面板 → 身份不变 → 仍算空转，
// 这正是上一版「拿长度当进度」把「反复重开赛前面板」误判成推进的那个坑的镜像。
// 正则一律写在 Node 侧：模板字面量会把 \s 吃成 s、\b 吃成退格（本项目已因此静默失效过一次）。
const modalSig = dom => {
  const ms = modalState(dom);
  if (!ms.ids.length) return 'none';
  const body = ms.body(ms.ids[0]) || '';
  const h2 = (body.match(/<h2[^>]*>([一-龥A-Za-z0-9 ·\s]*?)<\/h2>/) || [, ''])[1]
    .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 48);
  const btns = (body.match(/onclick="([^"]+)"/g) || []).map(x => x.slice(9, -1)).sort().join('|').slice(0, 400);
  return ms.ids.join(',') + '#' + h2 + '#' + btns;
};

// 收集"此刻真能点"的 onclick：弹窗开着就只看弹窗（真人被模态挡住），否则逐页强制重渲染后再看
function candidates(dom) {
  return vm.runInContext(`(function(){
    const PAGES=${JSON.stringify(PAGES)}, NOISE=${NOISE.toString()}, ADV=${ADV.toString()};
    const re=/onclick="([^"]+)"/g;
    const grab=html=>{const o=[];let m;while((m=re.exec(html)))o.push(m[1]);return o;};
    // 噪声判定要看**整条语句**：'closeModal(...);openBP(...)' 以 closeModal 开头，
    // 但它才是真正的推进入口（赛前面板的「进入 BP」）——按前缀滤会把它误杀（踩过）。
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

// ── trace 用的一行简报（--trace 时逐轮打出来）：空转的真相全在 day/phase/系列赛进度三元组里
const brief = dom => vm.runInContext(`[S.day,S.season,S.split,S.phase,S.preseason?1:0,S.matchIdx,
  (S.series?S.series.stage+' '+(S.series.mw||0)+':'+(S.series.ow||0)+' max'+(S.series.max||0):'-'),
  S.lineup.length,(S.playoff&&S.playoff.final&&S.playoff.final.r)||'',S.challenger?1:0,S.ewc?1:0,
  S.ag&&!S.ag.champ?1:0,S.annual&&S.annual.po&&S.annual.po.champ?1:0].join(' ')`, dom);

const results = [];
for (const mode of (ONLY ? [ONLY] : ['manager', 'player', 'coach'])) {
  const { dom } = makeSandbox();
  let dead = null, iter = 0, lastSig = null, stuck = 0, closed = 0;
  const banned = new Set();   // 只开装饰弹窗的按钮：拉黑，避免驱动在页面↔弹窗之间来回弹
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

    const before = stateSig(dom), beforeModal = modalState(dom).ids.join(','), beforeSigM = modalSig(dom);
    const observable = () => stateSig(dom) !== before || modalState(dom).ids.join(',') !== beforeModal || modalSig(dom) !== beforeSigM;

    // ── 审计（与驱动分离）：此刻屏幕上每个「推进类」按钮都必须留下可观察后果。
    //    逐个试之前先快照 S、试完立刻还原——否则一轮里连点多个推进按钮会把节奏打乱
    //    （第一版就因此 3001 步跑不满一个赛季）。
    //    只断言"存在一条能用的出口"不够：反向验证过，把 uiDoNextAction('startPlayoff')
    //    的 bug 退回去，探针能从别的页面绕过去，"没有死锁"的结论就是假的，
    //    而那颗按钮在真人手里确实是死的。
    // 只在没有弹窗时做按钮审计：BP/赛前弹窗开着时点一下再还原，会把 _draft 与弹窗 HTML 弄成
    // 不一致的状态，驱动就困在"弹窗里全是失效按钮"里出不来（manager/coach 因此 3001 步跑不满赛季）
    let deadBtns2 = 0;
    if (!modalState(dom).ids.length) {
    const snap = vm.runInContext('JSON.stringify(S)', dom);
    const deadBtns = [];
    for (const call of (c.adv || [])) {
      try { vm.runInContext('try{' + call + '}catch(e){}', dom); } catch (e) { }
      if (!observable()) deadBtns.push(call);
      // 还原时必须把弹窗开合也复原：S 是数据、弹窗是 UI 状态，只还原 S 会把审计点开的弹窗
      // 留在原地，下一轮 candidates 就困在弹窗里追按钮（manager/coach 因此 3001 步跑不满赛季）
      // 还原后必须重建 mid 索引：JSON 往返会把「同一对象的两个引用」拆成两份独立副本
      //   —— 快照里 S.matches['po_胜者组决赛'] 与 S.playoff.wf 本是同一个对象，stringify 写两遍、
      //   parse 回来就是两个东西。此后 finishSeries 按 getMatch(mid) 找到的那份写 m.r，
      //   活着的对阵表条目永远是 null ⇒ 同一场永远重开（coach 卡 4001 步的真因）。
      vm.runInContext('S=JSON.parse(' + JSON.stringify(snap) + ');window._draft=null;'
        + 'try{rebuildMatchStore(S);}catch(e){}', dom);
      const want = JSON.stringify(beforeModal ? beforeModal.split(',') : []);
      vm.runInContext(`['app-modal','start-modal'].forEach(id=>{const el=document.getElementById(id);
        el.classList[${want}.indexOf(id)>=0?'add':'remove']('on');});`, dom);
      vm.runInContext('try{renderAll()}catch(e){}', dom);
    }
    deadBtns2 = deadBtns.length;
    if (deadBtns.length) { dead = { kind: '推进类按钮点了毫无反应（死按钮）', iter, 死按钮: deadBtns.slice(0, 6), 状态: JSON.parse(stateSig(dom)), 来源: c.from }; break; }
    }

    // ── 驱动：先试推进类出口，再试其余。「只是开了一个不含任何推进出口的弹窗」不算推进——
    //    真人关掉就继续玩，探针却记成动了一步，于是 manager/coach 在 club 页那颗 openCrestEdit()
    //    （改队徽）与弹窗里的 resetCrest() 之间来回弹，4001 步跑不满一个赛季（--trace 实测）。
    //    player 档不空转纯属偶然：renderClub 只在非选手档渲染改队徽按钮。
    let moved = false, movedTo = '';
    const order = (c.adv || []).concat(c.calls.filter(x => (c.adv || []).indexOf(x) < 0));
    for (const call of order) {
      if (banned.has(call)) continue;
      try { vm.runInContext('try{' + call + '}catch(e){}', dom); } catch (e) { }
      if (!observable()) continue;
      const ms = modalState(dom);
      if (ms.ids.length) {
        const inner = candidates(dom);          // 弹窗开着 → 只看弹窗里的出口
        if (!inner.adv.length) {                // 装饰弹窗：关掉、记名，本轮不算推进
          vm.runInContext(`['app-modal','start-modal'].forEach(id=>{try{closeModal(id);}catch(e){}});try{renderAll()}catch(e){}`, dom);
          banned.add(call);
          continue;
        }
      }
      moved = true; movedTo = call.slice(0, 40); break;
    }
    if (TRACE) {
      const tried = c.calls.length, adv = (c.adv || []).length;
      console.log(`  r${String(iter).padStart(4)} ${brief(dom)} | 出口 ${tried}(推进类 ${adv}) 来源 ${c.from.slice(0, 22)} | ${moved ? '动: ' + movedTo : '不动'}` +
        (deadBtns2 ? ` | 死按钮 ${deadBtns2}` : ''));
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
else console.log('[PASS] 三身份状态推进不变量全部通过' + (RANDOM_SEED ? '（种子 ' + SEED + ' 随机）' : '（种子 ' + SEED + ' 固定，重跑必得同一轨迹）'));

// 下课出口门禁：钉住「待业 ≠ 生涯结束」这套出口，以及 fired 态经营入口的整页收口。
// 起因（2026-09-20 实测）：全仓 uiGuard() 只有 9 处调用，而 fired 态仍渲染出
//   market 页 9 颗经营按钮（buyPlayer×6 / listPlayer / openSellNego / refreshMarket）、
//   train 页 24 颗 doTrain、lineup 页 6 颗 openSellNego —— 真点下去 buyPlayer 会扣掉 93万、
//   名单 6→7、货架 6→5。同页横幅还写着「买卖/续约/开赛决定都不再经你的手」，文案与行为对冲。
// 判据（逐条都做过反向验证，见文件末 REVERSE）：
//   ① fired 态三页零经营 onclick，且渲染的是待业卡；
//   ② 解约那一次结算里就必须给出 ≥1 份再就业报价（推进入口全锁死，等下个年结＝永远等不到），
//      同时旧队当场官宣继任主帅——否则"董事会解约"在世界里不留痕迹；
//   ③ 接报价＝转会再就业：换队、清 fired、名单不翻倍、货架不含本队人、推进入口恢复；
//   ④ 投递简历在待业期恒能有回音（不能存在"没报价又走不了"的死局）；
//   ⑤ 挂印退役才是终局：careerEnd 落档、报价清空、推进与经营全锁、页面只剩另起新档；
//   ⑥ 引擎层必须保持无 UI 依赖：fired 下 nextDay/buyPlayer 直接调用照旧生效——
//      平衡门禁（sim/sim-quick/fuzz）靠这条驱动数值，别把守卫下沉到引擎里去"补漏"。
// 运行：node tests/verify-fired-exit.js
const vm = require('vm');
const { makeDom, seedMath } = require('./harness');

const errors = [];
const check = (c, m) => { if (!c) errors.push(m); };

// 固定种子：报价池与名宿抽取用随机，结构断言虽不依赖具体队名，仍钉住种子保证三次逐字节一致
const boot = (mode) => {
 const { dom } = makeDom();
 seedMath(dom, 424242);
 vm.runInContext(`(function(){
  S=newState('下课探针队','x');fillRoster(S,'mid');
  S.coach=JSON.parse(JSON.stringify(COACH_POOL.find(c=>c.id==='co12')));
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=400;initGroups(S);
  S.mode=${JSON.stringify(mode || 'manager')};
  S.preseason=true;S.transferWindow=7;S.day=1;S.fund=4000;
  buildTransferMarket(S);refreshMarket(S,{seed:true});
  // 挂牌/出售必须用非首发（listPlayer 对首发直接 return），补一个板凳位
  const u=new Set(S.players.map(p=>p.name));
  const bench=genPlayer(genFreeAgentDef('sup','mid',u));
  S.players.push(bench);S.benchId=bench.id;
  save=function(){};renderAll=function(){};
 })()`, dom);
 return dom;
};
const run = (dom, code) => vm.runInContext(code, dom);
const PAGE_OF = { market: 'page-market', train: 'page-train', lineup: 'page-lineup', club: 'page-club' };
const html = (dom, page) => {
 run(dom, `renderPage('${page === 'club' ? 'club' : page}')`);
 return vm.runInContext(`document.getElementById('${PAGE_OF[page] || 'page-' + page}').innerHTML||''`, dom);
};
// 经营/推进类 onclick 的判定面：与探针同一份清单，改按钮命名时两处一起看
const ACT = ['buyPlayer', 'listPlayer', 'delistPlayer', 'openSellNego', 'renewPlayer', 'doTrain',
 'doHeroTrain', 'refreshMarket', 'acceptOffer', 'tempSeatOffer', 'applyAcademy', 'signRetired', 'signCoach',
 'uiNextDay', 'uiStartMatch', 'uiSkipTransfer', 'uiEndPreseason', 'uiStartCup', 'uiAsiadStep', 'uiAdvanceCalendar', 'uiDoNextAction'];
const actionHits = (h) => {
 const hits = {};
 const parts = String(h).split('onclick=');
 for (let i = 1; i < parts.length; i++) {
  const seg = String(parts[i]).slice(0, 80);
  ACT.forEach(f => { if (seg.indexOf(f + '(') >= 0) hits[f] = (hits[f] || 0) + 1; });
 }
 return hits;
};
const count = o => Object.values(o).reduce((a, b) => a + b, 0);

// ── ① fired 态三页整页收口 ──────────────────────────────────────
{
 const dom = boot('manager');
 run(dom, `S.board.fired=true;S.board.firedSeason=S.season;S.jobOffers=genJobOffers(S);`);
 ['market', 'train', 'lineup'].forEach(p => {
  const h = html(dom, p);
  const hits = actionHits(h);
  check(count(hits) === 0, `① ${p} 页在 fired 态仍渲染经营/推进按钮：${JSON.stringify(hits)}`);
  check(/待业中|已离队/.test(h), `① ${p} 页 fired 态没渲染待业卡，玩家看不到"这些页面不归我管"`);
 });
 // 俱乐部页要看得见报价，不然"出口"两个字没有落点
 const club = html(dom, 'club');
 check(/报价|投递简历/.test(club), '① 俱乐部页的董事会面板没给出再就业出口');
 check(/acceptJobOffer\('|seekJob\(|retireFromCoaching\(/.test(club), '① 俱乐部页的出口按钮没有 onclick（只是三句说明文字）');
}

// ── ② 解约当场：报价 + 旧队继任者 ─────────────────────────────
{
 const dom = boot('manager');
 const oldTeam = run(dom, `S.teamName`);
 const r = run(dom, `(function(){
  S.managerCareer.years=4;S.managerCareer.titles=2;S.managerCareer.lastRank=3;
  // 名宿市场里放一位自由名宿：接任者应当真名落到该队的 AI 帅位记录上
  S.retiredCoaches=[{id:'lc1',name:'测试名宿',type:'coach',bonus:12,rating:95}];
  S.board.trust=0;S.board.warn=3;
  boardSettle(S);
  return {fired:S.board.fired,offers:(S.jobOffers||[]).length,
   teams:(S.jobOffers||[]).map(o=>o.team),self:(S.jobOffers||[]).filter(o=>o.team===S.teamName).length,
   succ:(aiCoachState(S)[${JSON.stringify(oldTeam)}]||{}).name||'',
   consumed:(S.retiredCoaches||[]).filter(x=>x.id==='lc1').length,
   logged:(S.eventLog||[]).some(l=>/接任主教练/.test(l.txt||'')),
   logFired:(S.eventLog||[]).some(l=>/执教邀约/.test(l.txt||''))};
 })()`);
 check(r.fired === true, '② 信任度归零没触发解约，用例前提失效');
 check(r.offers >= 1, '② 下课没给任何报价——推进入口全锁死时这就是待业死锁');
 check(r.self === 0, '② 报价里出现了自己刚离开的那支队');
 check(r.succ === '测试名宿', `② 旧队继任者没落到 aiCoachState（实得"${r.succ}"）`);
 check(r.consumed === 0, '② 接任的名宿没从名宿市场里移出，下一轮会被重复签走');
 check(r.logged, '② 日志里没有「接任主教练」的官宣');
 check(r.logFired, '② 报价生成了却没在日志里通知玩家');
}

// ── ②b 无帅可派时也必须官宣（自建队不在 CLUB_TEMPLATES 里，名宿池又空） ──
{
 const dom = boot('manager');
 const r = run(dom, `(function(){
  S.board.trust=0;S.board.warn=3;boardSettle(S);
  return {logged:(S.eventLog||[]).some(l=>/接任主教练/.test(l.txt||'')),
   nulled:(S.eventLog||[]).some(l=>/undefined|null/.test(l.txt||''))};
 })()`);
 check(r.logged, '②b 接不上继任者时日志静默——"董事会解约"在世界里不留痕迹');
 check(!r.nulled, '②b 官宣文案里漏出了 undefined/null');
}

// ── ③ 接报价 = 转会再就业 ──────────────────────────────────────
{
 const dom = boot('manager');
 const r = run(dom, `(function(){
  const oldTeam=S.teamName;
  S.retiredCoaches=[{id:'lc1',name:'测试名宿',type:'coach',bonus:12,rating:95}];
  S.board.trust=0;S.board.warn=3;boardSettle(S);
  const t=(S.jobOffers[0]||{}).team;
  acceptJobOffer(t);
  const ids=S.players.map(p=>p.id);
  const dup=ids.length-new Set(ids).size;
  const ownOnShelf=S.market.filter(p=>ids.indexOf(p.id)>=0).length
   +(S.freeAgents||[]).filter(p=>ids.indexOf(p.id)>=0).length;
  const d0=S.day;uiNextDay(S);
  return {team:S.teamName,changed:S.teamName!==oldTeam,fired:S.board.fired,warn:S.board.warn,trust:S.board.trust,
   dup,ownOnShelf,n:S.players.length,dayMoved:S.day!==d0,offersLeft:(S.jobOffers||[]).length,
   succLeft:(aiCoachState(S)[oldTeam]||{}).name||'',logged:((S.coachDeal||{}).log||[]).some(x=>/再就业/.test(x.note||''))};
 })()`);
 check(r.changed, '③ 接报价后队名没换（仍停留在原俱乐部）');
 check(!r.fired, '③ 接报价后 board.fired 没清——人会带着解约标记落进新俱乐部，全页继续锁死');
 check(r.dup === 0, `③ 换队后名单出现重复 id（${r.dup} 个）——switchClubTo 与报价路径没共用重建逻辑`);
 check(r.ownOnShelf === 0, `③ 货架/自由市场里躺着新班底的人（${r.ownOnShelf} 个），coachAutoSquad 直签会名单翻倍`);
 check(r.n >= 5, `③ 新东家班底只有 ${r.n} 人，不足以开赛`);
 check(r.dayMoved, '③ 再就业后推进入口仍被锁住（uiNextDay 点不动）');
 check(r.offersLeft === 0, '③ 接单后旧报价没清空，还能再领一份合同');
 check(!!r.succLeft, '③ 离开的俱乐部没留下接任者记录');
 check(r.logged, '③ 执教履历（coachDeal.log）里没记这次再就业');
}

// ── ④ 投递简历恒有回音 ────────────────────────────────────────
{
 const dom = boot('coach');
 const r = run(dom, `(function(){
  S.board.fired=true;S.jobOffers=[];
  const a=(S.jobOffers||[]).length;seekJob();const b=(S.jobOffers||[]).length;
  seekJob();const c=(S.jobOffers||[]).length;   // 第二次只能补新队或持平，不能倒退
  return {a,b,c,teams:(S.jobOffers||[]).map(o=>o.team),self:(S.jobOffers||[]).filter(o=>o.team===S.teamName).length};
 })()`);
 check(r.a === 0 && r.b >= 1, '④ 待业期投递简历一份报价都拿不到（出口为零）');
 check(r.c >= r.b, '④ 再投递把已有报价弄丢了');
 check(r.self === 0, '④ 报价里出现自己刚被解约的那支队');
}

// ── ⑤ 挂印退役才是终局 ────────────────────────────────────────
{
 const dom = boot('manager');
 const r = run(dom, `(function(){
  S.board.trust=0;S.board.warn=3;boardSettle(S);
  const club=S.teamName;
  retireFromCoaching();
  const d0=S.day;uiNextDay(S);
  return {end:!!S.careerEnd,club:club,stillClub:S.teamName,fired:S.board.fired,
   offers:(S.jobOffers||[]).length,dayMoved:S.day!==d0,
   log:(S.coachDeal||{}).log?S.coachDeal.log.some(x=>/挂印退役/.test(x.note||'')):false};
 })()`);
 run(dom, `S.board.fired=true;S.board.firedSeason=S.season;`); // careerEnd 只在 fired 路径上出现，保持一致
 const club = html(dom, 'club');
 check(r.end, '⑤ 挂印退役没写 careerEnd 总结');
 check(r.fired, '⑤ 退役后 fired 被清了——所有闸门会重新打开');
 check(r.offers === 0, '⑤ 封笔后手上还留着可接的报价');
 check(!r.dayMoved, '⑤ 退役后 uiNextDay 仍能推进（生涯没收住）');
 check(/已封笔/.test(club), '⑤ 俱乐部页没渲染封笔卡');
 check(count(actionHits(club)) === 0, `⑤ 封笔态俱乐部页仍有推进/经营按钮：${JSON.stringify(actionHits(club))}`);
 check(/resetGame\(/.test(club), '⑤ 封笔态没给「另起一份新生涯」的出口');
 check(r.log, '⑤ 执教履历里没记封笔');
}

// ── ⑥ 引擎层保持无 UI 依赖（平衡门禁的口径） ──────────────────
{
 const dom = boot('manager');
 const r = run(dom, `(function(){
  S.board.fired=true;S.board.firedSeason=S.season;
  const d0=S.day,w0=S.transferWindow,f0=S.fund;
  const tgt=S.market.find(p=>p&&S.fund>=Math.round(valueOf(overall(p))*(p.discount||1)));
  const bought=tgt?buyPlayer(S,tgt):false;
  nextDay(S);
  return {bought,spent:f0-S.fund,dayMoved:S.day!==d0||S.transferWindow!==w0};
 })()`);
 check(r.bought && r.spent > 0, '⑥ 引擎层被 fired 硬锁住了——sim/fuzz/年终门禁直接调 buyPlayer 的路径断了');
 check(r.dayMoved, '⑥ nextDay 在 fired 态不推进：平衡门禁会误判成死锁');
}

// REVERSE（本次实现逐条做过的人工反向验证，改动时被退回就会报红）：
//   ① 去掉三处 joblessGate → market/train/lineup 立刻报 9/24/6 颗按钮；
//   ② 删掉 board.js 里的 genJobOffers/announceSuccessor → 「没给报价」「旧队没继任者」两条同红；
//   ③ 让 acceptJobOffer 不清 fired → 「fired 没清」+「推进入口仍被锁」两条红；
//   ④ seekJob 换成 return → 「出口为零」红；
//   ⑤ retireFromCoaching 不写 careerEnd → 「没写总结」「仍能推进」红。
if (errors.length) {
 console.log('[FAIL] verify-fired-exit:\n  ' + errors.join('\n  '));
 process.exitCode = 1;
} else {
 console.log('[PASS] verify-fired-exit（下课出口 · 三页收口 · 再就业/封笔两条路 · 引擎层不下沉守卫）');
}

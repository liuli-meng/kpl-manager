// 教练身份回归：钉住「教练模式玩不通」的四条成因（2026-09-19 三身份穷举探针报出、当轮未修）
// 根因逐条：
//   ① 亚运年夏季赛「开幕即锁」——startSplit 的 coach/player 分支先跑 coachAutoSquad 后跑
//      announceNatCamp：俱乐部刚把班底补齐，国家队转头把唯一的首发抽走，而这一分支提前 return，
//      没有经理档那 7 天转会窗，第一场 BP 就直接开不出来。
//   ② s.freeAgents 恒为 0——同一分支跳过了 buildTransferMarket。于是「引援建议」永远没有推荐、
//      「申请直签」永远办不成，缺位弹窗里的「前往转会市场签约」也只是对着空列表点。
//   ③ 助教席/名宿转任只有经理档有卡面——teamPower 里的助教加成对教练身份是死字段。
//   ④ 下课态仍渲染可点的 uiStartMatch：点下去只回一句 toast，真人读到的是「按钮还在、我还能指挥」。
// 反向验证：逐条把修复退回（`git show b70ef4d:src/js/<file>` 覆盖）后本脚本必须报红，
//   否则这条断言等于没写——这是本仓第二次踩「断言太弱抓不住死按钮」。
// 运行：node tests/verify-coach-mode.js
const vm = require('vm');
const { makeDom } = require('./harness');

const errors = [];
const check = (c, m) => { if (!c) errors.push(m); };
const boot = mode => {
  const { dom } = makeDom();
  vm.runInContext(mode === 'coach'
    ? `(function(){ _coachPick=0; applyCoachClub(); closeModal('start-modal'); closeModal('app-modal'); renderAll(); })()`
    : `(function(){ const e=document.getElementById('new-team-name'); e.value='经理对照队'; createTeam(); closeModal('start-modal'); closeModal('app-modal'); renderAll(); })()`, dom);
  return dom;
};
const coachAsiadSquad = dom => vm.runInContext(`(function(){
  // 5 人班底、无替补，其中对抗路是全联盟最强（必被征召）——亚运年夏赛开幕即触发缺位的最低配置
  S=newState('教练锁队','盾'); S.mode='coach';
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  const u=new Set();
  const mk=(pos,star)=>{const d=genFreeAgentDef(pos,star?'star':'low',u);const p=genPlayer(d);
    if(star){p.name='测试王牌';p.attrs={lane:99,farm:95,team:99,mind:96};}return p;};
  S.players=[mk('top',true),mk('jg'),mk('mid'),mk('ad'),mk('sup')];
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S); S.fund=800;
  startSplit(S,'summer');
  return {asiad:isAsiadYear(S),announced:!!S.natAnnounced,camped:(S.players||[]).filter(p=>p.natCamp).length,
    noGo:lineupNoGo(S).map(x=>POS[x][0]),lineup:S.lineup.length,n:S.players.length,preseason:!!S.preseason,win:S.transferWindow};
})()`, dom);

// ── ① 教练档必须有自由球员池（开局即建市，且不含本队人） ───────────────
{
  const dom = boot('coach');
  const r = vm.runInContext(`(function(){
    const ids=new Set(S.players.map(p=>p.id));
    return {fa:(S.freeAgents||[]).length,own:(S.freeAgents||[]).filter(p=>ids.has(p.id)).length,
      tl:(S.transferList||[]).length};
  })()`, dom);
  check(r.fa > 0, `① 教练档开局 freeAgents 仍为 ${r.fa}（buildTransferMarket 被跳过 → 申请直签/引援建议/缺位签约全部落空）`);
  check(r.own === 0, `① freeAgents 里混进了本队选手 ${r.own} 名（直签会签出重复的人）`);
  check(r.tl > 0, `① transferList 为空（${r.tl}），市场根本没建`);
}

// ── ② 亚运年夏季赛开幕不得把教练锁死：俱乐部补位必须看得见集训缺席 ──────
{
  const dom = boot('coach');
  const r = coachAsiadSquad(dom);
  check(r.asiad && r.announced, `② 前置条件不成立：没走到亚运年征召宣布（asiad=${r.asiad} announced=${r.announced}）`);
  check(r.camped > 0, `② 前置条件不成立：无人被征召（camped=${r.camped}），测不到缺位路径`);
  check(!r.preseason && !(r.win > 0), `② 教练档出现了转会窗（preseason=${r.preseason}/${r.win}），本用例口径已变`);
  check(r.noGo.length === 0,
    `② 夏赛开幕即锁：${JSON.stringify(r.noGo)} 无人可打，第一场 BP 开不出来（班底 ${r.n} 人 / lineup ${r.lineup} 人）`);
  check(r.lineup === 5, `② 开幕时首发不满 5 人（${r.lineup}）`);
}
// 对照：经理档同一天靠 7 天转会窗自救（证明②不是「本该如此」）
{
  const dom = boot('manager');
  const r = vm.runInContext(`(function(){
    const u=new Set();
    const mk=(pos,star)=>{const d=genFreeAgentDef(pos,star?'star':'low',u);const p=genPlayer(d);
      if(star){p.name='经理王牌';p.attrs={lane:99,farm:95,team:99,mind:96};}return p;};
    S.players=[mk('top',true),mk('jg'),mk('mid'),mk('ad'),mk('sup')];
    S.lineup=S.players.map(p=>p.id); S.seedPower=teamPower(S); S.fund=2000;
    startSplit(S,'summer');
    return {noGo:lineupNoGo(S).length,win:S.transferWindow,preseason:!!S.preseason,fa:(S.freeAgents||[]).length};
  })()`, dom);
  check(r.win > 0 && r.preseason, `②对照 经理档没有转会窗缓冲（${r.win}/${r.preseason}），对照失效`);
  check(r.fa > 0, '②对照 经理档 freeAgents 也空了（市场构建被改坏）');
}

// ── ③ 教练档要能真的组织教练组：助教席 + 名宿转任，且加成有效 ───────────
{
  const dom = boot('coach');
  const r = vm.runInContext(`(function(){
    renderCoachMarket();
    const h=document.getElementById('page-market').innerHTML||'';
    const p0=teamPower(S);
    hireAssistant(S,ASSISTANT_POOL[0].id);
    const p1=teamPower(S);
    confirmDanger=function(){return true};
    fireAssistant(S,ASSISTANT_POOL[0].id);
    const p2=teamPower(S);
    // 名宿转任助教：造一名退役名宿，走 hireAssistant 的 6 折分支
    S.retiredCoaches=[{id:'rc_test',name:'名宿甲',rating:80,style:'team',bonus:5,styleBonus:3,wage:22,cost:240,
      skill:{n:'名宿执教',d:'x'},type:'coach',origin:'测试王牌'}];
    renderCoachMarket();
    const h2=document.getElementById('page-market').innerHTML||'';
    const f0=S.fund; hireAssistant(S,'rc_test');
    return {有助教席:/助教席/.test(h),有hireAssistant:/hireAssistant/.test(h),有名宿入口:/转任助教/.test(h2),
      名宿行:/rc_test/.test(h2),
      p0:Math.round(p0),p1:Math.round(p1),p2:Math.round(p2),
      折扣成交:f0-S.fund,cost:Math.round(240*0.6),在任:(S.assistants||[]).length};
  })()`, dom);
  check(r.有助教席 && r.有hireAssistant, '③ 教练档转会页没有助教席入口（助教加成对教练身份是死字段）');
  check(r.有名宿入口 && r.名宿行, '③ 教练档没有「退役名宿 → 助教」入口');
  check(r.p1 > r.p0, `③ 聘助教后全队战力没变（${r.p0} → ${r.p1}）——加成没接上`);
  check(r.p2 === r.p0, `③ 解约助教后战力没回落（${r.p1} → ${r.p2}，应回到 ${r.p0}）`);
  check(r.在任 === 1 && r.折扣成交 === r.cost, `③ 名宿转任助教没按 6 折成交（实收 ${r.折扣成交}，应为 ${r.cost}）或没入册（在任 ${r.在任}）`);
}

// ── ④ 下课态：同一场景「下课前后」逐页签差分，推进类按钮必须一个不剩 ──────
// 判据为什么这么定（反向验证逼出来的）：原来写成「下课态俱乐部页没有推进按钮」，
// 可 fired 时 nextAction 本就返回 null、赛段面板提前 return，把修复退回也照样报绿——
// 那是「此刻无比赛可推」，不是「下课把按钮收掉了」。所以改成差分：
// ①同一场景未下课确有这些按钮（前提不失效）②同一场景下课后一个不剩。扫全部页签。
const ADV_CALL = /onclick="[^"]*\b(uiNextDay|uiDoNextAction|uiEndPreseason|uiSkipTransfer|uiStartMatch|startMatch|startPlayerMatch|startPlayoff|startCard|uiStartCup|uiAsiadStep|uiAdvanceCalendar|uiFinishAnnual)\s*\(/;
const SCENES = [
  ['常规赛', `S.preseason=false;S.transferWindow=0;S.split='spring';S.phase='r1';`],
  // 下课结算后引擎照常开新赛季：经理档会带着 board.fired 落进「赛前转会期」，
  // 市场页顶上就是开赛/跳过两颗按钮——只盯俱乐部页会漏掉这条
  ['转会期', `S.preseason=true;S.transferWindow=7;S.phase='r1';`],
  ['挑战者杯', `S.preseason=false;S.transferWindow=0;try{setupChallenger(S);}catch(e){}`],
  ['亚运会', `S.preseason=false;S.transferWindow=0;S.split='summer';try{setupAsianGames(S);}catch(e){}`],
];
const scanAdv = dom => vm.runInContext(`(function(){
  const PAGES=(typeof MODE_PAGES!=='undefined'&&MODE_PAGES[S.mode])||[];
  const out=[];
  PAGES.forEach(p=>{
    try{ renderPage(p); }catch(e){ out.push(p+':渲染抛错 '+e.message); return; }
    const h=document.getElementById('page-'+p).innerHTML||'';
    (h.match(/onclick="[^"]*"/g)||[]).filter(x=>${ADV_CALL.toString()}.test(x))
      .forEach(x=>out.push(p+':'+x.slice(9,-1)));
  });
  return out;
})()`, dom);
// 只查会被解约的两档（选手档年结走 playerYearSettle，board.fired 永不置位）
const firedTally = [];
for (const mode of ['coach', 'manager']) {
  for (const [scene, setup] of SCENES) {
    const dom = boot(mode);
    vm.runInContext(`(function(){ S.board.fired=false; ${setup} })()`, dom);
    const before = scanAdv(dom);
    vm.runInContext(`(function(){ S.board.trust=0;S.board.fired=true; ${setup} })()`, dom);
    const after = scanAdv(dom);
    firedTally.push(`${mode}/${scene} ${before.length}→${after.length}`);
    check(before.length > 0, `④(${mode}/${scene}) 未下课也扫不到推进类按钮，这条差分什么都没测到（前提失效）`);
    check(after.length === 0, `④(${mode}/${scene}) 下课态仍留着推进类按钮（点了只有 toast）：${JSON.stringify(after.slice(0, 6))}`);
    // 任务条上的「推进一场比赛 / 结束转会期开赛」也是同一类残留：onclick 只有 goPage，
    // 不会被上面的判据抓到，但它把玩家指向一颗已经不存在的按钮，所以单独判
    const strip = vm.runInContext(`(function(){ goPage('club');
      return /新手任务|推进一场比赛|结束转会期开赛/.test(document.getElementById('page-club').innerHTML||''); })()`, dom);
    check(!strip, `④(${mode}/${scene}) 下课态俱乐部页仍留着新手任务条的开赛指引`);
  }
}
// 下课页本身必须留一条明确出路（不能只剩一页无返货的按钮）
{
  const dom = boot('coach');
  vm.runInContext(`S.board.trust=0;S.board.fired=true;renderClub();`, dom);
  const h = vm.runInContext(`document.getElementById('page-club').innerHTML||''`, dom);
  check(/resetGame/.test(h) && /已解约|执教已终止/.test(h), '④ 下课页缺少「结束执教 · 重新开始」或解约说明');
}

// ── ⑤ 申请直签必须真能办成（依赖 ① 的市场），且不签出重复选手 ───────────
{
  const dom = boot('coach');
  const r = vm.runInContext(`(function(){
    if(!(S.freeAgents||[]).length)return {空池:true};
    S.fund=5000;
    const fa=S.freeAgents[0], id=fa.id, pos=fa.pos;
    const n0=S.players.length;
    coachRequest(S,'sign',id);
    const ids=S.players.map(p=>p.id);
    const dup=ids.length-new Set(ids).size;
    // 已在阵中的人还在池里（旧口径下换队执教就会出现这种状态）：再走一次自动办理，
    // 归属守卫必须把他当办结丢掉；没有守卫就是名单里两个同 id 选手
    S.freeAgents=S.freeAgents.concat([fa]);
    S.coachRecs=[{type:'sign',pid:id,pos,name:fa.name}];
    coachAutoSquad(S);
    const ids2=S.players.map(p=>p.id);
    return {空池:false,pos,in0:ids.filter(x=>x===id).length,dup0:dup,
      in1:ids2.filter(x=>x===id).length,dup1:ids2.length-new Set(ids2).size,added:S.players.length-n0};
  })()`, dom);
  check(!r.空池, '⑤ 自由球员池仍是空的，申请直签无从验证（①未生效）');
  if (!r.空池) {
    check(r.in0 === 1, `⑤ 申请直签后阵中该选手 ${r.in0} 份（应为 1）`);
    check(r.dup0 === 0, `⑤ 直签引入了重复 id（${r.dup0} 个）`);
    check(r.in1 === 1 && r.dup1 === 0,
      `⑤ 对已在阵中的自由人重复受理：阵中 ${r.in1} 份 / 全名单重复 id ${r.dup1} 个（coachAutoSquad 缺归属守卫）`);
  }
}

// ── ⑥ 连续换赛段都要重建市场；换队执教后市场不能含新班底的人 ────────────
// 两处都用「先清空/投毒、再看有没有重建」的写法：只查长度会靠开局那份旧池假绿
{
  const dom = boot('coach');
  const r = vm.runInContext(`(function(){
    const faBoot=(S.freeAgents||[]).length;
    S.freeAgents=[];                 // 掏空：换赛段这一步必须自己把市场建回来
    startSplit(S,'summer');
    const faSummer=(S.freeAgents||[]).length;
    // 豪门邀约：先投一名「本队选手」进池，接受邀约后必须被重建冲掉（否则 coachAutoSquad 会把他再签一遍）
    S.freeAgents=[S.players[0],...(S.freeAgents||[])];
    const poisoned=S.freeAgents.length;
    const other=CLUB_TEMPLATES.find(c=>c.name!==S.teamName);
    S.coachOffer={team:other.name};
    respondCoachOffer(true);
    const ids=new Set(S.players.map(p=>p.id));
    return {faBoot,faSummer,投毒数:poisoned,换队后池:(S.freeAgents||[]).length,
      换队后撞车:(S.freeAgents||[]).filter(p=>ids.has(p.id)).length,队名换了:S.teamName===other.name};
  })()`, dom);
  check(r.faBoot > 0, `⑥ 教练档开局没建市场（freeAgents=${r.faBoot}）`);
  check(r.faSummer > 0, `⑥ 换到夏季赛后市场仍是空的（startSplit 没重建：开局 ${r.faBoot} → 换段 ${r.faSummer}）`);
  check(r.换队后池 > 0 && r.换队后池 !== r.投毒数,
    `⑥ 换队执教后市场没重建（投毒后 ${r.投毒数} 人 → 换队后 ${r.换队后池} 人，那颗投进去的钉子还在）`);
  check(r.换队后撞车 === 0, `⑥ 换队执教后市场里仍有新班底选手 ${r.换队后撞车} 名（会被再签一遍）`);
  check(r.队名换了, '⑥ respondCoachOffer 没换成邀约队，用例前提失效');
}

// ── ⑦ 重构没弄坏经理档：助教席/教练市场/退役名宿三块卡面都还在 ───────────
{
  const dom = boot('manager');
  const r = vm.runInContext(`(function(){
    S.retiredCoaches=[{id:'rc_m',name:'名宿乙',rating:80,style:'lane',bonus:5,styleBonus:3,wage:20,cost:210,
      skill:{n:'名宿执教',d:'x'},type:'coach',origin:'某人'}];
    renderMarket();
    const h=document.getElementById('page-market').innerHTML||'';
    return {助教席:/助教席/.test(h),教练市场:/教练市场/.test(h),名宿:/退役名宿/.test(h),名宿行:/rc_m/.test(h),
      池卡面:/(ASSISTANT_POOL|聘为助教)/.test(h)||/聘为助教/.test(h)};
  })()`, dom);
  ['助教席', '教练市场', '名宿', '名宿行', '池卡面'].forEach(k =>
    check(r[k], `⑦ 经理档转会页丢了「${k}」卡面（助教逻辑抽共用时删坏了）`));
}

// ── ⑧ 亚运对阵表缺失时「推进赛程」不得静默：必须有可读反馈 ─────────────
{
  const dom = boot('coach');
  const r = vm.runInContext(`(function(){
    toast=function(m){window._toast=m}; window._toast='';
    S.phase='asiad'; S.ag=null;
    const day0=S.day, log0=(S.eventLog||[]).length;
    uiAsiadStep(S);
    return {toast:window._toast,动了:(S.day!==day0)||((S.eventLog||[]).length!==log0)};
  })()`, dom);
  check(!!r.toast, `⑧ 对阵表缺失时点「推进亚运会赛程」完全静默（无提示、无推进）：${JSON.stringify(r)}`);
  check(!r.动了, `⑧ 对阵表缺失却把状态推进了（应只提示不动手）：${JSON.stringify(r)}`);
}

if (errors.length) {
  console.log('[FAIL] 教练身份回归:\n  ' + errors.join('\n  '));
  process.exitCode = 1;
} else {
  console.log('[PASS] 教练身份回归：亚运开幕不锁人（补位看得见集训缺席）、自由市场已建、助教席/名宿有入口且加成有效、下课态无残留按钮、直签不重复');
  console.log('       下课差分（未下课→下课，扫各身份全部页签的推进类按钮）：' + firedTally.join(' | '));
}

// 分视角成就 + 史实降级空窗体验（教练/选手）
// 运行：node tests/verify-mode-achieve.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=t=>res.push('[PASS] '+t);

  // ① 教练专属成就
  S=newState('教练队','x');fillRoster(S,'mid','star');
  S.mode='coach';S.coach={...COACH_POOL.find(c=>c.id==='co1'),rating:88};
  S.coachDeal={years:2,honors:[],log:[]};
  S.board={trust:80,kpi:null,warn:0,fired:false,firedSeason:0,log:[{trust:80},{trust:75},{trust:72}]};
  checkAchievements(S);
  if(!S.achieved.co_master)fail('co_master 未解锁（rating 88）');
  else if(!S.achieved.co_iron)fail('co_iron 未解锁（三次信任≥70）');
  else ok('① 教练成就：名帅风范 + 铁帅');

  // ② 豪门垂青
  S._coachPoached=true;checkAchievements(S);
  if(!S.achieved.co_poach)fail('co_poach 未解锁');
  else ok('② 教练成就：豪门垂青');

  // ③ 名宿执教
  S.coach.origin='测试名宿';checkAchievements(S);
  if(!S.achieved.co_legend)fail('co_legend 未解锁');
  else ok('③ 教练成就：名宿执教');

  // ④ 选手专属成就
  S=newState('选手队','x');fillRoster(S,'mid','star');
  S.mode='player';
  const me=S.players[0];
  S.career={me:me.id,seasons:[],titles:1,fmvp:1,allstar:0,nat:1,retired:false,pendingMove:null,moved:true};
  me.attrs={lane:95,farm:95,team:95,mind:95};
  checkAchievements(S);
  if(!S.achieved.me_fmvp)fail('me_fmvp 未解锁');
  else if(!S.achieved.me_title)fail('me_title 未解锁');
  else if(!S.achieved.me_star)fail('me_star 未解锁');
  else if(!S.achieved.me_move)fail('me_move 未解锁');
  else if(!S.achieved.me_nat)fail('me_nat 未解锁');
  else ok('④ 选手成就：FMVP/冠军/星/转会/国家队');

  // ⑤ 空窗面板：教练 histGap
  //    队名必须用 2017 档联盟里真实存在的名字（简名 AG超玩会）——旧用例塞的是
  //    '成都AG超玩会'（2019 才启用的队名），与当时 2018 out 表里那个写错的字符串
  //    恰好吻合，所以它测的是「幽灵队」而不是史实降级；⑥ 也因此恒真（塞进去的名字还在名单里）。
  installEra('2017');
  S=newState('AG超玩会','焰');fillRoster(S,'mid','star');
  S.era='2017';S.season=1;S.mode='coach';S.teamName='AG超玩会';
  if(!AI_TEAMS.some(t=>t.name==='AG超玩会'))fail('前提：2017 档联盟应含 AG超玩会');
  else{
   S.season=2;
   applyHistoricalLeague(S);
   if(!S.seatLost)fail('前提：2018 教练版 AG 应 seatLost（实得 '+S.seatLost+'）');
   else{
    histPromotionSkip(S);
    if(!S.histGap)fail('教练降级空窗应进入 histGap，而不是直接跳过');
    else if(typeof histGapPanelHtml!=='function'||!histGapPanelHtml().includes('等待重返'))fail('空窗面板缺少等待重返');
    else ok('⑤ 教练空窗：histGap + 面板可选等待/另谋高就');
   }
  }

  // ⑥ 等待重返（AG 在 2019 以新队名回归；玩家队名随之更新）
  histGapWait(S);
  if(S.seatLost)fail('等待重返未解除 seatLost');
  else if(!AI_TEAMS.some(t=>t.name==='成都AG超玩会'))fail('等待后 AG 应以成都AG超玩会回到名单');
  else if(S.teamName!=='成都AG超玩会')fail('等待重返后玩家队名应随更名更新（实得 '+S.teamName+'）');
  else ok('⑥ 等待重返：AG 以「成都AG超玩会」回到 KPL 名单并解除空窗');

  // ⑦ 选手另谋高就
  installEra('2017');
  S=newState('AG超玩会','焰');fillRoster(S,'mid','star');
  S.era='2017';S.season=1;S.mode='player';S.teamName='AG超玩会';
  S.career={me:S.players[0].id,seasons:[],titles:0,fmvp:0,allstar:0,nat:0,retired:false,pendingMove:null};
  S.season=2;
  applyHistoricalLeague(S);
  histPromotionSkip(S);
  if(!S.histGap)fail('选手空窗应 histGap');
  else{
    histGapLeave(S);
    if(S.histGap)fail('另谋高就后仍 histGap');
    else if(S.teamName==='AG超玩会')fail('另谋高就应换队');
    else if(S.seatLost)fail('换队后应解除 seatLost');
    else ok('⑦ 选手另谋高就：转会至 '+S.teamName);
  }

  // ⑧ 面板按身份过滤：教练面板不出现「天价交易/董事会宠儿」
  if(typeof achievementsFor!=='function')fail('achievementsFor 未导出');
  else{
    const co=achievementsFor('coach').map(a=>a.id);
    const pl=achievementsFor('player').map(a=>a.id);
    const mg=achievementsFor('manager').map(a=>a.id);
    if(co.indexOf('co_master')<0||co.indexOf('big_sale')>=0)fail('教练列表过滤错误');
    else if(pl.indexOf('me_fmvp')<0||pl.indexOf('board_fav')>=0)fail('选手列表过滤错误');
    else if(mg.indexOf('big_sale')<0||mg.indexOf('co_master')>=0||mg.indexOf('me_fmvp')>=0)fail('经理列表过滤错误');
    else if(co.length>=mg.length)fail('教练列表仍过长（'+co.length+' vs '+mg.length+'）');
    else ok('⑧ 成就按身份过滤：教练 '+co.length+' · 选手 '+pl.length+' · 经理 '+mg.length);
  }

  installEra(null);
  return res.join('\\n')+(hadFail?'\\n[FAIL]':'\\n[PASS]');
})()
`, dom);

console.log(out);
if (String(out).includes('[FAIL]')) process.exit(1);

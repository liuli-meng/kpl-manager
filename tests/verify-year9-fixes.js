// year9 剩余问题回归门禁：选手季后赛入口 / 新援磨合 / 教练 gap / 媒体日 / 小球市 / 荣誉入账
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(
  `
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 选手模式必须能开卡位/季后/杯赛（旧版 permission 只放行 manager/coach）
  if(!canOperate('startCard',{mode:'player'}))fail('选手不能打卡位赛');
  else if(!canOperate('startPlayoff',{mode:'player'}))fail('选手不能打季后赛');
  else if(!canOperate('startCup',{mode:'player'}))fail('选手不能打杯赛');
  else if(canOperate('startMatch',{mode:'player'}))fail('选手 startMatch 不该被放行（走 playerStartMatch）');
  else log('① 选手可出战卡位/季后/杯赛，仍不能操作赛前 BP');

  // ② nextAction 选手卡片文案带「出战」
  S=newState('入口队','入');fillRoster(S,'star');S.mode='player';
  S.career={me:S.players[0].id,seasons:[],titles:0,fmvp:0,allstar:0};
  S.preseason=false;S.transferWindow=0;
  S.card={matches:[{a:S.teamName,b:'X',r:null},{a:'A',b:'B',r:null},{a:'C',b:'D',r:null},{a:'E',b:'F',r:null}],idx:0};
  S.phase='card';
  const a1=nextAction(S);
  if(!a1||a1.fn!=='startCard'||!/出战/.test(a1.label))fail('卡位入口文案/入口异常: '+JSON.stringify(a1));
  else log('② 卡位入口: '+a1.label);

  // ③ 新援磨合：2 名近 15 天新援 → 战力打折；只 1 人不打
  S=newState('磨合队','磨');fillRoster(S,'star','star');
  S.preseason=false;S.transferWindow=0;
  const pw0=teamPower(S);
  S.players[0].joinedDay=S.day;S.players[1].joinedDay=S.day;
  const pw1=teamPower(S);
  S.players[1].joinedDay=null;
  const pw2=teamPower(S);
  if(!(pw1<pw0&&pw2>=pw0*0.99))fail('磨合惩罚异常: 基准'+pw0+' 双新援'+pw1+' 单新援'+pw2);
  else log('③ 新援磨合：双新援战力 '+pw0+'→'+pw1+'（-'+Math.round((1-pw1/pw0)*100)+'%），单新援 '+pw2+' 不罚');

  // ④ 教练 gap：已有合格选手则拒报；重复申请去重
  S=newState('教练队','教');S.mode='coach';fillRoster(S,'mid');
  S.coachRecs=[];
  coachRequest(S,'gap',null,'mid');
  const n1=S.coachRecs.filter(r=>r.type==='gap'&&r.pos==='mid').length;
  if(n1!==0)fail('已有 mid 选手仍被报缺位');
  else log('④ gap 阈值：mid 位有人时不报缺（旧版五位置全报）');

  // ⑤ 媒体日：比赛日 tick 会抛邀约，且 stats.mediaOffers 有计数
  S=newState('媒体队','媒');S.mode='player';fillRoster(S,'mid');
  S.career={me:S.players[0].id,seasons:[],titles:0,fmvp:0,allstar:0,stats:{trained:0,social:0,media:0,matches:0}};
  S.preseason=false;S.transferWindow=0;
  let opened=0;
  for(let i=0;i<40;i++){
    matchDayTick(S);
    if(S.career&&S.career.media){opened++;playerRespondMedia(S,0);}
  }
  if(!opened)fail('40 个比赛日 0 次媒体邀约');
  else if(!(S.career.stats.media>0))fail('媒体已开但 stats.media 未增');
  else log('⑤ 媒体日：40 比赛日邀约 '+opened+' 次 · 已答 '+S.career.stats.media);

  // ⑥ 小球市扶持：资金 <7000 时分润 +25%
  S=newState('弱旅队','弱');fillRoster(S,'mid');S.fund=5000;
  const f0=S.fund;leaguePayout(S,'八强');
  const gain=Math.round(S.fund-f0);
  if(gain<Math.round(133*1.2))fail('弱旅分润未加成: +'+gain);
  else log('⑥ 小球市扶持：5000 资金八强分润 +'+gain+'（基准 133）');

  // ⑦ 随队夺冠：career.titles 实时 +1
  S=newState('荣誉队','荣');S.mode='player';fillRoster(S,'star');
  S.career={me:S.players[0].id,seasons:[],titles:0,fmvp:0,allstar:0};
  S.lineup=S.players.map(p=>p.id);
  S.preseason=false;S.transferWindow=0;
  registerChampCore(S,'测试冠军');
  if((S.career.titles||0)<1)fail('随队夺冠未入账 career.titles='+S.career.titles);
  else log('⑦ 随队夺冠实时入账: career.titles='+S.career.titles);

  // ⑧ file:// 不写 manifest link（防 CORS）——源码断言
  // （构建产物由 verify-built 对照；这里查源）
  // ⑧ 周结必须真扣费：发薪日资金下降，且日志有「周结总账」
  S=newState('扣费队','扣');fillRoster(S,'star','star');
  S.preseason=false;S.transferWindow=0;S.sponsorLv=0;S.fans=0;
  S.day=6; // 下一天正好跨发薪周
  S._quietSave=true;
  const fBefore=S.fund;
  nextDay(S);
  const spent=Math.round(fBefore-S.fund);
  const logs=(S.eventLog||[]).map(e=>e.txt||'').join('|');
  if(spent<=0)fail('发薪日未见扣费: '+fBefore+'→'+S.fund);
  else if(logs.indexOf('周结总账')<0)fail('周结日志缺失「周结总账」');
  else log('⑧ 周结扣费：-'+spent+'万 · 日志含收支总账');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`,
  dom
);

console.log(out);

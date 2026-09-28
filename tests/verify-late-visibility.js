// 同类问题回归：排名靠后/系列赛进行中/止步后信息不得消失
// 运行：node tests/verify-late-visibility.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 年度积分榜 13 名：我队行必须还在
  S=newState('后排积分',' x');fillRoster(S,'mid');
  S.annualPts={};
  // 造 18 队积分，我队垫底（积分最低）
  const all=[S.teamName].concat(AI_TEAMS.map(t=>t.name).filter(n=>n!==S.teamName)).slice(0,18);
  all.forEach((n,i)=>{S.annualPts[n]=n===S.teamName?5:(18-i)*10;});
  S.phase='r1';S.groups={G1:all.slice(0,6),G2:all.slice(6,12),G3:all.slice(12,18)};
  S.tables={G1:{},G2:{},G3:{}};
  ['G1','G2','G3'].forEach(g=>S.groups[g].forEach(n=>S.tables[g][n]={w:0,l:0,pts:0,pw:0}));
  S.schedule=[];S.matchIdx=0;S.preseason=false;
  // renderLeague 依赖 yearCalendarHtml 等：直接抽积分榜片段
  let h='';
  try{renderLeague();h=document.getElementById('page-league').innerHTML||'';}catch(e){fail('renderLeague 抛错: '+e.message);}
  if(h.indexOf(S.teamName)<0)fail('积分榜 13 名外我队消失');
  else if(h.indexOf('前12外')<0)fail('未标注前12外');
  else log('① 年度积分榜：垫底我队仍在表内（标注前12外）');

  // ② 系列赛进行中：俱乐部页必须写「系列赛进行中」和比分
  S=newState('系列中',' x');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=teamPower(S);
  S.preseason=false;S.transferWindow=0;
  S.phase='r1';
  S.schedule=[{round:1,opp:'北京JDG',result:null,myScore:0,opScore:0,mid:'reg_r1_1'}];
  S.matchIdx=0;
  S.groups={G1:[S.teamName,'北京JDG','A','B','C','D'],G2:[],G3:[]};
  S.tables={G1:{}};S.groups.G1.forEach(n=>S.tables.G1[n]={w:0,l:0,pts:0,pw:0});
  S.lineup=S.players.map(p=>p.id);
  S.series={used:[],usedOpp:[],mw:2,ow:1,max:5,stage:'regular',mid:'reg_r1_1',logs:[],myName:S.teamName,opName:'北京JDG',side:'blue'};
  let h2='';
  try{
    const panel=clubLeaguePhasePanel();
    h2=panel;
  }catch(e){fail('clubLeaguePhasePanel 抛错: '+e.message);}
  if(h2.indexOf('系列赛进行中')<0)fail('系列赛进行中标题缺失');
  else if(h2.indexOf('2:1')<0)fail('系列赛比分 2:1 未显示');
  else if(h2.indexOf('北京JDG')<0)fail('系列赛对手未显示');
  else if(h2.indexOf('下一场比赛')>=0)fail('进行中仍显示「下一场比赛」');
  else log('② 系列赛进行中：标题/比分 2:1/对手 北京JDG 齐全');

  // ③ 未开赛时仍是「下一场比赛」
  S.series=null;
  const h3=clubLeaguePhasePanel();
  if(h3.indexOf('下一场比赛')<0)fail('未开赛标题不是「下一场比赛」');
  else log('③ 未开赛：恢复正常「下一场比赛」');

  // ④ 止步页显示最后一战对手
  S.phase='eliminated';
  S.history=[{opp:'成都AG超玩会',stage:'季后赛',score:'2:4',win:false}];
  S.annualPts[S.teamName]=40;
  let h4='';
  try{h4=clubResultPanel();}catch(e){fail('clubResultPanel 抛错: '+e.message);}
  if(h4.indexOf('止步')<0)fail('止步标题缺失');
  else if(h4.indexOf('成都AG超玩会')<0)fail('止步未显示最后一战对手');
  else log('④ 止步：最后一战 vs 成都AG超玩会 可见');

  // ⑤ 组内其他场次标注
  S.phase='r1';S.series=null;
  S.aiSchedule={G1:[{round:1,a:'A',b:'B',r:{w:'A',mw:3,ow:1}},{round:1,a:'C',b:'D',r:{w:'C',mw:3,ow:0}}]};
  let h5='';
  try{renderLeague();h5=document.getElementById('page-league').innerHTML||'';}catch(e){}
  if(h5.indexOf('组内其他场次')<0)fail('AI 战报未标注「最近 6 场」');
  else log('⑤ 组内其他场次有截断说明');

  return res.join('\\n')+(hadFail?'\\n[HAD-FAIL]':'\\n[ALL-OK]');
})()
`, dom);

console.log(out);
process.exit(out.includes('[HAD-FAIL]') ? 1 : 0);

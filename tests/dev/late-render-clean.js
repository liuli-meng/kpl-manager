// 干净后期压测：不注入脏字段，只靠 season 膨胀 + 真实结构调用 render*
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');
const { dom } = makeDom();
injectHelpers(dom);

const PROBE = `
function buildCleanLate(){
  const S=newState('干净后期','⚔️');
  fillRoster(S,'mid','star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  initGroups(S);
  S.season=12;
  S.day=10;
  S.split='summer';
  S.fund=5000;
  S.fans=200;
  S.mode='manager';
  // 满额历史：按真实写入格式
  S.titleHistory=[];
  for(let i=0;i<16;i++){
    S.titleHistory.push({season:1+i,split:i%2?'summer':'spring',event:i%3===0?'挑战者杯':(i%3===1?'春季赛':'夏季赛'),champ:['AG超玩会','重庆狼队','武汉eStarPro'][i%3]});
  }
  S.honors=[];
  for(let i=0;i<20;i++){
    S.honors.push({season:1+i%12,title:'荣誉'+i,champion:i%2===0,roster:'A、B、C'});
  }
  S.fmvpHonor=[];
  for(let i=0;i<12;i++)S.fmvpHonor.push({year:2026+i,event:'春季赛',name:'选手'+i,team:i%3? 'AG超玩会':S.teamName});
  S.awards=[];
  for(let i=0;i<10;i++)S.awards.push({season:12-i,first:[{pos:'mid',name:'一阵'+i,team:'AG'}],second:[{pos:'ad',name:'二阵'+i,team:'WB'}]});
  S.yearReviews=[];
  for(let i=0;i<10;i++){
    S.yearReviews.push({year:2038-i,season:12-i,team:S.teamName,
      stages:[{ev:'春季赛',place:i%2?'冠军':'四强'}],
      honors:[{title:'x',champion:true}],
      transfers:[{dir:'in',name:'T',fee:10}],
      keys:[{opp:'狼队',stage:'总决赛',score:'4:1',win:true}],
      achieved:[],
      board:{rank:3,target:4,delta:5,note:'ok',trust:70},
      annualPts:100,annualRank:3,fund:4000,fans:100});
  }
  S.transfers=[];
  for(let i=0;i<80;i++)S.transfers.push({yr:2030,season:1,dir:'in',name:'T'+i,fee:10});
  S.history=[];
  for(let i=0;i<20;i++)S.history.push({opp:'E'+i,stage:'常规赛',score:'3:1',win:true,peak:i===0,yr:2038,logs:['第1局 胜','第2局 负'],aiReport:i===0?'AI战报内容':null});
  S.eventLog=[];
  for(let i=0;i<120;i++)S.eventLog.push({txt:'事件'+i,t:Date.now(),level:'info',cat:'other'});
  S.board={trust:60,kpi:{target:4,from:3,label:'前4'},warn:0,fired:false,firedSeason:0,log:[{season:11,rank:3,target:4,delta:5,note:'ok',trust:60}]};
  S.managerCareer={years:8,titles:3,lastRank:3};
  S.champCore={ids:S.lineup.slice(0,3),names:['A','B','C'],titles:2,label:'春冠'};
  // 选手无 val（真实：替补可能无 val）
  S.players.forEach((p,i)=>{if(i>4)delete p.val;});
  // captain null
  S.captain=null;
  // 幽灵 lineup 残留
  S.lineup=S.lineup.concat(['ghost_x']);
  S.awards=S.awards.concat([{season:1,first:[],second:[]}]); // 空 first（可能：评选时空池）
  return S;
}
const issues=[];
function scan(html,tag){
  const s=String(html||'');
  if(/undefined/.test(s)){
    (s.match(/.{0,50}undefined.{0,50}/g)||[]).slice(0,2).forEach(x=>issues.push(tag+': undefined → '+x.replace(/\\s+/g,' ').trim()));
  }
  if(/NaN/.test(s)){
    (s.match(/.{0,50}NaN.{0,50}/g)||[]).slice(0,2).forEach(x=>issues.push(tag+': NaN → '+x.replace(/\\s+/g,' ').trim()));
  }
}
function elh(id){const el=document.getElementById(id);return el?el.innerHTML:'';}
S=buildCleanLate();
const fns=['renderHeader','renderClub','renderLineup','renderMarket','renderTrain','renderLeague','renderKjia','renderUnion','renderHall','renderBiz'];
fns.forEach(n=>{
  try{(0,eval)(n)();}catch(e){issues.push(n+' THROW: '+(e&&e.message||e));}
});
scan(elh('header'),'header');
scan(elh('page-club'),'club');
scan(elh('page-lineup'),'lineup');
scan(elh('page-market'),'market');
scan(elh('page-league'),'league');
scan(elh('page-union'),'union');
scan(elh('page-hall'),'hall');
scan(elh('page-biz'),'biz');
try{showYearReview(0);}catch(e){issues.push('showYearReview THROW: '+(e&&e.message||e));}
scan(elh('app-modal-body'),'yearReview');
try{window._unionMode='hist';renderUnion();window._unionMode='now';}catch(e){issues.push('union hist THROW: '+(e&&e.message||e));}
scan(elh('page-union'),'unionHist');
// 选手模式
S.mode='player';
S.career={me:S.players[0].id,retired:false,seasons:[
  {year:2037,team:S.teamName,apps:20,caps:80,kda:'1/1/1',mvp:2,ovr:80,val:105,titles:1}
],titles:1,fmvp:0,allstar:0,nat:0,stats:{trained:0,social:0,media:0,matches:5},role:'core'};
try{renderCareer();}catch(e){issues.push('renderCareer THROW: '+(e&&e.message||e));}
scan(elh('page-career'),'career');
// 空 first awards 是否触发 union
JSON.stringify({issues:issues});
`;
const raw = vm.runInContext(PROBE, dom);
const result = JSON.parse(raw);
if (result.issues.length) {
  console.log('干净后期问题 ' + result.issues.length + ' 条：');
  [...new Set(result.issues)].forEach(x => console.log('  - ' + x));
  process.exitCode = 1;
} else {
  console.log('干净后期：无 undefined/NaN/throw');
}

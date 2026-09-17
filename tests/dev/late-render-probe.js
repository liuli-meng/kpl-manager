// 临时排查：UI/渲染层后期 bug（不改产品代码，只跑真实 render*）
// 运行：node tests/late-render-probe.js
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

const { dom } = makeDom();
injectHelpers(dom);

const PROBE = `
function mkPlayer(id,pos,band,opts){
  const u=new Set();
  const def=genFreeAgentDef(pos,band||'mid',u);
  const p=genPlayer(def);
  p.id=id;
  if(opts&&opts.name)p.name=opts.name;
  if(opts&&opts.val===undefined)delete p.val; // 模拟无 val 选手
  else if(opts&&opts.val!=null)p.val=opts.val;
  if(opts&&opts.age!=null)p.age=opts.age;
  return p;
}
function buildLateState(){
  const S=newState('后期压测','⚔️');
  S.mode='manager';
  S.season=12;
  S.day=8;
  S.fund=4200;
  S.fans=180;
  S.split='summer';
  S.phase='r1';
  S.preseason=false;
  S.transferWindow=0;
  S.selfBuilt=false;
  S.era=null;
  // 阵容：5 首发 + 替补；部分无 val
  const posList=['top','jg','mid','ad','sup'];
  posList.forEach((pos,i)=>{
    S.players.push(mkPlayer('p_late_'+pos,pos,'mid',{
      name:'后期选手'+i,
      val:i===2?undefined:(i===0?130:100),
      age:20+i
    }));
  });
  S.players.push(mkPlayer('p_bench_top','top','low',{name:'板凳上单',val:undefined,age:28}));
  S.players.push(mkPlayer('p_legacy','mid','low',{name:'名宿旧将',val:90,age:30}));
  S.lineup=posList.map(pos=>'p_late_'+pos);
  S.captain=null; // 队长为空
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  // 残留：幽灵首发 id（已退役/清人）
  S.lineup.push('ghost_retired_99');
  S.captain='ghost_captain_gone'; // 队长幽灵
  // titleHistory 16 条满额
  S.titleHistory=[];
  for(let i=0;i<16;i++){
    const champs=['AG超玩会','重庆狼队','武汉eStarPro','佛山DRG','北京WB'];
    S.titleHistory.push({
      season:1+i,
      split:i%2?'summer':'spring',
      event:i%3===0?'挑战者杯':(i%3===1?'春季赛':'夏季赛'),
      champ:champs[i%champs.length]
    });
  }
  // honors 20+ 满额（含无 title / 无 roster / 无 champion 的脏数据）
  S.honors=[];
  for(let i=0;i<22;i++){
    if(i===5){
      S.honors.push({season:i,champion:true}); // 缺 title、缺 roster
    }else if(i===7){
      S.honors.push({season:i,title:'脏数据亚军'}); // 缺 champion
    }else{
      S.honors.push({
        season:i,
        title:'2026+i 总冠军',
        champion:i%2===0,
        roster:i%4===0?'选手A、选手B、选手C':'—'
      });
    }
  }
  // fmvpHonor 满额 + 脏条
  S.fmvpHonor=[];
  for(let i=0;i<12;i++){
    if(i===3)S.fmvpHonor.push({year:2030}); // 缺 name/event/team
    else S.fmvpHonor.push({year:2026+i,event:i%2?'春季赛':'年总',name:'FMVP选手'+i,team:i%3===0?S.teamName:'AG超玩会'});
  }
  // awards：缺 first 的脏条（模拟半截迁移/外部编辑）
  S.awards=[
    {season:12,first:[{pos:'mid',name:'一阵中路',team:'AG超玩会'}],second:[{pos:'mid',name:'二阵中路',team:'eStar'}]},
    {season:11}, // 缺 first/second
    {season:10,first:[{name:'无pos选手',team:'X'}],second:null}, // 缺 pos、second=null
  ];
  // yearReviews：缺字段的脏条
  S.yearReviews=[
    {
      year:2038,season:12,team:S.teamName,
      stages:[{ev:'春季赛',place:'冠军'},{ev:'夏季赛',place:'四强'}],
      honors:[{title:'春季赛 总冠军',champion:true}],
      transfers:[{dir:'in',name:'签入A',fee:100,team:'AG'}],
      keys:[{opp:'狼队',stage:'总决赛',score:'4:2',win:true,peak:false}],
      achieved:['首冠时刻'],
      board:{rank:3,target:4,delta:12,note:'达成',trust:78},
      annualPts:180,annualRank:3,fund:4000,fans:100
    },
    {
      year:2037,season:11,team:S.teamName
      // 缺 stages/honors/transfers/keys/achieved/board/annualPts
    },
  ];
  // career.seasons：退役履历 + 缺 val/mvp/ovr
  S.mode='player';
  S.career={
    me:'p_legacy',
    retired:false,
    seasons:[
      {year:2036,team:'AG超玩会',apps:20,caps:80,kda:'3.1/2.0/6.2',mvp:5,ovr:82,val:110,titles:1},
      {year:2035,team:'狼队',apps:18,caps:70,kda:null}, // 缺 mvp/ovr/val/titles
    ],
    titles:1,fmvp:1,allstar:2,nat:1,
    stats:{trained:0,social:0,media:0,matches:10},
    role:'core',
  };
  // 董事会 + KPI 缺 label + board.log
  S.board={
    trust:55,
    kpi:{target:4,from:3}, // 无 label
    warn:1,fired:false,firedSeason:0,
    log:[
      {season:11,rank:3,target:4,delta:12,note:'达成',trust:70},
      {season:10,rank:null,target:null,delta:0,note:'缺数据'}, // 缺 rank/target 数值
    ]
  };
  S.managerCareer={years:8,titles:2,lastRank:3};
  // 转会台账大量
  S.transfers=[];
  for(let i=0;i<80;i++){
    S.transfers.push({yr:2030+i%10,season:1+i%12,dir:i%2?'in':'out',name:'转会选手'+i,fee:50+i});
  }
  // 历史复盘 + AI 战报
  S.history=[];
  for(let i=0;i<20;i++){
    S.history.push({
      opp:'对手'+i,stage:i%2?'季后赛':'常规赛',score:i%2?'4:2':'2:4',win:i%2===0,peak:i===3,
      yr:2038,
      logs:['第1局 我方 12-8 击败 对手'+i, i===1?undefined:'第2局 负 对手'],
      aiReport:i===2?'AI：这是一场后期关键战，双方后期团战拉满，最终拿下。':null
    });
  }
  // 事件日志膨胀
  S.eventLog=[];
  for(let i=0;i<120;i++){
    S.eventLog.push({txt:'后期动态事件 #'+i,t:Date.now(),level:i%3?'info':'gold',cat:i%4===0?'honor':(i%4===1?'match':'fund')});
  }
  // coachDeal 缺 honors（教练模式切换）
  S.coachDeal={years:3,log:[{year:2037,note:'换队',team:'eStar'}]}; // 无 honors
  // 市场/教练缺 skill 的脏数据
  S.market=[];
  const m1=mkPlayer('mkt1','jg','high',{name:'市场顶星'});
  S.market.push(m1);
  S.coachMarket=[{id:'c99',name:'脏教练',rating:90,style:'mid',bonus:10,styleBonus:3,cost:200,wage:20}];
  // 助教缺 skill
  S.assistants=[{id:'a1',name:'脏助教',rating:80,style:'lane',bonus:4,styleBonus:2,wage:10,cost:80}];
  // freeAgents / retiredCoaches
  S.freeAgents=[mkPlayer('fa1','ad','low',{name:'自由人'})];
  S.retiredCoaches=[{id:'rc1',name:'退役名宿',rating:80,type:'coach',style:'mid',bonus:5,styleBonus:3,wage:20,cost:150,skill:{n:'名宿',d:'加成'}}];
  S.hosts=[{id:'h1',name:'主播A',income:3}];
  // 列表/挂牌
  S.listed=[];
  S.bids=[];
  S.transferList=[];
  S.academy=[mkPlayer('aca1','mid','low',{name:'青训新秀',age:17,potential:3})];
  S.expiring=['p_legacy'];
  // champCore 残留幽灵 id
  S.champCore={ids:['ghost_retired_99','p_late_mid'],names:['名宿旧将','后期选手2'],titles:2,label:'2028春季赛'};
  // awards 阵容脏 pos
  S.awards.push({season:9,first:[{pos:'xxx',name:'错位',team:'?'}],second:[{pos:'sup',name:'正常',team:'AG'}]});
  // 初始化分组便于 renderLeague
  try{initGroups(S);}catch(e){}
  // 切回经理模式做多数渲染
  S.mode='manager';
  // 选手模式单独测
  return S;
}

function buildPlayerRetired(){
  const S=buildLateState();
  S.mode='player';
  S.career={
    me:'p_legacy',
    retired:true,
    legacy:{name:'名宿旧将',age:31,ovr:85,mvp:12,titles:2,seasons:10},
    seasons:[
      {year:2036,team:'AG超玩会',apps:20,caps:80,kda:'3.1/2.0/6.2',mvp:5,ovr:82,val:110,titles:1},
      {year:2035,team:'狼队',apps:18}, // 缺大量字段
    ],
    titles:2,fmvp:1,allstar:2,nat:1,coachPath:true,
    stats:{trained:0,social:0,media:0,matches:10},
  };
  // 退役后本人已不在名单
  S.players=S.players.filter(p=>p.id!=='p_legacy');
  S.lineup=S.lineup.filter(id=>id!=='p_legacy'&&id!=='ghost_retired_99');
  return S;
}

function scanHtml(html,tag,issues){
  if(html==null)return;
  const s=String(html);
  if(/undefined/.test(s)){
    const m=s.match(/.{0,40}undefined.{0,40}/g)||[];
    m.slice(0,3).forEach(x=>issues.push(tag+': undefined 文本 → '+x.replace(/\\s+/g,' ').trim()));
  }
  if(/NaN/.test(s)){
    const m=s.match(/.{0,40}NaN.{0,40}/g)||[];
    m.slice(0,3).forEach(x=>issues.push(tag+': NaN 文本 → '+x.replace(/\\s+/g,' ').trim()));
  }
  if(/\\[object Object\\]/.test(s)){
    issues.push(tag+': 出现 [object Object]');
  }
}

function callRender(fnName,issues){
  try{
    const fn=this[fnName]||eval(fnName);
    if(typeof fn!=='function'){issues.push(fnName+': 函数不存在');return null;}
    const r=fn();
    return r;
  }catch(e){
    issues.push(fnName+': THROW '+(e&&e.message||e));
    return null;
  }
}

function elHtml(id){
  const el=document.getElementById(id);
  return el?el.innerHTML:'';
}

function runProbe(st){
  S=st;
  const issues=[];
  const pageMap={renderClub:'page-club',renderLineup:'page-lineup',renderMarket:'page-market',renderTrain:'page-train',renderLeague:'page-league',renderKjia:'page-kjia',renderUnion:'page-union',renderHall:'page-hall',renderBiz:'page-biz',renderCareer:'page-career'};
  const renders=['renderHeader','renderClub','renderLineup','renderMarket','renderTrain','renderLeague','renderKjia','renderUnion','renderHall','renderBiz'];
  renders.forEach(n=>{
    try{ (0,eval)(n)(); }catch(e){ issues.push(n+': THROW '+(e&&e.message||e)); }
  });
  Object.keys(pageMap).forEach(n=>{
    scanHtml(elHtml(pageMap[n]),n+'#'+pageMap[n],issues);
  });
  scanHtml(elHtml('header'),'renderHeader#header',issues);
  // 选手生涯页
  try{renderCareer();}catch(e){issues.push('renderCareer: THROW '+(e&&e.message||e));}
  scanHtml(elHtml('page-career'),'renderCareer#page-career',issues);
  // 年度回顾弹窗（含缺字段脏条）
  [0,1].forEach(i=>{
    try{showYearReview(i);}catch(e){issues.push('showYearReview('+i+'): THROW '+(e&&e.message||e));}
    scanHtml(elHtml('app-modal-body'),'showYearReview('+i+')',issues);
  });
  // 联盟历史页
  try{window._unionMode='hist';renderUnion();}catch(e){issues.push('renderUnion(hist): THROW '+(e&&e.message||e));}
  scanHtml(elHtml('page-union'),'renderUnion#hist',issues);
  window._unionMode='now';
  // 战队阵容弹窗
  try{showSquad('AG超玩会');}catch(e){issues.push('showSquad: THROW '+(e&&e.message||e));}
  scanHtml(elHtml('app-modal-body'),'showSquad',issues);
  // 选手档案（有/无 val）
  try{
    const p=S.players.find(x=>x.val===undefined)||S.players[0];
    if(p)showCareer(p);
  }catch(e){issues.push('showCareer: THROW '+(e&&e.message||e));}
  scanHtml(elHtml('app-modal-body'),'showCareer',issues);
  // 复盘
  try{ if(S.history&&S.history[1])showReplay(S.history[1]); }catch(e){issues.push('showReplay: THROW '+(e&&e.message||e)); }
  scanHtml(elHtml('app-modal-body'),'showReplay',issues);
  // 董事会下课态
  try{
    S.board.fired=true;S.board.firedSeason=12;
    renderClub();
  }catch(e){issues.push('renderClub(fired): THROW '+(e&&e.message||e));}
  scanHtml(elHtml('page-club'),'renderClub#fired',issues);
  S.board.fired=false;
  // 教练模式
  try{
    S.mode='coach';
    if(!S.coachDeal)S.coachDeal={years:1,log:[]};
    // honors 缺失已在构造时注入
    renderClub();
  }catch(e){issues.push('renderClub(coach): THROW '+(e&&e.message||e));}
  scanHtml(elHtml('page-club'),'renderClub#coach',issues);
  S.mode='manager';
  return issues;
}

function runPlayerRetired(){
  S=buildPlayerRetired();
  const issues=[];
  try{renderCareer();}catch(e){issues.push('renderCareer(retired): THROW '+(e&&e.message||e));}
  scanHtml(elHtml('page-career'),'renderCareer#retired',issues);
  try{renderHall();}catch(e){issues.push('renderHall(retired player): THROW '+(e&&e.message||e));}
  scanHtml(elHtml('page-hall'),'renderHall#playerRetired',issues);
  try{renderClub();}catch(e){issues.push('renderClub(player retired): THROW '+(e&&e.message||e));}
  scanHtml(elHtml('page-club'),'renderClub#playerRetired',issues);
  // 在役选手生涯页但 me 已不在 roster（幽灵 career.me）
  try{
    S.career.retired=false;
    S.career.me='ghost_me_gone';
    S.career.legacy=null;
    delete S.career.legacy;
    renderCareer();
  }catch(e){issues.push('renderCareer(ghost me): THROW '+(e&&e.message||e));}
  scanHtml(elHtml('page-career'),'renderCareer#ghostMe',issues);
  return issues;
}

// ====== 场景 A：完整后期脏数据 ======
const issuesA=runProbe(buildLateState());
// ====== 场景 B：选手退役/幽灵 me ======
const issuesB=runPlayerRetired();

// ====== 场景 C：纯缺字段最小脏档（不走 newState 初始化）=====
const issuesC=[];
try{
  const S3=newState('脏档','⚔️');
  fillRoster(S3,'mid','star');
  S3.season=15;
  S3.titleHistory=[{}, {season:2}, {event:'春季赛'}]; // 空对象/缺字段
  S3.honors=[{}];
  S3.fmvpHonor=[{}];
  S3.awards=[{season:1}];
  S3.yearReviews=[{year:2040,season:15,team:S3.teamName}];
  S3.board={trust:50,kpi:{},warn:0,fired:false,firedSeason:0,log:[{delta:null}]};
  S3.captain=null;
  S=S3;
  ['renderClub','renderHall','renderBiz','renderLeague','renderUnion','renderMarket','renderLineup'].forEach(n=>{
    try{(0,eval)(n)();}catch(e){issuesC.push(n+': THROW '+(e&&e.message||e));}
  });
  try{showYearReview(0);}catch(e){issuesC.push('showYearReview: THROW '+(e&&e.message||e));}
  scanHtml(elHtml('app-modal-body'),'C#showYearReview',issuesC);
  scanHtml(elHtml('page-hall'),'C#hall',issuesC);
  scanHtml(elHtml('page-biz'),'C#biz',issuesC);
  scanHtml(elHtml('page-club'),'C#club',issuesC);
  scanHtml(elHtml('page-union'),'C#union',issuesC);
}catch(e){
  issuesC.push('场景C 构造: '+(e&&e.message||e));
}

const total=issuesA.length+issuesB.length+issuesC.length;
JSON.stringify({A:issuesA,B:issuesB,C:issuesC,total:total});
`;

let raw;
try {
  raw = vm.runInContext(PROBE, dom);
} catch (e) {
  console.log('✗ 沙箱异常: ' + (e && e.message || e));
  console.log(e && e.stack || '');
  process.exit(1);
}
let result;
try { result = JSON.parse(raw); } catch (e) {
  console.log('✗ 结果解析失败: ' + raw);
  process.exit(1);
}
function dump(tag, arr) {
  if (!arr || !arr.length) { console.log('[' + tag + '] 无问题'); return; }
  console.log('[' + tag + '] ' + arr.length + ' 条：');
  [...new Set(arr)].forEach(x => console.log('  - ' + x));
}
dump('A 后期脏数据渲染', result.A);
dump('B 退役/幽灵选手', result.B);
dump('C 极端缺字段', result.C);
if (result.total) {
  console.log('合计问题 ' + result.total + ' 条');
  process.exitCode = 1;
} else {
  console.log('全部通过');
}

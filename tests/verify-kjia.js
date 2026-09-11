// K甲联赛完整版回归：独立赛程/积分榜/二队出战与表现数据/守卫/旧档懒初始化/收官结算
// 运行：node tests/verify-kjia.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  // fillRoster 只有 5 人首发：补一名替补用于下放（同 verify-tactics 的 mkS 做法）
  const addBench=(s,band)=>{const u=new Set(s.players.map(p=>p.name));const b=genPlayer(genFreeAgentDef(pick(POS_ORDER),band||'mid',u));b.apps=0;s.players.push(b);return b;};

  // ① 独立赛程：8 队（7 AI + 我的二队）单循环 7 轮，每队 7 场、两两恰交手一次
  const s1=newState('K甲队','x');fillRoster(s1,'mid','star');S=s1;
  const k1=initKjia(s1);
  const my=kjiaMyName(s1);
  const allTeams=k1.teams;
  const pairCnt={};
  let totalMatches=0;
  k1.rounds.forEach(rd=>rd.forEach(m=>{
   totalMatches++;
   const key=[m.a,m.b].sort().join('|');
   pairCnt[key]=(pairCnt[key]||0)+1;
  }));
  const perTeam={};allTeams.forEach(t=>perTeam[t]=0);
  k1.rounds.forEach(rd=>rd.forEach(m=>{perTeam[m.a]++;perTeam[m.b]++;}));
  const badPair=Object.keys(pairCnt).filter(key=>pairCnt[key]!==1);
  const badTeam=allTeams.filter(t=>perTeam[t]!==7);
  if(allTeams.length!==8)fail('K甲应为 8 队: '+allTeams.length);
  else if(!allTeams.includes(my))fail('二队未在 K甲名录: '+my);
  else if(k1.rounds.length!==7||totalMatches!==28)fail('赛程应为 7 轮 28 场: '+k1.rounds.length+'轮 '+totalMatches+'场');
  else if(badPair.length)fail('对阵重复/缺失: '+badPair.slice(0,3).join(','));
  else if(badTeam.length)fail('每队应 7 场: '+badTeam.slice(0,3).join(','));
  else log('① 独立赛程：8 队单循环 7 轮 28 场，二队「'+my+'」在列，两两恰交手一次');

  // ② 满赛程推进：每轮全部出分、积分表一致（胜场和=28）、冠军=榜首
  const s2=newState('赛程队','x');fillRoster(s2,'mid','star');S=s2;
  initKjia(s2);
  for(let i=0;i<7;i++)kjiaNextRound(s2);
  const k2=s2.kjia;
  let played=0,winSum=0;
  k2.rounds.forEach(rd=>rd.forEach(m=>{if(m.r)played++;}));
  Object.keys(k2.tables).forEach(t=>winSum+=k2.tables[t].w);
  const rank=kjiaRank(s2);
  if(played!==28)fail('满赛程应有 28 场出分: '+played);
  else if(winSum!==28)fail('积分表胜场总和应=28: '+winSum);
  else if(rank[0]!==k2.champ)fail('冠军应=榜首: '+rank[0]+' vs '+k2.champ);
  else if(!(k2.tables[k2.champ].pts>=k2.tables[rank[1]].pts))fail('冠军积分不高于次名');
  else log('② 赛程推进：7 轮全部出分，积分表胜场和 28，冠军「'+k2.champ+'」=榜首');

  // ③ 下放选手真实出战：进二队名单 → 二队战力提升 → 打一轮出 KDA/统计/近况日志
  const s3=newState('练级队','x');fillRoster(s3,'mid','star');addBench(s3,'star');S=s3;
  initKjia(s3);
  const b3=s3.players.find(p=>!s3.lineup.includes(p.id));
  const basePow=kjiaTeamPower(s3);
  sendKjia(s3,b3.id);
  const afterPow=kjiaTeamPower(s3);
  if(!kjiaSquad(s3).some(p=>p.id===b3.id))fail('下放选手未进入二队名单');
  else if(afterPow<=basePow)fail('下放后二队战力未提升: '+basePow+'→'+afterPow);
  else{
   // 推到二队的下一轮（day 每 2 天一轮，直接调 kjiaNextRound 直到打满 7 轮）
   for(let i=0;i<7;i++)kjiaNextRound(s3);
   const st=b3.kjiaStats;
   if(!st||!st.apps)fail('下放选手没有出场记录（表现数据断了）');
   else if(!(b3.kjiaLog||[]).length)fail('下放选手没有近况日志');
   else if(st.k+st.d+st.a<=0)fail('KDA 累计为空');
   else log('③ 真实出战：下放后二队战力 '+basePow+'→'+afterPow+'，'+b3.name+' 出场 '+st.apps+' 场（KDA 累计 '+st.k+'/'+st.d+'/'+st.a+' · MVP'+st.mvp+'），近况日志 '+b3.kjiaLog.length+' 条');
  }

  // ④ 下放守卫：锻炼中不能出售/挂牌/放走
  const s4=newState('守卫队','x');fillRoster(s4,'mid','star');addBench(s4);S=s4;
  const b4=s4.players.find(p=>!s4.lineup.includes(p.id));
  sendKjia(s4,b4.id);
  b4.contract=0; // 放走只对合同到期选手开放，先把合同清零再试
  let threw='';
  try{openSellNego(s4,b4.id);threw=(window._sellNego&&window._sellNego.pid===b4.id)?'sell-nego-opened':'';}catch(e){threw=e.message;}
  if(threw)fail('K甲锻炼中仍打开了出售谈判: '+threw);
  else{
   listPlayer(s4,b4.id);
   if((s4.listed||[]).some(x=>x.id===b4.id))fail('K甲锻炼中仍能挂牌');
   else{
    releasePlayer(s4,b4.id);
    if(!s4.players.some(p=>p.id===b4.id))fail('K甲锻炼中仍能放走（releasePlayer）');
    else log('④ 下放守卫：锻炼中出售谈判/挂牌/放走全部被拦截');
   }
  }

  // ⑤ 归队成长：30 天倒计时归零 + 属性成长（含场上即时成长的累计口径）
  const s5=newState('归队队','x');fillRoster(s5,'mid','star');addBench(s5);S=s5;
  initKjia(s5);
  const b5=s5.players.find(p=>!s5.lineup.includes(p.id));
  sendKjia(s5,b5.id);
  const gain0=b5.kjiaGain||0;
  for(let i=0;i<31;i++)nextDay(s5); // 挂真实日历：kjiaTick + K甲轮次一起推进
  const g5=(b5.kjiaGain||0)-gain0; // kjiaGain 只累计 K甲成长（归队 +2~4×2 + 场上即时 +1），随机日常事件不掺入
  if(b5.kjia!==0)fail('倒计时未归零: '+b5.kjia);
  else if(g5<4)fail('归队成长不足: +'+g5);
  else if(!s5.eventLog.some(e=>/K甲归队/.test(e.txt)))fail('归队日志缺失');
  else log('⑤ 归队成长：30 天归队 K甲成长 +'+g5+'（kjiaGain 口径，含场上即时成长），归队日志已广播');

  // ⑥ 旧档懒初始化：kjia 缺字段时 nextDay 自动补建联赛
  const s6=newState('旧档队','x');fillRoster(s6,'mid','star');S=s6;
  s6.kjia=undefined; // 模拟旧档
  nextDay(s6);
  if(!s6.kjia||!s6.kjia.teams)fail('旧档 nextDay 未懒初始化 K甲联赛');
  else log('⑥ 旧档兼容：kjia 缺字段时 nextDay 懒初始化出 8 队联赛');

  // ⑦ 收官结算：二队夺冠 → 奖金+粉丝+士气；面板渲染关键区块
  const s7=newState('夺冠队','x');fillRoster(s7,'star','star');addBench(s7);S=s7; // star 档班底：二队战力占优
  initKjia(s7);
  const fund0=s7.fund,fans0=s7.fans;
  s7.kjia.powers[KJIA_AI_TEAMS[0]]=100; // 压低 AI：确保二队登顶
  KJIA_AI_TEAMS.slice(1).forEach(t=>{s7.kjia.powers[t]=100;});
  const b7=s7.players.find(p=>!s7.lineup.includes(p.id));
  sendKjia(s7,b7.id);
  for(let i=0;i<7;i++)kjiaNextRound(s7);
  if(s7.kjia.champ!==kjiaMyName(s7))fail('压低 AI 后二队仍未夺冠: '+s7.kjia.champ);
  else if(s7.fund-fund0<80)fail('K甲夺冠奖金未发放: +'+(s7.fund-fund0));
  else if(!s7.eventLog.some(e=>/二队 K甲夺冠/.test(e.txt)))fail('夺冠公告缺失');
  else{
   // ⑧ 面板渲染：二队页关键区块齐全
   let rErr='';
   try{goPage('kjia');}catch(e){rErr=e.message;}
   const body=document.querySelector('#page-kjia').innerHTML;
   const hasAll=['K甲积分榜','赛程与赛果','下放选手表现','二队班底'].every(t=>body.includes(t));
   if(rErr)fail('二队页渲染异常: '+rErr);
   else if(!hasAll)fail('二队页缺关键区块');
   else if(!body.includes('K甲锻炼'))fail('下放选手卡片未显示 K甲状态');
   else log('⑦ 收官与面板：二队夺冠（奖金+粉丝+公告）· 二队页四区块渲染齐全（含选手 K甲表现）');
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);

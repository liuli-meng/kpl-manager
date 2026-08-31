
/* ================= 比赛与联赛（KPL 2025 官方赛制） =================
   常规赛4阶段：第一轮(3组单循环BO5)→第二轮(S/A/B)→卡位赛(BO7含巅峰对决)→第三轮(S/A单循环BO5)
   季后赛：S组6队(前4进胜者组)+A组前4 → 10队 BO7 双败淘汰，总决赛第7局巅峰对决
   常规赛胜者积1分；2026起奖金按胜小局数结算 */
const PHASE_NAME={r1:'常规赛·第一轮',r2:'常规赛·第二轮',card:'卡位赛',r3:'常规赛·第三轮',playoff:'季后赛',champion:'赛季结束',eliminated:'赛季结束'};
function logLevel(txt){
  if(/冠军|王朝|夺得总冠军/.test(txt))return 'gold';
  if(/惜败|败|负|😔|拖欠工资|淘汰|无缘/.test(txt))return 'lose';
  if(/胜|击败|获胜|晋级|卡位/.test(txt))return 'win';
  if(/💰|💸|🎁|🤝|🎉|🚀|赞助|奖|🎫/.test(txt))return 'gold';
  return 'info';
}
function logEvent(s,txt){s.eventLog.unshift({txt,t:Date.now(),level:logLevel(txt)});s.eventLog=s.eventLog.slice(0,120);}
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=rnd(0,i);[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function powerOf(s,name){
  if(name===s.teamName)return teamPower(s);
  ensureAiRosters(s,name); // 懒建真实阵容并写入 aiPower（与玩家同刻度）
  return s.aiPower[name]||450;
}
function phaseGroups(s){
  if(s.phase==='r1')return ['G1','G2','G3'];
  if(s.phase==='r2')return ['S','A','B'];
  if(s.phase==='r3')return ['S','A'];
  return [];
}
function myGroup(s){
  for(const g of phaseGroups(s)){if(s.groups[g]&&s.groups[g].includes(s.teamName))return g;}
  return null;
}
function sortGroup(s,g){
  const table=s.tables[g]||{};
  return (s.groups[g]||[]).slice().sort((a,b)=>{
    const ta=table[a]||{pts:0,pw:0},tb=table[b]||{pts:0,pw:0};
    if(ta.pts!==tb.pts)return tb.pts-ta.pts;
    return tb.pw-ta.pw;
  });
}
/* 初始化分组：玩家新队进 G3（第一轮抽签组），其余按战力蛇形分 G1/G2/G3 */
function initGroups(s){
  // 玩家执教的俱乐部从 AI 池移除（如选 AG 则 AI 中没有 AG）
  let aiList=AI_TEAMS.filter(t=>t.name!==s.teamName);
  // 自建队不在 AI 名单中：自动顶替最弱队席位（KPL 18 队固定）
  if(aiList.length>17)aiList=aiList.filter(t=>t.name!=='常山UUG');
  // 分组按真实阵容战力（与玩家 teamPower 同刻度），豪门进 G1、弱旅进 G3
  const all=aiList.map(t=>{
    const r=ensureAiRosters(s,t.name);
    return {name:t.name,power:r.length?aiRosterPower(r):t.power};
  });
  all.push({name:s.teamName,power:s.seedPower||teamPower(s)}); // 玩家种子=开局真实战力
  all.sort((a,b)=>b.power-a.power);
  s.leagueTeams=all.map(x=>x.name); // 联盟 18 队注册名录（联盟页/榜单用）
  const g1=all.slice(0,6).map(x=>x.name);
  const g2=all.slice(6,12).map(x=>x.name);
  const g3=all.slice(12,18).map(x=>x.name);
  s.groups={G1:g1,G2:g2,G3:g3};
  s.phase='r1';
  s.aiPower={};
  aiList.forEach(t=>{
    const r=s.aiRosters[t.name];
    s.aiPower[t.name]=r&&r.length?aiRosterPower(r):t.power;
  });
  initTables(s);
  genRoundSchedule(s);
  s.card=null;s.playoff=null;s.eliminated=[];
}
function initTables(s){
  s.tables={};
  phaseGroups(s).forEach(g=>{
    s.tables[g]={};
    s.groups[g].forEach(n=>{s.tables[g][n]={w:0,l:0,pts:0,pw:0};});
  });
}
/* 生成玩家所在组单循环赛程（5场） */
function genRoundSchedule(s){
  const g=myGroup(s);
  const opps=(s.groups[g]||[]).filter(n=>n!==s.teamName);
  shuffle(opps);
  s.schedule=opps.map((op,i)=>({round:i+1,opp:op,result:null,myScore:0,opScore:0}));
  s.matchIdx=0;
  buildGroupSchedule(s);
}
/* 全联盟赛程：每组单循环（6队→5轮×3场），玩家的场次留给真人打，其余由 AI 逐轮模拟 */
function buildGroupSchedule(s){
  s.aiSchedule={};
  phaseGroups(s).forEach(g=>{
    const teams=(s.groups[g]||[]).slice();
    // 舍转法：固定首队，其余轮转，生成 5 轮 × 3 场
    const n=teams.length,rounds=[];
    const arr=teams.slice(1);
    for(let r=0;r<n-1;r++){
      const pairs=[];
      const ring=[teams[0],...arr];
      for(let i=0;i<n/2;i++){
        const a=ring[i],b=ring[n-1-i];
        if(a&&b)pairs.push([a,b]);
      }
      rounds.push(pairs);
      arr.unshift(arr.pop());
    }
    s.aiSchedule[g]=[];
    rounds.forEach((pairs,ri)=>{
      pairs.forEach(([a,b])=>{
        if(a===s.teamName||b===s.teamName)return; // 玩家场次不模拟
        s.aiSchedule[g].push({round:ri+1,a,b,r:null});
      });
    });
  });
}
/* 模拟玩家已打到的轮次为止、所有组内尚未进行的 AI 场次，并更新积分表 */
function simulateAiRound(s,upToRound){
  if(!s.aiSchedule||!phaseGroups(s).some(g=>s.aiSchedule[g]))buildGroupSchedule(s); // 老存档懒构建
  const reports=[];
  phaseGroups(s).forEach(g=>{
    (s.aiSchedule[g]||[]).forEach(m=>{
      if(m.round>upToRound||m.r)return;
      const r=simSeriesResult(s,m.a,m.b,KPL.BO5);
      m.r={w:r.win?m.a:m.b,mw:r.mw,ow:r.ow};
      const ta=(s.tables[g]||{})[m.a],tb=(s.tables[g]||{})[m.b];
      if(!ta||!tb)return;
      if(r.win){ta.w++;ta.pts++;tb.l++;}
      else{tb.w++;tb.pts++;ta.l++;}
      ta.pw+=r.mw;tb.pw+=r.ow;
      if(m.round===upToRound)reports.push(g+'组：'+m.a+' '+r.mw+':'+r.ow+' '+m.b);
    });
  });
  if(reports.length)logEvent(s,'📰 联赛战报（第'+upToRound+'轮）：'+reports.slice(0,6).join('；'));
}
/* AI 系列赛（BO5/BO7 模拟，返回局数） */
function simSeriesResult(s,a,b,bo){
  let mw=0,ow=0;
  const need=Math.ceil(bo/2);
  const aEff=powerOf(s,a)*(1+dynastyStreak(s,b)*0.02); // 王朝反制①：对方连冠 → 我方研究加成
  const bEff=powerOf(s,b)*(1+dynastyStreak(s,a)*0.02);
  for(let i=1;i<=bo&&mw<need&&ow<need;i++){
    const w=Math.random()<winChance(aEff,bEff);
    if(w)mw++;else ow++;
  }
  return {win:mw>ow,mw,ow};
}
/* ===== 阶段推进 ===== */
function advancePhase(s){
  simulateAiRound(s,99); // 兜底补完本阶段未模拟的 AI 场次
  if(s.phase==='r1'){
    const sTeams=[],aTeams=[],bTeams=[];
    ['G1','G2','G3'].forEach(grp=>{
      const rank=sortGroup(s,grp);
      sTeams.push(rank[0],rank[1]);
      aTeams.push(rank[2],rank[3]);
      bTeams.push(rank[4],rank[5]);
    });
    s.groups={S:sTeams,A:aTeams,B:bTeams};
    s.phase='r2';
    initTables(s);
    genRoundSchedule(s);
    const g=myGroup(s);
    logEvent(s,'📊 第一轮结束！'+s.teamName+' 进入'+(g==='S'?'S组':g==='A'?'A组':'B组')+'（第二轮）');
  }else if(s.phase==='r2'){
    s.phase='card';
    setupCard(s);
  }else if(s.phase==='r3'){
    buildPlayoff(s);
  }
  save();renderAll();
}
/* ===== 卡位赛（BO7 含巅峰对决） ===== */
function setupCard(s){
  const sRank=sortGroup(s,'S'),aRank=sortGroup(s,'A'),bRank=sortGroup(s,'B');
  s.card={matches:[
    {a:sRank[4],b:aRank[1],r:null,winTo:'S'}, // S5 vs A2
    {a:sRank[5],b:aRank[0],r:null,winTo:'S'}, // S6 vs A1
    {a:aRank[4],b:bRank[1],r:null,winTo:'A'}, // A5 vs B2
    {a:aRank[5],b:bRank[0],r:null,winTo:'A'}, // A6 vs B1
  ],idx:0};
  s.eliminated=[...(s.eliminated||[]),...bRank.slice(2)]; // B3-B6 淘汰
  const myR=bRank.indexOf(s.teamName);
  if(myGroup(s)==='B'&&myR>=2){
    s.phase='eliminated';
    logEvent(s,'😢 第二轮 B 组排名 3-6，无缘本赛季后续比赛');
    // 联盟照常打完本赛季：补完卡位赛与季后赛，产生冠军（王朝统计/连冠反制需要）
    s.card.matches.forEach(m=>{if(!m.r){const r=simSeriesResult(s,m.a,m.b,KPL.BO7);m.r=r.win?m.a:m.b;}});
    s.card.idx=s.card.matches.length;
    finishCard(s);
    save();renderAll();
    return;
  }
  const playerIn=s.card.matches.some(m=>m.a===s.teamName||m.b===s.teamName);
  logEvent(s,'🎫 卡位赛（BO7·含巅峰对决）即将开始！');
  if(!playerIn){
    s.card.matches.forEach(m=>{const r=simSeriesResult(s,m.a,m.b,KPL.BO7);m.r=r.win?m.a:m.b;});
    s.card.idx=s.card.matches.length;
    finishCard(s);
    return;
  }
  save();renderAll();
}
function playCardNext(s){
  const m=s.card.matches[s.card.idx];
  if(!m){finishCard(s);return;}
  if(m.a===s.teamName||m.b===s.teamName){
    const opName=m.a===s.teamName?m.b:m.a;
    // 系列赛中断恢复：不重置比分
    if(s.series&&s.series.stage==='card'){
      showPreMatch('卡位赛（BO7·含巅峰对决）vs '+opName+' · 第'+(s.series.mw+s.series.ow+1)+'局（'+s.series.mw+':'+s.series.ow+'）');
      return;
    }
    s.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'card',cardMatch:m,logs:[],myName:m.a===s.teamName?m.a:m.b,opName,side:firstSide(s,'card',opName)};s.seriesAuto=false;
    resetOppEnergy(s,opName);
    showPreMatch('卡位赛（BO7·含巅峰对决）vs '+opName+' · 第1局');
  }else{
    const r=simSeriesResult(s,m.a,m.b,KPL.BO7);
    m.r=r.win?m.a:m.b;
    logEvent(s,'🎫 卡位赛：'+m.a+' vs '+m.b+'，'+m.r+' 晋级');
    s.card.idx++;
    save();renderAll();
    playCardNext(s);
  }
}
function finishCard(s){
  const sRank=sortGroup(s,'S'),aRank=sortGroup(s,'A');
  const sNew=[sRank[0],sRank[1],sRank[2],sRank[3]];
  const aNew=[aRank[2],aRank[3]];
  (s.card.matches||[]).forEach(m=>{
    if(!m.r){const r=simSeriesResult(s,m.a,m.b,KPL.BO7);m.r=r.win?m.a:m.b;}
    if(m.winTo==='S'){sNew.push(m.r);aNew.push(m.r===m.a?m.b:m.a);}
    else aNew.push(m.r);
  });
  s.groups={S:sNew,A:aNew};
  const alive=new Set([...sNew,...aNew]);
  s.eliminated=AI_TEAMS.map(t=>t.name).filter(n=>!alive.has(n));
  if(!alive.has(s.teamName)){
    s.phase='eliminated';
    logEvent(s,'😢 卡位赛未能突围，本赛季止步');
    buildPlayoff(s); // 联盟照常打完季后赛，产生本赛季冠军（王朝统计/连冠反制需要）
    save();renderAll();
    return;
  }
  s.phase='r3';
  initTables(s);
  genRoundSchedule(s);
  logEvent(s,'🏁 卡位赛结束！'+s.teamName+' 进入第三轮'+(myGroup(s)==='S'?'S组':'A组'));
  save();renderAll();
}
/* ===== 季后赛（10队双败淘汰 BO7） ===== */
function buildPlayoff(s){
  // 旧版残留的 simulateGroupAI 调用已删：r3 的 AI 场次由 simulateAiRound 逐轮模拟 + advancePhase 兜底补完，此处重跑会重复计分（且该函数在重构时已丢失导致进季后赛必崩）
  const sRank=sortGroup(s,'S'),aRank=sortGroup(s,'A');
  if(!sRank.length){s.phase='eliminated';save();renderAll();return;}
  s.playoff={
    wb:[{a:sRank[0],b:sRank[3],r:null},{a:sRank[1],b:sRank[2],r:null}], // 胜者组R1: S1vS4,S2vS3
    lb:[{a:aRank[0],b:aRank[3],r:null},{a:aRank[1],b:aRank[2],r:null}], // 败者组R1: A1vA4,A2vA3
    lb2:[{a:sRank[4],b:null,r:null},{a:sRank[5],b:null,r:null}], // S5/S6 直进败者组R2
    lb3:[{a:null,b:null,r:null},{a:null,b:null,r:null}], // 败者组R3: 胜者组R1败者 vs 败者组R2胜者
    wf:{a:null,b:null,r:null}, // 胜者组决赛
    lb4:{a:null,b:null,r:null}, // 败者组半决赛: lb3两胜者
    lbf:{a:null,b:null,r:null}, // 败者组决赛: wf败者 vs lb4胜者
    final:{a:null,b:null,r:null},champ:null
  };
  s.phase=(s.phase==='eliminated')?s.phase:'playoff'; // 玩家已出局时保留"止步"状态
  const inPlayoff=s.groups.S.includes(s.teamName)||aRank.slice(0,4).includes(s.teamName);
  logEvent(s,'🏆 季后赛开启！10强 BO7 双败淘汰');
  if(!inPlayoff){
    logEvent(s,'😢 未能晋级季后赛，本赛季止步');
    let guard=0;
    while(!s.playoff.final.r&&guard<20){playoffStep(s);guard++;}
    return;
  }
  save();renderAll();
}
function playoffStep(s){
  const p=s.playoff;
  if(!p)return;
  for(let i=0;i<2;i++){const m=p.wb[i];if(m.r===null&&m.a&&m.b){playPoMatch(s,m,'wb'+(i+1));return;}}
  for(let i=0;i<2;i++){const m=p.lb[i];if(m.r===null&&m.a&&m.b){playPoMatch(s,m,'lb'+(i+1));return;}}
  for(let i=0;i<2;i++){
    const m=p.lb2[i];
    if(m.b===null&&p.lb[i].r)m.b=p.lb[i].r;
    if(m.r===null&&m.a&&m.b){playPoMatch(s,m,'lb2_'+(i+1));return;}
  }
  if(p.wf.a===null){p.wf.a=p.wb[0].r;p.wf.b=p.wb[1].r;}
  if(p.wf.r===null&&p.wf.a&&p.wf.b){playPoMatch(s,p.wf,'胜者组决赛');return;}
  for(let i=0;i<2;i++){
    const m=p.lb3[i];
    if(m.a===null)m.a=p.wb[i].r===p.wb[i].a?p.wb[i].b:p.wb[i].a;
    if(m.b===null&&p.lb2[i].r)m.b=p.lb2[i].r;
    if(m.r===null&&m.a&&m.b){playPoMatch(s,m,'lb3_'+(i+1));return;}
  }
  if(p.lb4.a===null){p.lb4.a=p.lb3[0].r;p.lb4.b=p.lb3[1].r;}
  if(p.lb4.r===null&&p.lb4.a&&p.lb4.b){playPoMatch(s,p.lb4,'败者组半决赛');return;}
  // 败者组决赛：胜者组决赛败者 vs 败者组半决赛胜者（双败制关键）
  if(p.lbf.a===null){p.lbf.a=p.wf.r===p.wf.a?p.wf.b:p.wf.a;p.lbf.b=p.lb4.r;}
  if(p.lbf.r===null&&p.lbf.a&&p.lbf.b){playPoMatch(s,p.lbf,'败者组决赛');return;}
  if(p.final.a===null){p.final.a=p.wf.r;p.final.b=p.lbf.r;}
  if(p.final.r===null&&p.final.a&&p.final.b){playPoMatch(s,p.final,'总决赛');return;}
  if(p.final.r){
    p.champ=p.final.r;
    s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,champ:p.final.r}]).slice(-12); // 王朝统计（连冠反制用）
    if(s.phase!=='eliminated')s.phase='champion'; // 玩家提前出局时：补完的联盟赛季不覆盖"止步"状态
    s.champion=p.final.r===s.teamName;
    if(s.champion||p.final.a===s.teamName||p.final.b===s.teamName)recordSeason(s); // 冠军/亚军均入册荣誉室
    if(s.champion){
      // 夺冠人气暴涨：全队商业价值提升（代言收入增加）
      s.players.forEach(p=>p.popularity=Math.min(99,(p.popularity||0)+5));
      logEvent(s,'📈 夺冠带来巨大曝光！全队选手人气+5，代言收入提升');
    }
    leaguePayout(s,s.champion?'冠军':'亚军');
    logEvent(s,'赛季'+s.season+'总冠军：'+p.final.r+'！'+(s.champion?'你就是冠军！':'下赛季再战！'));
    save();renderAll();
  }
}
function playPoMatch(s,m,slot){
  if(m.a===s.teamName||m.b===s.teamName){
    const opName=m.a===s.teamName?m.b:m.a;
    // 系列赛中断恢复：不重置比分
    if(s.series&&s.series.stage==='po'){
      showPreMatch((slot==='总决赛'?'总决赛':'季后赛')+'（BO7·含巅峰对决）vs '+opName+' · 第'+(s.series.mw+s.series.ow+1)+'局（'+s.series.mw+':'+s.series.ow+'）');
      return;
    }
    s.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'po',poSlot:slot,poMatch:m,logs:[],myName:m.a===s.teamName?m.a:m.b,opName,side:firstSide(s,'playoff',opName)};s.seriesAuto=false;
    resetOppEnergy(s,opName);
    showPreMatch((slot==='总决赛'?'总决赛':'季后赛')+'（BO7·含巅峰对决）vs '+opName+' · 第1局');
    return;
  }
  const r=simSeriesResult(s,m.a,m.b,KPL.BO7);
  m.r=r.win?m.a:m.b;
  logEvent(s,'📺 季后赛（'+slot+'）：'+m.a+' '+(r.win?'胜':'负')+' '+m.b+'，'+m.r+' 晋级');
  save();renderAll();
  playoffStep(s);
}
/* 注意：startPlayoff 定义在 match.js（带转会期拦截），此处不得重复定义，
   否则按加载顺序后者会覆盖、容易造成两处逻辑不一致 */
/* 联盟分润：赛季末按季后赛名次分成（KPL 联盟承诺俱乐部分润不低于工资帽） */
function leaguePayout(s,place){
  const map={'冠军':500,'亚军':300,'四强':150,'八强':80};
  const amt=map[place];
  if(amt){s.fund+=amt;logEvent(s,'🏦 联盟分润（'+place+'）：'+amt+'万');}
}
/* 季后赛出局名次判定：只在真正出局的轮次返回名次（用于结算联盟分润）。
   胜者组 R1 / 胜者组决赛失利只是掉入败者组，队伍仍存活——返回 null（leaguePayout 对 null 不结算），
   否则会出现「输一场就领分润、之后真出局再领一次」的重复发放。 */
function poPlace(slot,isFinal){
  if(isFinal)return '亚军';
  if(/^wb[12]$|^wf$/.test(slot))return null;
  if(/^lb[12]$|^lb2_/.test(slot))return '八强';
  return '四强';
}
function nextDay(s){
  s.day++;s.trained=false;s.marketRefreshed=false;s.academyTrained=false;
  s.fund+=SPONSORS[s.sponsorLv].income; // 赞助商每日结算
  if(s.hosts&&s.hosts.length)s.fund+=s.hosts.reduce((t,h)=>t+h.income,0); // 退役主播人气收入
  if(s.transferWindow>0){
    s.transferWindow--;
    aiBidTick(s); // AI 队对挂牌选手报价
    if(s.transferWindow===0){
      endTransferWindow(s);
      if(s.preseason){
        s.preseason=false;
        logEvent(s,'📋 赛前转会期结束（天数用完），联赛正式开始！');
      }else{
        logEvent(s,'📉 转会窗关闭，未成交的挂牌选手自动撤牌');
      }
    }
  }
  if(s.day%WAGE_EVERY===0)payWage(s);
  s.players.forEach(p=>{p.injury=Math.max(0,p.injury-1);p.energy=clamp(p.energy+10,0,ENERGY_MAX);}); // 伤情恢复 + 体力自然回复
  tickLoans(s); // 租借倒计时：到期自动归队
  if(s.day%3===0){s.fund+=8;toast('签到奖励：赞助补贴 +8万');}
  if(Math.random()<0.65&&s.players.length){ // 名单被卖空时跳过随机事件（事件需要选手参与）
    const ev=pick(EVENTS);
    const tp=pick(rosterAll(s)); // 公告文案与效果作用同一名选手
    const txt=ev.desc.replace('{p}',()=>tp.name);
    ev.fn(s,tp);
    logEvent(s,'🎲 【'+ev.t+'】'+txt);
  }
  save();
}
function payWage(s){
  const wage=weeklyWage(s);
  // 选手代言收入：人气 × 0.3万/周（商业价值对冲工资帽压力）
  const endorse=Math.round(s.players.reduce((t,p)=>t+((p.popularity||0)*0.3),0));
  s.fund-=wage;
  s.fund+=endorse;
  let tax=0;
  if(wage>s.wageCap){
    // KPL 工资帽：超帽部分缴纳 60% 奢侈税
    tax=Math.round((wage-s.wageCap)*0.6);
    s.fund-=tax;
    logEvent(s,'💸 周薪 '+wage+'万（工资帽 '+s.wageCap+'万，超帽缴纳奢侈税 '+tax+'万）');
  }else{
    logEvent(s,'💸 发放周薪 '+wage+'万（工资帽内 '+s.wageCap+'万）');
  }
  if(endorse>0)logEvent(s,'📣 选手代言收入 '+endorse+'万（人气变现）');
  if(s.fund<0){
    s.fund=Math.max(0,s.fund);
    s.players.forEach(p=>p.morale=clamp(p.morale-15,20,100));
    logEvent(s,'⚠️ 资金不足！拖欠工资导致全员士气大降');
  }else{
    s.players.forEach(p=>p.morale=clamp(p.morale+3,20,100));
  }
}
/* ================= 王朝反制（连冠≥2 触发） =================
   现实中反制王朝的三板斧：对手研究录像（BP 吃亏）、版本针对体系、联盟财政条款。
   ①对阵连冠队伍，研究方有效战力 +2%/连冠季（上限+6%，AI 互赛同规则）
   ②连冠队伍工资帽成长减半 ③新赛季版本针对：核心选手属性/士气/状态受挫 */
function dynastyStreak(s,teamName){
  const hist=(s.titleHistory||[]).slice().sort((a,b)=>b.season-a.season);
  let streak=0,expect=s.season-1; // 当前赛季进行中，从上个已完赛赛季往回数
  for(const h of hist){
    if(h.season!==expect||h.champ!==teamName)break;
    streak++;expect--;
  }
  return Math.min(streak,3);
}
/* ================= 赛季最佳阵容（一阵/二阵） =================
   按位置评选：排序分=招牌战力×状态系数（权重减半：火热可越级入选，但不虚高 20 分）；
   展示的「评分」用 OVR 总值（1-99，与全游戏刻度一致），表现另用状态标签表达；
   新赛季开启时入册 s.awards（历届），联盟页实时展示当期评选 */
function allStarScore(p){return playerPower(p,p.sig)*(1+((p.val||100)-100)/250);}
function allStarTeams(s){
  const pool=s.players.map(p=>({p,team:s.teamName}));
  (s.leagueTeams||[]).forEach(n=>{
    if(n===s.teamName)return;
    (ensureAiRosters(s,n)||[]).forEach(p=>pool.push({p,team:n}));
  });
  const t1=[],t2=[];
  POS_ORDER.forEach(pos=>{
    const two=pool.filter(x=>x.p.pos===pos).sort((a,b)=>allStarScore(b.p)-allStarScore(a.p)).slice(0,2);
    if(two[0])t1.push({p:two[0].p,team:two[0].team});
    if(two[1])t2.push({p:two[1].p,team:two[1].team});
  });
  return {t1,t2};
}
/* 赛季收官：最佳阵容入册 + 公告（newSeason 顶部调用，用刚结束赛季的阵容快照） */
function recordSeasonAwards(s){
  s.awards=s.awards||[];
  if(s.awards.some(a=>a.season===s.season))return;
  const {t1,t2}=allStarTeams(s);
  s.awards.unshift({season:s.season,
    first:t1.map(x=>({pos:x.p.pos,name:x.p.name,team:x.team,ovr:overall(x.p)})),
    second:t2.map(x=>({pos:x.p.pos,name:x.p.name,team:x.team,ovr:overall(x.p)}))});
  s.awards=s.awards.slice(0,10);
  logEvent(s,'🏆 KPL 赛季最佳阵容揭晓：一阵——'+t1.map(x=>POS[x.p.pos][1]+' '+x.p.name+'（'+x.team+'）').join('、'));
  logEvent(s,'🥈 二阵——'+t2.map(x=>POS[x.p.pos][1]+' '+x.p.name+'（'+x.team+'）').join('、'));
}
function newSeason(s){
  recordSeasonAwards(s); // 上赛季最佳阵容入册（趁阵容还没跨季老化）
  s.season++;s.day=1;s.trained=false;s.marketRefreshed=false;
  s.pick={}; // 清掉上赛季末的英雄选择残留（BP 确认后才会重新写入）
  s.academyTrained=false;
  // 年龄增长：黄金期属性成长，下滑期按位置衰减，达到位置退役年龄离队
  const retired=[];
  s.players.forEach(p=>{
    p.age=(p.age||0)+1;
    const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
    const key=pick(['lane','farm','team','mind']);
    if(p.age<=m.gold){
      // 黄金期（19-22 反应手速巅峰）：随机属性+1
      p.attrs[key]=clamp(p.attrs[key]+1,55,99);
    }else if(p.age<m.retire){
      // 下滑期：按位置衰减（野射下滑快，辅助缓）
      p.attrs[key]=clamp(p.attrs[key]-rnd(1,m.decay),40,99);
    }
    if(p.age>=m.retire)retired.push(p);
    else p.retiring=p.age>=m.retire-1;
    p.energy=ENERGY_MAX;p.morale=clamp(p.morale+15,20,100);p.injury=0;
  });
  // 赛季结算：表现溢价回归 + 黄金期后年龄贬值 + 续约涨薪（堵"身价只涨不跌"的无风险套利）
  s.players.forEach(p=>{
    const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
    p.val=clamp(Math.round((p.val||100)*0.7+30),70,150); // 表现溢价逐年回归：不持续打出表现就跌回（||100：未上过场的替补没有 val，避免算出 NaN）
    if(p.age>m.gold)p.val=clamp(p.val-(p.age-m.gold)*4,70,150); // 过黄金期：身价随年龄贬值
    if(p.age>=m.retire-1)p.val=clamp(p.val-8,70,150); // 临近退役：额外折价
    if(p.val>=120){ // 巅峰表现 → 续约涨薪（工资帽压力随成绩增长）
      const nw=Math.min(Math.round(p.wage*1.15)+1,Math.round(wageOf(overall(p))*1.5));
      if(nw>p.wage){p.wage=nw;logEvent(s,'💰 赛季结算：'+p.name+' 续约涨薪至 '+nw+'万/周');}
    }
  });
  // 青训新秀同步长一岁：满 18 岁才有晋升一线队资格（KPL 注册规则）；每年自然成长（潜力越高长得越快）
  (s.academy||[]).forEach(r=>{
    r.age=(r.age||16)+1;
    const bonus=r.potential>=4?2:1;
    const keys=['lane','farm','team','mind'];
    for(let i=0;i<2;i++){
      const k=keys.splice(Math.floor(Math.random()*keys.length),1)[0];
      r.attrs[k]=clamp(r.attrs[k]+bonus,40,95);
    }
  });
  retired.forEach(p=>{
    s.players=s.players.filter(x=>x.id!==p.id);
    const li=s.lineup.indexOf(p.id);
    if(li>=0){s.lineup.splice(li,1);if(s.pick)delete s.pick[p.pos];}
    // 退役去向：转教练（按实力给战力加成）或 转型主播（俱乐部人气收入）
    retireToCoach(s,p);
  });
  s.fund+=130;
  // 王朝反制②：连冠队伍工资帽成长减半（保住豪华阵容越来越难）
  const st=dynastyStreak(s,s.teamName);
  s.wageCap=(s.wageCap||90)+(st>=2?7:15); // KPL 联盟每赛季调整工资帽
  // 王朝反制③：版本针对——力度随连冠次数加码
  if(st>=2){
    logEvent(s,'⚖️ 联盟公平条款：'+s.teamName+' 已'+st+'连冠，新赛季工资帽成长减半（+'+(st>=2?7:15)+'万）');
    const core=s.players.slice().sort((a,b)=>overall(b)-overall(a))[0];
    if(core){
      const key=pick(['lane','farm','team','mind']);
      core.attrs[key]=clamp(core.attrs[key]-st,40,99);
      core.morale=clamp(core.morale-5*st,20,100);
      core.val=clamp((core.val||100)-10,70,150);
      logEvent(s,'📌 版本针对：全联盟都在研究你——新版本削弱了核心 '+core.name+' 的招牌体系（属性-'+st+' · 士气-'+5*st+'%点 · 状态-10%）');
    }
  }
  // 租借选手：新赛季开始前一律归队（租借不跨赛季）
  (s.players||[]).filter(p=>p.loan).forEach(p=>{
    aiAttachDef(s,p.id,p.loan.from);
    logEvent(s,'📤 租借到期：'+p.name+' 返回 '+(p.loan.from||'原队')+'（新赛季阵容注册）');
  });
  if((s.players||[]).some(p=>p.loan)){
    s.players=s.players.filter(p=>!p.loan);
    s.lineup=s.lineup.filter(id=>s.players.some(p=>p.id===id));
    s.aiRosters={};
  }
  s.transferWindow=7; // 赛前转会期 7 天：自由组队，结束/到期后联赛才开打
  s.preseason=true;
  s.streak=0;
  aiTransferWindow(s); // AI 转会期：退役结算/缺位补强/明星流转/新星出道（联盟生态推进）
  buildTransferMarket(s); // 构建转会市场（AI 队选手 + 非卖品）
  s.aiRosters={}; // 对手阵容每赛季重建（年龄成长）
  s.aiInj={}; // 新赛季伤病清零（新赛季阵容重建后原伤停表失效）
  logEvent(s,'📈 联盟调整工资帽：本周薪上限 '+s.wageCap+'万');
  logEvent(s,'📋 赛前转会期开启（7天）：可买断/挂牌/直签选手与教练，市场刷新免费；结束转会期后联赛开打');
  s.stage='regular';
  initGroups(s);
  logEvent(s,'🚀 赛季 '+s.season+' 开始！18队 S/A/B 赛制，目标：总冠军！');
  save();renderAll();
}
/* 选手退役去向：转教练（战力加成）或转型主播（人气收入），进入"退役名宿"市场 */
function retireToCoach(s,p){
  s.retiredCoaches=s.retiredCoaches||[];
  const isStar=p.mvp>=1||overall(p)>=88; // 名宿看生涯成就与实力，看出身
  if(Math.random()<0.6||!isStar){
    // 转教练：实力越强加成越高
    const bonus=isStar?rnd(5,8):rnd(3,5);
    const style=pick(['lane','farm','team','mind']);
    const coach={id:'rc'+Date.now()+'_'+rnd(100,999),name:p.name,rating:isStar?80:70,style,bonus,styleBonus:isStar?rnd(3,5):2,
      wage:isStar?rnd(12,18):rnd(8,11),cost:isStar?rnd(120,180):rnd(70,100),
      skill:{n:'名宿执教',d:'全队战力+'+bonus+'% · 退役选手转型教练'},type:'coach',origin:p.name};
    s.retiredCoaches.push(coach);
    logEvent(s,'🧑‍🏫 '+p.name+'（'+p.age+'岁）退役转型主教练！执教能力已进入教练市场');
  }else{
    // 转型主播：给俱乐部带来人气收入（每日资金）
    const host={id:'rh'+Date.now()+'_'+rnd(100,999),name:p.name,rating:80,type:'host',
      income:rnd(4,9),cost:rnd(90,140),popularity:(p.popularity||40)+rnd(10,25),
      skill:{n:'转型主播',d:'每日为俱乐部带来 '+0+'万 人气收入'},origin:p.name};
    host.skill={n:'转型主播',d:'每日为俱乐部带来 '+host.income+'万 人气收入（热度 '+(p.popularity||40)+'）'};
    s.retiredCoaches.push(host);
    logEvent(s,'📺 '+p.name+'（'+p.age+'岁）退役转型人气主播！每日可为俱乐部带来 '+host.income+'万 收入');
  }
}
/* 签约退役名宿（教练 or 主播） */
function signRetired(s,id){
  const r=(s.retiredCoaches||[]).find(x=>x.id===id);
  if(!r)return;
  if(s.fund<r.cost){toast('资金不足（签约费 '+r.cost+'万）');return;}
  s.fund-=r.cost;
  s.retiredCoaches=s.retiredCoaches.filter(x=>x.id!==id);
  if(r.type==='coach'){
    // 教练：替换当前主教练（旧教练解约）
    if(s.coach)logEvent(s,'🔁 换帅！'+s.coach.name+' 离任，'+r.name+' 出任主教练');
    else logEvent(s,'🤝 签约退役名宿 '+r.name+' 出任主教练');
    s.coach={...r};
    toast(r.name+' 执教！全队战力+'+r.bonus+'%');
  }else{
    // 主播：加入主播席，每日提供人气收入
    s.hosts=[...(s.hosts||[]).filter(h=>h.id!==id),r];
    logEvent(s,'🤝 签约退役主播 '+r.name+'，每日人气收入 '+r.income+'万');
    toast(r.name+' 入驻直播平台！');
  }
  save();renderAll();
}
function fireHost(s,id){
  s.hosts=(s.hosts||[]).filter(x=>x.id!==id);
  save();renderAll();toast('已解除主播合约');
}
/* 聘助教（上限2名，加成与主教练叠加）：助教池直聘，或退役名宿教练 6 折转任 */
function hireAssistant(s,id){
  if((s.assistants||[]).length>=2){toast('助教席已满（上限2人），请先解约一名');return;}
  let a=ASSISTANT_POOL.find(x=>x.id===id);
  let cost;
  if(a){
    if((s.assistants||[]).some(x=>x.id===a.id)){toast('已聘任该助教');return;}
    cost=a.cost;
  }else{
    const r=(s.retiredCoaches||[]).find(x=>x.id===id);
    if(!r||r.type!=='coach'){toast('该名宿不能转任助教');return;}
    a={...r,type:'assistant'};
    cost=Math.round(r.cost*0.6); // 名宿转任助教：6 折签约
    s.retiredCoaches=s.retiredCoaches.filter(x=>x.id!==id);
  }
  if(s.fund<cost){toast('资金不足（签约费 '+cost+'万）');return;}
  s.fund-=cost;
  s.assistants=[...(s.assistants||[]),{...a,acqCost:cost}];
  logEvent(s,'🤝 聘任助教 '+a.name+'（'+COACH_STYLE[a.style]+'型 · 全队战力+'+a.bonus+'% · 签约费 '+cost+'万）');
  save();renderAll();toast(a.name+' 加入教练组！');
}
function fireAssistant(s,id){
  const a=(s.assistants||[]).find(x=>x.id===id);
  if(!a)return;
  s.assistants=s.assistants.filter(x=>x.id!==id);
  logEvent(s,'👋 助教 '+a.name+' 与俱乐部解约');
  save();renderAll();
}
/* 签约自由球员（无球可打流向市场的选手） */
function signFreeAgent(s,id){
  const p=(s.freeAgents||[]).find(x=>x.id===id);
  if(!p)return;
  if(s.players.some(x=>x.id===p.id)){toast('已拥有该选手');return;}
  if(s.fund<p.signCost){toast('资金不足（签约费 '+p.signCost+'万）');return;}
  if(weeklyWage(s)+p.wage>s.wageCap){
    const {over,tax}=overCapTax(s,p.wage);
    if(!confirm('⚠️ 超帽签约：签下 '+p.name+' 后周薪 '+(weeklyWage(s)+p.wage)+'万（帽 '+s.wageCap+'万），超出 '+over+'万/周 需每周缴纳 60% 奢侈税（'+tax+'万/周）。\n多花钱可以，确定签下？'))return;
  }
  s.fund-=p.signCost;
  p.acqCost=p.signCost; // 买入价锚定（转售保护用）
  s.freeAgents=s.freeAgents.filter(x=>x.id!==id);
  s.players.push(p);
  logEvent(s,'⚪ 自由市场签下 '+p.name+'（无球可打选手 · 签约费 '+p.signCost+'万）');
  save();renderAll();toast(p.name+' 加盟！');
}

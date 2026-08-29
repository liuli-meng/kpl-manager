
/* ================= 游戏状态与存档 ================= */
const SAVE_KEY='esport_manager_save_v3';
let curSlot=parseInt(localStorage.getItem('esport_manager_curslot')||'1',10)||1;
function slotKey(){return SAVE_KEY+(curSlot>1?'_'+curSlot:'');}
function b64e(s){const bytes=new TextEncoder().encode(s);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin);}
function b64d(s){const bin=atob(s);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder().decode(bytes);}
let S=null; // 全局状态

function newState(teamName,icon){
  return {
    teamName,icon,season:1,day:1,fund:800,sponsorLv:0,
    honors:[], // 历史荣誉（多赛季）
    stage:'regular',phase:'r1',matchIdx:0,wageCap:90,streak:0,transferWindow:0,preseason:false, // 工资帽/连胜手感/转会窗/赛前转会期
    players:[],lineup:[],market:[],
    schedule:[],groups:{},tables:{},aiPower:{},card:null,playoff:null,eliminated:[],
    eventLog:[],trained:false,marketRefreshed:false,academyTrained:false,champion:false,
    academy:[],history:[],transferList:[],listed:[],bids:[],
    pick:{}, // 当前 BP 选定的英雄 {top:'花木兰',...}
    series:null, // 当前系列赛 {used:[],mw,ow,max,stage,oppName,logs,myName,opName,idx}
    coach:null,coachMarket:[], // 主教练 + 教练市场
    aiRosterDefs:null,extraDefs:[],retiredDefs:[], // AI 转会生态：AI 队在册 def 映射 / 新星 def / 已退役 def
  };
}
function rosterAll(s){return s.players;}
function rosterLineup(s){return s.lineup.map(id=>s.players.find(p=>p.id===id)).filter(Boolean);}
function rosterBench(s){return s.players.filter(p=>!s.lineup.includes(p.id));}
function moraleAll(s,v){s.players.forEach(p=>p.morale=clamp(p.morale+v,20,100));}
/* 选手当前选用英雄（未 BP 时默认招牌） */
function pickedHero(s,p){return (s.pick&&s.pick[p.pos])||p.sig;}
function heroOf(heroId){return HEROES.find(x=>x.n===heroId)||null;}
function heroAtPos(heroId,pos){const h=heroOf(heroId);return h&&h.pos.includes(pos)?h:null;}
function playerPower(p,heroId){
  const a=p.attrs;
  let pow=a.lane*0.25+a.farm*0.25+a.team*0.3+a.mind*0.2;
  const sk=p.skill;
  if(sk.t==='lane')pow+=a.lane*0.12*0.25;
  if(sk.t==='farm')pow+=a.farm*0.12*0.25;
  if(sk.t==='team')pow+=a.team*0.12*0.3;
  if(sk.t==='mind')pow+=a.mind*0.12*0.2;
  // 英雄加成：按熟练度（绝活+8% / 熟练+4% / 一般0% / 生疏-8%），版本热门再 +2%
  const h=heroId?heroAtPos(heroId,p.pos):null;
  if(h){
    pow*=1+HERO_LV[heroLv(p,heroId)].b;
    if(h.hot)pow*=1.02;
  }
  // 带伤：按伤情剩几天打折（10% ~ 30%），随恢复逐渐回稳
  if(p.injury>0)pow*=1-0.1*Math.min(p.injury,3);
  // 体力：低于 60 开始衰减（0 体力约 -24%）；每小局 -8、每日自然恢复 +10、休息 +55
  const eng=(p.energy==null)?100:p.energy;
  if(eng<60)pow*=1-(60-eng)*0.004;
  return Math.round(pow);
}
/* AI 队战力：与 teamPower 同刻度（五位置最强者求和 × 士气系数）。
   体力由 playerPower 实时读取：构建时=满体力（联赛模拟用），系列赛中用实时值（逐局衰减）。
   AI 无玩家侧教练/羁绊，用 AI_STAFF 折算职业队平均教练班底水平。 */
const AI_STAFF=1.06;
function aiRosterPower(roster){
  if(!roster||!roster.length)return 0;
  const best={};
  roster.forEach(p=>{
    const v=playerPower(p,p.sig);
    if(best[p.pos]==null||v>best[p.pos])best[p.pos]=v;
  });
  let sum=0,cnt=0,mSum=0;
  POS_ORDER.forEach(pos=>{if(best[pos]!=null){sum+=best[pos];cnt++;}});
  if(!cnt)return 0;
  roster.forEach(p=>mSum+=(p.morale||80));
  const morale=clamp(mSum/roster.length/100,0.82,1.1);
  return Math.round(sum*morale*AI_STAFF);
}
/* picks 可选：BP 进行中实时结算用（未选位置回退招牌）；缺省走 S.pick */
function teamPower(s,picks){
  const ls=rosterLineup(s);
  if(!ls.length)return 0;
  const ph=p=>(picks&&picks[p.pos])||pickedHero(s,p);
  let pow=ls.reduce((t,p)=>t+playerPower(p,ph(p)),0);
  const mAvg=ls.reduce((t,p)=>t+p.morale,0)/ls.length;
  pow*=clamp(mAvg/100,0.82,1.1);
  activeBonds(s).forEach(b=>pow*=1+b.bonus/100);
  // 主教练加成：全队战力% + 侧重属性额外加成
  if(s.coach){
    const c=s.coach;
    const w={lane:0.25,farm:0.25,team:0.3,mind:0.2}[c.style];
    const attrSum=ls.reduce((t,p)=>t+p.attrs[c.style],0);
    pow+=attrSum*c.styleBonus/100*w;
    pow*=1+c.bonus/100;
  }
  // 连胜/连败手感：±2%/场，上限 ±10%
  if(s.streak)pow*=1+clamp(s.streak,-5,5)*0.02;
  return Math.round(pow);
}
function activeBonds(s){
  const ls=rosterLineup(s),cnt={};
  ls.forEach(p=>{if(p.team)cnt[p.team]=(cnt[p.team]||0)+1;});
  const act=[];
  for(const t in cnt){
    const def=TEAM_BONDS[t];
    if(!def)continue;
    if(cnt[t]>=def.full)act.push({bonus:def.bonusFull,desc:def.descFull});
    else if(cnt[t]>=def.min)act.push({bonus:def.bonusMin,desc:def.descMin});
  }
  return act;
}
function weeklyWage(s){
  let sum=s.players.reduce((t,p)=>t+p.wage,0);
  if(s.coach)sum+=s.coach.wage;
  return sum;
}
function save(){try{localStorage.setItem(slotKey(),JSON.stringify(S));}catch(e){console.warn('save fail',e);}}
function migrateSave(){
  if(!S)return;
  S.aiRosters={}; // 名册更新后重建对手阵容
  // 修复旧版 0:0 模拟（KPL.BO5 未定义）造成的错误积分：回滚后按新逻辑重算
  if(typeof phaseGroups==='function'&&S.tables&&S.aiSchedule){
    phaseGroups(S).forEach(g=>{
      (S.aiSchedule[g]||[]).forEach(m=>{
        if(!(m.r&&m.r.mw===0&&m.r.ow===0))return;
        const ta=(S.tables[g]||{})[m.a],tb=(S.tables[g]||{})[m.b];
        if(ta&&tb){tb.w=Math.max(0,tb.w-1);tb.pts=Math.max(0,tb.pts-1);ta.l=Math.max(0,ta.l-1);}
        const r=simSeriesResult(S,m.a,m.b,KPL.BO5);
        m.r={w:r.win?m.a:m.b,mw:r.mw,ow:r.ow};
        if(ta&&tb){
          if(r.win){ta.w++;ta.pts++;tb.l++;}
          else{tb.w++;tb.pts++;ta.l++;}
          ta.pw+=r.mw;tb.pw+=r.ow;
        }
      });
    });
  }
  S.series=S.series||null;
  if(S.series&&!S.series.side)S.series.side='blue';
  S.pick=S.pick||{};
  S.coach=S.coach||null;
  S.coachMarket=S.coachMarket||[];
  S.honors=S.honors||[];
  if(!S.wageCap)S.wageCap=90;
  if(!S.seedPower)S.seedPower=280;
  if(!S.streak)S.streak=0;
  if(S.preseason==null)S.preseason=false; // 旧档迁移：默认已过转会期
  if(!S.transferWindow)S.transferWindow=0;
  S.transferList=S.transferList||[];
  // 旧档非卖品意愿=100 → 动态化（85-100 初始区间）
  (S.transferList||[]).forEach(p=>{if(p.untouchable&&p.willingness===100)p.willingness=rnd(85,100);});
  S.listed=S.listed||[];
  S.bids=S.bids||[];
  S.history=S.history||[];
  S.academy=S.academy||[];
  S.retiredCoaches=S.retiredCoaches||[];
  S.hosts=S.hosts||[];
  S.freeAgents=S.freeAgents||[];
  S.extraDefs=S.extraDefs||[]; // AI 转会生态：新星 def（aiRosterDefs 懒初始化自 AI_ROSTERS）
  S.retiredDefs=S.retiredDefs||[];
  // 总值化迁移：教练/名宿旧档 rarity → rating 评分（选手总值实时计算，无需迁移）
  const R2RATE={SSR:90,SR:80,R:70};
  [S.coach].concat(S.coachMarket||[],S.retiredCoaches||[]).forEach(c=>{
    if(c&&c.rating==null&&c.rarity)c.rating=R2RATE[c.rarity]||80;
  });
  // 旧赛制存档（无 groups）→ 重置为 KPL 2025 新赛制（保留队伍/资金/教练）
  if(!S.groups||!S.groups.G1){
    S.phase='r1';S.matchIdx=0;
    S.groups={};S.tables={};S.aiPower={};S.card=null;S.playoff=null;S.eliminated=[];
    S.stage='regular';S.champion=false;
  }
  if(!S.phase)S.phase='r1';
  S.players.forEach(p=>{
    if(p.injury==null)p.injury=0;
    if(p.mvp==null)p.mvp=0;
    if(p.retiring==null)p.retiring=false;
    if(p.age==null)p.age=ageByPos(p.pos,false);
    if(!p.sig)p.sig=(HEROES.find(h=>h.pos[0]===p.pos)||{}).n||null;
    if(!p.career){const def=PLAYER_POOL.find(d=>d.id===p.id);if(def)p.career=def.career||'';}
    // 英雄池：字符串→对象；补全本职+摇摆位英雄，并清掉异位置英雄（旧档的储备/错位英雄统一洗掉）
    if(!p.heroPool||typeof p.heroPool[0]==='string'){
      const old=(p.heroPool||[]).map(h=>typeof h==='string'?h:h.n);
      p.heroPool=old.map(n=>({n,lv:n===p.sig?3:2}));
    }
    if(p.sig&&!p.heroPool.some(x=>x.n===p.sig))p.heroPool.unshift({n:p.sig,lv:3});
    HEROES.filter(h=>h.pos.includes(p.pos)).forEach(h=>{if(!p.heroPool.some(x=>x.n===h.n))p.heroPool.push({n:h.n,lv:2});});
    p.heroPool=p.heroPool.filter(x=>{const h=heroOf(x.n);return h&&h.pos.includes(p.pos);});
  });
}
function ensureSeason(s){
  // 启动/读档后确保赛制状态完整（新档 initGroups 在 createTeam 调用；旧档迁移后这里补）
  if(!s.groups||!s.groups.G1){
    s.stage='regular';
    initGroups(s);
    logEvent(s,'🔄 赛制升级为 KPL 2025 官方赛制（18队 · S/A/B 三组）');
    save();
  }
}
function load(){
  try{const d=localStorage.getItem(slotKey());if(d){S=JSON.parse(d);migrateSave();return true;}}
  catch(e){console.warn('load fail',e);}
  return false;
}

/* ================= 选手年龄体系（真实 KPL 生命周期） =================
   出道18-19（青训17跟训）→ 黄金期 → 下滑期 → 退役
   打野/射手寿命最短（24退役）· 对抗/中路中等（26退役）· 辅助最长（31退役，27-28仍可首发） */
const AGE_MODEL={
  jg:{gold:21,decline:22,retire:24,decay:2}, // 打野：吃手速反应，23岁后难首发，24退役
  ad:{gold:21,decline:22,retire:24,decay:2}, // 射手（发育路）：同上
  top:{gold:22,decline:23,retire:26,decay:1},// 对抗路：操作+意识，24-25下滑，26+极少首发
  mid:{gold:22,decline:23,retire:26,decay:1},// 中路：同上
  sup:{gold:24,decline:25,retire:31,decay:1},// 游走：靠大局观指挥，寿命最长，27-28仍有首发
};
function ageByPos(pos,isRookie){
  if(isRookie)return rnd(16,17); // 青训跟训
  if(pos==='sup')return rnd(19,22); // 辅助出道/在位年限更久
  if(pos==='jg'||pos==='ad')return rnd(18,20); // 野射出道早
  return rnd(18,21);
}
/* 年龄阶段标签 */
function ageStage(p){
  const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
  if(p.age>=m.retire)return '🚫已退役';
  if(p.age>=m.retire-1)return '⚠️即将退役';
  if(p.age>m.gold)return '🧓下滑期';
  return '💪黄金期';
}
/* 选手生成（含位置化年龄） */

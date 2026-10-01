function genPlayer(def){
 const keys=['lane','farm','team','mind'];
 const attrs={};
 keys.forEach((k,i)=>{attrs[k]=clamp((def.base?def.base[i]:70)+rnd(-1,1),40,99);});
 const o=overall({pos:def.pos,attrs}); // 总值：身价/工资/人气全部由它出
 // 主播选手工资减半（有直播收入），K甲新秀工资更便宜
 let wage=wageOf(o);
 if(def.tags&&def.tags.includes('主播'))wage=Math.max(2,Math.round(wage*0.5));
 if(def.tags&&def.tags.includes('青训'))wage=Math.max(2,Math.round(wage*0.7));
 // 英雄池：招牌(绝活lv3) + 本职及摇摆位全会(熟练lv2) —— 只含本位置可用英雄，BP 候选与档案展示一致
 const heroPool=[{n:def.sig,lv:3}];
 heroesNow().filter(h=>h.pos.includes(def.pos)&&h.n!==def.sig).forEach(h=>heroPool.push({n:h.n,lv:2}));
 const p={id:def.id,name:def.name,pos:def.pos,team:def.team||null,tags:def.tags||[],
 attrs,skill:def.skill,sig:def.sig,heroPool,career:def.career||'',wage,energy:ENERGY_MAX,morale:rnd(75,92),injury:0,
 mvp:0,retiring:false,contract:rnd(2,3), // 合同年限：到期后需续约（转会期处理）
 // 传奇老将：最后一舞（退役前1-2年），普通选手按位置出道年龄
 age:(def.team==='传奇')?(AGE_MODEL[def.pos]||AGE_MODEL.mid).retire-rnd(1,2):ageByPos(def.pos,def.tags&&def.tags.includes('青训')),
 // 商业价值（代言收入）与转会意愿（0=想走 100=死忠）
 popularity:Math.round((o>=90?rnd(38,65):o>=80?rnd(16,34):rnd(5,14))*(def.tags&&def.tags.includes('主播')?1.5:1)),
 willingness:rnd(45,90)};
 // 个人天花板按年龄/总值定房间（防加练刷满 99）
 try{if(typeof ensurePlayerPeak==='function')ensurePlayerPeak(p);}catch(e){}
 return p;
}
/* 英雄熟练度：绝活+8% / 熟练+4% / 一般0% / 生疏-8% */
const HERO_LV={
 3:{n:'绝活',b:0.08,cls:'lv3',desc:'招牌英雄，如臂使指'},
 2:{n:'熟练',b:0.04,cls:'lv2',desc:'掌握精熟，稳定发挥'},
 1:{n:'一般',b:0,cls:'lv1',desc:'能拿出手，但没绝活'}, 
 0:{n:'生疏',b:-0.08,cls:'lv0',desc:'不擅长，容易打崩'},
};
function heroLv(p,heroId){const h=(p.heroPool||[]).find(x=>x.n===heroId);return h?h.lv:1;}
/* 英雄熟练度：绝活+8% / 熟练+4% / 一般0% / 生疏-8% */
/* 选手身价→签约/转会价：signCost 缺失/非法时按身价折算，禁止 0 元白拿 */
function signCostOf(p,fallback){
 if(!p)return fallback!=null?fallback:0;
 const v=Math.round(valueOf(overall(p))*0.58);
 const sc=p.signCost;
 if(typeof sc==='number'&&isFinite(sc)&&sc>0)return Math.round(sc);
 return v>0?v:(fallback!=null?fallback:80);
}
function buyPlayer(s,p){
 if(!p){toast('选手已被签走');return false;}
 if(typeof canSign==='function'){
  const chk=canSign(s,p,{actor:'player'});
  if(!chk.ok){toast(chk.reason||'不能签约');return false;}
 }else if(typeof transferOpsBlockedReason==='function'){
 const modeBlock=transferOpsBlockedReason(s);
 if(modeBlock){toast(modeBlock);return false;}
 }
 if(!rosterGuard(s))return false; // 联盟规则：大名单 ≤10 人
 if(typeof freeSignBlockedReason==='function'){
 const blocked=freeSignBlockedReason(s);
 if(blocked){toast(blocked);return false;}
 }
 const cost=capFee(Math.round(valueOf(overall(p))*(p.discount||1)));
 if(s.fund<cost){toast('资金不足');return false;}
 if(s.players.some(x=>x.id===p.id)){toast('已拥有该选手');return false;}
 p.wage=Math.min(p.wage,PLAYER_WAGE_MAX); // 个人顶薪封顶
 if(weeklyWage(s)+p.wage>s.wageCap){
 const {over,tax}=overCapTax(s,p.wage);
 if(!confirmDanger(' 超帽签约：签下 '+p.name+' 后年薪 '+(weeklyWage(s)+p.wage)+'万（帽 '+s.wageCap+'万），超出 '+over+'万 需每周缴纳 60% 奢侈税（'+tax+'万）。\n多花钱可以，确定签下？'))return false;
 }
 s.fund-=cost;p.acqCost=cost;p.joinedDay=s.day;s.players.push(p); // acqCost：买入价锚定（转售保护用）；joinedDay：新援磨合
 if(p.contract==null)p.contract=2; // 签约即给合同年限
 s.market=s.market.filter(x=>x.id!==p.id); // 签约后从市场移除
  s.freeAgents=(s.freeAgents||[]).filter(x=>x.id!==p.id); // 同步摘自由市场，防同名双挂
  s.transferList=(s.transferList||[]).filter(x=>x.id!==p.id);
 if(typeof aiDetachDef==='function')aiDetachDef(s,p.id); // 玩家签下：AI 名册除名防双挂
 recordTransfer(s,'in',p,cost,'自由市场',p.discount?'市场特惠签约':'市场签约'); // 年度回顾·转会台账
 logEvent(s,` 从转会市场签约 ${p.name}（总值${overall(p)}·${POS[p.pos][0]}）${p.discount?'（特惠'+Math.round(p.discount*10)+'折）':''}`);
 try{SFX.gold();}catch(_){}
 save();renderAll();return true;
}

/* ================= 自由球员 / 青训名字池 =================
 与 18 队注册名单隔离，保证任何情况下联盟内一人一队 */
const ACADEMY_NAMES=['弈秋','观澜','听松','照夜','惊蛰','谷雨','芒种','白秋','霜降','立夏','惊鸿照','初霁','疏桐','晚晴','归舟','远山','泊烟','沉璧','映雪','疏星','垂柳','鸣蝉','宿雨','斜阳','烟渚','兰舟','竹杖','芒鞋','蓑衣','钓叟','渔火','枫桥','钟声','客船','碧水','东流'];
function genFreeAgentDef(pos,band,usedNames){
 // 池尽时走 combName（两字/三字组合），不再生成「新人47」这种占位名
 const name=poolName(ACADEMY_NAMES,usedNames);
 if(usedNames)usedNames.add(name);
 // 档位即四维基准：star≈顶星(88+) / mid≈主力(78) / low≈轮换(69)，总值由 base 直出
 const BAND={star:[85,92],mid:[74,82],low:[66,73]}[band]||[74,82];
 const base=posSpecializedBase(pos,BAND[0],BAND[1]);
 const sk=pick(posSkillPool(pos)); // [type, 名, 描述]
 const sig=pick(heroesNow().filter(h=>h.pos[0]===pos)).n;
 return {id:'fa_'+pos+'_'+Math.random().toString(36).slice(2,7),name,pos,team:null,tags:[],
 base,skill:{n:sk[1]+'体系',t:sk[0],d:sk[2]},sig,
 career:'自由球员，曾在次级联赛历练，'+rnd(18,22)+'岁，等待 KPL 机会。'};
}
/* ================= 位置专精四维（对齐 POS_W，治「职不对位」） =================
 旧生成器四维平随机：中路可能对线最高、游走可能运营最高，档案看起来「不是这个位置的人」。
 现在按 POS_W 主属性抬高、次属性持平、冷属性压低，overall() 加权后自然对位。 */
const POS_ATTR_KEYS=['lane','farm','team','mind'];
const POS_SKILL_BIAS={
 top:[['lane','线霸','对线属性额外+10%'],['team','团战','团战属性额外+10%']],
 jg:[['farm','运营','运营属性额外+10%'],['team','团战','团战属性额外+10%']],
 mid:[['team','团战','团战属性额外+10%'],['lane','线霸','对线属性额外+10%']],
 ad:[['lane','线霸','对线属性额外+10%'],['farm','运营','运营属性额外+10%']],
 sup:[['mind','大心脏','心态属性额外+10%'],['team','团战','团战属性额外+10%']],
};
function posSpecializedBase(pos,min,max,rndFn){
 const r=rndFn||(typeof rnd==='function'?rnd:(a,b)=>a+Math.floor(Math.random()*(b-a+1)));
 const w=(typeof POS_W!=='undefined'&&POS_W[pos])||{lane:.25,farm:.25,team:.25,mind:.25};
 // 并列权重时按「更像本位置」破平：mid 团战略>对线，ad 对线≈运营
 const tieBoost={mid:{team:1},ad:{lane:1},top:{lane:1},jg:{farm:1},sup:{mind:1}};
 const ranked=POS_ATTR_KEYS.slice().sort((a,b)=>{
  const wb=(w[b]||0)+((tieBoost[pos]&&tieBoost[pos][b])||0)*0.01;
  const wa=(w[a]||0)+((tieBoost[pos]&&tieBoost[pos][a])||0)*0.01;
  return wb-wa;
 });
 // 分层抽样：四档不重叠区间，主属性必在最高档——随机再大也不会「职不对位」
 const span=Math.max(4,max-min);
 const bands=[
  [min+Math.round(span*0.62),max],                 // 主
  [min+Math.round(span*0.34),min+Math.round(span*0.58)],
  [min+Math.round(span*0.12),min+Math.round(span*0.30)],
  [min,min+Math.round(span*0.10)],
 ];
 const out={};
 POS_ATTR_KEYS.forEach(k=>{
  const rank=Math.min(3,ranked.indexOf(k));
  const t=bands[rank]||bands[2];
  const lo=clamp(t[0],40,99),hi=clamp(Math.max(t[1],t[0]),40,99);
  out[k]=clamp(r(lo,hi),40,99);
 });
 return POS_ATTR_KEYS.map(k=>out[k]);
}
function posSkillPool(pos){
 return POS_SKILL_BIAS[pos]||POS_SKILL_BIAS.mid;
}

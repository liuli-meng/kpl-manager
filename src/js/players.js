function genPlayer(def){
  const keys=['lane','farm','team','mind'];
  const attrs={};
  keys.forEach((k,i)=>{attrs[k]=clamp((def.base?def.base[i]:70)+rnd(-1,1),40,99);});
  const o=overall({pos:def.pos,attrs}); // 总值：身价/工资/人气全部由它出
  // 主播选手工资减半（有直播收入），K甲新秀工资更便宜
  let wage=wageOf(o);
  if(def.tags&&def.tags.includes('🎤'))wage=Math.max(2,Math.round(wage*0.5));
  if(def.tags&&def.tags.includes('🌱'))wage=Math.max(2,Math.round(wage*0.7));
  // 英雄池：招牌(绝活lv3) + 本职及摇摆位全会(熟练lv2) —— 只含本位置可用英雄，BP 候选与档案展示一致
  const heroPool=[{n:def.sig,lv:3}];
  HEROES.filter(h=>h.pos.includes(def.pos)&&h.n!==def.sig).forEach(h=>heroPool.push({n:h.n,lv:2}));
  return {id:def.id,name:def.name,pos:def.pos,team:def.team||null,tags:def.tags||[],
    attrs,skill:def.skill,sig:def.sig,heroPool,career:def.career||'',wage,energy:ENERGY_MAX,morale:rnd(75,92),injury:0,
    mvp:0,retiring:false,
    // 传奇老将：最后一舞（退役前1-2年），普通选手按位置出道年龄
    age:(def.team==='传奇')?(AGE_MODEL[def.pos]||AGE_MODEL.mid).retire-rnd(1,2):ageByPos(def.pos,def.tags&&def.tags.includes('🌱')),
    // 商业价值（代言收入）与转会意愿（0=想走 100=死忠）
    popularity:Math.round((o>=90?rnd(38,65):o>=80?rnd(16,34):rnd(5,14))*(def.tags&&def.tags.includes('🎤')?1.5:1)),
    willingness:rnd(45,90)};
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
function buyPlayer(s,p){
  const cost=Math.round(valueOf(overall(p))*(p.discount||1));
  if(s.fund<cost){toast('资金不足');return false;}
  if(s.players.some(x=>x.id===p.id)){toast('已拥有该选手');return false;}
  if(weeklyWage(s)+p.wage>s.wageCap){
    const {over,tax}=overCapTax(s,p.wage);
    if(!confirm('⚠️ 超帽签约：签下 '+p.name+' 后周薪 '+(weeklyWage(s)+p.wage)+'万（帽 '+s.wageCap+'万），超出 '+over+'万/周 需每周缴纳 60% 奢侈税（'+tax+'万/周）。\n多花钱可以，确定签下？'))return false;
  }
  s.fund-=cost;p.acqCost=cost;s.players.push(p); // acqCost：买入价锚定（转售保护用）
  s.market=s.market.filter(x=>x.id!==p.id); // 签约后从市场移除
  logEvent(s,`🤝 从转会市场签约 ${p.name}（总值${overall(p)}·${POS[p.pos][0]}）${p.discount?'（特惠'+Math.round(p.discount*10)+'折）':''}`);
  save();renderAll();return true;
}

/* ================= 自由球员 / 青训名字池 =================
   与 18 队注册名单隔离，保证任何情况下联盟内一人一队 */
const ACADEMY_NAMES=['弈秋','观澜','听松','照夜','惊蛰','谷雨','芒种','白秋','霜降','立夏','惊鸿照','初霁','疏桐','晚晴','归舟','远山','泊烟','沉璧','映雪','疏星','垂柳','鸣蝉','宿雨','斜阳','烟渚','兰舟','竹杖','芒鞋','蓑衣','钓叟','渔火','枫桥','钟声','客船','碧水','东流'];
let _faSeq=0;
function genFreeAgentDef(pos,band,usedNames){
  let name=usedNames?ACADEMY_NAMES.find(n=>!usedNames.has(n)):null;
  if(!name&&usedNames){do{name='新人'+(++_faSeq);}while(usedNames.has(name));} // 自增序号兜底：名字空间耗尽也不会死循环
  if(usedNames)usedNames.add(name);
  // 档位即四维基准：star≈顶星(88+) / mid≈主力(78) / low≈轮换(69)，总值由 base 直出
  const BAND={star:[85,92],mid:[74,82],low:[66,73]}[band]||[74,82];
  const base=[0,1,2,3].map(()=>rnd(BAND[0],BAND[1]));
  const sk=pick([['lane','对线属性额外+10%'],['farm','运营属性额外+10%'],['team','团战属性额外+10%'],['mind','心态属性额外+10%']]);
  const skilln={lane:'线霸',farm:'运营',team:'团战',mind:'大心脏'}[sk[0]];
  const sig=pick(HEROES.filter(h=>h.pos[0]===pos)).n;
  return {id:'fa_'+pos+'_'+Math.random().toString(36).slice(2,7),name,pos,team:null,tags:[],
    base,skill:{n:skilln+'体系',t:sk[0],d:sk[1]},sig,
    career:'自由球员，曾在次级联赛历练，'+rnd(18,22)+'岁，等待 KPL 机会。'};
}

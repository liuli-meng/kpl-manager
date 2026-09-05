
/* ================= 训练 ================= */
function doTrain(s,pid,attr){
 const p=s.players.find(x=>x.id===pid);
 if(!p)return;
 if(s.trained){toast('本日已进行过行动');return;}
 if(p.energy<10){toast(`${p.name} 体力不足`);return;}
 if(s.fund<80){toast('资金不足（训练需 80万）');return;}
 s.fund-=80;p.energy-=10;s.trained=true;
 const gain=1+rnd(0,1);
 p.attrs[attr]=clamp(p.attrs[attr]+gain,40,99);
 p.morale=clamp(p.morale-2,20,100);
 logEvent(s,` 训练完成：${p.name} 的「${TRAIN_ITEMS.find(t=>t.k===attr).n}」提升 ${gain} 点`);
 save();renderAll();
}
function doRest(s){
 if(s.trained){toast('本日已进行过行动');return;}
 s.trained=true;
 s.players.forEach(p=>{p.energy=clamp(p.energy+55,0,ENERGY_MAX);p.morale=clamp(p.morale+4,20,100);if(p.injury>0)p.injury=Math.max(0,p.injury-2);});
 logEvent(s,' 全队休息一天，体力和士气得到恢复');
 save();renderAll();
}
/* 英雄特训：优先提升熟练度（生疏→一般→熟练→绝活），全部满级则学新英雄（生疏） */
function doHeroTrain(s,pid){
 const p=s.players.find(x=>x.id===pid);
 if(!p)return;
 if(s.trained){toast('本日已进行过行动');return;}
 if(p.energy<15){toast(`${p.name} 体力不足`);return;}
 if(s.fund<150){toast('资金不足（英雄特训需 150万）');return;}
 // 找熟练度最低的英雄提升
 const upgradable=(p.heroPool||[]).filter(h=>h.lv<3);
 let msg;
 if(upgradable.length){
 upgradable.sort((a,b)=>a.lv-b.lv);
 const t=upgradable[0];
 t.lv++;
 msg=` 英雄特训：${p.name} 的「${t.n}」熟练度提升至「${HERO_LV[t.lv].n}」！`;
 }else{
 if((p.heroPool||[]).length>=80){toast('英雄池已满（上限80）且全部满级');return;}
 const src=HEROES.filter(h=>h.pos.includes(p.pos)).map(h=>h.n).filter(h=>!p.heroPool.some(x=>x.n===h));
 if(!src.length){toast('该位置可学的英雄都学完了');return;}
 const h=pick(src);
 p.heroPool.push({n:h,lv:0});
 msg=` 英雄特训：${p.name} 学会了新英雄「${h}」（生疏）！`;
 }
 s.fund-=150;p.energy-=15;s.trained=true;
 p.morale=clamp(p.morale-2,20,100);
 logEvent(s,msg);
 save();renderAll();
}

/* ================= 青训体系 ================= */
const ROOKIE_NAMES=['小沐','阿泽','子辰','昊然','清扬','星野','无眠','逐梦','南风','初见','慕白','亦辰'];
/* 电竞 ID 风格组名：字库两两组合（如 洛野/白柒/江辞），避免「清扬_2」式自增后缀 */
const RK_A=['阿','小','白','苏','陆','沈','顾','洛','叶','凌','夜','莫','江','温','秦','池','祁','许','林','常'];
const RK_B=['川','野','辞','屿','柒','晏','深','迟','昭','眠','遥','笙','秋','策','尘','澜','溪','澈','泠','桉'];
let _rkSeq=0;
/* 收集当前档位已占用的选手名（含市场/挂牌/自由球员/AI阵容缓存），保证新秀名唯一 */
function rookieUsedNames(s){
 const used=new Set();
 [s.players,s.academy].forEach(l=>(l||[]).forEach(p=>p&&p.name&&used.add(p.name)));
 ['market','transferList','freeAgents'].forEach(k=>(s[k]||[]).forEach(p=>p&&p.name&&used.add(p.name)));
 Object.values(s.aiRosters||{}).forEach(r=>(r||[]).forEach(p=>p&&p.name&&used.add(p.name)));
 (s.extraDefs||[]).forEach(d=>d&&d.name&&used.add(d.name)); // 联盟新星 def 的名字也要占位，否则青训会撞名
 return used;
}
function genRookieName(s){
 const used=rookieUsedNames(s);
 let guard=0;
 while(guard++<60){
 const n=Math.random()<0.35?pick(ROOKIE_NAMES):(pick(RK_A)+pick(RK_B));
 if(!used.has(n)){used.add(n);return n;}
 }
 return pick(RK_A)+pick(RK_B)+pick(RK_B); // 三字兜底（如 洛川澈）
}
function genRookie(s){
 _rkSeq++;
 const pos=pick(POS_ORDER);
 const potential=rnd(2,5);
 const attrs={};
 ['lane','farm','team','mind'].forEach(k=>{attrs[k]=clamp(rnd(42,58)+(potential>=4?rnd(0,5):0),40,70);});
 const mainPool=HEROES.filter(h=>h.pos[0]===pos).map(h=>h.n);
 const sig=pick(mainPool);
 const heroPool=[{n:sig,lv:2}];
 const cand=[...new Set(mainPool)].filter(h=>h!==sig);
 for(let i=0;i<3&&cand.length;i++){heroPool.push({n:cand.splice(Math.floor(Math.random()*cand.length),1)[0],lv:1});}
 const name=s?genRookieName(s):(pick(ROOKIE_NAMES)+'·'+_rkSeq);
 return {id:'rk'+_rkSeq,name,pos,team:null,tags:['青训'],
 attrs,skill:{n:'潜力新星',t:pick(['lane','farm','team','mind']),d:'成长型选手，潜力可期'},
 sig,heroPool,career:' 青训出品 · 未来之星',wage:rnd(2,4),energy:ENERGY_MAX,morale:rnd(70,90),injury:0,
 mvp:0,retiring:false,age:rnd(16,17),popularity:rnd(3,8),willingness:rnd(60,90),potential,isRookie:true,contract:2};
}
function recruitRookie(s){
 if(s.fund<300){toast('招募青训需 300万');return;}
 s.fund-=300;
 const r=genRookie(s);
 s.academy=[...(s.academy||[]),r];
 logEvent(s,' 青训营招募新秀 '+r.name+'（'+POS[r.pos][0]+' · 潜力'+r.potential+'）');
 save();renderAll();toast('新秀 '+r.name+' 加入青训营');
}
function trainRookie(s,id){
 if(s.academyTrained){toast('今日已培养过青训选手');return;}
 const r=(s.academy||[]).find(x=>x.id===id);
 if(!r)return;
 if(s.fund<100){toast('青训培养需 100万');return;}
 s.fund-=100;
 s.academyTrained=true;
 // 潜力越高成长越快：2-4 起步 + 潜力加成（pot/2），平均 4~6/天 —— 约 3~4 周培养到晋升线（四维和300）
 const gain=2+rnd(0,2)+Math.floor((r.potential||3)/2);
 const key=pick(['lane','farm','team','mind']);
 r.attrs[key]=clamp(r.attrs[key]+gain,40,95);
 r.morale=clamp(r.morale-3,20,100);
 const label=(TRAIN_ITEMS.find(t=>t.k===key)||{}).n||'属性';
 logEvent(s,' 青训培养：'+r.name+'「'+label+'」+'+gain+'（潜力'+r.potential+'）');
 save();renderAll();
}
function rookieReady(r){
 return ['lane','farm','team','mind'].reduce((t,k)=>t+r.attrs[k],0)>=300;
}
function promoteRookie(s,id){
 const r=(s.academy||[]).find(x=>x.id===id);
 if(!r)return;
 if(!rookieReady(r)){toast(r.name+' 尚未达到晋升标准（四维总和需≥300）');return;}
 if(r.age<18){toast(r.name+' 年仅 '+r.age+' 岁，KPL 规定满 18 岁才能上场比赛——再等一年');return;}
 s.academy=s.academy.filter(x=>x.id!==id);
 r.isRookie=false;
 r.tags=['青训'];
 r.academyGrad=true; // 青训出身永久标记（成就「自家血统/青训门面」判定用）
 r.contract=2; // 晋升一线队签 2 年合同
 s.players.push(r);
 if(!s.lineup.includes(r.id)&&!s.players.some(p=>p.id!==r.id&&p.pos===r.pos&&s.lineup.includes(p.id))){
 // 该位置空缺时直接进首发
 s.lineup.push(r.id);
 }
 logEvent(s,' '+r.name+'（'+r.age+'岁）从青训晋升一线队！');
 save();renderAll();toast(r.name+' 晋升一线队！');
}

/* ================= 位置改造 =================
 现实中职业选手会转型换位置；游戏内用于解决特定位置断档。
 重构英雄池：新旧位置通用英雄保留熟练度，招牌不通用则重立，属性不变。 */
function convertPos(s,pid,newPos){
 const p=s.players.find(x=>x.id===pid);
 if(!p)return;
 if(p.pos===newPos){toast('已经是该位置');return;}
 const cost=300;
 if(s.fund<cost){toast('位置改造需要 '+cost+'万');return;}
 if(s.lineup.includes(pid)&&s.lineup.some(id=>{
 const o=s.players.find(x=>x.id===id);return o&&o.id!==pid&&o.pos===newPos;
 })){toast(POS[newPos][0]+' 首发已有选手，请先将其换下再改造');return;}
 s.fund-=cost;
 const oldPos=p.pos;
 const oldPool=new Map(p.heroPool.map(h=>[h.n,h.lv]));
 p.pos=newPos;
 if(!heroOf(p.sig).pos.includes(newPos)){
 p.sig=pick(HEROES.filter(h=>h.pos[0]===newPos)).n; // 招牌不通用则重立
 }
 const newPool=[{n:p.sig,lv:3}];
 const add=(n,lv)=>{if(!newPool.some(x=>x.n===n))newPool.push({n,lv});};
 HEROES.filter(h=>h.pos.includes(newPos)&&h.n!==p.sig).forEach(h=>add(h.n,oldPool.has(h.n)?oldPool.get(h.n):2));
 p.heroPool=newPool;
 logEvent(s,' '+p.name+' 位置改造：'+POS[oldPos][0]+' → '+POS[newPos][0]+'（'+cost+'万）');
 save();renderAll();toast(p.name+' 已转型 '+POS[newPos][0]);
}
function doConvertPos(){
 const pid=$('#conv-player').value;
 const newPos=$('#conv-pos').value;
 if(!pid){toast('请选择选手');return;}
 convertPos(S,pid,newPos);
}

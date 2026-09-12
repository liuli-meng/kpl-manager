/* 生成 AI 战队阵容（BP 界面可见对手选手与招牌英雄） */
function ensureAiRosters(s,teamName){
 s.aiRosters=s.aiRosters||{};
 if(s.aiRosters[teamName])return s.aiRosters[teamName];
 const map=aiRosterDefMap(s);
 const ids=map[teamName]||(s.ewcDefMap||{})[teamName]; // ewcDefMap：EWC 海外队选手（杯赛期间可正常 BP/结算）
 if(!ids)return [];
 s.aiPower=s.aiPower||{};
 const ownedIds=new Set(s.players.map(p=>p.id));
 const ownedNames=new Set(s.players.map(p=>p.name));
 const roster=ids.map(pid=>{
 const def=defOf(s,pid);
 if(!def)return null;
 if(s.retiredDefs&&s.retiredDefs.includes(pid))return null; // 已退役：空位由青训递补
 if(ownedIds.has(def.id)||ownedNames.has(def.name))return null; // 已被玩家签走：不再出现在对手阵中
 const p=genSeasonPlayer(s,def);
 return p;
 }).filter(Boolean).filter(p=>p.age<(AGE_MODEL[p.pos]||AGE_MODEL.mid).retire); // 到龄退役，空位由青训递补
 // 空位用本队青训递补，保证 5 人；查重必须看全局（玩家+青训营+市场+其他 AI 队缓存），
 // 否则 A/B 两队各自补青训会挑到同一个名字（跨队重名 bug）
 ['top','jg','mid','ad','sup'].forEach(pos=>{
 if(roster.some(p=>p.pos===pos))return;
 const usedNames=rookieUsedNames(s);
 roster.forEach(p=>usedNames.add(p.name));
 const p=genSeasonPlayer(s,genAcademyDef(pos,usedNames,s.season));
 roster.push(p);
 });
 s.aiRosters[teamName]=roster;
 s.aiPower[teamName]=aiRosterPower(roster,s,teamName); // AI 战力=真实阵容结算（与玩家 teamPower 同刻度）
 if(s.challDefMap&&s.challDefMap[teamName])s.aiPower[teamName]=Math.round(s.aiPower[teamName]*1.05); // 挑战者的祝福：低赛道队 vs KPL +5%（玩家对局同规则）
 return roster;
}
/* AI 选手随赛季年龄成长/衰减（与玩家 newSeason 同规则），联赛会随赛季演化
 黄金期每年 +1~2 点（原固定 +1 追不上玩家的训练速度，AI 会原地踏步） */
function ageDrift(p){
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 if(p.age<=m.gold){
 const gk=pick(['lane','farm','team','mind']);
 p.attrs[gk]=clamp(p.attrs[gk]+rnd(2,3),55,99);
 }else if(p.age<m.retire){
 const key=pick(['lane','farm','team','mind']);
 p.attrs[key]=clamp(p.attrs[key]-rnd(1,m.decay),40,99);
 }
}
/* 从原始定义重建选手：年龄逐年推进到当前赛季，成长/衰减逐年结算
 （修复旧版年龄一次跳 N-1 岁但只结算 1 年成长的问题，黄金期选手会真实变强） */
function genSeasonPlayer(s,def){
 const p=genPlayer(def);
 for(let i=0;i<s.season-1;i++){p.age++;ageDrift(p);}
 return p;
}
/* 青训递补选手定义（不占用联盟注册名额，与玩家、各队均不重名）
 底子随赛季水涨船高（每赛季+2，封顶+14）：明星到龄退役后联盟战力不至于塌方 */
function genAcademyDef(pos,usedNames,season){
 const name=typeof ACADEMY_NAMES!=='undefined'?poolName(ACADEMY_NAMES,usedNames):combName(usedNames);
 usedNames.add(name);
 const cands=HEROES.filter(h=>h.pos[0]===pos);
 const boost=Math.min(2*((season||1)-1),14);
 const b=v=>clamp(v+boost,40,99);
 return {id:'ac_'+pos+'_'+Math.random().toString(36).slice(2,7),name,pos,team:null,tags:['青训'],
 base:[b(68),b(68),b(70),b(72)],skill:{n:'青训体系',t:'team',d:'团战属性额外+8%'},
 sig:pick(cands.length?cands:HEROES).n,career:'本队青训营提拔，阶梯赛历练稳定。'};
}
/* ================= AI 转会生态 =================
 AI 阵容以「选手定义(def)」持久化在 s.aiRosterDefs（初始=AI_ROSTERS），每赛季转会期：
 退役结算 → 缺位补强 → 明星流转 → 新星出道。真实选手在联盟内流转，
 玩家始终有明星可挖；青训递补只做兜底，联盟不再随退役塌方。 */
function aiRosterDefMap(s){
 if(!s.aiRosterDefs){
 s.aiRosterDefs={};
 for(const tn in AI_ROSTERS)s.aiRosterDefs[tn]=AI_ROSTERS[tn].p.slice();
 }
 return s.aiRosterDefs;
}
/* 选手 def 查找：静态池（PLAYER_POOL+FA_2026）建 Map 一次，动态池（extraDefs 联盟新生/引援）保持线性 */
let _defIdx=null;
function defIndex(){
 if(!_defIdx){
 _defIdx={};
 PLAYER_POOL.forEach(d=>{_defIdx[d.id]=d;});
 FA_2026.forEach(d=>{_defIdx[d.id]=d;});
 }
 return _defIdx;
}
function defOf(s,pid){return defIndex()[pid]||(s.extraDefs||[]).find(d=>d.id===pid)||null;}
function aiDetachDef(s,pid){ // def 被玩家签走：从所有 AI 队除名，原队转会期自动补强
 if(!defOf(s,pid))return;
 const map=aiRosterDefMap(s);
 for(const tn in map)map[tn]=map[tn].filter(id=>id!==pid);
}
function aiAttachDef(s,pid,teamName){ // def 流入某 AI 队（位置与名额合法才接收）；返回是否入册
 const def=defOf(s,pid);
 if(!def)return false;
 const map=aiRosterDefMap(s);
 if(!map[teamName]||map[teamName].length>=5)return false;
 if(map[teamName].some(id=>{const d=defOf(s,id);return d&&d.pos===def.pos;}))return false;
 aiDetachDef(s,pid);
 const arr=map[teamName]; // aiDetachDef 会整体替换各队数组，必须在除名后重取引用，否则 push 到孤儿数组、该选手从联盟消失
 arr.push(pid);
 s.aiRosters={}; // 名册缓存失效：该选手立即为买方出战、原队除名（与 negoComplete 同步，否则整个赛季缓存都是旧的）
 return true;
}
/* 新星出道：生成一名新秀 def 进入联盟流转（补真实选手的退役折损）
 底子随赛季水涨船高（每赛季+2，封顶+12）：新生代一代比一代强，联盟整体缓慢上探 */
function genStarDef(s,usedNames,forcePos){
 const pos=forcePos||pick(POS_ORDER);
 const name=poolName(ACADEMY_NAMES,usedNames); // 池尽回退 combName，不再生成「新星N」
 usedNames.add(name);
 const sk=pick([['lane','线霸体系','对线属性额外+10%'],['farm','运营体系','运营属性额外+10%'],
 ['team','团战体系','团战属性额外+10%'],['mind','大心脏体系','心态属性额外+10%']]);
 const boost=Math.min(2*((s.season||1)-1),12);
 const b=v=>clamp(v+boost,40,99);
 return {id:'ns_'+s.season+'_'+Math.random().toString(36).slice(2,7),name,pos,team:null,tags:['青训'],
 base:[b(rnd(74,84)),b(rnd(74,84)),b(rnd(74,84)),b(rnd(74,84))],
 skill:{n:sk[1],t:sk[0],d:sk[2]},sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n,
 career:'赛季'+s.season+'从青训营出道的新生代，天赋肉眼可见。'};
}
/* AI 转会期（newSeason 内调用）：联盟生态推进 */
/* 难度分层：按种子战力把 AI 队分成 豪门/中游/弱旅——豪门更凶（抢人/换帅/青训），
 弱旅更散（放人多、补强弱），形成经营压力梯度。玩家连冠会全局加压（王朝反制配套）。 */
function aiTierOf(s,tn){
 const t=AI_TEAMS.find(x=>x.name===tn)||{};
 // AI_TEAMS 用 power；CLUB_TEMPLATES 用 seed——两者都认，避免时代档/现役档口径不一致
 const seed=t.seed!=null?t.seed:(t.power||450);
 const p=s.aiPower&&s.aiPower[tn]!=null?s.aiPower[tn]:seed;
 if(seed>=560||p>=520)return 'elite';
 if(seed>=470||p>=470)return 'mid';
 return 'weak';
}
function aiDiffMul(s,tn){
 // 全局：玩家 ≥2 连冠 → 全联盟决策更积极（研究/挖角/青训加码）
 const pressure=1+Math.min(dynastyStreak(s,s.teamName),3)*0.08;
 const t=aiTierOf(s,tn);
 return (t==='elite'?1.35:t==='mid'?1:0.72)*pressure;
}
function aiTransferWindow(s){
 const map=aiRosterDefMap(s);
 s.extraDefs=s.extraDefs||[];
 s.retiredDefs=s.retiredDefs||[];
 const teams=Object.keys(map).filter(tn=>tn!==s.teamName);
 const roll={}; // def 当前赛季估值（窗口内缓存，避免同 def 多次随机重掷）
 const ovrOf=def=>roll[def.id]||(roll[def.id]=overall(genSeasonPlayer(s,def)));
 // ① 退役结算：到龄选手离开联盟（转型教练/主播进入名宿市场）
 teams.forEach(tn=>{
 map[tn]=map[tn].filter(pid=>{
 const def=defOf(s,pid);
 if(!def)return false;
 if(s.retiredDefs.includes(pid))return false;
 const p=genSeasonPlayer(s,def);
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 if(p.age>=m.retire){
 s.retiredDefs.push(pid);
 retireToCoach(s,p);
 logEvent(s,' '+p.name+'（'+p.age+'岁）宣布退役，'+tn+' 腾出'+POS[p.pos][0]+'位置');
 return false;
 }
 return true;
 });
 });
 // ①.5 AI 续约决策：状态差（过黄金期/战力低迷）→ 不续约释放进自由池；状态好 → 续约留队
 // 难度：弱旅更愿放人重组，豪门更愿留核心（badForm 阈值按 tier 收紧/放宽）
 const releasedFrom={};
 teams.forEach(tn=>{
 const tier=aiTierOf(s,tn);
 const holdBias=tier==='elite'?0.25:tier==='weak'?-0.15:0; // 负=更容易放人
 map[tn]=map[tn].filter(pid=>{
 const def=defOf(s,pid);
 if(!def)return false;
 const p=genSeasonPlayer(s,def);
 const am=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 const badForm=(p.age>am.gold&&Math.random()<0.55+holdBias)||(overall(p)<76&&Math.random()<0.5+holdBias);
 if(badForm){
 releasedFrom[pid]=tn;
 logEvent(s,' '+tn+' 未与 '+p.name+'（'+p.age+'岁 · 总值'+overall(p)+'）续约，状态下滑进入自由市场');
 return false;
 }
 return true; // 状态好：续约留队
 });
 });
 // ② 自由池：未被任何 AI 队签下的 def（原版无队选手、被放走的老将、待业新星）
 // 先清「幽灵注册」：玩家已买走的 def 若残留在某 AI 队注册表（旧档/并发路径），一律除名——
 // 否则该位置被幽灵占位，球队永远补不进真人（上场时 ownedIds 过滤又打不出战力）
 teams.forEach(tn=>{
 map[tn]=map[tn].filter(pid=>!s.players.some(x=>x.id===pid));
 });
 const assigned=new Set();
 teams.forEach(tn=>map[tn].forEach(id=>assigned.add(id)));
 // 自由池必须排除玩家已拥有的 def：否则会被 AI「签走」成幽灵，占住别人阵容还补不了强
 let freePool=PLAYER_POOL.concat(s.extraDefs).filter(d=>!assigned.has(d.id)&&!s.retiredDefs.includes(d.id)&&!s.players.some(x=>x.id===d.id)).slice();
 // ③ 缺位补强：弱队优先，按位置签自由池最强者；池里没有该位置候选人时
 // 直接引进一名新援（青训提拔/次级联赛引援）——绝不让空位拖一整赛季
 const order=teams.slice().sort((a,b)=>(s.aiPower[a]||400)-(s.aiPower[b]||400));
 const usedNames=rookieUsedNames(s); // 全局查重（玩家/青训/市场/各队缓存）
 PLAYER_POOL.concat(s.extraDefs).forEach(d=>usedNames.add(d.name));
 order.forEach(tn=>{
 let guard=0;
 while(map[tn].length<5&&guard++<6){
 const have=new Set(map[tn].map(id=>defOf(s,id)).filter(Boolean).map(d=>d.pos));
 const need=POS_ORDER.find(pos=>!have.has(pos));
 if(!need)break;
 const cands=freePool.filter(d=>d.pos===need&&releasedFrom[d.id]!==tn); // 本队不签回刚放走的
 let def;
 if(cands.length){
 def=cands.sort((a,b)=>ovrOf(b)-ovrOf(a))[0];
 freePool=freePool.filter(d=>d!==def);
 logEvent(s,' 转会：'+def.name+' 加盟 '+tn+'（'+POS[def.pos][0]+'）');
 }else{
 def=genStarDef(s,usedNames,need); // 自由池无人可签：按缺位引进新援（对位培养，底子随赛季水涨船高）
 s.extraDefs.push(def);
 logEvent(s,' 补强：'+tn+' 引进 '+def.name+'（'+POS[def.pos][0]+' · 次级联赛引援）');
 }
 map[tn].push(def.id);
 }
 });
 // ④ 明星流转：按难度概率用自由池明显更强的同位置选手换下一名首发（豪门更积极）
 order.forEach(tn=>{
 const pStar=0.5*aiDiffMul(s,tn);
 if(Math.random()>=pStar||map[tn].length<5||!freePool.length)return;
 let best=null;
 map[tn].forEach(pid=>{
 const def=defOf(s,pid);
 if(!def)return;
 const cur=ovrOf(def);
 // 豪门更挑剔（需 +5 才换），弱旅更愿意赌（+3 就换）
 const needGain=aiTierOf(s,tn)==='elite'?5:aiTierOf(s,tn)==='weak'?3:4;
 freePool.forEach(d=>{
 if(d.pos!==def.pos)return;
 const gain=ovrOf(d)-cur;
 if(gain>=needGain&&(!best||gain>best.gain))best={gain,pid,def,out:def};
 });
 });
 if(best){
 const out=best.out;
 freePool=freePool.filter(d=>d!==best.def);
 map[tn]=map[tn].map(id=>id===best.pid?best.def.id:id);
 freePool.push(out);
 logEvent(s,' 转会：'+best.def.name+' 加盟 '+tn+'，'+out.name+' 离队寻找下家');
 }
 });
 // ⑤ 新星出道：每赛季 2-3 名新秀进入联盟（对冲各位置退役潮，优先补缺位，否则待业进自由市场）
 // 难度：玩家连冠压力下多生 1 人（联盟不让你躺）
 const extraBirth=dynastyStreak(s,s.teamName)>=2?1:0;
 const births=rnd(2,3)+extraBirth;
 for(let i=0;i<births;i++){
 const def=genStarDef(s,usedNames);
 s.extraDefs.push(def);
 const tn=order.find(t=>map[t].length<5&&!map[t].some(id=>{const d=defOf(s,id);return d&&d.pos===def.pos;}));
 if(tn){map[tn].push(def.id);logEvent(s,' 新星出道：'+def.name+'（'+POS[def.pos][0]+'）加盟 '+tn);}
 else{logEvent(s,' 新星出道：'+def.name+'（'+POS[def.pos][0]+'）进入自由市场');}
 }
 // ⑥ 教练组流动：AI 队也会换帅——从名宿市场挖更好的教练（与玩家抢人），旧帅下岗回流市场
 // 弱队优先、只升不降；换帅概率按难度分层
 s.retiredCoaches=s.retiredCoaches||[];
 let coachMoved=false;
 order.forEach(tn=>{
 if(Math.random()>=0.45*aiDiffMul(s,tn))return;
 const cur=aiCoachState(s)[tn]||{bonus:6};
 const c=s.retiredCoaches.filter(r=>r.type!=='host'&&r.bonus>cur.bonus).sort((a,b)=>b.bonus-a.bonus)[0];
 if(!c)return;
 s.retiredCoaches=s.retiredCoaches.filter(r=>r.id!==c.id);
 if(cur.name)s.retiredCoaches.push({...cur,type:'coach'}); // 旧帅回流名宿市场，玩家可签
 aiCoachState(s)[tn]={id:c.id,name:c.name,rating:c.rating,bonus:c.bonus,styleBonus:c.styleBonus,style:c.style};
 coachMoved=true;
 logEvent(s,'换帅！'+c.name+'（全队战力+'+c.bonus+'%）执教 '+tn+(cur.name?'，'+cur.name+' 回流名宿市场':''));
 });
 if(coachMoved)s.aiRosters={}; // 教练加成变化：名册缓存战力失效
 // ⑦ AI 青训培养：AI 队也有自家青训营——概率培养底子，达标的自动晋升替换队内弱首发
 // （豪门开班更勤、练得更狠）
 s.aiAcademy=s.aiAcademy||{};
 let rookMoved=false;
 order.forEach(tn=>{
 const mul=aiDiffMul(s,tn);
 if(Math.random()>=0.4*mul)return;
 if(!s.aiAcademy[tn]||!s.aiAcademy[tn].length){
 const pool=[];
 const n=aiTierOf(s,tn)==='elite'?rnd(2,3):rnd(1,2);
 for(let k=0;k<n;k++){
 const def=genAiRookieDef(s,tn);
 s.extraDefs.push(def);
 pool.push(def.id);
 }
 s.aiAcademy[tn]=pool;
 logEvent(s,' '+tn+' 青训营开班，签入 '+pool.length+' 名新秀（'+pool.map(id=>defOf(s,id).name).join('、')+'）');
 }
 // 培养一名新秀（随机属性 +2~4，与玩家青训培养同量级；豪门可到 +5）
 const id=s.aiAcademy[tn][rnd(0,s.aiAcademy[tn].length-1)];
 const r=defOf(s,id);
 if(!r)return;
 const key=pick(['lane','farm','team','mind']);
 const idx=['lane','farm','team','mind'].indexOf(key);
 const trainMax=aiTierOf(s,tn)==='elite'?5:4;
 r.base[idx]=clamp((r.base[idx]||70)+rnd(2,trainMax),40,95);
 const rSum=sumBase(r);
 logEvent(s,' '+tn+' 培养青训 '+r.name+'（'+POS[r.pos][0]+'）「'+TRAIN_ITEMS.find(t=>t.k===key).n+'」+2~'+trainMax);
 // 达标晋升：四维和≥300 且队内该位置首发弱于新秀 → 替换上位（老将离队寻找下家）
 if(rSum>=300){
 const rOvr=overall(genSeasonPlayer(s,r));
 const oldIdx=map[tn].findIndex(pid=>{const d=defOf(s,pid);return d&&d.pos===r.pos;});
 if(oldIdx>=0){
 const oldDef=defOf(s,map[tn][oldIdx]);
 if(oldDef&&overall(genSeasonPlayer(s,oldDef))<rOvr){
 map[tn][oldIdx]=r.id;
 rookMoved=true;
 logEvent(s,' '+tn+' 新秀 '+r.name+'（'+rOvr+'总值）晋升一线队，'+oldDef.name+' 离队寻找下家');
 return; // 晋升替换完成，本队不再继续
 }
 }else if(map[tn].length<5){
 map[tn].push(r.id);
 rookMoved=true;
 logEvent(s,' '+tn+' 新秀 '+r.name+'（'+rOvr+'总值）晋升一线队（'+POS[r.pos][0]+'）');
 }
 }
 });
 if(rookMoved)s.aiRosters={}; // 名册缓存失效
}
/* AI 青训新秀 def（四维底子 60-70 起，培养 2-4 次可达 300 晋升线；名字全局查重） */
function genAiRookieDef(s,teamName){
 const used=rookieUsedNames(s);
 PLAYER_POOL.concat(s.extraDefs).forEach(d=>used.add(d.name));
 let name;
 const guard=()=>{let g=0;while(g++<60){const n=Math.random()<0.5?(pick(['小沐','阿泽','子辰','昊然','清扬','星野','无眠','逐梦','南风','初见'])+'·'+teamName.slice(0,2)):(pick(RK_A)+pick(RK_B));if(!used.has(n)){used.add(n);return n;}}return '青训·'+teamName.slice(0,2);};
 name=guard();
 const pos=pick(POS_ORDER);
 const b=v=>clamp(v+rnd(-3,3),58,76);
 return {id:'aiq'+gameYear(s)+'_'+rnd(1000,9999)+'_'+teamName.slice(0,2),name,pos,team:teamName,tags:['青训'],
 base:[b(70),b(68),b(70),b(68)],
 skill:{n:'潜力新星',t:pick(['lane','farm','team','mind']),d:'AI 青训出品，达标自动晋升'},
 sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n,career:' '+teamName+' 青训营培养的新生代。'};
}
function sumBase(d){return (d.base||[0,0,0,0]).reduce((t,v)=>t+v,0);}
/* 构建转会市场：各 AI 队选手（含非卖品与意愿） */
function buildTransferMarket(s){
 s.transferList=[];
 const U=new Set(); // 非卖品按原队设定（建队核心走到哪都是队魂）
 for(const tn in AI_ROSTERS)AI_ROSTERS[tn].u.forEach(id=>U.add(id));
 const map=aiRosterDefMap(s);
 for(const tn in map){
 if(tn===s.teamName)continue;
 map[tn].forEach(pid=>{
 if(s.players.some(x=>x.id===pid))return; // 玩家已拥有
 if((s.retiredDefs||[]).includes(pid))return; // 已退役
 const def=defOf(s,pid);
 if(!def)return;
 const p=genSeasonPlayer(s,def); // 与 AI 名册同规则：年龄逐年推进+成长结算
 p.ownerTeam=tn;
 p.untouchable=U.has(pid);
 // 达到位置退役年龄（野射24/对抗中26/辅助31）：不进买断池，老将转向名宿市场（教练/主播）
 const am=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 if(p.age>=am.retire){retireToCoach(s,p);return;}
 if(p.age>am.gold)p.aging=true; // 已过黄金期：买来即巅峰末期
 // 非卖品并非永远忠诚：意愿随年龄衰减（30岁+大幅松动，队魂也会离队）
 if(p.untouchable){
 const decay=p.age>=30?rnd(30,45):p.age>=27?rnd(12,22):rnd(0,8);
 p.willingness=clamp(rnd(85,100)-decay,25,100);
 }
 s.transferList.push(p);
 });
 }
 s.transferList.sort((a,b)=>overall(b)-overall(a));
 // 自由球员：26 年自由市场（真实 KPL 选手轮换上架，签一人少一人）+ 各队无球可打的替补
 s.freeAgents=[];
 const seenFA=new Set();
 shuffle(FA_2026.filter(d=>!s.players.some(x=>x.id===d.id)&&!(s.retiredDefs||[]).includes(d.id))).slice(0,3).forEach(def=>{
 seenFA.add(def.id);
 const p=genSeasonPlayer(s,def);
 p.signCost=Math.round(valueOf(overall(p))*0.7); // 真实选手身价 7 折直签
 p.freeAgent=true;
 p.willingness=rnd(70,95); // 合同到期，寻求下家
 s.freeAgents.push(p);
 });
 while(s.freeAgents.length<3){
 const pos=pick(POS_ORDER);
 const assigned=new Set(); // 各 AI 队在册 def：真正的无球可打者才能进自由市场
 const dmap=aiRosterDefMap(s);
 for(const tn in dmap){if(tn===s.teamName)continue;dmap[tn].forEach(id=>assigned.add(id));}
 const pool=PLAYER_POOL.concat(s.extraDefs||[]).filter(d=>d.pos===pos&&!seenFA.has(d.id)
 &&!assigned.has(d.id)&&!(s.retiredDefs||[]).includes(d.id)&&!s.players.some(x=>x.id===d.id));
 if(!pool.length)break;
 const def=pick(pool);
 seenFA.add(def.id);
 const p=genSeasonPlayer(s,def);
 p.signCost=Math.round(valueOf(overall(p))*0.58); // 无球可打，按身价 58 折直签
 p.freeAgent=true;
 p.willingness=rnd(70,100); // 无球可打，想走
 s.freeAgents.push(p);
 }
 s.freeAgents.sort((a,b)=>overall(b)-overall(a));
}
/* 更衣室产物：公开要求离队的选手更容易谈走——俱乐部留人成本上升（买断费打折、强挖更易、
   本人要价降低）。三处结算必须同用一个判定，避免" UI 说容易谈、实际更贵"的分裂 */
const effWillingness=p=>clamp((p.willingness||0)+(p.transferRequest?-30:0),0,100);
/* 买断费：基础价（总值曲线） × 战力加成 × 意愿系数（意愿低=更难挖）；要求离队者八五折 */
function buyoutPrice(p){
 const base=valueOf(overall(p));
 const powBonus=1+Math.max(0,(playerPower(p,p.sig)-55)/200);
 const wil=p.willingness||0;
 const wilMult=wil>=60?1:wil>=30?1.5:2.2;
 return Math.round(base*powBonus*wilMult*(p.transferRequest?0.85:1));
}
/* 非卖品强挖：2.5倍溢价，成功率=意愿缺口，失败意愿-10（多次尝试终能打动） */
function untouchablePrice(p){return Math.round(buyoutPrice(p)*2.5);}
function raidChance(p){return clamp((100-effWillingness(p))/100,0.02,0.92);}
/* ================= FC26 式转会谈判 =================
 玩家报「转会费+年薪」组合报价 → 对方评估 → 最多 3 轮拉锯：
 每轮被拒后对方给出明确还价，接受还价即成交；超轮次或强挖失败则谈判破裂。
 超帽不拒签：允许超工资帽签约，超出部分每周缴纳 60% 奢侈税（发薪日结算，经营页可见）。 */
function negoWageDemand(p){
 return Math.max(2,Math.round(p.wage*(1.15+(100-(p.willingness||0))/120)*(p.transferRequest?0.9:1)));
}
function negoAskFee(p){
 return p.untouchable?untouchablePrice(p):buyoutPrice(p);
}
function overCapTax(s,extraWage){
 const over=Math.max(0,weeklyWage(s)+(extraWage||0)-s.wageCap);
 return {over,tax:Math.round(over*0.6)};
}
function negoCapCheck(s,p){
 const {over,tax}=overCapTax(s,p.wage);
 if(over<=0)return true;
 return confirm(' 超帽签约：签下 '+p.name+' 后周薪 '+(weeklyWage(s)+p.wage)+'万（帽 '+s.wageCap+'万），超出 '+over+'万/周 需每周缴纳 60% 奢侈税（'+tax+'万/周）。\n多花钱可以，确定签下？');
}
function negoComplete(s,p,fee){
 const from=p.ownerTeam,isFA=p.freeAgent;
 delete p.ownerTeam;delete p.untouchable;delete p.freeAgent;delete p.signCost;
 if(fee!=null)p.acqCost=fee; // 买入价锚定（自由球员记 0，转售按保底价压）
 if(p.contract==null)p.contract=2; // 签约即给合同年限
 s.players.push(p);
 aiDetachDef(s,p.id); // 从 AI 阵容除名（若为 def）：原队下个转会期自动补强
 if(isFA)s.freeAgents=(s.freeAgents||[]).filter(x=>x.id!==p.id);
 s.transferList=(s.transferList||[]).filter(x=>x.id!==p.id);
 s.aiRosters={}; // 玩家签走任何选手后重建全部对手名册（自由球员也可能是他人首发，防同一名选手出现在两队）
}
function openNegotiation(s,pid){
 const p=s.transferList.find(x=>x.id===pid)||(s.freeAgents||[]).find(x=>x.id===pid);
 if(!p){toast('该选手不在转会市场');return;}
 if(s.players.some(x=>x.id===pid)){toast('已拥有该选手');return;}
 window._nego={s,pid,round:1,
 freeAgent:!!p.freeAgent,
 askFee:p.freeAgent?0:negoAskFee(p),
 askWage:negoWageDemand(p)};
 renderNego();
}
function negoRow(label,value,extra){return `<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--dim)">${label}</span><b>${value}${extra||''}</b></div>`;}
function renderNego(){
 const n=window._nego;if(!n)return;
 const s=n.s,p=s.transferList.find(x=>x.id===n.pid)||(s.freeAgents||[]).find(x=>x.id===n.pid);
 if(!p){window._nego=null;return;}
 const cur=weeklyWage(s);
 let html=`<h2> 转会谈判 <span class="tag">第 ${n.round}/3 轮</span></h2>
 <div class="match" style="margin:10px 0;padding:10px 12px">
 <div class="center" style="margin-bottom:6px"><b style="font-size:16px;color:${ovrColor(overall(p))}">${p.name}</b>
 <span class="dim">${POS[p.pos][0]} · 总值${overall(p)} · ${p.age}岁 · 战力 ${playerPower(p,p.sig)}</span></div>
 ${negoRow('现效力',p.freeAgent?'自由球员（无球可打）':p.ownerTeam||'—')}
 ${negoRow('本人意愿',effWillingness(p)+' / 100',p.transferRequest?' <span style="color:var(--gold)">（已公开要求离队 · 更容易谈）</span>':(p.willingness<40?' <span style="color:var(--red)">（很可能拒绝）</span>':''))}
 ${negoRow('对方心理价位',n.freeAgent?'—（仅谈薪资）':n.askFee+'万 转会费')}
 ${negoRow('期望年薪',n.askWage+'万')}
 ${(()=>{const {over,tax}=overCapTax(s,p.wage);return negoRow('签后周薪',(cur+p.wage)+' / 帽 '+s.wageCap+'万',over>0?` <span style="color:var(--red)">超帽${over}万 · 税${tax}万/周</span>`:' <span style="color:var(--green)">帽内</span>');})()}
 ${p.untouchable?`<div class="hint" style="color:var(--red)"> 非卖品：需 ${n.askFee}万 溢价强挖，每轮谈判有失败风险</div>`:''}
 </div>
 <div class="hint" style="margin-bottom:8px">报价需同时满足「转会费 ≥ 心理价位」和「年薪 ≥ 期望」，也可压价试探——但每被拒一轮，对方要价上涨，第 3 轮仍不满足则谈判破裂（意愿-10）。</div>
 ${n.msg?`<div class="event-card" style="margin-bottom:10px">${n.msg}</div>`:''}
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
 <label style="flex:1;min-width:120px">转会费(万)<input id="nego-fee" type="number" class="hd-in" value="${n.freeAgent?0:Math.round(n.askFee*0.8)}" ${n.freeAgent?'disabled':''} style="width:100%;margin-top:4px"></label>
 <label style="flex:1;min-width:120px">年薪(万)<input id="nego-wage" type="number" class="hd-in" value="${n.askWage}" style="width:100%;margin-top:4px"></label>
 </div>
 <div class="center" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
 <button class="btn" onclick="negoQuit()"> 放弃</button>
 ${!n.freeAgent?`<button class="btn" onclick="negoFillAsk()"> 满足要价</button>`:''}
 <button class="btn primary" onclick="negoSubmit()"> 递交报价</button>
 </div>`;
 $('#app-modal-body').innerHTML=html;
 $('#app-modal').classList.add('on');
}
function negoFillAsk(){
 const n=window._nego;if(!n)return;
 // 意愿低的选手需要溢价才肯加盟（1.3 倍转会费），“满足要价”直接给出可成交的数
 const mult=(n.s.transferList.find(x=>x.id===n.pid)||{}).willingness<30?1.3:1;
 $('#nego-fee').value=Math.round(n.askFee*mult);$('#nego-wage').value=n.askWage;
}
function negoQuit(){
 window._nego=null;closeModal('app-modal');toast('已退出谈判');
}
function negoSubmit(){
 const n=window._nego;if(!n)return;
 const s=n.s,p=s.transferList.find(x=>x.id===n.pid)||(s.freeAgents||[]).find(x=>x.id===n.pid);
 if(!p){window._nego=null;closeModal('app-modal');toast('谈判对象已失效（被他人签走或市场刷新）');return;}
 const fee=n.freeAgent?0:Math.max(0,parseInt($('#nego-fee').value,10)||0);
 const wage=Math.max(1,parseInt($('#nego-wage').value,10)||0);
 if(!n.freeAgent&&fee>s.fund){n.msg=' 俱乐部资金不足（现有 '+fmtWan(s.fund)+'，报价 '+fmtWan(fee)+'）。';renderNego();return;}
 // 非卖品强挖：每轮都掷成功率，失败=本轮破裂且要价上涨
 if(p.untouchable&&Math.random()>raidChance(p)){
 p.willingness=clamp(p.willingness-10,5,100);
 n.askFee=Math.round(n.askFee*1.15);n.askWage=negoWageDemand(p);
 n.round++;
 logEvent(s,' 强挖 '+p.name+' 被拒（'+(p.ownerTeam||'原俱乐部')+' 态度强硬，意愿-10）');
 if(n.round>3){negoBreak(s,p,'强挖多次未果');return;}
 n.msg=' '+p.ownerTeam+' 拒绝放人！对方态度更加强硬（意愿降至 '+p.willingness+'，要价已上调）。';
 renderNego();return;
 }
 // 评估：转会费/年薪是否达到逐轮上涨的要价
 const feeOk=n.freeAgent||fee>=n.askFee;
 const wageOk=wage>=n.askWage;
 const willingOk=p.willingness>=30||fee>=n.askFee*1.3; // 意愿低但要价给足也能打动
 if(feeOk&&wageOk&&willingOk){
 if(!negoCapCheck(s,p))return; // 超帽需确认（奢侈税），取消则留在谈判
 if(!n.freeAgent)s.fund-=fee;
 p.wage=wage;
 const fromTeam=n.freeAgent?'自由球员':(p.ownerTeam||'原俱乐部');
 negoComplete(s,p,n.freeAgent?0:fee);
 recordTransfer(s,'in',p,n.freeAgent?0:fee,fromTeam,n.freeAgent?'自由球员直签':'转会买断');
 logEvent(s,(n.freeAgent?' 签下自由球员 ':' 转会达成！')+' '+p.name+' 加盟 '+s.teamName+(n.freeAgent?'（年薪 '+wage+'万）':'（转会费 '+fee+'万 · 年薪 '+wage+'万）'));
 if(fee>=300)logEvent(s,' 重磅转会！联盟震动');
 window._nego=null;closeModal('app-modal');
 try{SFX.gold();}catch(_){}
 save();renderAll();toast(' 谈判成功！'+p.name+' 加盟');
 return;
 }
 // 被拒：给还价，要价上涨
 n.round++;
 n.askFee=n.freeAgent?0:Math.round(n.askFee*(feeOk?1:1.12));
 n.askWage=Math.round(n.askWage*(wageOk?1:1.1));
 const why=[];
 if(!feeOk)why.push('转会费低于心理价位');
 if(!wageOk)why.push('年薪不够');
 if(!willingOk)why.push('本人无意加盟');
 if(n.round>3){negoBreak(s,p,why.join('、'));return;}
 n.msg=' 对方摇头：'+why.join('、')+'。<br> 经纪人放话——'+(n.freeAgent?'':'转会费至少 <b style="color:var(--gold)">'+n.askFee+'万</b>，')+'年薪 <b style="color:var(--gold)">'+n.askWage+'万</b> 才考虑。';
 renderNego();
}
function negoBreak(s,p,reason){
 p.willingness=clamp(p.willingness-10,5,100);
 logEvent(s,' 与 '+p.name+' 的谈判破裂（'+reason+'），选手意愿-10');
 window._nego=null;closeModal('app-modal');
 save();renderAll();toast('谈判破裂：'+p.name+' 不为所动');
}

/* ================= 卖方谈判（FC26 式：多家俱乐部竞价，你抬价/递要价/接受） =================
 与买方对称：意向俱乐部数量由总值/人气决定，预算按俱乐部身价；
 三轮内递交心理要价——要价≤对方预算则接受、接近预算则给最终报价、过高直接退出；
 任何时候可接受某个报价；「回收商」一口价永远兜底（原秒卖价）。
 转售保护：刚买入未打满 5 场的选手，报价被压在买入价九折内（杜绝低价买高价卖的套利）。 */
function sellAskPrice(p){
 const base=Math.round(valueOf(overall(p))*0.92);
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 const ageF=p.age<=m.gold?1.1:p.age>=m.retire-1?0.7:0.9; // 黄金期溢价，临近退役打折
 const popF=1+(p.popularity||0)/250; // 人气=商业价值
 const valF=(p.val||100)/100; // 比赛表现浮动：状态火热溢价、持续低迷打折（70%~150%）
 return Math.round(base*ageF*popF*valF);
}
/* 表现状态标签（身价浮动可视化） */
function perfLabel(p){
 const v=p.val||100;
 return v>=125?'火热':v>=110?'↗走高':v>=95?'—稳定':v>=80?'↘下滑':'低迷';
}
/* 转售上限：有买入记录且出场<5 时返回价格上限，否则 null（无限制） */
function sellCeiling(p){
 if(p.acqCost==null||(p.caps||0)>=5)return null;
 const anchor=(p.acqCost||0)>0?p.acqCost:Math.round(valueOf(overall(p))*0.65);
 return Math.round(anchor*0.9);
}
function openSellNego(s,pid){
 const p=s.players.find(x=>x.id===pid);
 if(!p)return;
 if(p.loan){toast('租借选手不属于俱乐部，不能出售');return;}
 if(typeof natCamping==='function'&&natCamping(s,p)){toast(p.name+' 正在国家队集训（缺席夏季赛），不能出售');return;}
 if(p.natFill){toast(p.name+' 是亚运集训期的借调顶位，归还青训前不能出售');return;}
 if(p.kjia>0){toast(p.name+' 正在 K甲锻炼（剩余 '+p.kjia+' 天），归队后再操作转会');return;}
 if((s.listed||[]).some(x=>x.id===pid)){toast('该选手已挂牌，请先撤牌或等待报价');return;}
 const ask=sellAskPrice(p);
 const cap=sellCeiling(p);
 let cnt=overall(p)>=88?rnd(2,3):overall(p)>=78?rnd(1,2):(Math.random()<0.6?1:0); // 总值/人气决定意向俱乐部数
 if((p.popularity||0)>50)cnt++;
 const pool=AI_TEAMS.filter(t=>t.name!==s.teamName).slice();
 const clubs=[];
 for(let i=0;i<cnt&&pool.length;i++){
 const t=pool.splice(Math.floor(Math.random()*pool.length),1)[0];
 const wealth=0.85+(t.power/640)*0.5; // 豪门预算更足
 let max=Math.round(ask*wealth*rnd(90,115)/100);
 if(cap!=null)max=Math.min(max,cap);
 clubs.push({name:t.name,max,bid:Math.round(max*rnd(60,78)/100),status:'active'});
 }
 window._sellNego={s,pid,round:1,ask,lock:cap!=null,lockCaps:Math.min(p.caps||0,4),
 lowball:Math.round(valueOf(overall(p))*0.65),
 clubs,
 msg:clubs.length?'收到 '+clubs.length+' 家俱乐部的初步报价：可直接接受、对某家逐轮抬价，或统一递交心理要价。':'暂无俱乐部感兴趣——可去挂牌等报价，或接受回收商一口价。'};
 renderSellNego();
}
function renderSellNego(){
 const n=window._sellNego;if(!n)return;
 const s=n.s,p=s.players.find(x=>x.id===n.pid);
 if(!p){window._sellNego=null;return;}
 const rows=n.clubs.map((c,i)=>{
 const badge=c.status==='agreed'?'<span class="green"> 接受你的要价</span>'
 :c.status==='final'?'<span style="color:var(--gold)">最终报价 · 不再抬</span>'
 :c.status==='walked'?'<span class="red">已退出</span>'
 :'<span style="color:var(--dim)">有意向</span>';
 const btn=c.status==='walked'?'':`<button class="btn sm primary" style="margin:0;min-width:56px" onclick="sellAcceptClub(${i})">接受</button>`;
 return `<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><span class="tname" style="font-size:13px">${c.name}</span><div class="power" style="font-size:10px">${badge}</div></div>
 <div class="score" style="font-size:13px;min-width:0">${c.bid}万</div>
 ${btn}
 </div>`;
 }).join('');
 const lowballRow=`<div class="match" style="margin-bottom:6px;padding:8px 10px">
 <div class="vs"><span class="tname" style="font-size:13px">回收商</span><div class="power" style="font-size:10px"><span style="color:var(--dim)">一口价打包带走</span></div></div>
 <div class="score" style="font-size:13px;min-width:0">${n.lowball}万</div>
 <button class="btn sm" style="margin:0;min-width:56px" onclick="sellAcceptClub(-1)">接受</button>
 </div>`;
 const html=`<h2>出售谈判 <span class="tag">${p.name} · 第 ${Math.min(n.round,3)}/3 轮</span></h2>
 <div class="hint" style="margin-bottom:8px">${POS[p.pos][1]} · 总值${overall(p)} · ${p.age}岁 · 战力 ${playerPower(p,p.sig)} · 人气 ${p.popularity||0} · 表现 <b class="${(p.val||100)>=110?'green':(p.val||100)<90?'red':''}">${perfLabel(p)} ${p.val||100}%</b><br>心理要价随比赛表现浮动（火热最高 +50%、低迷最低 -30%）；要价≤预算即成交、接近预算给最终报价、太高直接吓跑；三轮后未成交只剩回收商。</div>
 ${rows}${lowballRow}
 ${n.lock?`<div class="hint" style="margin:8px 0;color:var(--gold)"> 新援保护期：${p.name} 尚未代表球队打满 5 场（当前 ${n.lockCaps}/5），俱乐部报价压在买入价九折内——先让他上场，打满后恢复真实身价。</div>`:''}
 ${n.msg?`<div class="hint" style="margin:8px 0;color:var(--cyan)">${n.msg}</div>`:''}
 <div style="display:flex;gap:8px;align-items:center;margin:10px 0">
 <span style="font-size:12px;color:var(--dim);white-space:nowrap">心理要价</span>
 <input id="sell-ask" type="number" value="${n.ask}" style="flex:1;background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px 10px;font-size:14px">
 <button class="btn primary" onclick="sellSubmitAsk()"> 递交要价</button>
 </div>
 <div class="center" style="display:flex;gap:8px;justify-content:center">
 <button class="btn" onclick="sellQuit()"> 停止出售</button>
 </div>`;
 $('#app-modal-body').innerHTML=html;
 $('#app-modal').classList.add('on');
}
function sellSubmitAsk(){
 const n=window._sellNego;if(!n)return;
 const A=Math.max(1,parseInt($('#sell-ask').value,10)||0);
 n.ask=A;n.round++;
 let agreed=0,finals=0,left=0;
 n.clubs.forEach(c=>{
 if(c.status!=='active')return;
 if(A<=c.max){c.bid=A;c.status='agreed';agreed++;}
 else if(A<=c.max*1.25){c.bid=c.max;c.status='final';finals++;}
 else{c.status='walked';left++;}
 });
 if(n.round>3){
 n.clubs.forEach(c=>{if(c.status==='active'){c.bid=c.max;c.status='final';}});
 n.msg=' 最后通牒：三轮报价结束，仍在谈的俱乐部给出了最终报价——接受或放弃。';
 }else if(agreed){
 n.msg=' '+agreed+' 家俱乐部接受你的要价，点「接受」即可成交！';
 }else if(finals){
 n.msg=' '+finals+' 家俱乐部给出了最终报价，再抬价他们就退出了'+(left?'，另有 '+left+' 家已离场':'')+'。';
 }else{
 n.msg=' 要价太高，俱乐部都在观望或离场……';
 }
 renderSellNego();
}
function sellAcceptClub(i){
 const n=window._sellNego;if(!n)return;
 const s=n.s;
 let team,fee;
 if(i<0){team='回收商';fee=n.lowball;}
 else{
 const c=n.clubs[i];
 if(!c||c.status==='walked'){toast('该俱乐部已退出谈判');return;}
 team=c.name;fee=c.bid;
 }
 const p=s.players.find(x=>x.id===n.pid);
 if(!p)return;
 const wasStarter=s.lineup.includes(p.id);
 completeSale(s,p,fee,team);
 if(wasStarter&&!s.players.some(x=>x.pos===p.pos))toast(' '+POS[p.pos][0]+'位置已无人，记得补签');
 window._sellNego=null;closeModal('app-modal');
 save();renderAll();toast(p.name+' 已售出（'+fee+'万）');
}
function sellQuit(){
 window._sellNego=null;closeModal('app-modal');toast('已停止出售，选手留队');
}
/* 成交共用：转会费入账 + 名册/首发/挂牌清理 */
function completeSale(s,p,fee,team){
 recordTransfer(s,'out',p,fee,team,'转会出售'); // 年度回顾·转会台账
 s.fund+=fee;
 s.maxSale=Math.max(s.maxSale||0,fee); // 单笔出售纪录（成就「天价交易」）
 s.players=s.players.filter(x=>x.id!==p.id);
 if(s.lineup.includes(p.id))s.lineup=s.lineup.filter(x=>x!==p.id);
 if(s.pick)delete s.pick[p.pos];
 s.listed=(s.listed||[]).filter(x=>x.id!==p.id);
 s.bids=(s.bids||[]).filter(x=>x.id!==p.id);
 // 兜底注册 def：市场/自由签来的选手（genFreeAgentDef）没有 def 存档，出售时必须补建，
 // 否则买入方 AI 队「查无此人」，选手直接从联盟蒸发（转会市场/对手阵容都找不到）
 if(!defOf(s,p.id)){
 (s.extraDefs=s.extraDefs||[]).push({
 id:p.id,name:p.name,pos:p.pos,team:p.team||null,tags:p.tags||[],
 base:[p.attrs.lane,p.attrs.farm,p.attrs.team,p.attrs.mind],skill:p.skill,sig:p.sig,
 career:p.career||''});
 }
 const attached=aiAttachDef(s,p.id,team); // 买入方 AI 队在册（若为 def），下赛季起为他出战
 const tl=(s.transferList||[]).find(x=>x.id===p.id);
 if(tl){tl.ownerTeam=team;tl.untouchable=false;} // 转会市场条目同步归属新东家
 else if(!attached){
 // 买家阵容已满（5人/位置被占）时无法即时入册：把他挂进转会市场归属买家，
 // 保证随时找得到，下个转会期 AI 会按缺位补强把他签进阵容
 const entry={...p,ownerTeam:team,untouchable:false,willingness:Math.max(p.willingness||60,70)};
 delete entry.signCost;delete entry.freeAgent;
 (s.transferList=s.transferList||[]).push(entry);
 }
 logEvent(s,' '+p.name+' 转会至 '+team+'（转会费 '+fee+'万）');
 if(fee>=3000)logEvent(s,' 重磅转会！联盟震动');
}

/* 玩家挂牌 / 撤牌 */
function listPlayer(s,pid){
 const p=s.players.find(x=>x.id===pid);
 if(!p)return;
 if(p.loan){toast('租借选手不属于俱乐部，不能挂牌');return;}
 if(p.kjia>0){toast(p.name+' 正在 K甲锻炼（剩余 '+p.kjia+' 天），归队后再挂牌');return;}
 if(s.lineup.includes(pid)){toast('请先将该选手移出首发');return;}
 if((s.listed||[]).some(x=>x.id===pid)){toast('该选手已在挂牌名单');return;}
 const price=Math.round(valueOf(overall(p))*(p.willingness>=60?0.8:1.1));
 s.listed=[...(s.listed||[]),{id:pid,price}];
 toast(p.name+' 已挂牌（'+price+'万）'+(p.willingness>=60?'，本人愿意转会':'，本人不太愿意'));
 logEvent(s,' '+p.name+' 进入转会市场（挂牌 '+price+'万）');
 save();renderAll();
}
function delistPlayer(s,pid){
 const p=s.players.find(x=>x.id===pid);
 s.listed=(s.listed||[]).filter(x=>x.id!==pid);
 s.bids=(s.bids||[]).filter(x=>x.id!==pid); // 有报价也可撤牌：撤牌即作废所有未接受报价
 logEvent(s,''+(p?p.name:'选手')+'撤牌，报价作废，选手留队');
 toast((p?p.name+' ':'')+'已撤牌（未成交报价一并作废）');
 save();renderAll();
}
/* 转会期内每天 AI 队可能报价 */
function aiBidTick(s){
 (s.listed||[]).forEach(item=>{
 if((s.bids||[]).some(b=>b.id===item.id))return;
 if(Math.random()<0.3){
 const team=pick(AI_TEAMS.filter(t=>t.name!==s.teamName));
 const p=s.players.find(x=>x.id===item.id);
 let bid=Math.round(item.price*(0.85+Math.random()*0.35));
 if(p){const cap=sellCeiling(p);if(cap!=null)bid=Math.min(bid,cap);} // 挂牌报价同样受转售保护
 s.bids=[...(s.bids||[]),{id:item.id,team:team.name,bid}];
 if(p)toast(' '+team.name+' 对 '+p.name+' 报价 '+bid+'万！');
 }
 });
 // 联盟内部重磅转会：非卖品意愿松动后被豪门挖走（队魂也会离队）——真实变更其 AI 队在册
 if(Math.random()<0.15){
 const candidates=(s.transferList||[]).filter(p=>p.untouchable&&p.willingness<75);
 if(candidates.length){
 const p=pick(candidates);
 const buyer=pick(AI_TEAMS.filter(t=>t.name!==p.ownerTeam&&t.name!==s.teamName));
 const price=untouchablePrice(p);
 aiAttachDef(s,p.id,buyer.name);
 logEvent(s,' 重磅转会！'+p.name+' 以 '+price+'万 转会至 '+buyer.name+'（非卖品破例放行）');
 s.transferList=s.transferList.filter(x=>x.id!==p.id);
 }
 }
 // 转会窗内 AI 补强：每天有概率有 AI 队签走一名自由球员——
 // 缺位的队直接认领；满编的队用更强的自由球员顶替弱首发（被顶替者流入自由市场）
 if(Math.random()<0.3&&(s.freeAgents||[]).length){
 const fa=pick(s.freeAgents);
 const map=aiRosterDefMap(s);
 const faOvr=overall(fa);
 const buyers=[];
 Object.keys(map).forEach(tn=>{
 if(tn===s.teamName)return;
 const cur=map[tn].map(id=>defOf(s,id)).filter(Boolean);
 const atPos=cur.find(d=>d.pos===fa.pos);
 if(!atPos){if(cur.length<5)buyers.push({tn,replace:null});}
 else if(faOvr-overall(genSeasonPlayer(s,atPos))>=3)buyers.push({tn,replace:atPos}); // 明显更强才动首发
 });
 const buyer=buyers.sort((a,b)=>(s.aiPower[a.tn]||400)-(s.aiPower[b.tn]||400))[0]; // 弱旅优先
 s.freeAgents=s.freeAgents.filter(x=>x.id!==fa.id);
 if(buyer){
 if(buyer.replace){
 aiDetachDef(s,buyer.replace.id); // 旧首发除名：下个转会期进自由池流转
 logEvent(s,' 转会动态：'+buyer.replace.name+' 被 '+buyer.tn+' 放弃，流入自由市场');
 }
 const def=defOf(s,fa.id);
 if(def&&!s.retiredDefs.includes(def.id)&&!(s.extraDefs||[]).some(x=>x.id===def.id))s.extraDefs.push(def);
 aiAttachDef(s,fa.id,buyer.tn); // 名册缓存失效：该选手立即为买方出战
 logEvent(s,' 转会动态：'+fa.name+'（'+POS[fa.pos][0]+'）以自由身加盟 '+buyer.tn+(buyer.replace?'，顶替 '+buyer.replace.name:''));
 }else{
 logEvent(s,' 转会动态：'+fa.name+' 被海外联赛球队签走，退出自由市场');
 }
 }
}
function acceptBid(s,id){
 const b=(s.bids||[]).find(x=>x.id===id);
 const p=s.players.find(x=>x.id===id);
 if(!b||!p)return;
 completeSale(s,p,b.bid,b.team);
 save();renderAll();toast('转会完成！');
}
function rejectBid(s,id){
 s.bids=(s.bids||[]).filter(x=>x.id!==id);
 save();renderAll();toast('已拒绝报价');
}
/* ================= 合同续约系统 =================
 赛季末合同到期 → 转会期处理：续约 2 年（签字费=身价 18%×表现系数）或放走（进自由市场）。
 转会窗结束仍未处理的自动续约 1 年（防误伤主力，想放走需主动点"不续约"）。 */
const RENEW_YEARS=2;
function renewCost(p){
 const f=(p.val||100)>=125?1.25:(p.val||100)<90?0.75:1; // 表现火热更贵、低迷更便宜
 return Math.max(100,Math.round(sellAskPrice(p)*0.18*f));
}
function renewPlayer(s,pid,years,offerWage){
 const p=s.players.find(x=>x.id===pid);
 if(!p||p.loan||(p.contract||0)>1){toast('该选手合同未到期');return;}
 const y=Math.min(4,Math.max(1,years||RENEW_YEARS));
 const cost=renewCostN(p,y);
 if(s.fund<cost){toast('资金不足（续约签字费 '+cost+'万）');return;}
 s.fund-=cost;
 const nw=offerWage?Math.round(offerWage):Math.round(wageOf(overall(p))*((p.val||100)/100)); // 报价成交按谈定周薪，否则按表现重定
 if(nw>p.wage)logEvent(s,' '+p.name+' 续约涨薪：'+p.wage+'万 → '+nw+'万/周（表现好值得加薪）');
 else if(nw<p.wage)logEvent(s,' '+p.name+' 接受降薪续约：'+p.wage+'万 → '+nw+'万/周');
 p.wage=Math.max(1,nw);
 p.contract=y;
 p.morale=clamp(p.morale+6,20,100);
 p.willingness=Math.min(100,(p.willingness||50)+10);
 logEvent(s,' 与 '+p.name+' 完成续约（'+y+' 年 · 签字费 '+cost+'万 · 周薪 '+nw+'万）');
 s.expiring=(s.expiring||[]).filter(x=>x!==pid);
 save();renderAll();toast(p.name+' 续约 '+y+' 年！');
}
/* ================= 续约谈判（合同可谈，非固定价） =================
 年限 1-4 年自由谈：锁得越久经纪人要价越高（长约溢价），
 老将/闹情绪选手会抬价；报价低于心理价位会被拒，最多三轮，谈崩伤士气。 */
function renewAskWage(p,years){
 let w=wageOf(overall(p))*((p.val||100)/100);
 w*=1+0.09*((years||2)-1);
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 if(p.age>=m.gold)w*=1.05;
 if((p.morale||50)<40)w*=1.05;
 return Math.max(5,Math.round(w/5)*5);
}
function renewCostN(p,years){return Math.max(50,Math.round(renewCost(p)*(0.55+0.45*((years||2)-1))));}
let _nego=null;
function openRenewNego(s,pid){
 const p=s.players.find(x=>x.id===pid);
 if(!p||p.loan){_nego=null;return;}
 if((p.contract||0)>1){_nego=null;toast('合同还剩 '+p.contract+' 年，最后一年再谈不迟');return;}
 _nego={pid,years:2,attempt:0,ask:renewAskWage(p,2),offer:null};
 renderRenewNego();
}
function renewNegoYears(y){
 if(!_nego)return;
 _nego.years=y;_nego.offer=null;_nego.ask=renewAskWage(S.players.find(x=>x.id===_nego.pid),y);
 renderRenewNego();
}
function renewNegoOffer(d){
 if(!_nego)return;
 _nego.offer=Math.max(5,(_nego.offer!=null?_nego.offer:_nego.ask)+d);
 renderRenewNego();
}
function renewNegoOfferInput(v){
 if(!_nego)return;
 const n=parseInt(v,10);
 if(!isNaN(n))_nego.offer=Math.max(5,Math.min(9999,n));
}
function renderRenewNego(){
 if(!_nego||!S)return;
 const p=S.players.find(x=>x.id===_nego.pid);
 if(!p){closeModal('app-modal');return;}
 const y=_nego.years,ask=_nego.ask;
 const offer=Math.max(5,Math.round((_nego.offer!=null?_nego.offer:ask)/5)*5);
 _nego.offer=offer;
 const cost=renewCostN(p,y);
 const r=offer/ask;
 const chance=r>=1.2?['基本会接受','var(--green)']:r>=1.05?['大概率接受','var(--green)']:r>=0.95?['五五开','var(--gold)']:r>=0.85?['大概率被拒','var(--red)']:['必被拒','var(--red)'];
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 const ageTag=p.age>=m.gold?'<span class="red">下滑期 · 要价偏高</span>':p.age<=22?'<span class="green">上升期</span>':'黄金期';
 $('#app-modal-body').innerHTML=`
 <h2>续约谈判 · ${p.name} <span class="tag">${POS[p.pos][0]} · 总值 ${overall(p)}</span></h2>
 <div class="hint" style="margin-bottom:10px">${p.age}岁 · ${ageTag} · 表现 ${p.val||100}% · 当前周薪 ${p.wage}万 · 现合同 ${p.contract>0?'最后 1 年':'已到期'}${_nego.attempt?'<br><span class="red">已拒绝 '+_nego.attempt+' 次（满 3 次谈崩，士气受损）</span>':''}</div>
 <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
 <span class="dim" style="font-size:12px">合同年限：</span>
 ${[1,2,3,4].map(k=>`<button class="btn sm ${k===y?'primary':''}" style="min-width:44px" onclick="renewNegoYears(${k})">${k}年</button>`).join('')}
 </div>
 <div class="hint" style="margin-bottom:10px">经纪人心理价位 <b class="gold">≈ ${ask}万/周</b>（长约溢价 · 签字费 ${cost}万）· 接受度 <b style="color:${chance[1]}">${chance[0]}</b></div>
 <div style="display:flex;gap:6px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
 <span class="dim" style="font-size:12px">周薪报价：</span>
 <button class="btn sm" onclick="renewNegoOffer(-10)">-10</button>
 <button class="btn sm" onclick="renewNegoOffer(-5)">-5</button>
 <input id="nego-offer" type="number" min="5" value="${offer}" onchange="renewNegoOfferInput(this.value)" style="width:76px;background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:3px;padding:6px 8px;font-size:14px;text-align:center">
 <button class="btn sm" onclick="renewNegoOffer(5)">+5</button>
 <button class="btn sm" onclick="renewNegoOffer(10)">+10</button>
 <span class="dim" style="font-size:12px">万/周</span>
 </div>
 <div class="center" style="display:flex;gap:8px;justify-content:center">
 <button class="btn primary" onclick="submitRenewNego()">提出报价</button>
 <button class="btn" onclick="closeModal('app-modal')">先不谈</button>
 </div>`;
 $('#app-modal').classList.add('on');
}
function submitRenewNego(){
 if(!_nego||!S)return;
 const p=S.players.find(x=>x.id===_nego.pid);
 if(!p){closeModal('app-modal');return;}
 const y=_nego.years,offer=_nego.offer,ask=_nego.ask,cost=renewCostN(p,y);
 if(S.fund<cost){toast('资金不足（签字费 '+cost+'万）');return;}
 const r=offer/ask;
 let prob=r>=1.2?0.98:r>=1.05?0.85:r>=0.95?0.55:r>=0.85?0.25:0.05;
 prob=clamp(prob+((p.morale||50)-50)/500,0.02,0.99);
 if(rnd(1,100)<=Math.round(prob*100)){
 renewPlayer(S,p.id,y,offer);
 _nego=null;
 closeModal('app-modal');
 return;
 }
 _nego.attempt++;
 if(_nego.attempt>=3){
 p.morale=clamp(p.morale-4,20,100);
 logEvent(S,' 与 '+p.name+' 的续约谈判破裂（三轮未谈拢，士气受损）');
 _nego=null;
 save();renderAll();closeModal('app-modal');
 toast('谈判破裂：'+p.name+' 坚持要价 '+ask+'万/周');
 return;
 }
 _nego.ask=Math.max(5,Math.round(_nego.ask*1.07/5)*5);
 _nego.offer=null;
 renderRenewNego();
 toast(p.name+' 的经纪人嫌低了，要价涨到 '+_nego.ask+'万/周');
}
function releasePlayer(s,pid){
 const p=s.players.find(x=>x.id===pid);
 if(!p||p.contract>0){toast('该选手合同未到期');return;}
 if(typeof natCamping==='function'&&natCamping(s,p)){toast(p.name+' 正在国家队集训（缺席夏季赛），不能放走');return;}
 if(p.kjia>0){toast(p.name+' 正在 K甲锻炼（剩余 '+p.kjia+' 天），归队后再操作');return;}
 s.players=s.players.filter(x=>x.id!==pid);
 const li=s.lineup.indexOf(pid);if(li>=0)s.lineup.splice(li,1);
 if(s.pick)delete s.pick[p.pos];
 p.freeAgent=true;p.willingness=rnd(70,95);
 p.signCost=Math.round(valueOf(overall(p))*0.7);
 p.contract=1;
 s.freeAgents=[...(s.freeAgents||[]).filter(x=>x.id!==pid),p];
 s.expiring=(s.expiring||[]).filter(x=>x!==pid);
 recordTransfer(s,'out',p,0,'自由球员','合同到期不续约放走'); // 年度回顾·转会台账
 logEvent(s,' 未与 '+p.name+' 续约，进入自由市场（其他队可直签）');
 save();renderAll();toast(p.name+' 进入自由市场');
}
function endTransferWindow(s){
 // 合同到期未处理的自动续约 1 年（防误伤主力；想放走需在转会期主动点"不续约"）
 (s.expiring||[]).slice().forEach(pid=>{
 const p=s.players.find(x=>x.id===pid);
 if(p&&!p.loan&&p.contract<=0){
 p.contract=1;
 logEvent(s,' '+p.name+' 合同自动续约 1 年（转会期未处理）');
 }
 });
 s.expiring=[];
 s.listed=[];
 s.bids=[];
 s.transferList=[];
}
/* ================= 赛前转会期（开局/新赛季先组队，再开赛） =================
 转会期内：转会市场全开放（买断/挂牌/自由市场刷新免费/顶星供给增加），
 不能打比赛；天数用完自动结束，也可随时提前结束。 */
function endPreseason(s){
 if(!confirm('确定结束转会期？剩余天数作废，阵容锁定后联赛正式开始'))return;
 autoFillLineup(s);
 const miss=POS_ORDER.filter(pos=>!s.players.some(p=>p.pos===pos));
 if(miss.length){toast(' '+miss.map(pos=>POS[pos][0]).join('、')+' 位置无人，无法开始联赛，请先签约选手');return;}
 s.preseason=false;
 s.transferWindow=0;
 endTransferWindow(s);
 logEvent(s,' 转会期结束！'+s.teamName+' 赛季'+s.season+'阵容锁定，联赛正式开始');
 logEvent(s,' 首战在即：俱乐部页开赛，每场赛前可调整首发、BP 中可换替补');
 save();renderAll();
 toast('联赛正式开始！去俱乐部页查看赛程');
}
/* 跳过剩余转会期：每天自动训练核心选手 + 培养青训（不浪费天数），AI 报价照常走，
 天数走完后自动结束转会期并开赛（与 endPreseason 的阵容校验一致） */
function skipTransferWindow(s){
 const left=s.transferWindow||0;
 if(left<=0){toast('当前不在转会期');return;}
 if(!confirm('跳过剩余 '+left+' 天转会期？期间每天自动：\n· 训练一名核心选手（练最弱属性，80万/次）\n· 培养一名青训（潜力优先，100万/次）\n资金不足的天数自动跳过；AI 报价照常进行。'))return;
 autoFillLineup(s);
 const miss=POS_ORDER.filter(pos=>!s.players.some(p=>p.pos===pos));
 if(miss.length){toast(' '+miss.map(pos=>POS[pos][0]).join('、')+' 位置无人，无法开赛，请先签约选手');return;}
 let guard=0;
 s._quietSave=true; // 内部 nextDay 不再天天全量存档；结束/中断时统一 save 一次
 try{
 while(s.transferWindow>0&&guard++<30){
 if(!s.trained)autoDoTrain(s);
 if(!s.academyTrained)autoTrainRookie(s);
 const bidsBefore=(s.bids||[]).length;
 nextDay(s); // 内部处理 AI 报价 / 转会窗关闭自动开赛 / 发薪 / 随机事件
 // 挂牌选手被 AI 报价：暂停跳过、保留剩余天数，优先去谈判（接受/拒绝/撤牌）
 if((s.bids||[]).length>bidsBefore){
 logEvent(s,' 转会期出现新报价，跳过流程暂停——请到转会市场处理（接受/拒绝/撤牌）');
 save();renderAll();
 toast(' 有 AI 报价！已暂停跳过，去转会市场谈判');
 goPage('market');
 return;
 }
 }
 }finally{
 s._quietSave=false;
 }
 logEvent(s,'跳过转会期剩余天数：已自动完成训练与青训培养，联赛正式开始');
 checkAchievements(s); // 跳过期结束强制扫（quiet 期间未走 save 巡检）
 save();renderAll();
 toast('转会期跳过完成，联赛开始！');
}
function autoDoTrain(s){
 if(s.fund<80)return;
 const p=s.players.filter(x=>x.injury<=0&&x.energy>=10).sort((a,b)=>overall(b)-overall(a))[0];
 if(!p)return;
 const key=['lane','farm','team','mind'].sort((a,b)=>p.attrs[a]-p.attrs[b])[0]; // 练最弱属性
 doTrain(s,p.id,key);
}
function autoTrainRookie(s){
 if(s.fund<100)return;
 const r=(s.academy||[]).filter(x=>!rookieReady(x)).sort((a,b)=>(b.potential||0)-(a.potential||0))[0];
 if(!r)return;
 trainRookie(s,r.id);
}
/* 刷新自由市场：转会窗内每日首次免费（可重复刷但按 5 万/次收费） */function refreshMarket(s){
 const inWindow=s.transferWindow>0;
 const free=inWindow&&!s.marketRefreshed;
 if(!free){
 if(s.fund<50){toast('资金不足（刷新需 50 万）');return;}
 s.fund-=50;
 }
 const usedNames=rookieUsedNames(s); // 全局查重：市场生成的选手不与联盟任何人重名
 s.market=[];
 for(let i=0;i<6;i++){
 const roll=Math.random();
 const band=inWindow?(roll<0.2?'star':roll<0.6?'mid':'low'):(roll<0.1?'star':roll<0.5?'mid':'low'); // 转会窗内顶星供给增加
 const np=genPlayer(genFreeAgentDef(pick(POS_ORDER),band,usedNames));
 if(Math.random()<0.15)np.discount=0.8; // 特惠上架（15% 概率 8 折，对应市场页划线价/特惠标签）
 s.market.push(np);
 }
 s.marketRefreshed=true;
 // 教练市场：随机 3 名候选教练（与现任不重复）
 s.coachMarket=s.coachMarket||[];
 const coachSeen=new Set();
 if(s.coach)coachSeen.add(s.coach.id);
 let cGuard=0;
 while(s.coachMarket.length<3&&cGuard++<40){
 const c=pick(COACH_POOL);
 if(coachSeen.has(c.id))continue;
 coachSeen.add(c.id);s.coachMarket.push({...c});
 }
 s.coachMarket.sort((a,b)=>(b.rating||0)-(a.rating||0));
 save();renderAll();
 toast(free?'转会窗内免费刷新（每日首次）':'市场已刷新（-5万）');
}
/* 签约主教练：已有教练时直接换帅（旧帅离任） */
function signCoach(s,c){
 if(!c){toast('教练信息无效，请先刷新市场');return;}
 if(s.fund<c.cost){toast('资金不足（签约费 '+c.cost+'万）');return;}
 if(s.coach&&s.coach.id===c.id){toast('该教练已是你队主教练');return;}
 s.fund-=c.cost;
 s.coachMarket=(s.coachMarket||[]).filter(x=>x.id!==c.id); // 已执教教练移出市场
 if(s.coach)logEvent(s,' 换帅！'+s.coach.name+' 离任，'+c.name+' 出任主教练');
 else logEvent(s,' 签约主教练 '+c.name+'（'+(c.rating||80)+'评分·'+COACH_STYLE[c.style]+'型）');
 s.coach={...c};
 save();renderAll();toast(c.name+' 执教！全队战力+'+c.bonus+'%');
}
/* 解雇主教练：无教练期间全队无教练加成 */
function fireCoach(s){
 if(!s.coach){toast('当前没有主教练');return;}
 logEvent(s,' '+s.coach.name+' 与俱乐部解约离任');
 s.coach=null;
 save();renderAll();
}

/* ================= 租借系统（非转会期唯一的人员流动方式） =================
 转会窗关闭时不能买卖选手，但可以向其他战队租借替补：支付租金（身价 15%），
 租借 21 天，到期自动归队；非卖品不可租，同时最多租 2 人；租借期间原队出青训递补。 */
const LOAN_DAYS=21;
function untouchableSet(){
 const U=new Set();
 for(const tn in AI_ROSTERS)AI_ROSTERS[tn].u.forEach(id=>U.add(id));
 return U;
}
function loanRent(p){return Math.max(80,Math.round(valueOf(overall(p))*0.15));}
function loanCandidates(s){
 const U=untouchableSet();
 const map=aiRosterDefMap(s);
 const out=[];
 for(const tn in map){
 if(tn===s.teamName)continue;
 (ensureAiRosters(s,tn)||[]).forEach(p=>{
 if(U.has(p.id))return; // 非卖品：队魂不外借
 out.push({p,from:tn,rent:loanRent(p)});
 });
 }
 return out.sort((a,b)=>overall(b.p)-overall(a.p));
}
function loanPlayer(s,teamName,pid){
 if(s.transferWindow>0){toast('转会窗内可以直接买断，无需租借');return;}
 if((s.players||[]).filter(p=>p.loan).length>=2){toast('租借名额已满（最多同时租借 2 人）');return;}
 const p=(ensureAiRosters(s,teamName)||[]).find(x=>x.id===pid);
 if(!p){toast('该选手不在租借名单');return;}
 if(untouchableSet().has(p.id)){toast(p.name+' 是非卖品，不外借');return;}
 const rent=loanRent(p);
 if(s.fund<rent){toast('资金不足（租金 '+rent+'万）');return;}
 s.fund-=rent;
 p.loan={from:teamName,days:LOAN_DAYS};
 s.players.push(p);
 aiDetachDef(s,p.id); // 原队除名（真实 def）：租借期内原队青训递补
 s.aiRosters={}; // 名册缓存失效
 logEvent(s,' 租借达成：'+p.name+'（'+POS[p.pos][0]+' · 总值'+overall(p)+'）从 '+teamName+' 租借 '+LOAN_DAYS+' 天，租金 '+rent+'万');
 save();renderAll();toast(p.name+' 租借加盟！'+LOAN_DAYS+' 天后自动归队');
}
function tickLoans(s){
 (s.players||[]).slice().forEach(p=>{
 if(!p.loan)return;
 p.loan.days--;
 if(p.loan.days<=0){
 const from=p.loan.from;
 logEvent(s,' 租借到期：'+p.name+' 返回 '+from);
 s.players=s.players.filter(x=>x.id!==p.id);
 const li=s.lineup.indexOf(p.id);
 if(li>=0)s.lineup.splice(li,1);
 if(s.pick)delete s.pick[p.pos];
 aiAttachDef(s,p.id,from); // 真实 def 回归原队（ac_ 递补则自然消散）
 s.aiRosters={};
 }
 });
}
/* ================= 赛中转会报价（打出名堂的选手收到其他队 offer） =================
 赛季进行中（非转会期），表现火热的选手会被其他俱乐部盯上——留人/放人/抬价三选：
 留人花工资（涨薪 ~8% 表达诚意，士气与忠诚上升）；放人收钱但得罪粉丝与更衣室；
 抬价约半数买家接受、部分给最终报价、也可能直接离场。报价 3 天不答复自动过期。
 与董事会/更衣室的联动是天然发生的：留人推高周薪（工资帽/奢侈税压力），
 放人削弱阵容（KPI 风险）并让队友寒心。引擎只在 nextDay 生成与过期 offer——
 门禁模拟不结算真实比赛表现（val 只在 gamePerform 更新），不会触发本系统。 */
const OFFER_TTL=3; // 报价有效期（天）
function eligibleForOffer(s,p){
 if(!p||p.loan||p.kjia>0)return false;
 if(typeof natCamping==='function'&&natCamping(s,p))return false; // 国家队集训缺席，不接 offer
 if((p.val||100)<112)return false; // 表现门槛：打出名堂（火热≥112%）
 return true;
}
function inSeasonOfferTick(s){
 if(s.transferWindow>0)return; // 转会期走挂牌竞价，不重复
 s.offers=s.offers||[];
 const before=s.offers.length;
 s.offers=s.offers.filter(o=>o.expire>s.day);
 if(s.offers.length<before)logEvent(s,' 有俱乐部的赛中报价到期无人答复，买家转向了其他目标');
 if(s.offers.length>=2)return; // 同时最多挂 2 份，避免刷屏
 const onlyMe=(s.mode==='player')?(s.career&&s.career.me):null; // 选手模式：只盯我自己的表现
 (s.players||[]).forEach(p=>{
 if(s.offers.length>=2)return;
 if(onlyMe&&p.id!==onlyMe)return;
 if(s.offers.some(o=>o.pid===p.id))return;
 if(!eligibleForOffer(s,p))return;
 if((p._offerCd||0)>s.day)return;
 // 概率随火热程度上浮（火热顶星 ~6%/天，刚过门槛 ~1.5%/天）
 const heat=(p.val||100)-100;
 if(Math.random()>=clamp(0.015+heat*0.0012,0.015,0.06))return;
 const fee=Math.round(buyoutPrice(p)*(0.95+Math.random()*0.4)); // 95%~135% 身价
 // 买家偏好：身价越高越可能是豪门在挖（取 AI 队前半段的强队池）
 const pool=AI_TEAMS.filter(t=>t.name!==s.teamName);
 const buyer=pick(pool.slice(0,Math.max(6,Math.round(pool.length*(overall(p)>=88?0.5:1)))));
 s.offers.push({pid:p.id,name:p.name,team:buyer.name,fee,expire:s.day+OFFER_TTL,status:'open'});
 p._offerCd=s.day+20; // 同一选手 20 天内不再被报价
 logEvent(s,' 赛中报价：'+buyer.name+' 开价 '+fee+'万 买断 '+p.name+'（表现引起联盟关注，俱乐部页 '+OFFER_TTL+' 天内答复）');
 });
}
/* 放人结算共用：转会费入账 + 粉丝失望 + 队友寒心（sold 触发的两条系统联动） */
function sellViaOffer(s,p,fee,team){
 const pop=p.popularity||0;
 const wasStarter=s.lineup.includes(p.id);
 completeSale(s,p,fee,team);
 const fanHit=clamp(Math.round(pop/12),1,5);
 addFans(s,-fanHit,team+' 挖走 '+p.name);
 s.players.forEach(x=>x.morale=clamp(x.morale-4,20,100));
 if(wasStarter)logEvent(s,' '+POS[p.pos][0]+'位置出现空缺——转会市场签人 / 训练页提拔青训，二选一');
 return fanHit;
}
function respondOffer(s,idx,action){
 s.offers=s.offers||[];
 const o=s.offers[idx];
 if(!o)return;
 if(s.mode==='player'){ // 选手生涯：只有自己的报价可回应——留队=涨薪续约，接受=赛段间转会
 if(o.pid!==(s.career&&s.career.me)){toast('那是队友的报价，经纪人不是你');return;}
 const p=s.players.find(x=>x.id===o.pid);
 if(!p){s.offers.splice(idx,1);save();renderAll();return;}
 if(action==='keep'){
 const raise=Math.max(2,Math.round(p.wage*0.08));
 p.wage+=raise;
 p.morale=clamp(p.morale+5,20,100);
 p.willingness=clamp((p.willingness==null?70:p.willingness)+5,0,100);
 s.offers=s.offers.filter(x=>x.pid!==p.id);
 logEvent(s,' 留队：回绝 '+o.team+'，俱乐部给 '+p.name+' 涨薪至 '+p.wage+'万/周（士气+5 · 忠诚+5）');
 toast(p.name+' 留队！周薪 +'+raise+'万');
 }else if(action==='sell'){
 s.career.pendingMove={team:o.team,fee:o.fee};
 s.offers=s.offers.filter(x=>x.pid!==p.id);
 logEvent(s,' 转会达成意向：你接受 '+o.team+' 的报价（'+o.fee+'万）——当前赛段继续为 '+s.teamName+' 出战，赛段结束正式加盟');
 toast(' 转会意向达成：赛段结束后加盟 '+o.team);
 }else{toast('选手报价只有「留队」与「接受」两个选项');return;}
 save();renderAll();
 return;
 }
 const p=s.players.find(x=>x.id===o.pid);
 if(!p){s.offers.splice(idx,1);save();renderAll();return;}
 if(action==='keep'){ // 留人：回绝报价 + 涨薪表达诚意
 const raise=Math.max(2,Math.round(p.wage*0.08));
 p.wage+=raise;
 p.morale=clamp(p.morale+5,20,100);
 p.willingness=clamp((p.willingness==null?70:p.willingness)+5,0,100);
 s.offers=s.offers.filter(x=>x.pid!==p.id);
 logEvent(s,' 留人：回绝 '+o.team+' 的报价，给 '+p.name+' 涨薪至 '+p.wage+'万/周（士气+5 · 忠诚+5）——工资帽压力自负');
 toast(p.name+' 留队！周薪 +'+raise+'万');
 }else if(action==='sell'){ // 放人：接受报价
 const fanHit=sellViaOffer(s,p,o.fee,o.team);
 s.offers=s.offers.filter(x=>x.pid!==p.id);
 toast(p.name+' 已转会 '+o.team+'（+'+o.fee+'万 · 粉丝-'+fanHit+'万）');
 }else if(action==='counter'){ // 抬价：+20~35% 反报价 → 成交 / 最终报价 / 离场
 if(o.status==='final'){toast('对方已给出最终报价：接受成交或留人');return;}
 const ask=Math.round(o.fee*(1.2+Math.random()*0.15));
 const roll=Math.random();
 if(roll<0.55){
 logEvent(s,' 抬价成功：'+o.team+' 接受 '+ask+'万 要价——'+p.name+' 加价成交（原报价 '+o.fee+'万）');
 sellViaOffer(s,p,ask,o.team);
 s.offers=s.offers.filter(x=>x.pid!==p.id);
 toast(p.name+' 加价转会 '+o.team+'（+'+ask+'万）');
 }else if(roll<0.85){
 o.status='final';o.fee=ask;
 logEvent(s,' '+o.team+' 给出最终报价 '+ask+'万：接受成交或留人，不再抬价');
 }else{
 s.offers=s.offers.filter(x=>x.pid!==o.pid);
 p.morale=clamp(p.morale-4,20,100);
 logEvent(s,' '+o.team+' 觉得被抬价羞辱，退出谈判——'+p.name+' 留队但情绪受影响（士气-4）');
 }
 }
 save();renderAll();
}

/* ================= 转会台账（年度回顾·转会记录数据源） =================
 所有涉及本俱乐部的永久性人员流动统一入册：买入（市场/谈判/自由签）/ 卖出（谈判成交/
 挂牌竞价/赛中报价）/ 到期放走。租借与续约不入册（临时/合同行为，另见对应面板）。 */
function recordTransfer(s,dir,p,fee,team,note){
 try{
 s.transfers=s.transfers||[];
 s.transfers.unshift({yr:gameYear(s),season:s.season,dir,name:p.name,pos:p.pos||'mid',
 fee:Math.round(fee||0),team:team||'',note:note||'',age:p.age||0,ovr:overall(p)});
 s.transfers=s.transfers.slice(0,80);
 }catch(e){}
}

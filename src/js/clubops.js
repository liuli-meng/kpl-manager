/* 粉丝商业 / 更衣室 / 战术板 / 版本大改（season.js 机械拆出） */
/* ================= 粉丝与商业（成绩 → 粉丝 → 收入 的正循环） =================
 粉丝由成绩驱动（赛段名次/冠军/选手人气），再反过来放大赞助单价、门票流水与代言收入，
 并作为赞助商升级门槛——把原先互不相干的三条线（选手人气 / 赞助商 / 代言）缝成一个环。
 系数刻意保守且封顶；平衡门禁不跑转会，经济改动对门禁几乎无影响。 */
function initFans(s){ // 开档粉丝 = 底子 + 阵容人气（豪门起点高，自建从零起步）
 const pop=(s.players||[]).reduce((t,p)=>t+(p.popularity||0),0);
 s.fans=Math.round((s.selfBuilt?6:10)+pop/12);
 return s.fans;
}
const FAN_MILESTONES=[20,80,200]; // 与赞助商升级门槛对齐：突破即可洽谈更高级赞助
function addFans(s,n,why){
 if(!n)return s.fans||0;
 const before=s.fans==null?0:s.fans;
 const after=Math.max(0,Math.round((before+n)*10)/10);
 s.fans=after;
 if(why&&Math.abs(after-before)>=0.5)logEvent(s,' 粉丝 '+(after>=before?'+':'')+(Math.round((after-before)*10)/10)+'万（'+why+' · 当前 '+after+'万）');
 FAN_MILESTONES.forEach(m=>{
  if(before<m&&after>=m){
   const tier=SPONSORS.filter(x=>x.fans===m).map(x=>x.name).join('/');
   if(tier)logEvent(s,' 粉丝突破 '+m+' 万！可以洽谈「'+tier+'」级别的赞助商了');
  }
 });
 return after;
}
const FAN_CAP=600; // 粉丝计效上限（万）：所有商业系数共用同一个帽子，避免极端值把日流水顶穿
const fanEff=s=>Math.min(s.fans||0,FAN_CAP);
const fanMul=(s,div)=>1+fanEff(s)/div; // 粉丝加成
/* 每日商业流水：赞助单价（粉丝加成）+ 门票/周边（同样走封顶）。抽成纯函数便于精确断言 */
function dailyCommercialIncome(s){
 return Math.round(SPONSORS[s.sponsorLv].income*fanMul(s,500))+Math.round(fanEff(s)*0.08);
}
/* 赛段收官结算粉丝：阵容人气是基本盘，夺冠/亚军额外加成 */
function awardSplitFans(s,isChamp,isRunner){
 const pop=(s.players||[]).reduce((t,p)=>t+(p.popularity||0),0);
 let gain=pop/60;
 gain+=isChamp?8:(isRunner?5:(s.phase==='eliminated'?0:2));
 return addFans(s,Math.round(gain*10)/10,'赛段收官·'+splitLabel(s));
}
/* ================= 更衣室（出场时间 / 队长） =================
 替补不是摆设：长期坐板凳的高战力选手会不满，积累到一定程度公开要求离队。
 依据只有"出场差距"（apps 由 finishSeries 统计），规则简单可预期，玩家能据此主动轮换。 */
const DRESS_OVR_MIN=74; // 战力低于此值的替补没资格抱怨（板凳深度本来就是他的位置）
function dressingRoomCheck(s){
 const ls=rosterLineup(s);
 if(!ls.length)return 0;
 const ref=ls.reduce((t,p)=>t+(p.apps||0),0)/ls.length; // 首发场均出场：替补的参照基准
 let unhappy=0;
 (s.players||[]).filter(p=>!s.lineup.includes(p.id)).forEach(p=>{
 if(p.retiring||p.loan||p.kjia>0)return; // 下放 K甲的选手在次级联赛有球可打，不按"坐板凳"记不满
 if(s.mode==='player'&&p.id===(s.career&&s.career.me))return; // 选手模式：你的不满由你自己写在生涯页（不重复记）
 const ovr=overall(p);
 if(ovr<DRESS_OVR_MIN)return;
 const gap=ref-(p.apps||0);
 if(ref>=3&&gap>=ref*0.6){ // 首发打满而他把板凳坐穿
 p.morale=clamp(p.morale-6,20,100);
 p.willingness=clamp((p.willingness==null?70:p.willingness)-8,0,100);
 unhappy++;
 logEvent(s,' 更衣室：'+p.name+'（战力 '+Math.round(ovr)+'）对出场时间公开不满（出场 '+(p.apps||0)+' 次 / 首发场均 '+ref.toFixed(1)+'）');
 if(p.willingness<=25&&!p.transferRequest){
 p.transferRequest=true;
 logEvent(s,' 转会风向：'+p.name+' 经纪人放话希望离队寻求出场——市场上他更容易被谈走');
 }
 }
 });
 // 队长离队自动摘除（被卖/退役/租借出去都会走到这）
 if(s.captain&&!(s.players||[]).some(p=>p.id===s.captain)){
 logEvent(s,' 队长袖标空缺：原队长已不在阵中，可在阵容页重新任命');
 s.captain=null;
 }
 return unhappy;
}
/* ================= 老将带新（更衣室关系） =================
 每年年龄结算后自动配对：老将（过黄金期或临近退役且战力在线）带一名新人（≤黄金期-1 或 ≤20 岁）。
 新人拿属性成长与士气，老将拿人气与士气——选手模式双向计入履历/生涯日志。 */
function isVeteranMentor(p){
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 return !p.retiring&&!p.loan&&p.age>=m.gold+1&&overall(p)>=70;
}
function isMentorRookie(p){
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 return !p.loan&&(p.age<=m.gold-1||p.age<=20);
}
function veteranMentors(s){
 s.mentorPairs=[];
 // 清掉上赛季配对标记，避免离队/换位后残留 mentoredBy 指向幽灵 id
 (s.players||[]).forEach(p=>{p.mentoredBy=null;p.mentoring=null;});
 const vets=(s.players||[]).filter(isVeteranMentor);
 const young=(s.players||[]).filter(isMentorRookie);
 const used=new Set();
 young.forEach(r=>{
 const cand=vets.filter(x=>!used.has(x.id)&&x.id!==r.id);
 const v=cand.find(x=>x.pos===r.pos)||cand[0];
 if(!v)return;
 used.add(v.id);
 s.mentorPairs.push({v:v.id,r:r.id,season:s.season});
 r.mentoredBy=v.id;v.mentoring=r.id;
 });
 return s.mentorPairs;
}
function mentorSeasonSettle(s){
 veteranMentors(s);
 (s.mentorPairs||[]).forEach(pair=>{
 const v=(s.players||[]).find(p=>p.id===pair.v);
 const r=(s.players||[]).find(p=>p.id===pair.r);
 if(!v||!r)return;
 const key=pick(['lane','farm','team','mind']);
 const gain=rnd(1,2);
 const attrN={lane:'对线',farm:'运营',team:'团战',mind:'心态'}[key];
 r.attrs[key]=clamp(r.attrs[key]+gain,40,99);
 r.morale=clamp(r.morale+4,20,100);
 v.popularity=Math.min(99,(v.popularity||0)+2);
 v.morale=clamp(v.morale+3,20,100);
 if(s.mode==='player'&&s.career){
 if(r.id===s.career.me){
 s.career.mentorName=v.name;
 logEvent(s,' 更衣室：老将 '+v.name+'（'+v.age+'岁）点拨你「'+attrN+'+'+gain+'」——新人成长有师父带');
 }
 if(v.id===s.career.me){
 s.career.mentoredCount=(s.career.mentoredCount||0)+1;
 logEvent(s,' 更衣室：你带训新人 '+r.name+'（'+r.age+'岁，'+attrN+'+'+gain+'）——名宿气质 +人气');
 }
 }else{
 logEvent(s,' 更衣室：'+v.name+'（'+v.age+'岁）带训新人 '+r.name+'（'+r.age+'岁）——'+attrN+'+'+gain);
 }
 });
}
/* ================= 战术板 / 版本大改 / K甲下放 =================
 战术克制：双方各带一个战术倾向，克制方 ±3%（只在比赛模拟处生效，见 match.js）。
 AI 的战术按系列赛懒生成并缓存——同一场系列赛里对手战术不会变。 */
function seriesTacticEdge(s,sr){
 if(!s.tactic||s.tactic==='balanced')return 0;
 const mine=tacticById(s.tactic);
 if(!sr._opTactic)sr._opTactic=tacticById(pick(TACTICS).id).id;
 const theirs=tacticById(sr._opTactic);
 sr._myTactic=mine.id;
 return theirs.beats===mine.id?-0.03:(mine.beats===theirs.id?0.03:0);
}
/* 赛季版本大改：两名英雄一加强一削弱，持有者属性微调（影响招牌价值与 BP 优先级）。
 upN/downN 可显式指定英雄名（测试与"策划指定版本"用），缺省随机抽取 */
function applySeasonPatch(s,upN,downN){
 const cand=HEROES.filter(h=>h.pos&&h.pos.length);
 const up=(upN&&HEROES.find(h=>h.n===upN))||pick(cand);
 let down=(downN&&HEROES.find(h=>h.n===downN))||pick(cand),g=0;
 while(down.n===up.n&&g++<10)down=pick(cand);
 (s.players||[]).forEach(p=>{
 const hold=(p.sig===up.n)||(p.heroPool||[]).some(x=>x.n===up.n);
 const hurt=(p.sig===down.n)||(p.heroPool||[]).some(x=>x.n===down.n);
 if(hold){const k=pick(['lane','farm','team','mind']);p.attrs[k]=clamp(p.attrs[k]+2,40,99);}
 if(hurt){const k=pick(['lane','farm','team','mind']);p.attrs[k]=clamp(p.attrs[k]-2,40,99);}
 });
 logEvent(s,' 版本公告 '+gameYear(s)+' 赛季：「'+up.n+'」加强、「'+down.n+'」削弱——绝活选手的战力随之浮动，BP 优先级变了');
 s.patch={up:up.n,down:down.n,season:s.season};
 return s.patch;
}

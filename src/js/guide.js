/* 新手引导 + 每页提示 + 前 3 日任务线（纯 UI 层：进度存 localStorage，不进存档、不进迁移链）。
 每页首行「这是什么」由各渲染函数拼 pageHint()；
 首进默认「3 步上手」任务线（目标驱动），完整页码 tour 仍可重放；
 前 3 个游戏日顶部任务条（missionStrip）挂在 club/career 首行。 */
const TOUR_KEY='km_tour',HINT_KEY='km_hints',MISSION_KEY='km_missions';
const PAGE_HINTS={
 club:'推进日期打比赛：赛程/赛况/复盘都在这。转会期结束前先凑齐首发',
 lineup:'选手卡管一切：训练、身价、续约、挂牌出售、替补轮换',
 market:'买人卖人：赛前转会期自由组队，赛季中留意报价与自由市场。教练模式=应急租借与引援申请',
 train:'变强在本页：专项训练/青训营/位置改造，花钱要精打细算',
 league:'联盟战局：积分榜、赛程比分、数据榜——看看对手有多强',
 kjia:'K甲二队：替补和青训生的练级场，表现好可提拔上一队',
 union:'联盟总览：18 队战力榜与历代联盟史册',
 hall:'荣誉馆：冠军墙/王朝纪录/FMVP/最佳阵容，夺冠后可生成战绩分享图',
 biz:'钱袋子：粉丝/赞助/代言/门票——收入全靠经营，别只顾战绩',
 career:'你的故事：训练/更衣室/媒体/生涯目标，选手模式每天来这打卡'
};
const TOUR_TITLES={
 club:'俱乐部 · 比赛主场',lineup:'阵容 · 管理选手',market:'转会 · 买卖选手',
 train:'训练 · 变强',league:'联赛 · 联盟战局',kjia:'二队 · K甲练级',
 union:'联盟 · 战力榜',hall:'荣誉馆 · 收藏馆',biz:'经营 · 钱袋子',career:'生涯 · 你的故事'
};
var _tour={on:false,i:0,mode:'quick'}; // mode: quick=3步上手 | full=完整页码tour
/* 前 3 日任务：目标驱动，不按页码背书。
   km_missions 走内存缓存（性能）：activeMissions 原本在 filter 内部逐任务调 missionState()，
   一次渲染要 JSON.parse 好几遍；现在只读一次、合并成一次写盘。
   这些是本机 UI 进度，唯一的写入口就是本文件的 saveMissionState，缓存与存储不会分叉。 */
let _missionCache=null;
function missionState(){
 if(_missionCache)return _missionCache;
 try{_missionCache=JSON.parse(localStorage.getItem(MISSION_KEY)||'{}')||{};}catch(_){_missionCache={};}
 return _missionCache;
}
function saveMissionState(m){_missionCache=m;try{localStorage.setItem(MISSION_KEY,JSON.stringify(m));}catch(_){}}
function missionDefs(mode){
 if(mode==='player')return [
  {id:'p1',day:1,title:'完成一次加练',text:'在「生涯」页练一项属性（体力不够先休息）',page:'career',
   done:s=>!!(s&&s.career&&s.career.stats&&s.career.stats.trained>=1)},
  {id:'p2',day:1,title:'更衣室走一遭',text:'「生涯」页聚餐/陪练/直播任选其一（与加练独立）',page:'career',
   done:s=>!!(s&&s.career&&s.career.stats&&s.career.stats.social>=1)},
  {id:'p3',day:2,title:'打完一场联赛',text:'「俱乐部」页开赛——比赛会自动模拟',page:'club',
   done:s=>!!(s&&s.career&&s.career.stats&&s.career.stats.matches>=1)},
 ];
 return [
  {id:'m1',day:1,title:'完成一次训练',text:'「训练」页给选手加练，或全队休息恢复',page:'train',
   done:s=>!!(s&&s.trained)},
  {id:'m2',day:1,title:'推进一场比赛',text:'「俱乐部」页开赛，赢下第一场联赛',page:'club',
   done:s=>!!(s&&(s.matchIdx>0||(s.history&&s.history.length)))},
  {id:'m3',day:2,title:'看清联盟格局',text:'打开「联赛」页看积分榜与下一对手',page:'league',
   done:s=>!!(s&&(missionState().seenLeague||s.matchIdx>=2))},
 ];
}
function markMissionSeen(key){
 const m=missionState();
 if(m[key])return; // 已是 1 就不再写盘：renderLeague 每次渲染都会调到这里
 m[key]=1;saveMissionState(m);
}
function activeMissions(s){
 const mode=(s&&s.mode)||'manager';
 const day=(s&&s.day)||1;
 if(day>3)return []; // 只提示前 3 日
 const st=missionState(); // 只读一次（原来在 filter 内部逐任务读，一次渲染 parse 好几遍）
 let dirty=false;
 const out=missionDefs(mode).filter(m=>{
  if((m.day||1)>day)return false; // 按任务标注日解锁（避免第 1 天就出现「打完一场联赛」）
  if((s&&s.preseason)&&m.id==='m2')return false; // 转会期还没开赛，先不催打比赛
  if(st['done_'+m.id])return false;
  try{if(m.done(s)){st['done_'+m.id]=1;dirty=true;return false;}}catch(_){}
  return true;
 });
 if(dirty)saveMissionState(st); // 本帧内多个任务同时达成：合并成一次写盘
 return out;
}
function missionStrip(s){
 const list=activeMissions(s);
 const seasonBar=seasonQuestStrip(s);
 // 下课是软终局：任务条先算后弃（本机任务进度照常落盘），但页面上不再给「推进一场比赛」这类
 // 指引——此时俱乐部页已收回全部推进按钮，留着它只会让人以为还能点
 if(s&&s.board&&s.board.fired)return '';
 if(!list.length&&!seasonBar)return '';
 const dayTag=list.length?`<span> <b>新手任务</b>（第 ${Math.min((s&&s.day)||1,3)} 天）：${list.map(m=>`<button class="btn sm" style="margin-left:4px" onclick="goPage('${m.page}')" title="${m.text}">${m.title}</button>`).join('')}</span>`:'';
 return dayTag+seasonBar;
}
/* ================= 第一赛季主线（5 件事） =================
 贯穿整个第 1 赛季，不只前 3 天——压「系统太多不知先干嘛」。
 进度存 localStorage（本机 UI，不进存档）；达成即从条上消失，赛季结束后不再显示。 */
const SEASONQ_KEY='km_seasonquest';
function seasonQuestState(){
 try{return JSON.parse(localStorage.getItem(SEASONQ_KEY)||'{}')||{};}catch(_){return {};}
}
function saveSeasonQuest(m){try{localStorage.setItem(SEASONQ_KEY,JSON.stringify(m));}catch(_){}}
function seasonQuestDefs(mode){
 if(mode==='player')return [
  {id:'q1',title:'加练一次',page:'career',done:s=>!!(s.career&&s.career.stats&&s.career.stats.trained>=1)},
  {id:'q2',title:'打完一场',page:'club',done:s=>!!(s.career&&s.career.stats&&s.career.stats.matches>=1)},
  {id:'q3',title:'更衣室互动',page:'career',done:s=>!!(s.career&&s.career.stats&&s.career.stats.social>=1)},
  {id:'q4',title:'关注身价/目标',page:'career',done:s=>!!(s.career&&(s.career.stats&&s.career.stats.matches>=3||s.val>=105))},
  {id:'q5',title:'打完整赛季',page:'club',done:s=>['champion','eliminated'].includes(s.phase)},
 ];
 return [
  {id:'q1',title:'凑齐 5 人首发',page:'lineup',
   done:s=>POS_ORDER.every(pos=>(s.players||[]).some(p=>p.pos===pos&&(s.lineup||[]).includes(p.id)))},
  {id:'q2',title:'结束转会期开赛',page:'club',
   done:s=>!s.preseason&&!(s.transferWindow>0)},
  {id:'q3',title:'完成一次训练',page:'train',
   done:s=>!!s.trained||(s.academy||[]).some(r=>r.attrs&&(r.attrs.lane+r.attrs.farm+r.attrs.team+r.attrs.mind)>280)},
  {id:'q4',title:'看过联赛积分榜',page:'league',
   done:s=>!!(seasonQuestState()['seenLeague_'+((s.season)||1)]|| (s.matchIdx||0)>=3)},
  {id:'q5',title:'赛季收官（任意结局）',page:'club',
   done:s=>['champion','eliminated'].includes(s.phase)||(s.board&&s.board.fired)},
 ];
}
function markSeasonQuestSeen(key){
 const m=seasonQuestState();
 const sk='seen_'+key;
 if(m[sk])return;
 m[sk]=1;saveSeasonQuest(m);
}
function seasonQuestProgress(s){
 const mode=(s&&s.mode)||'manager';
 const season=(s&&s.season)||1;
 const st=seasonQuestState();
 const key='s'+season+'_'+mode;
 if(st['doneSeason_'+key])return {done:true,total:0,list:[],season};
 let dirty=false;
 const defs=seasonQuestDefs(mode);
 const list=defs.filter(q=>{
  if(st['done_'+season+'_'+q.id])return false;
  try{if(q.done(s)){st['done_'+season+'_'+q.id]=1;dirty=true;return false;}}catch(_){}
  return true;
 });
 if(!list.length){st['doneSeason_'+key]=1;dirty=true;}
 if(dirty)saveSeasonQuest(st);
 return {done:!list.length,season,list,total:defs.length,mode};
}
function seasonQuestStrip(s){
 if(!s)return '';
 const season=(s.season)||1;
 if(season>1)return ''; // 只服务第 1 赛季
 const p=seasonQuestProgress(s);
 if(p.done||!p.list.length)return '';
 return `<div class="mission-strip" style="margin:0 0 8px;padding:8px 10px;border:1px solid rgba(92,138,245,.45);border-radius:8px;background:rgba(92,138,245,.08);font-size:12px">
 <span> <b>第 1 赛季主线</b>（${p.total-p.list.length}/${p.total}）：${p.list.map(q=>`<button class="btn sm" style="margin-left:4px" onclick="goPage('${q.page}')">${q.title}</button>`).join('')}</span>
 </div>`;
}
/* 每页一行提示；× 单页关闭（km_hints 按页记忆）。
   km_hints 走内存缓存：pageHint 每渲染一页都会调用，原来每次都 JSON.parse 一遍 localStorage */
let _hintCache=null;
function _hintState(){
 if(_hintCache)return _hintCache;
 try{_hintCache=JSON.parse(localStorage.getItem(HINT_KEY)||'{}')||{};}catch(_){_hintCache={};}
 return _hintCache;
}
function pageHint(name){
 const hide=_hintState();
 if(hide&&hide[name])return '';
 const txt=PAGE_HINTS[name];if(!txt)return '';
 return `<div class="page-hint"><span>${txt}</span><button class="ph-x" onclick="dismissHint('${name}')" title="不再显示这条">×</button></div>`;
}
function dismissHint(name){
 try{
  const hide=_hintState();
  hide[name]=1;_hintCache=hide;localStorage.setItem(HINT_KEY,JSON.stringify(hide));
 }catch(_){}
 renderPage(typeof curPageName==='function'?curPageName():'club');
}
/* 完整引导：按当前身份遍历可见页（MODE_PAGES），首尾各一页说明 */
function tourSteps(){
 const mode=(S&&S.mode)||'manager';
 const pages=MODE_PAGES[mode]||MODE_PAGES.manager;
 const modeName=mode==='player'?'选手生涯':mode==='coach'?'教练生涯':'经理模式';
 const steps=[{page:null,title:'欢迎来到 王者电竞经理·KPL 篇',text:'你是'+modeName+'。下面带你把各页面走一遍，看懂就能上手；想随时重看：存档管理 → 重玩新手引导。'}];
 pages.forEach(p=>steps.push({page:p,title:TOUR_TITLES[p]||p,text:PAGE_HINTS[p]||''}));
 steps.push({page:null,title:'存档与目标',text:'进度自动保存在本机浏览器，「管理」里可 3 槽切换、导出备份、导入换机。目标只有一个：捧起银龙杯。上阵！'});
 return steps;
}
/* 3 步上手：目标驱动，不按页码背书 */
function quickSteps(){
 const mode=(S&&S.mode)||'manager';
 const modeName=mode==='player'?'选手生涯':mode==='coach'?'教练生涯':'经理模式';
 const m=missionDefs(mode);
 return [
  {page:null,title:'3 步上手 · '+modeName,text:'不用读完所有页面。先完成这三件事，比赛节奏就通了。之后随时「管理 → 重玩新手引导」看完整说明。'},
  ...m.map(x=>({page:x.page,title:x.title,text:x.text,mission:true})),
  {page:null,title:'冲！',text:'目标：捧起银龙杯。进度自动存本机；前 3 天顶部会有任务条提醒。'},
 ];
}
function maybeStartTour(){
 if(_tour.on||!S)return;
 try{if(localStorage.getItem(TOUR_KEY))return;}catch(_){}
 // 赛前转会期先组队：引导与「先组队再开赛」的落地页抢焦点，开赛后/非转会期再弹
 if(S.preseason&&(S.transferWindow||0)>0)return;
 startQuickOnboard(); // 首进：3 步上手（目标驱动），完整 tour 从管理页重放
}
function startTour(){ // 完整页码 tour（管理页入口）
 _tour={on:true,i:0,mode:'full'};
 renderTour();
}
function startQuickOnboard(){ // 首进默认：3 步上手
 _tour={on:true,i:0,mode:'quick'};
 renderTour();
}
function renderTour(){
 const steps=_tour.mode==='quick'?quickSteps():tourSteps();
 const st=steps[_tour.i]||steps[0];
 if(st.page)goPage(st.page); // goPage 会再进 maybeStartTour：_tour.on 守卫挡住，不递归
 const n=steps.length;
 const isQuick=_tour.mode==='quick';
 $('#app-modal-body').innerHTML=`<h2>${_escTxt(st.title)}</h2>
 <div class="hint" style="margin-bottom:10px">${st.text}</div>
 <div style="display:flex;gap:4px;margin-bottom:14px">${steps.map((_,i)=>`<span style="flex:1;height:3px;border-radius:2px;background:${i<=_tour.i?'var(--gold)':'var(--line)'}"></span>`).join('')}</div>
 <div class="center" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
 ${_tour.i>0?'<button class="btn sm" onclick="tourPrev()">上一步</button>':''}
 <button class="btn sm" onclick="tourSkip()">跳过</button>
 ${isQuick?'<button class="btn sm" onclick="startTour()">看完整引导</button>':''}
 ${_tour.i<n-1?'<button class="btn sm primary" onclick="tourNext()">下一步</button>':'<button class="btn sm gold" onclick="tourFinish()">'+(isQuick?'开始上手':'开始征程')+'</button>'}
 </div>`;
 $('#app-modal').classList.add('on');
}
function tourNext(){const steps=_tour.mode==='quick'?quickSteps():tourSteps();const n=steps.length;if(_tour.i<n-1){_tour.i++;renderTour();}else tourFinish();}
function tourPrev(){if(_tour.i>0){_tour.i--;renderTour();}}
function _tourEnd(msg){
 _tour={on:false,i:0,mode:'quick'};
 try{localStorage.setItem(TOUR_KEY,'1');}catch(_){}
 closeModal('app-modal');
 toast(msg);
}
function tourSkip(){_tourEnd('已跳过引导——「管理 → 重玩新手引导」随时再看');}
function tourFinish(){_tourEnd('上手！前 3 天按顶部任务条走，目标：总冠军');}

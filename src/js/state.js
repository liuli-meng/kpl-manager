
/* ================= 游戏状态与存档 ================= */
/* 存储键名里的 v3 是历史遗留：键名不能跟着 SAVE_VERSION 走，否则旧档直接"消失"。
   结构升级靠 MIGRATIONS 迁移链在读取时完成（v3 档 → v4 档）。 */
const SAVE_KEY='esport_manager_save_v3';
const SAVE_VERSION=4; // 存档结构版本：结构变更时在 MIGRATIONS 追加迁移步骤并递增，旧档读入自动升级
const MIGRATIONS={
 // 3→4：董事会/信任度 + 开局剧本（旧档补默认值：中性信任度 60、执教生涯从零计、剧本按常规）
 3:(s)=>{
  s.board={trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
  s.managerCareer={years:0,titles:0,lastRank:null};
  s.scenario='normal';
  s.fans=8; // 老档给一个中性起始粉丝（新房由 initFans 按阵容人气算）
 },
};
/* ================= 存档字段默认表（读档兜底唯一来源） =================
 缺字段一律在此登记；migrateSave 不要再写散落的 S.x=S.x||default。
 复杂变换（货币缩放/阵容清洗/赛季形态）仍走命名步骤，见 applySaveDefaults 之后。 */
const SAVE_DEFAULTS=[
 // key, default, note
 ['board',{trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]},'董事会'],
 ['managerCareer',{years:0,titles:0,lastRank:null},'执教生涯'],
 ['scenario','normal','开局剧本'],
 ['mode','manager','游戏身份'],
 ['mentorPairs',[],'老将带新'],
 ['fans',8,'粉丝（中性起始）'],
 ['captain',null,'队长'],
 ['kjia',null,'K甲联赛'],
 ['offers',[],'赛中报价'],
 ['transfers',[],'转会台账'],
 ['yearReviews',[],'年度回顾'],
 ['yearStages',[],'成绩曲线'],
 ['series',null,'进行中系列赛'],
 ['pick',{},'BP 选定'],
 ['coach',null,'主教练'],
 ['coachMarket',[],'教练市场'],
 ['honors',[],'历史荣誉'],
 ['seedPower',280,'分组种子战力'],
 ['upsetBoost',0,'以下克上加成'],
 ['upsetCount',0,'队史爆冷次数'],
 ['fumbleBoost',0,'阴沟翻船减益'],
 ['fumbleCount',0,'队史被爆冷次数'],
 ['preseason',false,'赛前转会期'],
 ['transferWindow',0,'转会窗剩余天'],
 ['idleDays',0,'连续无经营动作天数（怠政：签到/赞助/董事会信任都读它）'],
 ['reserveSlots',2,'自留签每季名额'],
 ['reserveUsed',0,'自留签已用'],
 ['draft',null,'选秀大会'],
 ['transferList',[],'买断市场'],
 ['listed',[],'挂牌'],
 ['bids',[],'挂牌报价'],
 ['champCore',null,'冠军班底羁绊'],
 ['aiChampCore',{},'AI 冠军班底'],
 ['history',[],'队史'],
 ['academy',[],'青训营'],
 ['retiredCoaches',[],'名宿市场'],
 ['hosts',[],'主播'],
 ['freeAgents',[],'自由球员'],
 ['extraDefs',[],'联盟新生 def'],
 ['retiredDefs',[],'已退役 def'],
 ['aiInj',{},'AI 伤停表'],
 ['assistants',[],'助教组'],
 ['split','spring','春/夏赛段'],
 ['annualPts',{},'年度积分'],
 ['ewc',null,'EWC 赛段'],
 ['annual',null,'年总赛段'],
 ['fmvpHonor',[],'历届 FMVP'],
 ['cardLosers',[],'卡位赛败者'],
 ['achieved',{},'成就解锁'],
 ['selfBuilt',false,'自建开局标记'],
 ['maxSale',0,'单笔出售纪录'],
 ['challenger',null,'挑战者杯'],
 ['crest',null,'自建队徽'],
 ['phase','r1','常规赛阶段'],
 ['matches',{},'比赛扁平表 mid→match'],
 ['_poError',null,'季后赛推进异常原因（诊断用：非空说明 ensureLeagueChampion 走过 catch）'],
 ['_migErr',null,'读档期完整性异常（迁移步骤失败 / 比赛索引重建失败；非空说明这个档需要人工看一眼）'],
 ['socialUsed',false,'选手社交已用'],
 ['wageCap',150,'工资帽（缺失按现役刻度）'],
 // —— 基础状态字段补齐（2026-09-17）：newState 一直有这些字段，但没登记进默认表，
 //    于是「导入残缺档 / 手工构造的档」缺字段时不会被兜底 —— 例如 logEvent 直接
 //    s.eventLog.unshift(...)（season.js:54），缺 eventLog 就抛错。全部登记后由
 //    applySaveDefaults 统一补；audit-static 有门禁保证以后新增字段不再漏。
 //    刻意不登记：v / moneyScaled / econReal（缺省=「未迁移」，登记了会让迁移链整条跳过）、
 //    fund / wageCap（另有 migrateFixZeroZero 与现役刻度兜底，登记会互相打架）。
 ['teamName','','队名'],
 ['icon','','队徽字符'],
 ['season',1,'赛季数'],
 ['day',1,'当日'],
 ['sponsorLv',0,'赞助等级'],
 ['stage','regular','赛段'],
 ['matchIdx',0,'常规赛轮次指针'],
 ['streak',0,'连胜数'],
 ['players',[],'一线队名单'],
 ['lineup',[],'首发'],
 ['market',[],'青训/自由市场当日货架'],
 ['schedule',[],'常规赛赛程'],
 ['groups',{},'分组'],
 ['tables',{},'积分榜'],
 ['aiPower',{},'AI 战力'],
 ['eliminated',[],'已淘汰'],
 ['eventLog',[],'事件日志'],
 ['card',null,'卡位赛'],
 ['playoff',null,'季后赛'],
 ['aiRosterDefs',null,'AI 在册 def 映射'],
 ['career',null,'选手/教练生涯'],
 ['coachDeal',null,'教练合同履历'],
 ['coachRecs',[],'教练引援/租借申请队列'],
 ['clubChoice',null,'战队关系待办事件（选择题）'],
 ['trained',false,'当日成长行动已用'],
 ['marketRefreshed',false,'当日市场已刷新'],
 ['academyTrained',false,'当日青训已培养'],
 ['champion',false,'本赛季夺冠'],
];
function applySaveDefaults(s){
 SAVE_DEFAULTS.forEach(([k,d])=>{
 // undefined 一律补默认；null 仅在默认值非 null 时覆盖（captain/crest 等默认就是 null）
 if(s[k]!==undefined&&!(s[k]===null&&d!==null))return;
 s[k]=(typeof d==='object'&&d!==null)?JSON.parse(JSON.stringify(d)):d;
 });
 // ⚠ wageCap 的 `<50 → 150` 兜底必须留在这里（迁移之前），不要挪到 migrateEconReal 之后。
 // 两种顺序各有代价，verify-migrate ④ 已锁定本顺序的期望值（cap 180 ÷6 = 30，不得被抬回 150）：
 //   本顺序：缺失 cap → 150 → ×10 → ÷6 = 250（偏宽松，现役区间 150~250 的顶格）；
 //   移到迁移后：合法迁移出的 30 会被抬成 150（把迁移结果改掉）。
 // 结论是有意保持现状。真要动这条，先想清楚「缺失 cap」和「合法的小 cap」如何区分。
 if(!s.wageCap||s.wageCap<50)s.wageCap=150;
 if(s.streak)s.streak=0;
 if(s.mode==='player'&&!s.career)s.career={me:null,seasons:[],titles:0,fmvp:0,allstar:0,nat:0,retired:false,pendingMove:null};
 if(s.mode==='player'&&s.career){
  s.career.role=s.career.role||'rot';
  s.career.stats=s.career.stats||{trained:0,social:0,media:0,matches:0};
  if(s.career.media===undefined)s.career.media=null;
  if(s.career.natFocus===undefined)s.career.natFocus='form';
 }
 if(s.mode==='coach'&&!s.coachDeal)s.coachDeal={years:0,honors:[],log:[]};
 if(typeof s.fund!=='number'||!isFinite(s.fund))s.fund=0;
}
/* localStorage 兜底：iOS Safari 开「阻止所有 Cookie」/ 无痕模式 / 配额写满时，读 localStorage 会**直接抛异常**。
   curSlot 全仓第一个存储访问点且在模块顶层——一抛就中断 state.js，下面的 `let S=null` 永不执行，
   game.html 内联的后续模块全部 `S is not defined` → 整页白屏（且每次加载都崩在同一点，表现为「永久打不开」）。
   以下包装把「存储不可用」降级成「内存兜底 + 只提示一次」，页面在任何存储状态下都能起来。 */
const _memStore=Object.create(null);
let _storeOk=null,_storeWarned=false;
function storeAvailable(){
 if(_storeOk!==null)return _storeOk;
 try{localStorage.setItem('__kpl_probe','1');localStorage.removeItem('__kpl_probe');_storeOk=true;}
 catch(_){_storeOk=false;}
 return _storeOk;
}
function storeGet(k){
 try{const v=localStorage.getItem(k);return (v===null&&(k in _memStore))?_memStore[k]:v;}
 catch(_){return (k in _memStore)?_memStore[k]:null;}
}
function storeSet(k,v){
 try{localStorage.setItem(k,v);return true;}catch(_){_memStore[k]=String(v);return false;}
}
function storeDel(k){
 try{localStorage.removeItem(k);}catch(_){delete _memStore[k];}
}
function storeWarnOnce(){
 if(_storeWarned)return;_storeWarned=true;
 try{toast('浏览器禁用了本机存储：进度只保留在本次会话，刷新即丢。建议关闭无痕模式或允许 Cookie。');}catch(_){}
}
let curSlot=parseInt(storeGet('esport_manager_curslot')||'1',10)||1;
function slotKey(){return SAVE_KEY+(curSlot>1?'_'+curSlot:'');}
function b64e(s){const bytes=new TextEncoder().encode(s);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin);}
function b64d(s){const bin=atob(s);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder().decode(bytes);}
let S=null; // 全局状态
/* blob 下载可用性判定：Safari 本体支持 a[download]+blob:，但**所有 WKWebView 内置浏览器**
（微信/QQ/抖音/微博/钉钉/支付宝…）不支持（WebKit bug 216918）——它会退化成「打开这个 blob 链接」，
失败后整页被替换成「Safari浏览器打不开该网页…（WebKitBlobResource错误1）」，而且地址栏会停在
已失效的 blob: 上，**刷新也回不到游戏**。判定为不可用时，导出改走系统分享 / 文本复制 / 页内长按保存。 */
function blobDLBlocked(){
 try{
  if(typeof navigator==='undefined'||!navigator.userAgent)return false;
  const ua=navigator.userAgent;
  if(/MicroMessenger|MQQBrowser|QQBrowser|QQ\/|WeChat|Douyin|Bytedance|Weibo|AlipayClient|DingTalk|baiduboxapp|UCBrowser|Quark/i.test(ua))return true;
  const iOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!iOS)return false;
  /* iOS 上 Safari 本体 UA 带 "Version/x.y … Safari/604.1"；裸 WKWebView 只有 "Mobile/15E148" */
  return !/Version\/[\d.]+ [^)]*Safari\//.test(ua);
 }catch(_){return false;}
}

/* ================= 预防性守卫（防误碰/空档/连点） =================
  UI 入口用：requireSave 挡未开局操作；confirmDanger 挡高代价点击；
  confirmSoft 挡例行确认（简化模式可跳过）；uiDebounce 挡连点。
  引擎层保持无 UI 依赖（门禁可直接驱动）。 */
function requireSave(what){
 if(!S||!S.players||!S.players.length){
 try{toast('尚未开局，'+(what||'该操作')+'不可用');}catch(_){}
 return false;
 }
 return true;
}
function confirmDanger(msg){
 try{return typeof confirm==='function'?!!confirm(msg):true;}catch(e){return true;}
}
/* 例行确认：简化模式跳过（导入/解雇等高代价仍走 confirmDanger） */
function confirmSoft(msg){
 try{if(simpleMode())return true;}catch(e){}
 return confirmDanger(msg);
}
const _uiArm=Object.create(null);
function uiDebounce(key,ms){
 const now=Date.now();
 const gap=ms||450;
 if(_uiArm[key]&&now-_uiArm[key]<gap)return true; // 连点中：应拦截
 _uiArm[key]=now;
 return false;
}

/* ================= 本机 UI 偏好（不进存档、不随导出走） =================
  simple=简化模式：跳过例行确认 + 赛前自动按战力优化首发
  hc=高对比：加亮描边/正文，胜负不只靠红绿色相 */
const PREF_KEY='km_prefs';
function uiPrefs(){
 try{return JSON.parse(localStorage.getItem(PREF_KEY))||{};}catch(e){return {};}
}
function uiPref(k){return !!uiPrefs()[k];}
function setUiPref(k,v){
 const p=uiPrefs();p[k]=!!v;
 try{localStorage.setItem(PREF_KEY,JSON.stringify(p));}catch(e){}
 applyUiPrefs();
}
function applyUiPrefs(){
 try{
  const r=document.documentElement;
  if(!r||!r.classList)return;
  r.classList.toggle('hc',uiPref('hc'));
  r.classList.toggle('simple',uiPref('simple'));
 }catch(e){}
}
function simpleMode(){return uiPref('simple');}
function highContrast(){return uiPref('hc');}
function toggleSimpleMode(){
 setUiPref('simple',!simpleMode());
 try{renderAll();}catch(e){}
 toast(simpleMode()?' 简化模式已开启：例行确认跳过 · 赛前自动优化首发':' 简化模式已关闭');
}
function toggleHighContrast(){
 setUiPref('hc',!highContrast());
 try{renderAll();}catch(e){}
 toast(highContrast()?' 高对比已开启：描边/正文加亮，胜负辅以标记':' 高对比已关闭');
}

/* ================= 双开检测（同一 origin 多标签会互写 localStorage） =================
  锁键 km_tab_lock 只记 tabId+时间戳，不是存档；BroadcastChannel 即时互通，
  storage 事件兜底（file:// 也适用）。save() 每次落盘刷新心跳。 */
const _tabId='t'+Math.random().toString(36).slice(2,10);
const _tabLockKey='km_tab_lock';
function _touchTabLock(){
 try{localStorage.setItem(_tabLockKey,JSON.stringify({id:_tabId,t:Date.now()}));}catch(e){}
}
function _warnDualTab(why){
 try{toast(' 检测到同一浏览器另开一局（'+(why||'多标签')+'）——存档可能互相覆盖，建议只保留一个窗口');}catch(e){}
}
function initTabGuard(){
 try{
  _touchTabLock();
  if(typeof BroadcastChannel==='function'){
   const ch=new BroadcastChannel('kpl-mgr-tab');
   ch.onmessage=function(ev){
    const d=ev&&ev.data;
    if(d&&d.id&&d.id!==_tabId)_warnDualTab('另一窗口已打开');
   };
   try{ch.postMessage({id:_tabId,hello:1});}catch(e){}
  }
  window.addEventListener('storage',function(e){
   if(!e||e.key!==_tabLockKey||!e.newValue)return;
   try{
    const o=JSON.parse(e.newValue);
    if(o&&o.id&&o.id!==_tabId)_warnDualTab('另一窗口已写入');
   }catch(_){}
  });
 }catch(e){}
}

function newState(teamName,icon){
 return {
 teamName,icon,crest:null,v:SAVE_VERSION,season:1,day:1,fund:1300,sponsorLv:0,moneyScaled:true,econReal:true,
 reserveSlots:2,reserveUsed:0, // 自留签：每季 2 个（晋升青训消耗）
 honors:[], // 历史荣誉（多赛季）
 stage:'regular',phase:'r1',matchIdx:0,wageCap:150,streak:0,transferWindow:0,preseason:false, // 工资帽/连胜手感/转会窗/赛前转会期
 players:[],lineup:[],market:[],
 schedule:[],groups:{},tables:{},aiPower:{},card:null,playoff:null,eliminated:[],
 eventLog:[],trained:false,marketRefreshed:false,academyTrained:false,champion:false,
 socialUsed:false, // 选手模式：更衣室/社交行动（与 trained 并行的第二行动位）
 academy:[],history:[],transferList:[],listed:[],bids:[],
 pick:{}, // 当前 BP 选定的英雄 {top:'花木兰',...}
 series:null, // 当前系列赛 {used:[],mw,ow,max,stage,oppName,logs,myName,opName,idx}
 coach:null,coachMarket:[],assistants:[], // 主教练 + 教练市场 + 助教组（上限2）
 aiRosterDefs:null,extraDefs:[],retiredDefs:[], // AI 转会生态：AI 队在册 def 映射 / 新星 def / 已退役 def
 split:'spring',annualPts:{}, // 年度赛历：春/夏双赛段 + 年度积分（春夏累计，前12进年总）
 ewc:null,annual:null, // EWC 电竞世界杯 / KPL 年度总决赛 赛段状态
 challenger:null, // 挑战者杯（春→挑杯→EWC→夏→年总）
 fmvpHonor:[],cardLosers:[], // 历届 FMVP / 卡位赛败者（年度积分名次判定用）
 achieved:{},selfBuilt:false,maxSale:0, // 成就（id→解锁年份）/ 自建开局标记 / 单笔出售纪录
 // 董事会：信任度 0-100 / 本赛季 KPI / 连续未达成次数 / 下课标记 / 每季结算记录
 board:{trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]},
 // 执教生涯（下课结算页与 KPI 依据）：年数 / 冠军数 / 上年年度积分排名
 managerCareer:{years:0,titles:0,lastRank:null},
 scenario:'normal', // 开局剧本（难度档）：normal/debt/exodus/cap/cursed —— 见 data.js SCENARIOS
 mode:'manager', // 游戏身份：manager=经理（全权经营）/ player=选手生涯（扮演一名选手）/ coach=教练生涯（只管竞技）
 career:null, // 选手生涯数据（mode=player）：{me,seasons,titles,fmvp,allstar,nat,retired,pendingMove,role,stats,media,natFocus}
 coachDeal:null, // 教练执教履历（mode=coach）：{years:0,honors:[],log:[]}
 fans:0, // 粉丝数（万）：由成绩与选手人气驱动，反过来放大赞助单价/门票/代言并作为赞助升级门槛
 captain:null, // 队长（选手 id）：全队战力小幅加成 + 士气激励，离队自动摘除
 upsetBoost:0, // 以下克上：本赛段爆冷累积战力%（每胜+3，封顶9；startSplit 清零）
 upsetCount:0, // 队史以下克上次数（成就解锁依据）
 fumbleBoost:0, // 阴沟翻船：本赛段被爆冷累积负战力%（每败-2，下限-6；startSplit 清零）
 fumbleCount:0, // 队史被爆冷次数
 kjia:null, // K甲联赛（二队）：独立赛程/积分榜/二队班底，每赛段重开——见 season.js「K甲联赛」
 champCore:null, // 冠军班底：最近一次夺冠首发 id 列表 + 夺冠次数——同场触发羁绊（见 activeBonds）
 aiChampCore:{}, // AI 冠军班底：队名→{titles}——按难度档给 AI 战力加成（见 aiRosterPower）
 offers:[], // 赛中转会报价（表现火热选手被挖角）：留人/放人/抬价三选——见 transfer.js
 transfers:[], // 转会台账（买入/卖出/放走）：年度回顾·转会记录数据源
 yearReviews:[], // 年度回顾（每年一份快照）：成绩曲线/转会记录/董事会评价/关键战役
 yearStages:[], // 本年度各赛段名次（成绩曲线数据源，年度轮换清零）
 };
}
function rosterAll(s){return s.players;}
function rosterLineup(s){const set=new Set(s.lineup);return s.players.filter(p=>set.has(p.id));}
function rosterBench(s){const set=new Set(s.lineup);return s.players.filter(p=>!set.has(p.id));}
function myPlayer(s){return (s&&s.mode==='player'&&s.career)?s.players.find(p=>p.id===s.career.me)||null:null;} // 选手生涯：我扮演的选手
/* ================= 选手状态机（唯一出口） =================
 同一选手可能同时挂多枚状态旗（伤停/K甲/外租/集训/退役/闹离队…）。
 各处不要再用 if (p.kjia>0 || p.loanOut || …) 自行拼条件——一律读 playerStatus(p)。
 字段语义：
   injury>0     伤停天数，不能训练/出战
   kjia>0       K甲锻炼剩余天数（二队出战，不占一队）
   loan         租入：属于别的俱乐部，本队临时使用权
   loanOut      租出：本队选手在外队打主力
   natCamp      亚运集训（整个夏季赛缺席俱乐部）
   natFill      集训期临时借调顶位（归还前不可售）
   retiring     临近退役（最后一年，转会价值下降）
   transferRequest 已公开要求离队（更易被谈走）
 新状态若要挂到选手身上：先在本函数登记旗标，再在 UI/守卫里读——避免第 N 处漏判断。 */
function playerStatus(p,s){
 p=p||{};
 return {
  injury:(p.injury||0)>0,
  injuryDays:p.injury||0,
  kjia:(p.kjia||0)>0,
  kjiaDays:p.kjia||0,
  loan:!!p.loan, // 租入
  loanOut:!!p.loanOut, // 租出
  loanOutTeam:p.loanOut&&p.loanOut.team||null,
  loanOutDays:p.loanOut&&p.loanOut.days||0,
  natCamp:!!p.natCamp||(typeof natCamping==='function'&&!!(s&&natCamping(s,p))),
  natFill:!!p.natFill,
  retiring:!!p.retiring,
  transferRequest:!!p.transferRequest,
  minor:(p.age||0)<MATCH_MIN_AGE,
  // 可否为母队出战/训练：任一占用性状态为 true 即否
  busy:(p.injury||0)>0||(p.kjia||0)>0||!!p.loanOut||!!p.natCamp||(typeof natCamping==='function'&&!!(s&&natCamping(s,p))),
 };
}
function playerStatusLabels(st){
 const out=[];
 if(st.injuryDays)out.push('伤停'+st.injuryDays+'天');
 if(st.kjia)out.push('K甲锻炼'+st.kjiaDays+'天');
 if(st.loanOut)out.push('租借'+(st.loanOutTeam||'外队')+st.loanOutDays+'天');
 if(st.natCamp)out.push('国家队集训');
 if(st.natFill)out.push('集训顶位');
 if(st.retiring)out.push('临近退役');
 if(st.transferRequest)out.push('要求离队');
 if(st.minor)out.push('未满'+MATCH_MIN_AGE);
 return out;
}
/* 统一出战资格：伤停 / 亚运集训 / 未满18岁（KPL 注册规则）——青训晋升、首发、比赛共用 */
const MATCH_MIN_AGE=18;
function matchEligible(s,p){
 if(!p)return false;
 const st=playerStatus(p,s);
 if(st.injury||st.loanOut||st.kjia||st.natCamp||st.minor)return false;
 return true;
}
function matchIneligibleReason(s,p){
 if(!p)return '选手不存在';
 const st=playerStatus(p,s);
 if(st.injury)return '伤停 '+st.injuryDays+' 天';
 if(st.loanOut)return '租借效力 '+(st.loanOutTeam||'外队')+'（剩 '+st.loanOutDays+' 天）';
 if(st.kjia)return 'K甲锻炼中（剩 '+st.kjiaDays+' 天）';
 if(st.natCamp)return '国家队集训中';
 if(st.minor)return '未满 '+MATCH_MIN_AGE+' 岁（KPL 规定满 '+MATCH_MIN_AGE+' 岁才能上场）';
 return '';
}
/* 按位置择优排首发：只排「当前可出场」的人（伤停/集训/租借/K甲/未成年跳过）。
 开局、换队、转会落地、教练换队共用——避免各处复制粘贴又漏过滤。 */
function buildBestLineup(s){
 const byPos={};
 (s.players||[]).forEach(p=>{if(!p)return;(byPos[p.pos]=byPos[p.pos]||[]).push(p);});
 const lineup=[];
 POS_ORDER.forEach(pos=>{
 const cand=(byPos[pos]||[]).filter(p=>matchEligible(s,p)).sort((a,b)=>playerPower(b,b.sig)-playerPower(a,a.sig));
 if(cand[0])lineup.push(cand[0].id);
 });
 return lineup;
}
/* 夺冠阵容快照：冠军/亚军入册时记录当时的首发名单（荣誉室可回看"这冠是谁打下来的"） */
function titleRoster(s){
 try{return rosterLineup(s).map(p=>p.name).join('、')||'—';}catch(e){return '';}
}
function moraleAll(s,v){s.players.forEach(p=>p.morale=clamp(p.morale+v,20,100));}
/* 选手当前选用英雄（未 BP 时默认招牌） */
function pickedHero(s,p){return (s.pick&&s.pick[p.pos])||p.sig;}
function heroOf(heroId){return HERO_BY_NAME[heroId]||null;} // Map 索引（data.js 建），原线性 find 是最热查询
function heroAtPos(heroId,pos){const h=heroOf(heroId);return h&&h.pos.includes(pos)?h:null;}
/* 当前战术权重：玩家在战术板选了战术就用它的权重（四维总和恒 1），否则用标准权重。
 S.tacticW 只由战术板写入——平衡门禁的模拟不设置，战力体系对门禁保持原样。 */
function tacticWeights(){
 const t=(typeof S!=='undefined'&&S&&S.tacticW)?S.tacticW:null;
 return t||BASE_W;
}
function playerPower(p,heroId){
 const a=p&&p.attrs?{lane:p.attrs.lane||70,farm:p.attrs.farm||70,team:p.attrs.team||70,mind:p.attrs.mind||70}:{lane:70,farm:70,team:70,mind:70};
 const w=tacticWeights();
 let pow=a.lane*w.lane+a.farm*w.farm+a.team*w.team+a.mind*w.mind;
 const sk=p&&p.skill?p.skill:null;
 if(sk&&sk.t==='lane')pow+=a.lane*0.12*w.lane;
 if(sk&&sk.t==='farm')pow+=a.farm*0.12*w.farm;
 if(sk&&sk.t==='team')pow+=a.team*0.12*w.team;
 if(sk&&sk.t==='mind')pow+=a.mind*0.12*w.mind;
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
 AI 教练班底：持久化在 s.aiCoaches（队名→教练），初始按原版俱乐部模板落位
 （豪门名帅/草根平淡），每个赛季转会期 AI 队会从名宿市场挖角更好的教练（与玩家抢人）；
 无记录的队按职业队平均班底 +6% 折算（旧版 AI_STAFF 等价值，旧档懒初始化兼容）。 */
function aiCoachState(s){
 if(!s.aiCoaches){
 s.aiCoaches={};
 (typeof CLUB_TEMPLATES!=='undefined'?CLUB_TEMPLATES:[]).forEach(t=>{
 const c=COACH_POOL.find(x=>x.id===t.coach);
 if(c)s.aiCoaches[t.name]={id:c.id,name:c.name,rating:c.rating,bonus:c.bonus,styleBonus:c.styleBonus,style:c.style};
 });
 }
 return s.aiCoaches;
}
function aiCoachBonus(s,tn){return (s&&s.aiCoaches&&s.aiCoaches[tn])?s.aiCoaches[tn].bonus:6;}
function aiRosterPower(roster,s,tn){
 if(!roster||!roster.length)return 0;
 const best={};
 roster.forEach(p=>{
 if(p.injury>0)return; // 伤停必须休息：不计入战力（青训递补顶替出战）
 const v=playerPower(p,p.sig);
 if(best[p.pos]==null||v>best[p.pos])best[p.pos]=v;
 });
 let sum=0,cnt=0,mSum=0;
 POS_ORDER.forEach(pos=>{if(best[pos]!=null){sum+=best[pos];cnt++;}});
 if(!cnt)return 0;
 roster.forEach(p=>mSum+=(p.morale||80));
 const morale=clamp(mSum/roster.length/100,0.82,1.1);
 let pow=sum*morale*(1+aiCoachBonus(s,tn)/100);
 // AI 冠军班底：按难度档缩放（豪门王朝更硬、弱旅不滚雪球）
 pow*=1+aiChampBondPct(s,tn)/100;
 return Math.round(pow);
}
/* AI 夺冠累计：联赛/挑杯/EWC/年总 AI 冠军入册；titles 越多加成越高（由 aiChampBondPct 消费） */
function registerAiChampCore(s,teamName){
 if(!s||!teamName||teamName===s.teamName)return; // 玩家队走 champCore
 s.aiChampCore=s.aiChampCore||{};
 const prev=s.aiChampCore[teamName];
 s.aiChampCore[teamName]={titles:((prev&&prev.titles)||0)+1};
}
/* AI 班底加成百分比：elite 1.25× / mid 0.8× / weak 0.35×，基座 首冠4% · 连冠≥2 为 6% */
function aiChampBondPct(s,tn){
 const cc=s&&s.aiChampCore&&s.aiChampCore[tn];
 if(!cc||!cc.titles)return 0;
 const tier=aiTierOf(s,tn);
 const base=cc.titles>=2?6:4;
 const scale=tier==='elite'?1.25:tier==='mid'?0.8:0.35;
 return Math.round(base*scale*10)/10;
}
/* picks 可选：BP 进行中实时结算用（未选位置回退招牌）；缺省走 S.pick */
function teamPower(s,picks){
 const ls=rosterLineup(s);
 if(!ls.length)return 0;
 const ph=p=>(picks&&picks[p.pos])||pickedHero(s,p);
 let pow=ls.reduce((t,p)=>t+playerPower(p,ph(p)),0);
 const mAvg=ls.reduce((t,p)=>t+(p&&typeof p.morale==='number'?p.morale:70),0)/ls.length;
 pow*=clamp(mAvg/100,0.82,1.1);
 activeBonds(s).forEach(b=>pow*=1+b.bonus/100);
 // 主教练加成：全队战力% + 侧重属性额外加成
 if(s.coach){
 const c=s.coach;
 const w={lane:0.25,farm:0.25,team:0.3,mind:0.2}[c.style]||0.25;
 const attrSum=ls.reduce((t,p)=>t+(p&&p.attrs?p.attrs[c.style]||70:70),0);
 pow+=attrSum*(c.styleBonus||0)/100*w;
 pow*=1+(c.bonus||0)/100;
 }
 // 助教组（上限2人）：与主教练加成叠加，幅度较小
 if(s.assistants&&s.assistants.length){
 s.assistants.forEach(a=>{
 const w={lane:0.25,farm:0.25,team:0.3,mind:0.2}[a.style]||0.25; const attrSum=ls.reduce((t,p)=>t+(p&&p.attrs?p.attrs[a.style]||70:70),0);
 pow+=attrSum*(a.styleBonus||0)/100*w;
 pow*=1+(a.bonus||0)/100;
 });
 }
 // 连胜/连败手感：±2%/场，上限 ±10%
 if(s.streak)pow*=1+clamp(s.streak,-5,5)*0.02;
 // 以下克上：本赛段爆冷胜场累积（每胜 +3%，上限 +9%），开赛段时清零
 if(s.upsetBoost)pow*=1+clamp(s.upsetBoost,0,9)/100;
 // 阴沟翻船：本赛段被弱队掀翻（每败 -2%，下限 -6%），开赛段时清零
 if(s.fumbleBoost)pow*=1+clamp(s.fumbleBoost,-6,0)/100;
 // 队长加成：队长在首发阵中，全队战力 +2%（队长被卖/退役/换下则不生效）
 if(s.captain&&ls.some(p=>p.id===s.captain))pow*=1.02;
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
 // 冠军班底羁绊：最近一次夺冠首发同场 ≥3 人触发；连冠（titles≥2）加成升一档
 const cc=s.champCore;
 if(cc&&cc.ids&&cc.ids.length){
 const idset=new Set(cc.ids);
 const n=ls.filter(p=>idset.has(p.id)).length;
 const tier=(cc.titles||1)>=2;
 const bMin=tier?6:4,bFull=tier?12:10;
 if(n>=5)act.push({bonus:bFull,desc:'冠军班底（满编5人）：全队战力+'+bFull+'%'+(tier?' · 连冠加成':'')});
 else if(n>=3)act.push({bonus:bMin,desc:'冠军班底（同场'+n+'人）：全队战力+'+bMin+'%'+(tier?' · 连冠加成':'')});
 }
 return act;
}
/* 夺冠时把当前首发记为冠军班底（联赛/挑杯/EWC/年总共用）。连冠刷新名单并累计次数。 */
function registerChampCore(s,title){
 if(!s)return;
 const ls=rosterLineup(s);
 const ids=ls.map(p=>p.id);
 if(!ids.length)return;
 const prev=s.champCore;
 s.champCore={ids,titles:((prev&&prev.titles)||0)+1,label:title||'',names:ls.map(p=>p.name)};
 try{logEvent(s,' 冠军班底成型！'+(s.champCore.names||[]).join('、')+'——此后同场 ≥3 人触发羁绊加成'+(s.champCore.titles>=2?'（连冠加成已升级）':''));}catch(e){}
}
function weeklyWage(s){
 // 租借选手租金已一次性支付，工资由原俱乐部承担，不计入本队周薪
 // NaN 守卫：旧档/异常写入可能让 wage 变成 undefined/NaN，连加会污染整个周薪显示与发薪
 const num=v=>(typeof v==='number'&&isFinite(v))?v:0;
 let sum=(s.players||[]).reduce((t,p)=>t+(p&&p.loan?0:num(p&&p.wage)),0);
 if(s.coach)sum+=num(s.coach.wage);
 (s.assistants||[]).forEach(a=>sum+=num(a&&a.wage));
 return sum;
}
/* 清洗工资脏数据：undefined/NaN/负值 → 按总值重估（读档、发薪前调用） */
function scrubWages(s){
 if(!s)return;
 const fix=p=>{
  if(!p)return;
  const w=p.wage;
  if(typeof w!=='number'||!isFinite(w)||w<0){
   try{p.wage=Math.max(2,Math.min(PLAYER_WAGE_MAX,Math.round(wageOf(overall(p))*(p.val||100)/100)));}
   catch(e){p.wage=2;}
  }
 };
 (s.players||[]).forEach(fix);
 (s.market||[]).forEach(fix);
 (s.transferList||[]).forEach(fix);
 (s.freeAgents||[]).forEach(fix);
 (s.academy||[]).forEach(fix);
 if(s.coach&&typeof s.coach.wage!=='number')s.coach.wage=Math.max(1,Math.round((s.coach.cost||80)/8));
 (s.assistants||[]).forEach(a=>{if(a&&typeof a.wage!=='number')a.wage=5;});
}
/* 存档序列化：剔除可重建/仅运行期字段。
  aiRosters 读档时 migrateSave 统一清空重建，写进去纯属白占 localStorage；
  matches 是 bracket 树 + series.mid 的派生索引（L1/L2 归一化后不再是真相源），
  migrateSave → rebuildMatchStore 会按 bracket 重灌，实测占全文 8.2%（9909/120972 字符）。
  ** 以下字段看着像缓存，实际不能剥——内容由随机数生成，剥掉读档会换人/换意愿 **：
  transferList / freeAgents（buildTransferMarket 内用 rnd/shuffle）、market（refreshMarket 用 Math.random）。
  同理「把 save() 改成防抖」也不可行：verify-save 断言静默解除后 save 必须同步落盘。
  _achAt/_asCache 等是节流缓存。导出/备份同样走这里。 */
function serializeForSave(s){
 if(!s)return 'null';
 const cache={aiRosters:s.aiRosters,matches:s.matches,transferList:s.transferList,_afterMatch:s._afterMatch};
 s.aiRosters={};
 s.matches={};
 s.transferList=[]; // 可重建缓存：buildTransferMarket 开窗重建，落盘可占全文 1/3+
 s._afterMatch=null; // 函数无法 JSON 化
 try{return JSON.stringify(s);}
 finally{Object.assign(s,cache);} // 原样还原（含 undefined 情形），只影响序列化产物
}
function save(){
 if(!S)return false;
 try{checkAchievements(S);}catch(e){}
 let payload=null;
 try{payload=serializeForSave(S);}catch(e){console.warn('save serialize fail',e);}
 if(payload===null){try{toast(' 存档失败：数据无法序列化');}catch(_){}return false;}
 if(storeSet(slotKey(),payload)){try{_touchTabLock();}catch(_){}return true;}
 /* 存储不可用（无痕 / 阻止 Cookie / 配额写满）：已降级为内存存档，只提示一次，别每次保存都弹 */
 storeWarnOnce();
 return false;
}

/* 赛制形态校验：当前阶段的分组结构是否存在且匹配。
 r2 起分组是 {S,A,B}/{S,A}，没有 G1 是正常的——不能用「无 G1」当旧档特征，
 否则打进 S 组后每次读档都会被误判成旧档、整体回滚到第一轮分组赛。 */
function seasonShapeOk(s){
 if(!s.groups||!Object.keys(s.groups).length)return false;
 if(s.phase==='r1')return !!s.groups.G1;
 if(s.phase==='r2'||s.phase==='card')return !!(s.groups.S&&s.groups.A&&s.groups.B);
 if(['r3','playoff','champion','eliminated'].includes(s.phase))return !!(s.groups.S&&s.groups.A);
 return true; // 未知阶段不强判
}
/* ================= 比赛扁平表 L1 =================
   所有杯赛/季后/卡位对阵登记进 s.matches[mid]；series 权威键是 mid。
   bracket 树仍保留（渲染/推进），写结果一律 resolveSeriesMatch → getMatch。 */
function ensureMatchStore(s){
 if(!s)return {};
 if(!s.matches||typeof s.matches!=='object')s.matches={};
 return s.matches;
}
function tagMatch(s,m,mid){
 if(!s||!m||!mid)return m;
 const store=ensureMatchStore(s);
 m.mid=mid;
 store[mid]=m;
 return m;
}
function getMatch(s,mid){
 if(!s||!mid)return null;
 if(s.matches&&s.matches[mid])return s.matches[mid];
 return null;
}
function rebuildMatchStore(s){
 if(!s)return;
 ensureMatchStore(s);
 s.matches={};
 const reg=(m,mid)=>{if(m&&mid)tagMatch(s,m,mid);};
 // 运行时槽位大多 1 基（playoffStep: po_wb1 / cups: ewc_qf1 / ch_r1_1 / brk1）；卡位 matches 下标 0 基
 const regList0=(list,prefix)=>{(list||[]).forEach((m,i)=>reg(m,prefix+i));};
 const regList1=(list,prefix)=>{(list||[]).forEach((m,i)=>reg(m,prefix+(i+1)));};
 const regCup8=(p,prefix)=>{
 if(!p)return;
 regList1(p.wb1,prefix+'wb1_');regList1(p.lb1,prefix+'lb1_');
 regList1(p.wb2,prefix+'wb2_');regList1(p.lb2,prefix+'lb2_');
 reg(p.wf,prefix+'wf');reg(p.lbs,prefix+'lbs');reg(p.lbf,prefix+'lbf');reg(p.final,prefix+'final');
 };
 if(s.card&&s.card.matches)regList0(s.card.matches,'card_');
 // 常规赛赛程也登记进扁平表（L2b）；旧档对阵缺 mid 时按相位+序号补写（与 genRoundSchedule 同构），读档迁移在此完成
 (s.schedule||[]).forEach((m,i)=>reg(m,m.mid||('reg_'+(s.phase||'r1')+'_'+(i+1))));
 if(s.playoff){
 const p=s.playoff;
 regList1(p.wb,'po_wb');regList1(p.lb,'po_lb');regList1(p.lb2,'po_lb2');regList1(p.lb3,'po_lb3');
 reg(p.wf,'po_胜者组决赛');reg(p.lb4,'po_败者组半决赛');reg(p.lbf,'po_败者组决赛');reg(p.final,'po_总决赛');
 }
 if(s.annual){
 if(s.annual.rounds)s.annual.rounds.forEach((rd,ri)=>{
 (rd||[]).forEach((m,mi)=>{
 reg(m,'arena_r'+(ri+1)+'_'+(mi+1));
 if(m&&(m.a===s.teamName||m.b===s.teamName))reg(m,'arena_r'+(ri+1)); // cupSlot 轮级别名
 });
 });
 regList1(s.annual.brk,'brk');
 regCup8(s.annual.po,'apo_');
 }
 if(s.challenger){
 const c=s.challenger;
 regList1(c.r1,'ch_r1_');regList1(c.r2,'ch_r2_');
 regCup8(c.po,'chpo_');
 reg(c.final,'ch_final');
 }
 if(s.ewc){
 const e=s.ewc;
 regList1(e.qf,'ewc_qf');regList1(e.sf,'ewc_sf');reg(e.final,'ewc_final');
 }
 if(s.series){
 const sr=s.series;
 const src=sr.cupMatch||sr.poMatch||sr.cardMatch;
 if(!sr.mid&&src){
 let mid=null;
 if(sr.stage==='card'&&sr.cardIdx!=null)mid='card_'+sr.cardIdx;
 else if(sr.stage==='po'&&sr.poSlot)mid='po_'+sr.poSlot;
 else if(sr.stage==='cup'&&sr.cupSlot){
 mid=sr.cupSlot;
 const hit=Object.keys(s.matches).find(k=>{
 const m=s.matches[k];
 return m&&(m.a===src.a&&m.b===src.b||m.a===src.b&&m.b===src.a)&&(k.indexOf(mid)===0||mid.indexOf(k)===0||k===mid);
 });
 if(hit)mid=hit;
 }
 if(mid)sr.mid=mid;
 }
 }
}
/* 对阵对象按 mid/slot 解析回 bracket 真对象。JSON 存读会切断引用：
   finishSeries 若写到幽灵副本，对阵树永远无 r → 年总/季后赛卡死。
   L2 约定：series.mid 为唯一权威键；不再挂 cupMatch/poMatch/cardMatch 对象引用。
   旧档仍带缓存字段时，只借用其中的队名做兜底检索，不把缓存当结果落点。 */
function findPoBracketMatch(p,slot){
	if(!p||!slot)return null;
	if(slot==='wb1')return p.wb&&p.wb[0]||null;
	if(slot==='wb2')return p.wb&&p.wb[1]||null;
	if(slot==='lb1')return p.lb&&p.lb[0]||null;
	if(slot==='lb2')return p.lb&&p.lb[1]||null;
	if(/^lb2_(\d+)$/.test(slot))return (p.lb2||[])[+RegExp.$1-1]||null;
	if(slot==='胜者组决赛'||slot==='wf')return p.wf||null;
	if(/^lb3_(\d+)$/.test(slot))return (p.lb3||[])[+RegExp.$1-1]||null;
	if(slot==='败者组半决赛'||slot==='lb4')return p.lb4||null;
	if(slot==='败者组决赛'||slot==='lbf')return p.lbf||null;
	if(slot==='总决赛'||slot==='final')return p.final||null;
	return null;
}
function findCup8BySuffix(p,suf){
	if(!p||!suf)return null;
	if(/^wb1_(\d+)$/.test(suf))return (p.wb1||[])[+RegExp.$1-1]||null;
	if(/^lb1_(\d+)$/.test(suf))return (p.lb1||[])[+RegExp.$1-1]||null;
	if(/^wb2_(\d+)$/.test(suf))return (p.wb2||[])[+RegExp.$1-1]||null;
	if(/^lb2_(\d+)$/.test(suf))return (p.lb2||[])[+RegExp.$1-1]||null;
	if(suf==='wf')return p.wf||null;
	if(suf==='lbs')return p.lbs||null;
	if(suf==='lbf')return p.lbf||null;
	if(suf==='final')return p.final||null;
	return null;
}
function findCupMatchBySlot(s,slot){
	if(!s||!slot)return null;
	const a=s.annual,c=s.challenger,e=s.ewc;
	if(/^arena_r(\d+)$/.test(slot)&&a&&a.rounds){
	const rd=a.rounds[+RegExp.$1-1];
	if(!rd)return null;
	return rd.find(m=>m.a===s.teamName||m.b===s.teamName)||null;
	}
	if(/^brk(\d+)$/.test(slot)&&a&&a.brk)return a.brk[+RegExp.$1-1]||null;
	if(/^apo_/.test(slot)&&a&&a.po)return findCup8BySuffix(a.po,slot.slice(4));
	if(/^ch_r1_(\d+)$/.test(slot)&&c&&c.r1)return c.r1[+RegExp.$1-1]||null;
	if(/^ch_r2_(\d+)$/.test(slot)&&c&&c.r2)return c.r2[+RegExp.$1-1]||null;
	if(/^chpo_/.test(slot)&&c&&c.po)return findCup8BySuffix(c.po,slot.slice(5));
	if(slot==='ch_final'&&c)return c.final||null;
	if(/^ewc_qf(\d+)$/.test(slot)&&e)return (e.qf||[])[+RegExp.$1-1]||null;
	if(/^ewc_sf(\d+)$/.test(slot)&&e)return (e.sf||[])[+RegExp.$1-1]||null;
	if(slot==='ewc_final'&&e)return e.final||null;
	return null;
}
function resolveSeriesMatch(s,srIn){
	if(!s)return null;
	const sr=srIn||s.series;
	if(!sr)return null;
	if(sr.mid){
	const live=getMatch(s,sr.mid);
	if(live)return live;
	}
	if(sr.stage==='regular'&&sr.mid==null&&s.schedule){
	// 旧档/手造 series（无 mid）：按当前 matchIdx 对齐
	const m=s.schedule[s.matchIdx];
	if(m)return m;
	}
	if(sr.stage==='card'&&s.card&&s.card.matches){
	if(sr.cardIdx!=null&&s.card.matches[sr.cardIdx])return s.card.matches[sr.cardIdx];
	}
	if(sr.stage==='po'){
	const live=findPoBracketMatch(s.playoff,sr.poSlot);
	if(live)return live;
	}
	if(sr.stage==='cup'){
	const live=findCupMatchBySlot(s,sr.cupSlot);
	if(live)return live;
	}
	// 槽位缺失时的兜底：按双方队名在当前赛段 bracket 里找回（旧档/测试手造 series）
	const findPair=(list,a,b)=>(list||[]).find(m=>m&&(m.a===a&&m.b===b||m.a===b&&m.b===a));
	let a=sr.myName,b=sr.opName;
	if((!a||!b)){
		// 旧档缓存只借队名，不把缓存当结果落点
		const src=sr.cupMatch||sr.poMatch||sr.cardMatch;
		if(src){a=a||src.a;b=b||src.b;}
	}
	if(!a||!b)return null;
	let live=null;
	if(sr.stage==='card'&&s.card&&s.card.matches)live=findPair(s.card.matches,a,b);
	else if(sr.stage==='po'&&s.playoff){
	const p=s.playoff;
	live=findPair(p.wb,a,b)||findPair(p.lb,a,b)||findPair(p.lb2,a,b)||findPair(p.lb3,a,b)
	||findPair([p.wf],a,b)||findPair([p.lb4],a,b)||findPair([p.lbf],a,b)||findPair([p.final],a,b);
	}
	else if(sr.stage==='cup'){
	if(s.phase==='annual'&&s.annual){
	if(s.annual.stage==='arena'&&s.annual.rounds)live=s.annual.rounds.flat().find(m=>findPair([m],a,b));
	else if(s.annual.stage==='breakthrough')live=findPair(s.annual.brk,a,b);
	else if(s.annual.po){
	const p=s.annual.po;
	live=findPair(p.wb1,a,b)||findPair(p.lb1,a,b)||findPair(p.wb2,a,b)||findPair(p.lb2,a,b)
	||findPair([p.wf],a,b)||findPair([p.lbs],a,b)||findPair([p.lbf],a,b)||findPair([p.final],a,b);
	}
	}else if(s.phase==='challenger'&&s.challenger){
	const c=s.challenger;
	live=findPair(c.r1,a,b)||findPair(c.r2,a,b);
	if(!live&&c.po){
	const p=c.po;
	live=findPair(p.wb1,a,b)||findPair(p.lb1,a,b)||findPair(p.wb2,a,b)||findPair(p.lb2,a,b)
	||findPair([p.wf],a,b)||findPair([p.lbs],a,b)||findPair([p.lbf],a,b);
	}
	if(!live)live=findPair([c.final],a,b);
	}else if(s.phase==='ewc'&&s.ewc){
	const e=s.ewc;
	live=findPair(e.qf,a,b)||findPair(e.sf,a,b)||findPair([e.final],a,b);
	}
	}
	return live||null;
}
function rebindSeriesMatch(s){
	if(!s||!s.series)return;
	const sr=s.series;
	if(sr.mid)return; // L2：有 mid 即可，不再回写对象缓存
	if(sr.stage==='card'&&sr.cardIdx!=null)sr.mid='card_'+sr.cardIdx;
	else if(sr.stage==='po'&&sr.poSlot)sr.mid='po_'+sr.poSlot;
	else if(sr.stage==='cup'&&sr.cupSlot)sr.mid=sr.cupSlot;
	else if(sr.stage==='regular'&&s.schedule&&s.schedule[s.matchIdx]){
	// 旧档进行中常规赛：rebuildMatchStore 已给对阵补 mid，按 matchIdx 对齐接上
	const m=s.schedule[s.matchIdx];
	sr.mid=m.mid||('reg_'+(s.phase||'r1')+'_'+(s.matchIdx+1));
	}
}
function migrateSave(){
 if(!S)return;
 S.era=(S.era&&KPL_ERAS[S.era])?S.era:null;
 // 版本号必须是数字：非数字（"3a"）会让 S.v<SAVE_VERSION 恒为 false，整条迁移链被静默跳过
 S.v=Number(S.v)||3;
 while(S.v<SAVE_VERSION){
 const step=MIGRATIONS[S.v];
 if(step){
  try{step(S);}
  catch(e){
   // ⚠ 迁移失败绝不能推进版本号：否则这个档被永久标记「已迁移」，而那一步永远不会再跑，
   //   半迁移的档会被写回去伪装成完整档，玩家再也拿不回数据。中止链 → 下次读档自动重试。
   S._migErr='迁移 v'+S.v+' 失败: '+(e&&e.message||e);
   console.warn('migrate '+S.v+' fail',e);
   break;
  }
 }
 S.v++;
 }
 applySaveDefaults(S); // 字段级兜底：一律走 SAVE_DEFAULTS
 // 旧档选手缺 energy / NaN 时回满：否则 clamp(NaN) 永远回不了体力
 (S.players||[]).forEach(p=>{
  if(!p)return;
  if(p.energy==null||!isFinite(p.energy))p.energy=100;
 });
 try{if(typeof autoFillLineup==='function')autoFillLineup(S);}catch(e){} // 亚运/伤停读档后立刻摘首发
 try{if(typeof initTempSeats==='function'){
  // 真实 KPL：固定 16 队永不降级；升班马（含玩家）挂临时席；不用 TEAM_BRAND/seed 误判
  if(!S.tempSeats)initTempSeats(S);
  S.tempSeatFixed=S.tempSeatFixed||[];
  S.tempSeats=(S.tempSeats||[]).filter(t=>{
   if(typeof isFixedSeatTeam==='function'&&isFixedSeatTeam(t))return false;
   if(S.tempSeatFixed.indexOf(t)>=0)return false;
   return true;
  });
  if(typeof initTempSeats==='function')initTempSeats(S);
 }}catch(e){}
 S.aiRosters={};
 migrateFixZeroZero(S);
 if(S.series&&!S.series.side)S.series.side='blue';
 // 派生索引重建失败要留痕并清空：getMatch 只读 s.matches，留着半建的索引比空索引更危险
 try{rebuildMatchStore(S);}
 catch(e){
  S._migErr='比赛索引重建失败: '+(e&&e.message||e);
  S.matches={};
  console.warn('rebuildMatchStore fail',e);
 }
 try{rebindSeriesMatch(S);}catch(e){}
 // 转会列表不落盘：读档后若仍在转会期，立刻重建，避免空列表上的买卖/谈判路径踩坑
 if(S.preseason&&!(S.transferList||[]).length){
  try{if(typeof buildTransferMarket==='function')buildTransferMarket(S);}catch(e){}
 }
 (S.transferList||[]).forEach(p=>{if(p.untouchable&&p.willingness===100)p.willingness=rnd(85,100);});
 try{if(typeof gcDefs==='function')gcDefs(S);}catch(e){}
 try{if(typeof scrubWages==='function')scrubWages(S);}catch(e){}
 migrateMoneyScale(S);
 migrateEconReal(S);
 migrateCoachRating(S);
 migrateSeasonShape(S);
 migratePlayerFields(S);
 migrateFreeAgents(S);
 migrateLegendPrice(S); // 名宿/回流旧帅缺 cost/wage 的旧档修复（须在两条货币缩放之后）
 // 年总卡死恢复：决赛已打完/冠军已出但 newSeason 未完成 → 读档自动补完年度轮换
 try{
 if(typeof yearRollPending==='function'&&yearRollPending(S)&&typeof finishAnnual==='function')finishAnnual(S,true);
 }catch(e){console.warn('year-roll recover fail',e);}
 // 杯赛结构丢失恢复：phase 有、bracket 无 → 再跑 setup*（重建）或回退到可推进阶段
 try{
  const ph=S.phase;
  const needCh=ph==='challenger'&&(!S.challenger||!S.challenger.teams);
  const needEwc=ph==='ewc'&&(!S.ewc||!S.ewc.qf);
  const needAg=ph==='asiad'&&(!S.ag||!S.ag.squad);
  const needAnn=ph==='annual'&&(!S.annual);
  if(needCh||needEwc||needAg||needAnn){
   if(needCh&&typeof setupChallenger==='function'){setupChallenger(S);}
   else if(needEwc&&typeof setupEWC==='function'){try{setupEWC(S);}catch(e){S.phase='champion';}}
   else if(needAg&&typeof setupAsianGames==='function'){try{setupAsianGames(S);}catch(e){S.phase='annual'||'champion';if(!S.annual&&typeof setupAnnual==='function')setupAnnual(S);}}
   else if(needAnn&&typeof setupAnnual==='function'){setupAnnual(S);}
   else S.phase='champion';
   logEvent(S,'读档修复：赛段结构缺失已尝试重建（phase='+S.phase+'）');
  }
 }catch(e){console.warn('cup-structure recover fail',e);try{S.phase='champion';}catch(_){}}
 try{if(typeof auditSave==='function')auditSave(S,{silent:false});}catch(e){}
}
/* 货币缩放（一次性标记）：×10 → ÷6 */
function migrateMoneyScale(s){
 if(s.moneyScaled)return;
 const mul=x=>(typeof x==='number')?Math.round(x*10):x;
 s.fund=mul(s.fund);s.wageCap=mul(s.wageCap);
 const scaleList=arr=>{if(Array.isArray(arr))arr.forEach(o=>{if(o&&typeof o==='object'){o.wage=mul(o.wage);o.cost=mul(o.cost);o.income=mul(o.income);o.acqCost=mul(o.acqCost);o.signCost=mul(o.signCost);}});};
 scaleList(s.players);scaleList(s.coachMarket);scaleList(s.retiredCoaches);scaleList(s.assistants);
 scaleList(s.market);scaleList(s.freeAgents);scaleList(s.transferList);scaleList(s.hosts);
 if(s.coach){s.coach.wage=mul(s.coach.wage);s.coach.cost=mul(s.coach.cost);}
 (s.listed||[]).forEach(x=>x.price=mul(x.price));
 (s.bids||[]).forEach(x=>x.bid=mul(x.bid));
 s.moneyScaled=true;
 try{logEvent(s,' 经济体系升级：全联盟身价/工资/资金 ×10（顶星身价千万级）');}catch(e){}
}
function migrateEconReal(s){
 if(s.econReal)return;
 const div=x=>(typeof x==='number')?Math.max(1,Math.round(x/6)):x;
 s.fund=div(s.fund);s.wageCap=div(s.wageCap);
 const dList=arr=>{if(Array.isArray(arr))arr.forEach(o=>{if(o&&typeof o==='object'){o.wage=div(o.wage);o.cost=div(o.cost);o.income=div(o.income);o.acqCost=div(o.acqCost);o.signCost=div(o.signCost);}});};
 dList(s.players);dList(s.coachMarket);dList(s.retiredCoaches);dList(s.assistants);
 dList(s.market);dList(s.freeAgents);dList(s.transferList);dList(s.hosts);
 if(s.coach){s.coach.wage=div(s.coach.wage);s.coach.cost=div(s.coach.cost);}
 (s.listed||[]).forEach(x=>x.price=div(x.price));
 (s.bids||[]).forEach(x=>x.bid=div(x.bid));
 s.econReal=true;
 try{logEvent(s,' 联盟硬规则落地：转会费封顶 1500 万 · 大名单 ≤10 人 · 个人顶薪 70 万/周 · 奖金 70% 归选手（全联盟货币同步缩放）');}catch(e){}
}
function migrateCoachRating(s){
 const R2RATE={SSR:90,SR:80,R:70};
 [s.coach].concat(s.coachMarket||[],s.retiredCoaches||[]).forEach(c=>{
 if(c&&c.rating==null&&c.rarity)c.rating=R2RATE[c.rarity]||80;
 });
}
function migrateFixZeroZero(s){
 if(typeof phaseGroups!=='function'||!s.tables||!s.aiSchedule)return;
 phaseGroups(s).forEach(g=>{
 (s.aiSchedule[g]||[]).forEach(m=>{
 if(!(m.r&&m.r.mw===0&&m.r.ow===0))return;
 const ta=(s.tables[g]||{})[m.a],tb=(s.tables[g]||{})[m.b];
 if(ta&&tb){tb.w=Math.max(0,tb.w-1);tb.pts=Math.max(0,tb.pts-1);ta.l=Math.max(0,ta.l-1);}
 const r=simSeriesResult(s,m.a,m.b,KPL.BO5);
 m.r={w:r.win?m.a:m.b,mw:r.mw,ow:r.ow};
 if(ta&&tb){
 if(r.win){ta.w++;ta.pts++;tb.l++;}
 else{tb.w++;tb.pts++;ta.l++;}
 ta.pw+=r.mw;tb.pw+=r.ow;
 }
 });
 });
}
function migrateSeasonShape(s){
 if(!seasonShapeOk(s)){
 s.phase='r1';s.matchIdx=0;
 s.groups={};s.tables={};s.aiPower={};s.card=null;s.playoff=null;s.eliminated=[];
 s.stage='regular';s.champion=false;
 }
}
function migratePlayerFields(s){
 (s.players||[]).concat(s.market||[],s.transferList||[],s.freeAgents||[],s.academy||[]).forEach(p=>{
 if(!p)return;
 // 残档：attrs/skill 被裁掉会让 pcard/overall/训练整页炸——读档时补齐默认值
 if(!p.attrs||typeof p.attrs!=='object')p.attrs={lane:70,farm:70,team:70,mind:70};
 else['lane','farm','team','mind'].forEach(k=>{if(typeof p.attrs[k]!=='number')p.attrs[k]=70;});
 if(!p.skill||typeof p.skill!=='object')p.skill={n:'—',d:'—',t:'team'};
 if(p.injury==null)p.injury=0;
 if(p.mvp==null)p.mvp=0;
 if(p.contract==null)p.contract=2;
 if(p.retiring==null)p.retiring=false;
 if(p.age==null)p.age=ageByPos(p.pos,false);
 if(!POS[p.pos])p.pos='mid';
 if(!p.sig)p.sig=(HEROES.find(h=>h.pos[0]===p.pos)||{}).n||null;
 if(!p.career){const def=PLAYER_POOL.find(d=>d.id===p.id);if(def)p.career=def.career||'';}
 try{if(typeof ensurePlayerPeak==='function'&&!p.peak)ensurePlayerPeak(p);}catch(e){}
 if(!p.heroPool||typeof p.heroPool[0]==='string'){
 const old=(p.heroPool||[]).map(h=>typeof h==='string'?h:h.n);
 p.heroPool=old.map(n=>({n,lv:n===p.sig?3:2}));
 }
 if(p.sig&&!p.heroPool.some(x=>x.n===p.sig))p.heroPool.unshift({n:p.sig,lv:3});
 HEROES.filter(h=>h.pos.includes(p.pos)).forEach(h=>{if(!p.heroPool.some(x=>x.n===h.n))p.heroPool.push({n:h.n,lv:2});});
 p.heroPool=p.heroPool.filter(x=>{const h=heroOf(x.n);return h&&h.pos.includes(p.pos);});
 });
 const scrubPoolPos=p=>{if(p&&Array.isArray(p.heroPool))p.heroPool=p.heroPool.filter(x=>{const h=heroOf(x.n);return h&&h.pos.includes(p.pos);});};
 [s.market,s.transferList,s.freeAgents,s.academy].forEach(list=>{if(Array.isArray(list))list.forEach(scrubPoolPos);});
 Object.values(s.aiRosters||{}).forEach(r=>{if(Array.isArray(r))r.forEach(scrubPoolPos);});
 const renameRookie=p=>{
 if(p&&p.name&&/^.+_\d+$/.test(p.name)&&(p.isRookie||(p.tags||[]).includes('青训')))p.name=genRookieName(s);
 };
 (s.players||[]).forEach(renameRookie);
 (s.academy||[]).forEach(renameRookie);
 (s.academy||[]).forEach(r=>{if(r.contract==null)r.contract=2;});
}
/* 自由球员身份字段兜底：老档/导入档的 freeAgents 可能缺 freeAgent/signCost/willingness——
   缺 freeAgent → 谈判被当转会处理凭空要转会费（openNegotiation 按 !!p.freeAgent 分流）；
   缺 signCost → 转会页渲染 undefined万；缺 willingness → 意愿显示 0/100 永远谈不成。
   必须跑在两条货币迁移之后单独成步：这里补出的 signCost 已是当前刻度，再被 ÷6 就毁了。 */
function migrateFreeAgents(s){
 (s.freeAgents||[]).forEach(p=>{
 if(!p||typeof p!=='object')return;
 if(p.freeAgent!==true)p.freeAgent=true;
 if(typeof p.signCost!=='number'||!isFinite(p.signCost))p.signCost=Math.round(valueOf(overall(p))*0.58);
 if(typeof p.willingness!=='number'||!isFinite(p.willingness))p.willingness=rnd(70,100);
 });
}
/* 名宿教练定价修复：AI 换帅回流（transfer.js）与早期退役转型写进 retiredCoaches 的对象
   可能只有执教字段、没有 cost/wage——转会页会渲染 "undefined万"，而玩家真点「聘为教练」
   就是 s.fund-=undefined → 资金 NaN。这里按 legendPrice 补出当前刻度的价码。
   与 migrateFreeAgents 同理，必须排在两条货币迁移之后，否则补出来的数会被再 ÷6。 */
function migrateLegendPrice(s){
 const fix=o=>{
 if(!o||typeof o!=='object')return;
 if(typeof o.cost!=='number'||!isFinite(o.cost)||!(o.cost>0)){const p=legendPrice(o.rating,o.bonus);o.cost=p.cost;}
 if(o.type!=='host'&&(typeof o.wage!=='number'||!isFinite(o.wage)||!(o.wage>0))){const p=legendPrice(o.rating,o.bonus);o.wage=p.wage;}
 };
 (s.retiredCoaches||[]).forEach(fix);
 (s.assistants||[]).forEach(fix);
 if(s.coach)fix(s.coach);
}
function ensureSeason(s){
 // 启动/读档后确保赛制状态完整（新档 initGroups 在 createTeam 调用）
 // 与 migrateSave 同一判定：按阶段形态校验，S/A/B 阶段没有 G1 属于正常，绝不能因此重建
 if(!seasonShapeOk(s)){
 s.stage='regular';
 initGroups(s);
 logEvent(s,' 赛制升级为 KPL 2025 官方赛制（18队 · S/A/B 三组）');
 save();
 }
 // 常规赛阶段缺赛程：分组在但 schedule 丢了（迁移中断/异常写盘）——补生成，否则俱乐部页赛前面板空转
 if((s.phase==='r1'||s.phase==='r2'||s.phase==='r3')&&(!Array.isArray(s.schedule)||!s.schedule.length)){
 try{
 if(typeof genRoundSchedule==='function')genRoundSchedule(s);
 logEvent(s,' 赛程数据缺失，已按当前分组重新生成剩余轮次');
 save();
 }catch(e){console.warn('schedule recover fail',e);}
 }
}
function load(){
 try{const d=localStorage.getItem(slotKey());if(d){S=JSON.parse(d);
 // 时代联盟按档重装：era 档装该时代；现代档也必须还原默认联盟（否则上一档的时代数据残留错装）
 if(typeof installEra==='function')installEra((S.era&&KPL_ERAS[S.era])?S.era:null);
 migrateSave();return true;}}
 catch(e){console.warn('load fail',e);try{toast(' 存档读取失败，已重新开局');}catch(_){}}
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
 if(p.age>=m.retire)return '已退役';
 if(p.age>=m.retire-1)return '即将退役';
 if(p.age>m.gold)return '下滑期';
 return '黄金期';
}
/* 选手生成（含位置化年龄） */

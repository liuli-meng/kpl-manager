// 静态审计：回调存在性 / 重复函数 / 数据表一致性 / 存档往返渲染
// 运行：node tests/audit-static.js
const fs = require('fs');
const path = require('path');
const { makeDom, makeTester, loadCode } = require('./harness');

const ROOT = path.join(__dirname, '..');
const code = loadCode(); // 源模块清单以 harness.js 为准（只维护一份）
const html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
const all = code + html;
const T = makeTester('静态审计');

// ① onclick 回调存在性
const names = new Set();
let m;
const reCb = /on(?:click|change|input)="([A-Za-z_$][\w$]*)\s*\(/g;
while ((m = reCb.exec(all))) names.add(m[1]);
const defined = new Set();
let m2;
const reFn = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
while ((m2 = reFn.exec(code))) defined.add(m2[1]);
const reVar = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function|\()/g;
while ((m2 = reVar.exec(code))) defined.add(m2[1]);
const missing = [...names].filter(n => !defined.has(n));
T.check(!missing.length, 'onclick 回调未定义: ' + missing.join(', '));

// ② 重复函数定义
const counts = {};
const reDup = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
while ((m2 = reDup.exec(code))) counts[m2[1]] = (counts[m2[1]] || 0) + 1;
const dupFns = Object.keys(counts).filter(k => counts[k] > 1);
T.check(!dupFns.length, '重复函数定义(后者覆盖前者): ' + dupFns.join(', '));

// ②b 跨模块顶层同名声明（生产里等于「后一个模块整块不执行」）
// 浏览器把每个 <script> 当独立的 Script：后一个 script 想在全局词法环境里再建一个已存在的
// const/let/class 名字时，整个 script 会以 "Identifier 'X' has already been declared" 报错并
// 完全不执行（2026-10-02 用 Chrome 实测复现）。也就是说：两个模块各自顶层 `const X` =
// 后一个模块的**全部函数在线上都是 undefined**，而源码里看不出任何异常。
// 之所以要静态查：拼接式沙箱会把这种情况暴露成「整个沙箱起不来」（很响），
// 而真实浏览器里它是静默的（很轻）—— 反过来正是 harness 现在的逐模块加载才让这检查有意义。
{
  const jsDir = path.join(ROOT, 'src', 'js');
  const decls = new Map(); // name -> [{file,line,kind}]
  fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).forEach(f => {
    fs.readFileSync(path.join(jsDir, f), 'utf8').split(/\r?\n/).forEach((ln, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
      const m = ln.match(/^(const|let|var|class|function)\s+([A-Za-z_$][\w$]*)/);
      if (!m) return;
      const kind = (m[1] === 'const' || m[1] === 'let' || m[1] === 'class') ? 'lexical' : 'var';
      if (!decls.has(m[2])) decls.set(m[2], []);
      decls.get(m[2]).push({ file: f, line: i + 1, kind });
    });
  });
  const clash = [];
  decls.forEach((list, name) => {
    const files = new Set(list.map(x => x.file));
    // 同名都出现在同一个模块内不在这里管（那是语法错误，模块根本加载不了）；
    // 两个 var/function 分属不同模块是合法的覆盖（已由 ② 单独盯 function）；
    // 只要有 lexical 声明与另一个模块的同名声明相遇，后一个 script 就会整块失败。
    if (files.size < 2) return;
    if (!list.some(x => x.kind === 'lexical')) return;
    clash.push(name + ' → ' + list.map(x => x.file + ':' + x.line).join(' / '));
  });
  T.check(!clash.length, '跨模块顶层同名声明（后一个模块在浏览器里会整块不执行）: ' + clash.join('; '));
}

// ③ 选手状态旗标单一出口（README 架构约定）：一行内裸拼 ≥2 个旗标 = 加新旗标时必漏的位置。
//    判据用「≥2 个」而非「1 个」：单旗标判断不会因为新增旗标而失效，组合判断才会。
//    只匹配单字母前缀（p./s./me./r./p1.），刻意不匹配 st./pst. —— 那是 playerStatus() 的返回值，正是合法出口。
//    state.js 是出口定义处，跳过；没有条件运算符的行（复位/赋值，如 s.players.forEach(p=>{p.natCamp=false;})）跳过。
const FLAG_KEYS = ['injury', 'kjia', 'loanOut', 'loan', 'natCamp', 'natFill', 'retiring', 'transferRequest', 'minor'];
const flagRe = {};
FLAG_KEYS.forEach(k => { flagRe[k] = new RegExp('\\b(?:[ps]|p\\d|me|r|x|o)\\.' + k + '\\b'); });
const flagBad = [];
fs.readdirSync(path.join(ROOT, 'src', 'js')).filter(f => f.endsWith('.js')).forEach(f => {
  if (f === 'state.js') return;
  fs.readFileSync(path.join(ROOT, 'src', 'js', f), 'utf8').split('\n').forEach((ln, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
    if (!/(\|\||&&|\?|\bif\b)/.test(ln)) return; // 不是条件 → 复位/赋值行，合法
    const hit = FLAG_KEYS.filter(k => flagRe[k].test(ln));
    if (hit.length < 2) return;
    flagBad.push(f + ':' + (i + 1) + '(' + hit.join('+') + ')');
  });
});
T.check(!flagBad.length, '选手状态旗标被裸拼，应走 playerStatus/matchEligible: ' + flagBad.join(', '));

// ④ 引擎与 UI 分离门禁（README 架构约定）：ui*.js 只渲染 + onclick 转发，不得改数值/写名单/写日志。
//    当前为 0 命中（棘轮：只要不新增就不失败）。main.js 不在检查范围 —— 它负责「开局创建」，
//    本来就要用模板建出初始状态，属于设计内。规则要下沉到 transfer/playerops/clubops 等引擎文件。
const UI_MUTATE_RULES = [
  [/\b\w+\.attrs\.\w+\s*[-+*/]?=(?!=)/, '改属性'],
  [/\b\w+\.(energy|morale|injury|popularity|wage|val)\s*[-+*/]?=(?!=)/, '改选手数值'],
  [/S\.(fund|wageCap|fans|sponsorLv)\s*[-+*/]?=(?!=)/, '改全局数值'],
  [/S\.(players|academy|honors|history|listed|bids|freeAgents)\s*\.\s*(push|splice|pop|shift)\(/, '改名单'],
  [/\blogEvent\s*\(/, '写日志'],
];
const uiBad = [];
fs.readdirSync(path.join(ROOT, 'src', 'js')).filter(f => /^ui.*\.js$/.test(f)).forEach(f => {
  fs.readFileSync(path.join(ROOT, 'src', 'js', f), 'utf8').split('\n').forEach((ln, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
    UI_MUTATE_RULES.forEach(([re, tag]) => { if (re.test(ln)) uiBad.push(f + ':' + (i + 1) + '(' + tag + ')'); });
  });
});
T.check(!uiBad.length, 'ui*.js 里出现了数值/名单/日志写入（应下沉到引擎）: ' + uiBad.join(', '));

// ③b 约定扩展（静态扫盘，不进 vm）：引擎禁 DOM · UI 禁直接改四维
{
  const jsDir = path.join(ROOT, 'src', 'js');
  const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  // 例外：data.js 提供 $/$$ 给 UI；hall.js 分享图 canvas；match.js 可选 AI 战报读输入框
  const DOM_OK = new Set(['data.js', 'hall.js', 'match.js', 'perf-monitor.js', 'bgm.js', 'bgm-settings.js', 'perf-dashboard.js', 'debug-panel.js']);
  const engineDom = files.filter(f => !/^ui/.test(f) && f !== 'main.js' && !DOM_OK.has(f)).filter(f => {
    const txt = fs.readFileSync(path.join(jsDir, f), 'utf8');
    return /document\.(querySelector|getElementById|createElement)/.test(txt);
  });
  T.check(!engineDom.length, '引擎文件出现 DOM API（应只在 ui*，例外见 DOM_OK）: ' + engineDom.join(', '));
  const uiAttrs = [];
  files.filter(f => /^ui/.test(f)).forEach(f => {
    const lines = fs.readFileSync(path.join(jsDir, f), 'utf8').split(/\r?\n/);
    lines.forEach((ln, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
      if (/\.attrs\.(lane|farm|team|mind)\s*(\+\+|--|\+=|-=|=(?!=))/.test(ln)) uiAttrs.push(f + ':' + (i + 1));
    });
  });
  T.check(!uiAttrs.length, 'UI 直接改四维（应走 train/引擎）: ' + uiAttrs.slice(0, 5).join(', '));
}

// ③ 数据一致性 + 存档往返（进沙箱）
const { dom } = makeDom();
const out = vm_run(dom, `
(function(){
  const R=[];
  /* 存档字段登记门禁：newState() 建出来的每个字段都必须在 SAVE_DEFAULTS 登记，
     否则「导入残缺档 / 手工构造的档」缺该字段时不会被兜底 —— 例如 logEvent 直接
     s.eventLog.unshift(...)（season.js:54），缺 eventLog 会抛错。2026-09-17 补齐了 26 个。
     ⚠ 白名单三个是「缺省即未迁移」的语义字段，登记了会让迁移链整条跳过（applySaveDefaults
     跑在 migrateMoneyScale/migrateEconReal 之前）：v / moneyScaled / econReal。
     fund / wageCap 另有 migrateFixZeroZero 与现役刻度兜底，登记会互相打架，也不在表内。 */
  const SAVE_DEFAULT_EXEMPT=['v','moneyScaled','econReal','econV2','fund','wageCap'];
  (function(){
    const st=newState('字段登记门禁','测');
    const reg=new Set(SAVE_DEFAULTS.map(d=>d[0]));
    const miss=Object.keys(st).filter(k=>!reg.has(k)&&!SAVE_DEFAULT_EXEMPT.includes(k));
    if(miss.length)R.push('newState 字段未登记 SAVE_DEFAULTS(残缺档不会被兜底): '+miss.join(', '));
  })();
  /* 经济刻度门禁：现役与历代联盟的俱乐部模板必须同在「真实刻度」（2026-09 全联盟 ÷6 之后）。
     踩过的坑：866ec5c 只压了现役 CLUB_TEMPLATES，漏改 KPL_ERAS 的 clubs → 时代开档
     资金/工资帽是现役的 6 倍，且 newState 已置 moneyScaled/econReal，迁移永远不生效。
     单看「有没有赋值」的断言抓不到，必须锁数值区间 + 资金帽比。 */
  const econBadOf=c=>{
    const bad=[];
    if(!(c.cap>=ECON.wageCapMin&&c.cap<=ECON.wageCapMax))bad.push('工资帽'+c.cap);
    if(!(c.budget>=2500&&c.budget<=16000))bad.push('资金'+c.budget);
    const r=c.cap?c.budget/c.cap:0;
    if(r<1.8||r>8)bad.push('资金帽比'+r.toFixed(1));
    return bad;
  };
  const heroNames={},dupHero=[];
  HEROES.forEach(h=>{if(heroNames[h.n])dupHero.push(h.n);heroNames[h.n]=1;});
  if(dupHero.length)R.push('英雄重名:'+JSON.stringify(dupHero));
  const ids={},dupId=[];
  PLAYER_POOL.forEach(d=>{if(ids[d.id])dupId.push(d.id);ids[d.id]=1;});
  const badSig=PLAYER_POOL.filter(d=>{const h=heroOf(d.sig);return !h||!h.pos.includes(d.pos);}).map(d=>d.name+'('+d.sig+')');
  if(dupId.length||badSig.length)R.push('选手池重复id='+JSON.stringify(dupId)+' 招牌错位='+JSON.stringify(badSig));
  // Schema 校验：静态表字段完整性/取值范围（人工维护易漏字段）
  const schBad=[];
  HEROES.forEach(h=>{
    if(!h.n||!Array.isArray(h.pos)||!h.pos.length||!TYPE_NAME[h.t])schBad.push('英雄'+(h.n||'?')+':字段残缺');
    (h.pos||[]).forEach(pp=>{if(!POS[pp])schBad.push('英雄'+h.n+':未知位置'+pp);});
  });
  PLAYER_POOL.concat(FA_2026).forEach(d=>{
    if(!d.id||!d.name||!POS[d.pos]||!Array.isArray(d.base)||d.base.length!==4||d.base.some(v=>typeof v!=='number'||v<40||v>99)
      ||!d.skill||!d.skill.n||!d.skill.t||!d.skill.d||!heroOf(d.sig))schBad.push('选手'+(d.name||d.id||'?')+':字段残缺/越界');
  });
  COACH_POOL.concat(ASSISTANT_POOL).forEach(c=>{
    if(!c.id||!c.name||!(c.rating>=60&&c.rating<=99)||!(c.bonus>=0&&c.bonus<=15)||!COACH_STYLE[c.style]||!c.skill||!c.skill.d)schBad.push('教练'+(c.name||c.id||'?')+':字段残缺/越界');
  });
  EVENTS.forEach((e,i)=>{
    if(!e.t||!e.desc||typeof e.fn!=='function')schBad.push('事件#'+i+'('+(e.t||'无名')+'):字段残缺');
  });
  SPONSORS.forEach((sp,i)=>{
    if(!sp.name||!(sp.income>=0)||(i<SPONSORS.length-1&&!(SPONSORS[i+1].cost>=sp.cost)))schBad.push('赞助#'+i+':字段/档位价格非递增');
  });
  if(schBad.length)R.push('Schema:'+JSON.stringify(schBad.slice(0,6)));
  // Map 索引一致性：HERO_BY_NAME/defIndex 与数据表必须一一对应（索引防呆）
  HEROES.forEach(h=>{if(HERO_BY_NAME[h.n]!==h)R.push('英雄索引不一致:'+h.n);});
  PLAYER_POOL.concat(FA_2026).forEach(d=>{if(defIndex()[d.id]!==d)R.push('def索引不一致:'+d.id);});
  const rosterBad=[];
  Object.keys(AI_ROSTERS).forEach(tn=>{
    const r=AI_ROSTERS[tn];
    if(r.p.length!==5)rosterBad.push(tn+':'+r.p.length+'人');
    const poss=r.p.map(id=>{const d=PLAYER_POOL.find(x=>x.id===id);return d?d.pos:'?';});
    if(poss.includes('?'))rosterBad.push(tn+':未知id');
    const dup=poss.filter((p,i)=>poss.indexOf(p)!==i);
    if(dup.length)rosterBad.push(tn+':位置重复');
  });
  if(rosterBad.length)R.push('AI阵容:'+JSON.stringify(rosterBad));
  const tplBad=[];
  CLUB_TEMPLATES.forEach(c=>{
    if(!COACH_POOL.find(x=>x.id===c.coach))tplBad.push(c.name+':教练id无效');
    if(c.players.length!==5)tplBad.push(c.name+':首发人数');
    const poss=c.players.map(id=>{const d=PLAYER_POOL.find(x=>x.id===id);return d?d.pos:'?';});
    if(poss.includes('?')||poss.filter((p,i)=>poss.indexOf(p)!==i).length)tplBad.push(c.name+':首发非法');
    const eb=econBadOf(c);
    if(eb.length)tplBad.push(c.name+':经济刻度'+eb.join('/'));
  });
  if(tplBad.length)R.push('俱乐部模板:'+JSON.stringify(tplBad));
  if(typeof FIXED_SEAT_TEAMS!=='undefined'){
    if(FIXED_SEAT_TEAMS.length!==16)R.push('固定席位必须恒为16支: '+FIXED_SEAT_TEAMS.length);
    if(typeof TEMP_SEAT_COUNT!=='undefined'&&TEMP_SEAT_COUNT!==2)R.push('临时席位必须为2支: '+TEMP_SEAT_COUNT);
    const fixedDup=FIXED_SEAT_TEAMS.filter((n,i)=>FIXED_SEAT_TEAMS.indexOf(n)!==i);
    if(fixedDup.length)R.push('固定席位存在同名队: '+JSON.stringify(fixedDup));
  }
  const coachBad=COACH_POOL.concat(ASSISTANT_POOL).filter(c=>!['lane','farm','team','mind'].includes(c.style)).map(c=>c.name);
  if(coachBad.length)R.push('教练风格:'+JSON.stringify(coachBad));
  // 历代联盟（2K 经典球队式）：安装每个时代 → 结构校验 + 时代新档全流程
  /* 队伍数不能钉死 18：年档的联盟规模是史实的（2016 创始 12 队、2019 13 队、
     2021 16 队…），钉死 18 只会让「沙箱里只有 2017/2019 两个档」的旧口径看起来是对的
     （harness 修成逐 <script> 加载后 11 个档全部可见，这条才第一次真正生效）。
     这里换成三条**结构性**不变量 —— 它们才是"年档装错了"会立刻报红的判据：
     ① 名录内不得有同名队（同名队会让 genEraDef 的 g<年>_<队>_<位置> 键撞车 →
        同 id 同姓名在 def 池里出现两遍 → defIndex 解析错对象。2020-2026 真的犯过）；
     ② 规模落在 [10,18]（KPL 历年区间）；
     ③ 联盟名录条数必须等于该年档的执教模板条数（两条构建路径的交叉校验）。 */
  const eraBad=[];
  const coachBaseCnt=COACH_POOL.length; // 时代安装前教练池基准（泄漏检测用）
  Object.keys(KPL_ERAS).forEach(id=>{
    try{
      installEra(id);
      const era=KPL_ERAS[id];
      const names=AI_TEAMS.map(t=>t.name);
      const dupTeam=names.filter((n,i)=>names.indexOf(n)!==i);
      if(dupTeam.length)eraBad.push(id+':联盟名录同名队'+JSON.stringify([...new Set(dupTeam)]));
      if(names.length<10||names.length>18)eraBad.push(id+':队伍数越界'+names.length);
      /* 执教模板数**不必**等于联盟队数：手写档就是 18 队配 12/15 条模板（可执教俱乐部
         少于联盟球队是设计内的，见 docs 的口径）。真正该拦的是反过来的方向 ——
         模板比联盟还多（必然有模板指向不存在的队）或少于 10 条（可选俱乐部太少）。 */
      if(CLUB_TEMPLATES.length<10)eraBad.push(id+':执教模板过少'+CLUB_TEMPLATES.length);
      if(CLUB_TEMPLATES.length>names.length)eraBad.push(id+':执教模板'+CLUB_TEMPLATES.length+'条 > 联盟'+names.length+'队');
      const defIds=new Set(),defNames=new Set();
      PLAYER_POOL.forEach(d=>{
        if(defIds.has(d.id))eraBad.push(id+':def id重复'+d.id);
        if(defNames.has(d.name))eraBad.push(id+':选手重名'+d.name);
        defIds.add(d.id);defNames.add(d.name);
        const sig=heroOf(d.sig);
        if(!d.id||!d.name||!POS[d.pos]||!Array.isArray(d.base)||d.base.length!==4||d.base.some(v=>typeof v!=='number'||v<40||v>99)
          ||!d.skill||!d.skill.n||!d.skill.t||!d.skill.d||!sig||!sig.pos.includes(d.pos))eraBad.push(id+':def残缺/招牌错位:'+(d.name||d.id));
      });
      Object.keys(AI_ROSTERS).forEach(tn=>{
        const r=AI_ROSTERS[tn];
        if(r.p.length!==5){eraBad.push(id+':'+tn+'阵容'+r.p.length+'人');return;}
        const poss=r.p.map(pid=>{const d=PLAYER_POOL.find(x=>x.id===pid);return d?d.pos:'?';});
        if(poss.includes('?'))eraBad.push(id+':'+tn+'未知def');
        else if(poss.filter((p,i)=>poss.indexOf(p)!==i).length)eraBad.push(id+':'+tn+'位置重复');
        if(!AI_TEAMS.some(t=>t.name===tn))eraBad.push(id+':阵容队名不在联盟:'+tn);
      });
      era.clubs.forEach(c=>{
        if(!COACH_POOL.find(x=>x.id===c.coach))eraBad.push(id+':'+c.name+'教练id无效');
        if(!AI_TEAMS.some(t=>t.name===c.name))eraBad.push(id+':模板球队不在联盟:'+c.name);
        const poss=c.players.map(pid=>{const d=PLAYER_POOL.find(x=>x.id===pid);return d?d.pos:'?';});
        if(poss.includes('?')||poss.filter((p,i)=>poss.indexOf(p)!==i).length)eraBad.push(id+':'+c.name+'模板首发非法');
        const eb=econBadOf(c);
        if(eb.length)eraBad.push(id+':'+c.name+'经济刻度'+eb.join('/'));
      });
      // 时代新档：执教该时代最后一支俱乐部 → 分组/市场/迁移/全页渲染
      const tmpl=CLUB_TEMPLATES[CLUB_TEMPLATES.length-1];
      S=newState(tmpl.name,tmpl.icon||'队');
      S.era=id;S.fund=tmpl.budget;S.wageCap=tmpl.cap;
      S.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
      tmpl.players.forEach(pid=>{const d=PLAYER_POOL.find(x=>x.id===pid);if(d)S.players.push(genPlayer(d));});
      S.lineup=POS_ORDER.map(pos=>{
        const cand=S.players.filter(p=>p.pos===pos).sort((a,b)=>playerPower(b)-playerPower(a));
        return cand[0]?cand[0].id:null;
      }).filter(Boolean);
      S.seedPower=teamPower(S)||400;
      initGroups(S);
      buildTransferMarket(S);refreshMarket(S);
      // 分组形态随赛制：sab→G1/G2/G3 各 6；ab/eastwest→两组；double-rr/single/legacy→单组 All
      const st0=(typeof fmtOf==='function'?(fmtOf(S).structure||S.structure):S.structure)||'sab';
      const stKey=st0==='legacy'?'double-rr':st0;
      const gs=S.groups||{};
      const groupOk=(stKey==='sab')
        ? !!(gs.G1&&gs.G1.length===6&&gs.G2&&gs.G2.length===6)
        : (stKey==='ab'||stKey==='eastwest')
          ? !!((gs.A||gs.East)&& (gs.B||gs.West))
          : !!(gs.All&&gs.All.length>=12);
      if(!groupOk)eraBad.push(id+':分组异常('+stKey+' → '+Object.keys(gs).join('/')+')');
      if(!S.leagueTeams||S.leagueTeams.length<12)eraBad.push(id+':联盟名录'+((S.leagueTeams||[]).length)+'队');
      migrateSave();
      let eErr='';
      try{['club','career','lineup','market','train','league','kjia','union','hall','biz'].forEach(p=>renderPage(p));}catch(e){eErr=e.message;}
      if(eErr)eraBad.push(id+':渲染异常 '+eErr);
    }catch(e){eraBad.push(id+':异常 '+(e.message||e));}
  });
  installEra(null); // 还原默认联盟，后续断言基于现役数据
  if(AI_TEAMS.length!==18||CLUB_TEMPLATES.length!==18)eraBad.push('还原现役联盟失败');
  if(COACH_POOL.length!==coachBaseCnt)eraBad.push('时代教练池泄漏: 基准'+coachBaseCnt+'→'+COACH_POOL.length+'（installEra(null) 必须还原教练池）');
  if(_eraActive)eraBad.push('还原后 _eraActive 残留:'+_eraActive);
  if(!defIndex()['top1'])eraBad.push('def 索引未随联盟还原失效重建');
  if(eraBad.length)R.push('历代联盟:'+JSON.stringify(eraBad.slice(0,8)));
  // 历代联盟史册：行字段完整性 + 杯赛唯一性（人工维护易漏）
  const histBad=[];
  KPL_HISTORY.seasons.concat(KPL_HISTORY.finals).forEach(r=>{
    if(!r.y||!r.champ||!r.ru)histBad.push('历届:'+(r.y||'?'));
  });
  const cupKeys=new Set();
  KPL_HISTORY.cups.forEach(r=>{
    if(!r.y||!r.ev||!r.champ)histBad.push('杯赛:'+(r.y||'?'));
    else{const k=r.y+r.ev;if(cupKeys.has(k))histBad.push('杯赛重复:'+k);cupKeys.add(k);}
  });
  KPL_HISTORY.clubs.forEach(c=>{if(!c.n||!c.era||!c.d)histBad.push('名队:'+(c.n||'?'));});
  KPL_HISTORY.eras.forEach(e=>{if(!e.t||!e.y||!e.d)histBad.push('版图:'+(e.t||'?'));});
  KPL_HISTORY.dynasties.forEach(d=>{if(!d.n||!d.t||!d.y||!d.d)histBad.push('王朝:'+(d.n||'?'));});
  if(histBad.length)R.push('历代联盟:'+JSON.stringify(histBad.slice(0,6)));
  // 存档往返 + 渲染
  S=newState('往返队','⚔️');
fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=400;initGroups(S);
  S.transferWindow=0;S.fund=3000;
  const t=loanCandidates(S)[0];loanPlayer(S,t.from,t.p.id);
  const back=JSON.parse(JSON.stringify(S));
  S=back;migrateSave();
  let renderErr='';
  try{['club','career','lineup','market','train','league','kjia','union','hall','biz'].forEach(p=>renderPage(p));
  window._unionMode='hist';renderPage('union');window._unionMode='now';renderPage('union'); // 历代联盟史册 + 现况两种形态都要能渲染
  }catch(e){renderErr=e.message;}
  const numOk=[S.fund,weeklyWage(S),teamPower(S)].every(v=>typeof v==='number'&&!isNaN(v));
  return JSON.stringify({issues:R, roundtrip:renderErr||'OK', numOk});
})()
`);
const res = JSON.parse(out);
T.check(res.issues.length === 0, '数据一致性问题:\n  ' + res.issues.join('\n  '));
T.check(res.roundtrip === 'OK', '存档往返/渲染异常: ' + res.roundtrip);
T.check(!!res.numOk, '数值健全性检查未通过');
T.report();

function vm_run(dom, snippet) {
  return require('vm').runInContext(snippet, dom);
}

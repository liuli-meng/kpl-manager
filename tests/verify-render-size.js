/* 渲染规模 + 脏文本门禁
   动机（2026-09-18 实测，见 OPTIMIZE-AUDIT-2.md）：转会页在真实存档下撑到 123.5 KB / 约 5,000 个
   标签，而上一轮审计记录的是「已修至 28.6 KB / 604 元素」——差异全在**列表规模**：transferList
   实测 89 人、选秀池 20 人全量出卡。体积只在有内容的档上暴露，没人每次开档量一遍就会静默长回去，
   所以这里用「构造出的最坏但合法的状态」把体积钉住（棘轮：只许变小，变大要显式改阈值并写理由）。
   为什么不用 saves/ 里的真实存档：saves/ 被 .gitignore 排除，CI 上不存在。 */
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');

/* 阈值口径：本轮改完的实测值向上留 ~20% 余量。
   改大阈值必须写清为什么——这条门禁的全部价值就在于「变大是要解释的」。 */
const LIMITS = {
  club: 14 * 1024,
  lineup: 26 * 1024,
  market: 72 * 1024,   // 截断前实测 123.5 KB；见 ui.js truncSlice + draft.js 紧凑行
  train: 40 * 1024,
  league: 26 * 1024,
  kjia: 30 * 1024,
  union: 30 * 1024,
  hall: 10 * 1024,
  biz: 26 * 1024,
};
const TAG_LIMITS = { market: 3000 };  // 默认节点上限 4000，转会页单独收紧
const BOOT = `
S=newState('渲染门禁','⚔️');
S.mode='manager';
fillRoster(S,'star');
S.preseason=true;S.transferWindow=7;
if(typeof buildTransferMarket==='function')buildTransferMarket(S);
if(typeof refreshMarket==='function')refreshMarket(S);
initDraft(S);
if(typeof genAcademyRookie==='function'){try{for(let i=0;i<3;i++)genAcademyRookie(S);}catch(e){}}
if(typeof academyPromote==='function'){try{}catch(e){}}
S.coachMarket=(typeof COACH_MARKET!=='undefined'?COACH_MARKET.slice(0,4):S.coachMarket||[]);
'script-ok';
`;

const { dom, elCache } = makeDom();
vm.runInContext(BOOT, dom);
const T = makeTester('渲染规模与脏文本门禁');

const TL = vm.runInContext('(S.transferList||[]).length', dom);
const POOL = vm.runInContext('((S.draft&&S.draft.pool)||[]).length', dom);
const ROSTER = vm.runInContext('S.players.length', dom);
console.log(`构造状态：transferList ${TL} 人 · 选秀池 ${POOL} 人 · 名单 ${ROSTER} 人`);
T.check(TL >= 30, `构造状态太轻：transferList 只有 ${TL} 人（门禁要压得住列表规模，造档代码疑似失效）`);
T.check(POOL >= 10, `构造状态太轻：选秀池只有 ${POOL} 人`);

Object.keys(LIMITS).forEach(p => {
  Object.keys(elCache).forEach(k => { elCache[k].innerHTML = ''; });
  vm.runInContext(`renderPage(${JSON.stringify(p)})`, dom);
  const html = (elCache['#page-' + p] && elCache['#page-' + p].innerHTML) || '';
  const bytes = html.length;
  const tags = (html.match(/</g) || []).length;
  const bad = [];
  // 只抓「值本身就是 undefined/NaN」才会出现的形态，正常中文文案不会命中
  if (/>undefined[< ]/.test(html)) bad.push('undefined 文本');
  if (/>NaN[< ]/.test(html)) bad.push('NaN 文本');
  if (/="undefined"/.test(html)) bad.push('undefined 属性');
  T.check(bytes <= LIMITS[p], `${p} 页渲染 ${(bytes / 1024).toFixed(1)} KB，超阈值 ${(LIMITS[p] / 1024).toFixed(0)} KB（体积变大要显式改阈值并写理由）`);
  T.check(tags <= (TAG_LIMITS[p] || 4000), `${p} 页渲染 ${tags} 个标签，超阈值（节点数直接决定手机端 layout 成本）`);
  bad.forEach(b => T.check(false, `${p} 页渲染出现 ${b}`));
  console.log(`  ${p.padEnd(7)} ${(bytes / 1024).toFixed(1).padStart(7)} KB  ${String(tags).padStart(5)} 标签  ${bad.length ? '✗ ' + bad.join(',') : 'OK'}`);
});

/* 截断不能变成丢数据：展开后必须真的列完，且收起时要有明确的「显示其余 N 人」入口 */
vm.runInContext("renderPage('market');_listMore['mtransfer']=true;renderPage('market')", dom);
const expanded = ((elCache['#page-market'].innerHTML || '').match(/class="match/g) || []).length;
T.check(expanded >= Math.min(TL, expanded) && expanded >= TL * 0.9,
  `转会列表展开后只有 ${expanded} 行，少于 transferList 的 ${TL} 人（截断疑似吃掉数据）`);
vm.runInContext("_listMore['mtransfer']=false;renderPage('market')", dom);
T.check(/显示其余/.test(elCache['#page-market'].innerHTML || ''),
  '转会列表截断后没渲染「显示其余 N 人」入口（玩家会以为市场没人了）');
T.check(/新秀池 \d+ 人 · 轮到你点名时/.test(elCache['#page-market'].innerHTML || ''),
  '选秀面板非本队回合时应渲染紧凑行 + 「轮到你点名时展开」提示（分级渲染被改坏了）');

/* 换档必须清会话级 UI 状态：A 档展开的列表不能带着 B 档继续展开 */
vm.runInContext("_listMore['mtransfer']=true;S=newState('换档后','⚔️');resetRuntimeGlobals()", dom);
T.check(vm.runInContext("_listMore['mtransfer']", dom) === undefined, 'resetRuntimeGlobals 没清 _listMore（换档残留上一档的列表展开状态）');
T.check(vm.runInContext('_nego', dom) === null, 'resetRuntimeGlobals 没清 _nego（转会谈判上下文会跨档残留）');
T.check(vm.runInContext('_clubPick', dom) === -1, 'resetRuntimeGlobals 没复位开局俱乐部选择 _clubPick');

/* 年度回顾/复盘的缺字段兜底：旧档没这些字段是常态（version 迁移路径），不能点开就抛错 */
const GUARD = `
S=newState('兜底档','⚔️');fillRoster(S,'mid');
S.yearReviews=[{stage:'春季赛'}];                 // 只有赛段名，没有 achieved/transfers/fund/year
S.history=[{opp:'某队',stage:'季后赛',score:'4-2',logs:['第1局 我方胜',null,{t:'对象形日志'},'第2局 我方负']}];
const out=[];
try{showYearReview(0);out.push('yearReview-ok');}catch(e){out.push('yearReview-THROW:'+e.message);}
try{showReplay(S.history[0]);out.push('replay-ok');}catch(e){out.push('replay-THROW:'+e.message);}
const body=document.getElementById('app-modal-body').innerHTML||'';
out.push(/>undefined[< ]|>NaN[< ]/.test(body)?'dirty':'clean');
out.join('|');
`;
const g = vm.runInContext(GUARD, dom);
console.log('  缺字段兜底:', g);
T.check(!/THROW/.test(g), `年度回顾/复盘在缺字段存档上抛错（应兜底渲染）：${g}`);
T.check(/clean$/.test(g), `兜底档弹窗里仍出现 undefined/NaN 文本：${g}`);

process.exit(T.report() ? 0 : 1);

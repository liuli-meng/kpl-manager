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

// ③ 数据一致性 + 存档往返（进沙箱）
const { dom } = makeDom();
const out = vm_run(dom, `
(function(){
  const R=[];
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
  });
  if(tplBad.length)R.push('俱乐部模板:'+JSON.stringify(tplBad));
  const coachBad=COACH_POOL.concat(ASSISTANT_POOL).filter(c=>!['lane','farm','team','mind'].includes(c.style)).map(c=>c.name);
  if(coachBad.length)R.push('教练风格:'+JSON.stringify(coachBad));
  // 存档往返 + 渲染
  S=newState('往返队','⚔️');
  const _u=new Set();
  ['top','jg','mid','ad','sup'].forEach(pos=>S.players.push(genPlayer(genFreeAgentDef(pos,'mid',_u))));
  S.lineup=S.players.map(p=>p.id);
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.seedPower=400;initGroups(S);
  S.transferWindow=0;S.fund=3000;
  const t=loanCandidates(S)[0];loanPlayer(S,t.from,t.p.id);
  const back=JSON.parse(JSON.stringify(S));
  S=back;migrateSave();
  let renderErr='';
  try{['club','lineup','market','train','league','union','biz'].forEach(p=>renderPage(p));}catch(e){renderErr=e.message;}
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

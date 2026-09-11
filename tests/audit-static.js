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
  // 历代联盟（2K 经典球队式）：安装每个时代 → 结构校验 + 时代新档全流程
  const eraBad=[];
  const coachBaseCnt=COACH_POOL.length; // 时代安装前教练池基准（泄漏检测用）
  Object.keys(KPL_ERAS).forEach(id=>{
    try{
      installEra(id);
      const era=KPL_ERAS[id];
      if(AI_TEAMS.length!==18)eraBad.push(id+':队伍数'+AI_TEAMS.length);
      if(CLUB_TEMPLATES.length<10)eraBad.push(id+':执教模板过少');
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
      if(!S.groups.G1||S.groups.G1.length!==6)eraBad.push(id+':分组异常');
      if(!S.leagueTeams||S.leagueTeams.length!==18)eraBad.push(id+':联盟名录'+((S.leagueTeams||[]).length)+'队');
      migrateSave();
      let eErr='';
      try{['club','lineup','market','train','league','kjia','union','biz'].forEach(p=>renderPage(p));}catch(e){eErr=e.message;}
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
  try{['club','lineup','market','train','league','kjia','union','biz'].forEach(p=>renderPage(p));
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

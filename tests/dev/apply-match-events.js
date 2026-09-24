/* One-shot: event-driven singleGame + eventStoryLines onto clean match.js (LF endings) */
const fs = require('fs');
const p = 'src/js/match.js';
let t = fs.readFileSync(p, 'utf8');

const oldFn = 'function singleGame(my,op){\n const w=Math.random()<winChance(my,op);\n return {w,myK:rnd(6,13),opK:rnd(6,13)};\n}';
if (!t.includes(oldFn)) {
  console.error('singleGame block not found — abort');
  process.exit(1);
}
if (t.includes('function eventStoryLines')) {
  console.error('eventStoryLines already present — abort');
  process.exit(1);
}

const singleGameNeu = [
  'function singleGame(my,op,opts){',
  ' opts=opts||{};',
  ' const pWin=winChance(my,op);',
  ' const w=Math.random()<pWin;',
  ' /* 局内事件流：对线 → 资源团 → 大团；经济雪球 gold，韧性有翻盘窗 */',
  ' let gold=(my-op)*0.03;',
  ' let myK=0,opK=0;',
  ' const evs=[];',
  ' const phases=[',
  '  {key:"lane",n:2,vol:0.8,tag:"对线期"},',
  '  {key:"obj",n:3,vol:1.0,tag:"资源团"},',
  '  {key:"tf",n:3,vol:1.25,tag:"大团"}',
  ' ];',
  ' phases.forEach(ph=>{',
  '  for(let i=0;i<ph.n;i++){',
  '   const swing=Math.tanh(gold/10);',
  '   const p=clamp(0.28+pWin*0.44+swing*0.28,0.12,0.88);',
  '   const side=Math.random()<p;',
  '   const vol=ph.vol;',
  '   let kills=0;const r=Math.random();',
  '   if(ph.key==="lane")kills=r<0.45?0:r<0.8?1:2;',
  '   else if(ph.key==="obj")kills=r<0.25?0:r<0.65?1:r<0.9?2:3;',
  '   else kills=r<0.15?0:r<0.45?1:r<0.75?2:r<0.92?3:4;',
  '   let flip=false;',
  '   if(!side&&gold>6&&ph.key==="tf"&&Math.random()<0.18)flip=true;',
  '   const gain=Math.max(0,kills)*vol;',
  '   if(side||flip){',
  '    const k=flip?Math.max(1,kills):kills;',
  '    myK+=k;opK+=flip?0:Math.floor(kills*0.3);',
  '    gold+=1.2+gain+(ph.key==="obj"?1.5:0)+(ph.key==="tf"?1.8:0);',
  '    evs.push({tag:ph.tag,side:1,k:k,flip});',
  '   }else{',
  '    const k=kills;',
  '    opK+=k;myK+=Math.floor(kills*0.3);',
  '    gold-=1.2+gain+(ph.key==="obj"?1.5:0)+(ph.key==="tf"?1.8:0);',
  '    evs.push({tag:ph.tag,side:-1,k,flip});',
  '   }',
  '   gold=clamp(gold,-14,14);',
  '  }',
  ' });',
  ' if(w&&myK<=opK)myK=opK+1+rnd(0,2);',
  ' if(!w&&opK<=myK)opK=myK+1+rnd(0,2);',
  ' const finalGap=Math.abs(myK-opK);',
  ' if(Math.abs(gold)>=8&&finalGap<3){',
  '  if(w)myK=opK+3+rnd(0,2);else opK=myK+3+rnd(0,2);',
  ' }else if(Math.abs(gold)<=2&&finalGap>4){',
  '  if(w)myK=opK+1+rnd(0,1);else opK=myK+1+rnd(0,1);',
  ' }',
  ' myK=clamp(myK,3,28);opK=clamp(opK,3,28);',
  ' return {w,myK,opK,gold:Math.round(gold),pWin,evs};',
  '}',
].join('\n');
t = t.replace(oldFn, singleGameNeu);

const helper = [
  '/* 事件流直播：按 g.evs（对线/资源/大团）顺序讲局势 */',
  'function eventStoryLines(sr,g,mvp){',
  ' const evs=(g&&g.evs)||[];',
  ' if(!evs.length)return null;',
  ' const myLs=rosterLineup(S);',
  ' const opR=ensureAiRosters(S,sr.opName)||[];',
  ' const R=arr=>arr[Math.floor(Math.random()*arr.length)];',
  ' const any=arr=>arr.length?R(arr):null;',
  ' const a=()=>any(myLs),o=()=>any(opR);',
  ' const myHero=p=>p?((S.pick&&S.pick[p.pos])||p.sig||''):'';',
  ' const heroOf=p=>{const h=myHero(p);return h?` 的 ${h}`:''};',
  ' const lines=[];',
  ' const mins={对线期:[3,5],资源团:[9,12,15],大团:[18,22,26]};',
  ' evs.forEach((ev,i)=>{',
  '  const span=mins[ev.tag]||[8+i*3];',
  '  const m=span[i%span.length];',
  '  const k=ev.k||0;',
  '  if(ev.flip){',
  '   const p=a();',
  '   lines.push(`第${m}分钟，${ev.tag}！落后方韧性拉满，${p?p.name:'我方'}${heroOf(p)} 关键团以少换多，硬生生扳回一城！`);',
  '   return;',
  '  }',
  '  if(ev.side>0){',
  '   if(k<=0)lines.push(`第${m}分钟，${ev.tag}节奏被我方控住，资源入袋，局势渐渐打开。`);',
  '   else if(k===1){const p=a();lines.push(`第${m}分钟，${ev.tag}：${p?p.name:'我方选手'}${heroOf(p)} 收下人头，我方继续滚经济。`);}',
  '   else{const p=a();lines.push(`第${m}分钟，${ev.tag}大获全胜！${p?p.name:'我方'} 带队打出 ${k} 换 0，雪球越滚越大。`);}',
  '  }else{',
  '   if(k<=0)lines.push(`第${m}分钟，${ev.tag}被对方压了一头，我方先避战发育。`);',
  '   else if(k===1){const p=a(),o2=o();lines.push(`第${m}分钟，${ev.tag}：${o2?o2.name:'对方选手'} 抓到机会，我方 ${p?p.name:'选手'} 送出人头，节奏被按住。`);}',
  '   else{const p=a();lines.push(`第${m}分钟，${ev.tag}崩了！对方打出 ${k} 换 0，${p?p.name:'我方'} 这波亏麻了。`);}',
  '  }',
  ' });',
  ' const diff=g.myK-g.opK;',
  ' if(g.w&&diff>=5)lines.push(`终局 ${g.myK}-${g.opK}，我方全程压制，一场漂亮的惨案局。`);',
  ' else if(g.w&&Math.abs(diff)<=2)lines.push(`终局 ${g.myK}-${g.opK}，焦灼到底，我方笑到最后。`);',
  ' else if(g.w)lines.push(`终局 ${g.myK}-${g.opK}，中盘建立的优势稳稳守住，我方拿下。`);',
  ' else if(diff<=-5)lines.push(`终局 ${g.myK}-${g.opK}，对方滚起雪球，我方没能翻盘。`);',
  ' else if(Math.abs(diff)<=2)lines.push(`终局 ${g.myK}-${g.opK}，差一口气，我方憾负。`);',
  ' else lines.push(`终局 ${g.myK}-${g.opK}，关键团没接住，我方遗憾落败。`);',
  ' if(mvp)lines.push(`本局 MVP：${mvp.name}（${mvp.k}/${mvp.d}/${mvp.a}）`);',
  ' return lines;',
  '}',
  '',
].join('\n');

const marker = 'function genMatchStory(sr,g,mvp){';
const idx = t.indexOf(marker);
if (idx < 0) {
  console.error('genMatchStory not found');
  process.exit(1);
}
t = t.slice(0, idx) + helper + t.slice(idx);
t = t.replace(
  'function genMatchStory(sr,g,mvp){\n',
  'function genMatchStory(sr,g,mvp){\n const evLines=eventStoryLines(sr,g,mvp);\n if(evLines&&evLines.length>=3)return evLines.map(l=>'+String.fromCharCode(39)+' '+String.fromCharCode(39)+'+l);\n'
);

fs.writeFileSync(p, t);
console.log('match.js: singleGame + eventStoryLines applied once');

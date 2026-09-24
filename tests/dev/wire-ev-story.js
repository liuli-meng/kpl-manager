const fs = require('fs');

// ---------- match.js: event-driven story ----------
{
  const p = 'src/js/match.js';
  let t = fs.readFileSync(p, 'utf8');
  const marker = 'function genMatchStory(sr,g,mvp){';
  const idx = t.indexOf(marker);
  if (idx < 0) {
    console.error('genMatchStory not found');
    process.exit(1);
  }
  const helper = [
    '/* 事件流直播：按 g.evs（对线/资源/大团）顺序讲局势，比随机模板更像真局 */',
    'function eventStoryLines(sr,g,mvp){',
    ' const evs=(g&&g.evs)||[];',
    ' if(!evs.length)return null;',
    ' const myLs=rosterLineup(S);',
    ' const opR=ensureAiRosters(S,sr.opName)||[];',
    ' const R=arr=>arr[Math.floor(Math.random()*arr.length)];',
    ' const any=arr=>arr.length?R(arr):null;',
    ' const a=()=>any(myLs),o=()=>any(opR);',
    ' const myHero=p=>p?((S.pick&&S.pick[p.pos])||p.sig||\'\'):\'\';',
    ' const heroOf=p=>{const h=myHero(p);return h?` 的 ${h}`:\'\';};',
    ' const lines=[];',
    ' const mins={对线期:[3,5],资源团:[9,12,15],大团:[18,22,26]};',
    ' let goldLead=0;',
    ' evs.forEach((ev,i)=>{',
    '  const span=mins[ev.tag]||[8+i*3];',
    '  const m=span[i%span.length];',
    '  const k=ev.k||0;',
    '  if(ev.flip){',
    '   const p=a(),o2=o();',
    '   lines.push(`第${m}分钟，${ev.tag}！落后方韧性拉满，${p?p.name:\'我方\'}${heroOf(p)} 关键团以少换多，硬生生扳回一城！`);',
    '   goldLead+=k;',
    '   return;',
    '  }',
    '  if(ev.side>0){',
    '   goldLead+=k;',
    '   if(k<=0)lines.push(`第${m}分钟，${ev.tag}节奏被我方控住，资源入袋，局势渐渐打开。`);',
    '   else if(k===1){const p=a(),o2=o();lines.push(`第${m}分钟，${ev.tag}：${p?p.name:\'我方选手\'}${heroOf(p)} 收下人头，我方继续滚经济。`);}',
    '   else{const p=a(),o2=o();lines.push(`第${m}分钟，${ev.tag}大获全胜！${p?p.name:\'我方\'} 带队打出 ${k} 换 0，雪球越滚越大。`);}',
    '  }else{',
    '   goldLead-=k;',
    '   if(k<=0)lines.push(`第${m}分钟，${ev.tag}被对方压了一头，我方先避战发育。`);',
    '   else if(k===1){const p=a(),o2=o();lines.push(`第${m}分钟，${ev.tag}：${o2?o2.name:\'对方选手\'} 抓到机会，我方 ${p?p.name:\'选手\'} 送出人头，节奏被按住。`);}',
    '   else{const p=a(),o2=o();lines.push(`第${m}分钟，${ev.tag}崩了！对方打出 ${k} 换 0，${p?p.name:\'我方\'} 这波亏麻了。`);}',
    '  }',
    ' });',
    ' // 收官句：按最终分差/经济讲结局',
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
  ].join('\r\n');
  t = t.slice(0, idx) + helper + t.slice(idx);
  // hook at top of genMatchStory body
  const hook = 'function genMatchStory(sr,g,mvp){\r\n const evLines=eventStoryLines(sr,g,mvp);\r\n if(evLines&&evLines.length>=3)return evLines.map(l=>\' \'+l);\r\n';
  t = t.replace('function genMatchStory(sr,g,mvp){\r\n', hook);
  fs.writeFileSync(p, t);
  console.log('match.js: eventStoryLines + hook ok');
}

// ---------- season.js: simSeriesResult uses singleGame ----------
{
  const p = 'src/js/season.js';
  let t = fs.readFileSync(p, 'utf8');
  const old = 'for(let i=1;i<=bo&&mw<need&&ow<need;i++){\r\n const w=Math.random()<winChance(aEff,bEff);\r\n if(w)mw++;else ow++;\r\n }';
  if (!t.includes(old)) {
    console.error('simSeriesResult loop not found');
    process.exit(1);
  }
  const neu = 'for(let i=1;i<=bo&&mw<need&&ow<need;i++){\r\n // 与玩家局同一事件引擎（对线/资源/大团），AI 对 AI 也保持叙事与分差手感一致\r\n const w=(typeof singleGame===\'function\')?singleGame(aEff,bEff).w:(Math.random()<winChance(aEff,bEff));\r\n if(w)mw++;else ow++;\r\n }';
  t = t.replace(old, neu);
  fs.writeFileSync(p, t);
  console.log('season.js: simSeriesResult -> singleGame ok');
}

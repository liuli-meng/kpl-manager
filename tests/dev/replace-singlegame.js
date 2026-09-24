const fs = require('fs');
const p = 'src/js/match.js';
let t = fs.readFileSync(p, 'utf8');
const oldFn = 'function singleGame(my,op){\r\n const w=Math.random()<winChance(my,op);\r\n return {w,myK:rnd(6,13),opK:rnd(6,13)};\r\n}';
if (!t.includes(oldFn)) {
  console.error('singleGame block not found');
  process.exit(1);
}
const neu = [
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
  ' /* 胜负对齐基线（联赛平衡门禁不被叙事打穿）；顺带修「赢家击杀更少」 */',
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
].join('\r\n');
t = t.replace(oldFn, neu);
fs.writeFileSync(p, t);
console.log('replaced singleGame ok');

// 只收集 fuzz 真正比对的名单（玩家队 + 各 AI 队）中的跨队重名
const vm = require('vm');
const fs = require('fs');
const { makeDom } = require('../harness');

const seedArg = (process.argv.find(a => a.startsWith('--seed=')) || '').split('=')[1];
const seed = seedArg ? (parseInt(seedArg, 10) || 2) : 2;
const { dom } = makeDom();
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + seed + ')', dom);
const run = snippet => vm.runInContext('(function(){\n' + snippet + '\n})()', dom);

const fuzz = fs.readFileSync(require.resolve('../fuzz.js'), 'utf8');
const m = /const out = run\(`([\s\S]*?)`\);/.exec(fuzz);
let body = m[1];
const marker = 'return JSON.stringify(';
const idx = body.lastIndexOf(marker);
if (idx < 0) { console.error('marker not found'); process.exit(1); }
body = body.slice(0, idx) + `
const meta=[];
(S.leagueTeams||[]).forEach(n=>{
  if(n===S.teamName){S.players.forEach(p=>meta.push({n:p.name,src:'me',id:p.id}));return;}
  const r=ensureAiRosters(S,n)||[];
  r.forEach(p=>meta.push({n:p.name,src:n,id:p.id}));
});
const by={};meta.forEach(x=>{(by[x.n]=by[x.n]||[]).push(x);});
const dups=Object.entries(by).filter(([,v])=>v.length>1).map(([n,v])=>({n,v}));
return JSON.stringify({season:S.season, series, players:S.players.length, dups, teamBad, errs});
`;
const res = JSON.parse(run(body));
console.log('seed', seed, 'season', res.season, 'series', res.series);
console.log('teamBad', res.teamBad);
console.log('errs', res.errs);
console.log('dups', res.dups.length);
res.dups.forEach(d => {
  console.log('---', d.n);
  d.v.forEach(x => console.log('   ', x.src, x.id));
});

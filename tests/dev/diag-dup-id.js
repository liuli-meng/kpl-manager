// 诊断重复 id：打印 S.players 中重复项及其来源
const vm = require('vm');
const fs = require('fs');
const { makeDom } = require('../harness');

const seed = parseInt((process.argv.find(a => a.startsWith('--seed=')) || '').split('=')[1], 10) || 55;
const { dom } = makeDom();
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + seed + ')', dom);
const run = snippet => vm.runInContext('(function(){\n' + snippet + '\n})()', dom);

const fuzz = fs.readFileSync(require.resolve('../fuzz.js'), 'utf8');
const m = /const out = run\(`([\s\S]*?)`\);/.exec(fuzz);
let body = m[1];
const idx = body.lastIndexOf('return JSON.stringify(');
body = body.slice(0, idx) + `
const byId={};
S.players.forEach((p,i)=>{(byId[p.id]=byId[p.id]||[]).push({i,name:p.name,keys:Object.keys(p).slice(0,8)});});
const dups=Object.entries(byId).filter(([,v])=>v.length>1).map(([id,v])=>({id,v}));
const meta=[];
(S.leagueTeams||[]).forEach(n=>{
  if(n===S.teamName){S.players.forEach(p=>meta.push({n:p.name,src:'me',id:p.id}));return;}
  const r=ensureAiRosters(S,n)||[];
  r.forEach(p=>meta.push({n:p.name,src:n,id:p.id}));
});
const by={};meta.forEach(x=>{(by[x.n]=by[x.n]||[]).push(x);});
const nameDups=Object.entries(by).filter(([,v])=>v.length>1).map(([n,v])=>({n,v}));
const target='ns_10_qar5u';
const hits=[];
const scan=(label,d)=>{if(d&&d.id===target)hits.push({label,name:d.name,id:d.id});};
(S.extraDefs||[]).forEach(d=>scan('extraDefs',d));
(S.players||[]).forEach(d=>scan('players',d));
(S.market||[]).forEach(d=>scan('market',d));
(S.transferList||[]).forEach(d=>scan('transferList',d));
(S.freeAgents||[]).forEach(d=>scan('freeAgents',d));
Object.entries(S.aiRosters||{}).forEach(([tn,r])=>(r||[]).forEach(d=>scan('aiRosters:'+tn,d)));
Object.entries(S.aiRosterDefs||{}).forEach(([tn,ids])=>(ids||[]).forEach(id=>scan('aiRosterDefs:'+tn,defOf(S,id))));
return JSON.stringify({dups,nameDups,hits,playerCount:S.players.length,errs},null,2);
`;
console.log(run(body));

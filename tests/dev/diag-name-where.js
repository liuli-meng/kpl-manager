// 查某个名字在 seed 跑完后的 def 注册位置
const vm = require('vm');
const fs = require('fs');
const { makeDom } = require('../harness');

const seed = parseInt((process.argv.find(a => a.startsWith('--seed=')) || '').split('=')[1], 10) || 2;
const target = (process.argv.find(a => a.startsWith('--name=')) || '').split('=')[1] || '叶昭';
const { dom } = makeDom();
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + seed + ')', dom);
const run = snippet => vm.runInContext('(function(){\n' + snippet + '\n})()', dom);

const fuzz = fs.readFileSync(require.resolve('../fuzz.js'), 'utf8');
const m = /const out = run\(`([\s\S]*?)`\);/.exec(fuzz);
let body = m[1];
const idx = body.lastIndexOf('return JSON.stringify(');
body = body.slice(0, idx) + `
const T=${JSON.stringify(target)};
const hits=[];
const scan=(label,d)=>{if(d&&d.name===T)hits.push({label,id:d.id,name:d.name});};
(S.extraDefs||[]).forEach(d=>scan('extraDefs',d));
(S.players||[]).forEach(d=>scan('players',d));
(S.market||[]).forEach(d=>scan('market',d));
(S.transferList||[]).forEach(d=>scan('transferList',d));
(S.freeAgents||[]).forEach(d=>scan('freeAgents',d));
(S.academy||[]).forEach(d=>scan('academy',d));
Object.entries(S.aiRosters||{}).forEach(([tn,r])=>(r||[]).forEach(d=>scan('aiRosters:'+tn,d)));
Object.entries(S.aiRosterDefs||{}).forEach(([tn,ids])=>(ids||[]).forEach(id=>scan('aiRosterDefs:'+tn,defOf(S,id))));
Object.entries(S.aiAcademy||{}).forEach(([tn,ids])=>(ids||[]).forEach(id=>scan('aiAcademy:'+tn,defOf(S,id))));
PLAYER_POOL.forEach(d=>scan('PLAYER_POOL',d));
FA_2026.forEach(d=>scan('FA_2026',d));
return JSON.stringify({hits, hasExtra:(S.extraDefs||[]).filter(d=>d&&d.name===T).map(d=>d.id)});
`;
const res = JSON.parse(run(body));
console.log(JSON.stringify(res, null, 2));

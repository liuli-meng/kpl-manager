// 回归测试：历史上修过的所有 bug 用例，防止复发
// 运行：node tests/verify-regression.js
const { makeDom, makeTester } = require('./harness');

const { dom } = makeDom();
// 每个 snippet 以 return 结尾，返回值直接暴露给 Node 侧断言
const run = snippet => require('vm').runInContext('(function(){\n' + snippet + '\n})()', dom);
const T = makeTester('回归测试');

// ① 替补身价 NaN（newSeason 对未上场选手）
const r1 = run(`
S=newState('T1','⚔️');
const _u1=new Set();
['top','jg','mid','ad','sup'].forEach(pos=>S.players.push(genPlayer(genFreeAgentDef(pos,'mid',_u1))));
const bench=genPlayer(genFreeAgentDef('jg','mid',new Set()));
S.players.push(bench);S.lineup=S.players.slice(0,5).map(p=>p.id);
S.coach={...COACH_POOL.find(c=>c.id==='co12')};S.seedPower=400;initGroups(S);
S.phase='champion';newSeason(S);
return S.players.find(p=>p.id===bench.id).val;
`);
T.check(!isNaN(r1) && r1>=70 && r1<=150, '替补身价 NaN: r1=' + r1);

// ② 总决赛亚军分润只发一次
const r2 = run(`
S=newState('T2','⚔️');
const _u2=new Set();
['top','jg','mid','ad','sup'].forEach(pos=>S.players.push(genPlayer(genFreeAgentDef(pos,'mid',_u2))));
S.lineup=S.players.map(p=>p.id);
S.coach={...COACH_POOL.find(c=>c.id==='co12')};S.seedPower=400;initGroups(S);
const ais=AI_TEAMS.filter(t=>t.name!==S.teamName);
const X=ais[0].name,Y=ais[1].name,A2=ais[2].name,A3=ais[3].name,A4=ais[4].name,A5=ais[5].name,A6=ais[6].name;
S.playoff={wb:[{a:S.teamName,b:A2,r:S.teamName},{a:X,b:A3,r:X}],lb:[{a:A4,b:A5,r:A4},{a:A6,b:Y,r:Y}],
  lb2:[{a:X,b:A4,r:X},{a:Y,b:A6,r:Y}],lb3:[{a:A2,b:X,r:X},{b:Y,a:A3,r:Y}],
  wf:{a:S.teamName,b:X,r:S.teamName},lb4:{a:X,b:Y,r:Y},lbf:{a:X,b:Y,r:Y},final:{a:S.teamName,b:Y,r:null},champ:null};
S.phase='playoff';S.fund=0;
S.series={stage:'po',poSlot:'总决赛',poMatch:S.playoff.final,mw:2,ow:4,logs:[],opName:Y,myName:S.teamName,max:7};
finishSeries(false);
return S.eventLog.filter(e=>e.txt.includes('联盟分润（亚军）')).length;
`);
T.check(r2 === 1, '总决赛亚军分润发了 ' + r2 + ' 次（应 1 次）');

// ③ 联盟页季后赛对阵含败者组决赛
const r3 = run(`
S=newState('T3','⚔️');
const _u3=new Set();
['top','jg','mid','ad','sup'].forEach(pos=>S.players.push(genPlayer(genFreeAgentDef(pos,'mid',_u3))));
S.lineup=S.players.map(p=>p.id);
S.coach={...COACH_POOL.find(c=>c.id==='co12')};S.seedPower=400;initGroups(S);
S.phase='playoff';
S.playoff={wb:[{a:'A',b:'B',r:'A'}],lb:[{a:'C',b:'D',r:'C'}],lb2:[{a:'E',b:'C',r:'C'}],lb3:[{a:'B',b:'C',r:'C'}],
  wf:{a:'A',b:'B',r:'A'},lb4:{a:'B',b:'C',r:'C'},lbf:{a:'A',b:'C',r:'C'},final:{a:'A',b:'C',r:null},champ:null};
renderLeague();
return document.querySelector('#page-league').innerHTML;
`);
T.check(/败者组半决赛/.test(r3) && /败者组决赛/.test(r3), '联盟页对阵缺败者组决赛/半决赛标签');

// ④ 事件属性/士气封顶
const r4 = run(`
S=newState('T4','⚔️');
const p=genPlayer(genFreeAgentDef('top','star',new Set()));
p.attrs.lane=98;p.attrs.team=98;p.morale=98;
S.players.push(p);S.lineup=[p.id];S.coach=null;
const jia=EVENTS.find(e=>e.t==='选手加练'),zhuan=EVENTS.find(e=>e.t==='战术研讨'),lao=EVENTS.find(e=>e.t==='老将觉醒');
for(let i=0;i<30;i++){jia.fn(S,p);zhuan.fn(S,p);lao.fn(S,p);}
return JSON.stringify([p.attrs.lane,p.attrs.team,p.morale]);
`);
T.check(r4 === '[99,99,100]', '事件封顶异常: ' + r4);

// ⑤ 招牌英雄无错位
const r5 = run(`return PLAYER_POOL.concat(FA_2026).filter(d=>{const h=heroOf(d.sig);return !h||!h.pos.includes(d.pos);}).map(d=>d.name);`);
T.check(r5.length === 0, '招牌错位: ' + r5.join(','));

// ⑥ AI 补强：无幽灵签约 + 缺位必补
const r6 = run(`
S=newState('T6','⚔️');
const _u6=new Set();
['top','jg','mid','ad','sup'].forEach(pos=>S.players.push(genPlayer(genFreeAgentDef(pos,'mid',_u6))));
S.lineup=S.players.map(p=>p.id);
S.coach={...COACH_POOL.find(c=>c.id==='co12')};S.seedPower=400;initGroups(S);
const yn=genPlayer(PLAYER_POOL.find(d=>d.id==='ad1'));
S.players.push(yn);aiDetachDef(S,'ad1');
for(let k=0;k<2;k++)newSeason(S);
const map=aiRosterDefMap(S);
const ghost=Object.keys(map).filter(tn=>map[tn].includes('ad1'));
const bad=[];
Object.keys(map).forEach(tn=>{
  if(tn===S.teamName)return;
  if(map[tn].length!==5)bad.push(tn+':'+map[tn].length);
  const poss=map[tn].map(id=>{const d=defOf(S,id);return d?d.pos:'?';});
  if(poss.includes('?'))bad.push(tn+':未知def');
});
return JSON.stringify({ghost, bad});
`);
T.check(r6 === '{"ghost":[],"bad":[]}', 'AI补强异常: ' + r6);

// ⑦ 租借全流程
const r7 = run(`
S=newState('T7','⚔️');
const _u7=new Set();
['top','jg','mid','ad','sup'].forEach(pos=>S.players.push(genPlayer(genFreeAgentDef(pos,'mid',_u7))));
S.lineup=S.players.map(p=>p.id);
S.coach={...COACH_POOL.find(c=>c.id==='co12')};S.seedPower=400;initGroups(S);
S.transferWindow=0;S.fund=5000;
const t7=loanCandidates(S)[0];
const fund0=S.fund;
loanPlayer(S,t7.from,t7.p.id);
const lp7=S.players.find(p=>p.id===t7.p.id);
const rent=fund0-S.fund;
const cleared=!Object.values(S.aiRosters).some(r=>r.some(x=>x.id===t7.p.id));
for(let i=0;i<21;i++)nextDay(S);
return JSON.stringify({rent, loaned:!!lp7.loan, cleared, returned:!S.players.some(p=>p.loan)});
`);
{
  const r = JSON.parse(r7);
  T.check(r.rent > 0 && r.loaned && r.cleared, '租借流程异常: ' + r7);
  T.check(r.returned, '租借 21 天后未归队');
}

// ⑧ 跨队零重名（多赛季极端压力）
const r8 = run(`
S=newState('T8','⚔️');
const _u8=new Set();
['top','jg','mid','ad','sup'].forEach(pos=>S.players.push(genPlayer(genFreeAgentDef(pos,'mid',_u8))));
S.lineup=S.players.map(p=>p.id);
S.coach={...COACH_POOL.find(c=>c.id==='co12')};S.seedPower=400;initGroups(S);
S.retiredDefs=PLAYER_POOL.map(d=>d.id);
newSeason(S);
const names=[];
(S.leagueTeams||[]).forEach(n=>{
  if(n===S.teamName)return;
  (ensureAiRosters(S,n)||[]).forEach(p=>names.push(p.name));
});
S.players.forEach(p=>names.push(p.name));
return names.filter((n,i)=>names.indexOf(n)!==i);
`);
T.check(r8.length === 0, '跨队重名: ' + r8.slice(0,6).join(','));

// ⑨ 伤停暂停可恢复
const r9 = run(`
S=newState('T9','⚔️');
const _u9=new Set();
['top','jg','mid','ad','sup'].forEach(pos=>S.players.push(genPlayer(genFreeAgentDef(pos,'mid',_u9))));
S.lineup=S.players.map(p=>p.id);
S.coach={...COACH_POOL.find(c=>c.id==='co12')};S.seedPower=400;initGroups(S);
S.preseason=false;S.transferWindow=0;
S.players.forEach(p=>{p.injury=4;});
startMatch();autoPlayNext();
const paused=!!S.series;
let d=0;while(d<8&&rosterLineup(S).some(p=>p.injury>0)){nextDay(S);d++;}
if(S.series){let g=0;while(S.series&&g++<12)autoPlayNext();}
return JSON.stringify({paused, done:S.series===null, progressed:S.matchIdx>0});
`);
T.check(r9 === '{"paused":true,"done":true,"progressed":true}', '伤停暂停/恢复异常: ' + r9);

T.report();

// 赛制旋钮层（KPL_FORMAT / fmtOf）回归：默认值必须等于历史写死值，时代覆盖必须真的生效
// 这层是"按年代切换赛制"的地基：2017 年没有全局 BP、早年转会期不是 7 天，都只能从这里开关。
// 运行：node tests/verify-era-format.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=t=>res.push('[PASS] '+t);
  const _ra=renderAll,_sv=save;renderAll=function(){};save=function(){};

  // ① 默认值 = 抽表前写死的值（任何一项漂了，就等于悄悄改了现行赛制）
  const d=fmtOf({});
  const want={globalBp:true,peakBoMin:7,transferDays:7};
  const drift=Object.keys(want).filter(k=>d[k]!==want[k]);
  if(drift.length)fail('① 默认旋钮漂移: '+drift.map(k=>k+'='+d[k]+' 应为 '+want[k]).join(', '));
  else ok('① 默认口径：globalBp='+d.globalBp+' peakBoMin='+d.peakBoMin+' transferDays='+d.transferDays);

  // ② 时代覆盖通路：installEra(带 rules 的时代) → fmtOf 读到覆盖值；installEra(null) 还原
  KPL_ERAS.__test={name:'测试时代',year:'2099',desc:'',rules:{globalBp:false,transferDays:3},
   defs:[],fa:[],coaches:[],bonds:{},teams:[{name:'测试队',icon:'测',power:400}],
   rosters:{'测试队':{p:[],u:[]}},clubs:[{name:'测试队',icon:'测',budget:1300,cap:150,coach:'co12',players:[]}]};
  installEra('__test');
  const s1=newState('覆盖队','x');
  const f1=fmtOf(s1);
  installEra(null);
  const s2=newState('还原队','x');
  const f2=fmtOf(s2);
  delete KPL_ERAS.__test;
  if(f1.globalBp!==false||f1.transferDays!==3)fail('② 时代 rules 未生效: '+JSON.stringify(f1));
  else if(f2.globalBp!==true||f2.transferDays!==7)fail('② 还原现行口径失败: '+JSON.stringify(f2));
  else ok('② 覆盖通路：时代档 '+JSON.stringify(f1)+' → 还原 '+JSON.stringify(f2));

  // ③ 行为：关掉全局 BP 后，applyBp 不再累积跨局已用（下游 used 判定自然退化为"每局独立 BAN/PICK"）
  S=newState('无全局BP队','x');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);S.seedPower=400;initGroups(S);
  S._fmt={globalBp:false,peakBoMin:7,transferDays:7};
  S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,oppPicks:{},side:'blue',myName:S.teamName,opName:'对手'};
  const pick={top:HEROES[0].n,jg:HEROES[1].n,mid:HEROES[2].n,ad:HEROES[3].n,sup:HEROES[4].n};
  applyBp(pick);
  if((S.series.used||[]).length)fail('③ 关闭全局 BP 却仍累积已用: '+S.series.used.join(','));
  else ok('③ globalBp=false：applyBp 后 series.used 仍为空（每局独立）');
  // 对照：开着全局 BP 时必须累积，否则这条守卫就是假绿
  S._fmt={globalBp:true,peakBoMin:7,transferDays:7};
  S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,oppPicks:{},side:'blue',myName:S.teamName,opName:'对手'};
  applyBp(pick);
  if((S.series.used||[]).length!==5)fail('③ 开启全局 BP 未累积 5 个已用: '+(S.series.used||[]).length);
  else ok('③ globalBp=true：series.used 累积 5 个（对照成立）');

  renderAll=_ra;save=_sv;
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join('\\n');
})()
`, dom);

console.log(out);

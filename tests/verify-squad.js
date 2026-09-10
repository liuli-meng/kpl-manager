// 更衣室系统回归：出场统计 / 板凳不满与要求离队 / 队长加成与摘除 / 转会端联动 / 成就
// 运行：node tests/verify-squad.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const mkS=()=>{S=newState('更衣室队','x');fillRoster(S,'mid','star');
   // 补两名替补（与现有位置重复，天然坐板凳）；名字查重必须带上已有队员，否则会撞名
   for(let i=0;i<2;i++){
    const u=new Set(S.players.map(p=>p.name));
    const b=genPlayer(genFreeAgentDef(pick(POS_ORDER),'mid',u));b.apps=0;S.players.push(b);
   }
   return S;};

  // ① 出场统计真的挂在 finishSeries 上（系列赛收尾即 +1；后续收尾链在桩环境可能报错，不影响本断言）
  const s1=mkS();s1.phase='r1';s1.matchIdx=0;s1.streak=0;
  s1.schedule=[{a:s1.teamName,b:'AG豪门',r:null,myScore:0,opScore:0}];
  s1.tables={S:{}};s1.tables.S[s1.teamName]={w:0,l:0,pts:0,pw:0};s1.tables.S['AG豪门']={w:0,l:0,pts:0,pw:0};
  s1.series={used:[],mw:3,ow:1,max:5,stage:'regular',logs:[],myName:s1.teamName,opName:'AG豪门',side:'blue'};
  const apps0=s1.players.map(p=>p.apps||0);
  try{finishSeries(true);}catch(_){}
  const apps1=s1.players.map(p=>p.apps||0);
  const bumped=apps1.filter((v,i)=>v===apps0[i]+1).length;
  if(bumped!==5)fail('系列赛收尾未给首发记出场: '+bumped+'/5');
  else log('① 出场统计：系列赛收尾后 5 名首发 apps 全部 +1');

  // ② 板凳不满：战力够高 + 出场差距大 → 扣士气/意愿；意愿≤25 → 要求离队
  const s2=mkS();
  const bench=s2.players.find(p=>!s2.lineup.includes(p.id));
  s2.players.forEach(p=>{if(s2.lineup.includes(p.id))p.apps=5;});
  bench.apps=0;
  ['lane','farm','team','mind'].forEach(k=>bench.attrs[k]=88);
  bench.morale=70;bench.willingness=30;bench.retiring=false;
  const n2=dressingRoomCheck(s2);
  if(n2<1)fail('高战力坐穿板凳却无人不满');
  else if(bench.morale!==64)fail('不满未扣士气: '+bench.morale);
  else if(!bench.transferRequest)fail('意愿跌到 '+bench.willingness+' 却未要求离队');
  else log('② 更衣室：战力 '+Math.round(overall(bench))+' 的替补坐穿板凳 → 士气 70→'+bench.morale+' · 意愿 30→'+bench.willingness+' · 公开要求离队');

  // ③ 不该抱怨的人：战力不足 / 即将退役 / 样本不足
  const s3=mkS();
  const weak=s3.players.find(p=>!s3.lineup.includes(p.id));
  ['lane','farm','team','mind'].forEach(k=>weak.attrs[k]=50); // 战力 <74
  s3.players.forEach(p=>{if(s3.lineup.includes(p.id))p.apps=5;});weak.apps=0;
  const old=s3.players.find(p=>!s3.lineup.includes(p.id)&&p!==weak);
  ['lane','farm','team','mind'].forEach(k=>old.attrs[k]=88);old.retiring=true;old.apps=0;
  const n3=dressingRoomCheck(s3);
  if(n3!==0)fail('低战力/即将退役的替补不该抱怨: '+n3);
  else if(weak.transferRequest||old.transferRequest)fail('不该标记要求离队');
  else log('③ 豁免：战力不足与即将退役的替补不触发不满');

  // ④ 队长：任命提升士气、在首发阵中才有战力加成、离队自动摘袖标
  const s4=mkS();
  const cap=s4.players.find(p=>s4.lineup.includes(p.id));
  const m0=s4.players.map(p=>p.morale);
  setCaptain(cap.id);
  const m1=s4.players.map(p=>p.morale);
  if(!m1.some((v,i)=>v===m0[i]+3)||m1[s4.players.indexOf(cap)]!==m0[s4.players.indexOf(cap)]+5)fail('任命队长士气激励错误');
  else log('④ 队长任命：全队士气 +3 · 队长本人 +5');
  s4.players.forEach(p=>p.morale=80);s4.streak=0;
  const withCap=teamPower(s4);
  s4.captain=null;
  const noCap=teamPower(s4);
  if(Math.abs(withCap-noCap*1.02)>1)fail('队长战力加成不是 +2%: '+noCap+'→'+withCap);
  else log('④ 队长加成：在阵时战力 '+noCap+'→'+withCap+'（+2%）');
  s4.captain=cap.id;s4.players=s4.players.filter(p=>p!==cap);s4.lineup=s4.lineup.filter(id=>id!==cap.id);
  dressingRoomCheck(s4);
  if(s4.captain!==null)fail('队长离队后袖标未自动摘除');
  else log('④ 队长离队 → 袖标自动摘除并提示重新任命');

  // ⑤ 转会端联动：要求离队 → 买断费八五折、强挖成功率上升、要价降低、意愿显示 -30
  const s5=mkS();
  const t5=s5.players[0];t5.willingness=50;t5.wage=50;
  const pNormal=buyoutPrice(t5),rNormal=raidChance(t5),wNormal=negoWageDemand(t5);
  t5.transferRequest=true;
  const pReq=buyoutPrice(t5),rReq=raidChance(t5),wReq=negoWageDemand(t5);
  if(Math.abs(pReq-pNormal*0.85)>1)fail('要求离队未打折: '+pNormal+'→'+pReq);
  else if(!(rReq>rNormal))fail('要求离队未提升强挖成功率: '+rNormal+'→'+rReq);
  else if(!(wReq<wNormal))fail('要求离队未降低要价: '+wNormal+'→'+wReq);
  else log('⑤ 转会联动：买断费 '+pNormal+'→'+pReq+'（八五折）· 强挖成功率 '+(rNormal*100).toFixed(0)+'%→'+(rReq*100).toFixed(0)+'% · 要价 '+wNormal+'→'+wReq);

  // ⑥ 成就：袖标荣耀 / 更衣室和睦
  const s6=mkS();s6.captain=s6.lineup[0];s6.honors=[{season:1,title:'x',champion:true}];checkAchievements(s6);
  if(!s6.achieved.cap_title)fail('队长任内夺冠未解锁 cap_title');
  else log('⑥ 成就：队长任内夺冠 →「袖标荣耀」');
  const s6b=mkS();
  {const u=new Set(s6b.players.map(p=>p.name));const b=genPlayer(genFreeAgentDef(pick(POS_ORDER),'mid',u));b.apps=0;s6b.players.push(b);} // 凑满 8 人门槛
  s6b.players.forEach(p=>p.morale=90);checkAchievements(s6b);
  if(!s6b.achieved.squad_happy)fail('全队士气≥85 未解锁 squad_happy');
  else log('⑥ 成就：全队士气 ≥85 且无人要求离队 →「更衣室和睦」');
  const s6c=mkS();s6c.players[0].transferRequest=true;s6c.players.forEach(p=>p.morale=90);checkAchievements(s6c);
  if(s6c.achieved.squad_happy)fail('有人要求离队却解锁了和睦成就');
  else log('⑥ 成就：有人要求离队 → 不解锁「更衣室和睦」（防误发）');

  // ⑦ 面板：选手卡显示出场次数与队长标记，阵容页有任命按钮
  const s7=mkS();s7.players.forEach(p=>p.apps=3);s7.captain=s7.lineup[0];
  goPage('lineup');renderLineup();
  const html=document.querySelector('#page-lineup').innerHTML;
  if(!html.includes('出场 3 次'))fail('选手卡未显示出场次数');
  else if(!html.includes('>队长<'))fail('队长标记未显示');
  else if(!html.includes("setCaptain("))fail('阵容页没有任命队长入口');
  else log('⑦ 面板：选手卡显示「出场 3 次」与队长标记，阵容页可任命/摘除');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);

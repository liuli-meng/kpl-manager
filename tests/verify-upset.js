// 以下克上：强敌判定 / 士气涨粉 / upsetBoost / 成就 / 赛段清零
// 运行：node tests/verify-upset.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const mkS=()=>{S=newState('爆冷队','x');fillRoster(S,'low','mid');S.fans=10;return S;};

  // ① 对阵弱队/平手不触发
  const s1=mkS();
  const p1=s1.players[0];
  const r1=maybeUpsetWin(s1,true,'常山UUG'); // UUG 很弱
  if(r1||s1.upsetCount)fail('打弱队不应触发以下克上');
  else log('① 打弱队：不触发');

  // ② 对阵强队（AG 战力远高）触发
  const s2=mkS();
  // 把我方压到很低，确保 AG 高出 ≥15%
  s2.players.forEach(p=>{['lane','farm','team','mind'].forEach(k=>p.attrs[k]=50);});
  const my0=teamPower(s2);
  const op=powerOf(s2,'成都AG超玩会');
  const should=op>=my0*1.15;
  const r2=maybeUpsetWin(s2,true,'成都AG超玩会');
  if(!should)log('② 跳过：AG 未高出 15%（my='+Math.round(my0)+' op='+Math.round(op)+'）');
  else if(!r2)fail('击败 AG 应触发，my='+Math.round(my0)+' op='+Math.round(op));
  else if(s2.upsetCount!==1)fail('upsetCount 应为 1');
  else if(s2.upsetBoost!==3)fail('upsetBoost 应为 3，实际 '+s2.upsetBoost);
  else if(s2.fans<=10)fail('应涨粉，fans='+s2.fans);
  else if(!s2.players.some(p=>p.morale>80))fail('首发士气应上升');
  else if((s2.achieved||{}).upset==null&&typeof checkAchievements==='function'){
    checkAchievements(s2);
    if((s2.achieved||{}).upset==null)fail('成就「以下克上」未解锁');
    else log('② 击败 AG：触发 + 成就解锁，boost='+s2.upsetBoost+' 粉丝='+s2.fans);
  }
  else log('② 击败 AG：触发 upsetCount=1 boost=3 粉丝='+s2.fans);

  // ③ 失败不触发
  const s3=mkS();
  s3.players.forEach(p=>{['lane','farm','team','mind'].forEach(k=>p.attrs[k]=50);});
  const r3=maybeUpsetWin(s3,false,'成都AG超玩会');
  if(r3||s3.upsetCount)fail('输球不应触发');
  else log('③ 输球：不触发');

  // ④ 叠加封顶 9%
  const s4=mkS();
  s4.players.forEach(p=>{['lane','farm','team','mind'].forEach(k=>p.attrs[k]=50);});
  for(let i=0;i<5;i++)maybeUpsetWin(s4,true,'成都AG超玩会');
  if(s4.upsetBoost!==9)fail('upsetBoost 应封顶 9，实际 '+s4.upsetBoost);
  else log('④ 五连胜强队：boost 封顶 9%');

  // ⑤ teamPower 吃到加成
  {
    const s=mkS();
    const a=teamPower(s);
    s.upsetBoost=6;
    const b=teamPower(s);
    if(!(b>a))fail('upsetBoost 应抬高战力 '+a+'→'+b);
    else log('⑤ teamPower：+6% 爆冷加成生效 '+a+'→'+b);
  }

  // ⑥ startSplit 清零
  {
    const s=mkS();
    s.upsetBoost=6;s.streak=4;
    try{startSplit(s,'spring');}catch(e){/* 沙箱可能缺部分依赖，只看字段 */}
    if(s.upsetBoost!==0)fail('startSplit 应清零 upsetBoost，实际 '+s.upsetBoost);
    else log('⑥ startSplit：upsetBoost 已清零');
  }

  // ⑦ 旧档迁移
  {
    const s=mkS();
    delete s.upsetBoost;delete s.upsetCount;delete s.fumbleBoost;delete s.fumbleCount;
    try{migrateSave();}catch(e){fail('migrate 异常: '+e.message);}
    if(S.upsetBoost!=0||S.upsetCount!=0||S.fumbleBoost!=0||S.fumbleCount!=0)fail('迁移应补 0/0/0/0');
    else log('⑦ 旧档迁移：upset/fumble 字段兜底 0');
  }

  // ⑧ 阴沟翻船：强队输给弱旅
  {
    const s=mkS();
    s.players.forEach(p=>{['lane','farm','team','mind'].forEach(k=>p.attrs[k]=90);});
    s.fans=20;
    powerOf(s,'常山UUG'); // 先建 AI 阵容
    s.aiPower['常山UUG']=220; // 压到明显更弱，保证高出 ≥15%
    const my=teamPower(s),op=powerOf(s,'常山UUG');
    if(my<op*1.15)log('⑧ 跳过：仍未高出 15%（my='+Math.round(my)+' op='+Math.round(op)+'）');
    else{
      const r=maybeUpsetLoss(s,false,'常山UUG');
      if(!r)fail('强队输弱旅应触发阴沟翻船');
      else if(s.fumbleCount!==1||s.fumbleBoost!==-2)fail('fumble 应 1/-2，实际 '+s.fumbleCount+'/'+s.fumbleBoost);
      else if(s.fans>=20)fail('应掉粉，fans='+s.fans);
      else if(!s.players.some(p=>p.morale<90))fail('士气应下降');
      else log('⑧ 阴沟翻船：fumbleBoost=-2 粉丝='+s.fans);
    }
  }

  // ⑨ 强队赢弱旅 / 弱队输强队：都不触发翻船
  {
    const s=mkS();
    s.players.forEach(p=>{['lane','farm','team','mind'].forEach(k=>p.attrs[k]=90);});
    powerOf(s,'常山UUG');s.aiPower['常山UUG']=220;
    maybeUpsetLoss(s,true,'常山UUG'); // 赢了
    const s2=mkS();
    s2.players.forEach(p=>{['lane','farm','team','mind'].forEach(k=>p.attrs[k]=50);});
    maybeUpsetLoss(s2,false,'成都AG超玩会'); // 弱队正常输强队
    if(s.fumbleCount||s2.fumbleCount)fail('不该触发翻船');
    else log('⑨ 强胜弱 / 弱负强：均不触发翻船');
  }

  // ⑩ 翻船封顶 -6 且 teamPower 下降
  {
    const s=mkS();
    s.players.forEach(p=>{['lane','farm','team','mind'].forEach(k=>p.attrs[k]=90);});
    powerOf(s,'常山UUG');s.aiPower['常山UUG']=220;
    const a=teamPower(s);
    for(let i=0;i<5;i++)maybeUpsetLoss(s,false,'常山UUG');
    const b=teamPower(s);
    if(s.fumbleBoost!==-6)fail('fumbleBoost 应封顶 -6，实际 '+s.fumbleBoost);
    else if(!(b<a))fail('翻船后战力应下降 '+a+'→'+b);
    else log('⑩ 翻船叠加：封顶 -6%，战力 '+a+'→'+b);
  }

  // ⑪ startSplit 清零 fumble
  {
    const s=mkS();
    s.fumbleBoost=-4;s.upsetBoost=3;
    try{startSplit(s,'summer');}catch(e){}
    if(s.fumbleBoost!==0||s.upsetBoost!==0)fail('startSplit 应清零双向加成');
    else log('⑪ startSplit：upset/fumble 均清零');
  }

  return {ok:!hadFail,lines:res};
})()
`,dom);

(out.lines||[]).forEach(l=>console.log(l));
if(!out.ok){console.error('以下克上验证失败');process.exit(1);}
console.log('以下克上验证通过');

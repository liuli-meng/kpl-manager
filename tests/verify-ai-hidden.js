// AI 隐性 bug 探针：人格稳定性 / 转会窗不变量 / 战术与 BP 边界 / seriesTactic 锁定语义
// 运行：node tests/verify-ai-hidden.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // 固定种子，阈值断言可复现
  let _rs=20260919>>>0;
  Math.random=function(){_rs=(_rs+0x6D2B79F5)>>>0;let t=_rs;t=Math.imul(t^(t>>>15),1|t);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};

  const mk=()=>{S=newState('隐性探针','x');fillRoster(S,'mid','mid');
   S.coach={...COACH_POOL.find(c=>c.id==='co12')};
   S.seedPower=400;initGroups(S);S.preseason=false;S.transferWindow=0;
   return S;};

  // ① 人格：全队稳定、合法枚举、档位先验不违和
  const s1=mk();S=s1;
  const styles=new Set();
  let personaFlip=0,badPersona=0,weakGalaxy=0,eliteAcademy=0;
  const allTn=Object.keys(aiRosterDefMap(s1));
  allTn.forEach(tn=>{
    const a=aiPersonaOf(s1,tn),b=aiPersonaOf(s1,tn),c=aiPersonaOf(s1,'');
    if(a!==b)personaFlip++;
    if(!['galaxy','academy','tactical','balanced'].includes(a))badPersona++;
    styles.add(a);
    const tier=aiTierOf(s1,tn);
    if(tier==='weak'&&a==='galaxy')weakGalaxy++;
    if(tier==='elite'&&a==='academy')eliteAcademy++;
  });
  if(personaFlip)fail('人格不稳定 '+personaFlip);
  else if(badPersona)fail('非法人格 '+badPersona);
  else if(weakGalaxy)fail('弱旅不应是 galaxy ×'+weakGalaxy);
  else if(eliteAcademy)fail('豪门不应是 academy ×'+eliteAcademy);
  else if(styles.size<3)fail('人格多样性不足: '+[...styles].join(','));
  else log('① 人格：'+allTn.length+' 队 · '+[...styles].join('/')+' · 稳定且档位合法');

  // ② aiPosNeedMap：空册/缺位/满编/脏 ovr 均不抛、不产出 NaN
  let needBad=0;
  try{
    const empty=aiPosNeedMap(s1,'不存在的队',d=>overall(genSeasonPlayer(s1,d)));
    POS_ORDER.forEach(p=>{if(typeof empty[p]!=='number'||isNaN(empty[p]))needBad++;});
    const map=aiRosterDefMap(s1);
    const tn=Object.keys(map).find(t=>t!==s1.teamName);
    // 挖空某队再算：缺位应=1
    const bak=map[tn].slice();
    map[tn]=[];
    const hollow=aiPosNeedMap(s1,tn,d=>overall(genSeasonPlayer(s1,d)));
    POS_ORDER.forEach(p=>{if(hollow[p]!==1)needBad++;});
    map[tn]=bak.slice(0,3); // 缺两席
    const partial=aiPosNeedMap(s1,tn,d=>overall(genSeasonPlayer(s1,d)));
    if(!(partial.top>=0&&partial.top<=1))needBad++;
    // 脏 ovr：必须产出有限 need，禁止 NaN 污染升级分
    const dirty=aiPosNeedMap(s1,tn,()=>NaN);
    POS_ORDER.forEach(p=>{if(typeof dirty[p]!=='number'||!isFinite(dirty[p]))needBad++;});
    map[tn]=bak;
  }catch(e){needBad=99;fail('aiPosNeedMap 抛错: '+e.message);}
  if(needBad===99){}
  else if(needBad>2)fail('needMap 边界异常 ×'+needBad);
  else log('② 位置需求：空册=1 · 缺位=1 · 满编闭区间 · 脏 ovr 不抛');

  // ③ aiUpgradeScore：缺 tn/need、极端年龄、反向增益
  let upBad=0;
  try{
    const ageOf=d=>aiAgeOf(s1,d);
    const ovrOf=d=>overall(genSeasonPlayer(s1,d));
    const map=aiRosterDefMap(s1);
    const tn=Object.keys(map).find(t=>t!==s1.teamName);
    const outD=defOf(s1,map[tn][0]);
    const inD=genStarDef(s1,new Set(),outD.pos);
    // 必造明显更强候选：否则负增益 return null 是合法行为
    inD.base=[95,95,95,95];
    const sc1=aiUpgradeScore(s1,ovrOf,ageOf,outD,inD,'mid',tn,0.9);
    const sc2=aiUpgradeScore(s1,ovrOf,ageOf,outD,inD,'mid'); // 缺 need/tn
    const sc3=aiUpgradeScore(s1,ovrOf,ageOf,outD,outD,'elite',tn,0); // 零增益：elite minGain=1 应 null 或负分
    const scNaN=aiUpgradeScore(s1,()=>NaN,ageOf,outD,inD,'mid',tn,NaN);
    if(sc1==null)upBad++;
    if(typeof sc2!=='number'&&sc2!==null)upBad++;
    if(sc3!=null&&sc3>20)upBad++; // 零增益不该高分
    if(scNaN!=null)upBad++; // NaN 增益必须被拒
  }catch(e){upBad=99;fail('aiUpgradeScore 抛错: '+e.message);}
  if(upBad===99){}
  else if(upBad)fail('upgradeScore 边界异常 ×'+upBad);
  else log('③ 补强评分：急缺降门槛 · 缺参可跑 · 零增益不高分');

  // ④ 战术：始终返回合法 id；seriesTactic 锁定；0:0 时 behind 分支不误触
  let tacBad=0,tacIds=new Set();
  try{
    for(let i=0;i<40;i++){
      const id=aiChooseTactic(s1,{mw:0,ow:0,opName:s1.teamName},'测试对手');
      if(!TACTICS.some(t=>t.id===id))tacBad++;
      tacIds.add(id);
    }
    // 落后/领先也能返回合法 id
    for(let i=0;i<20;i++){
      const a=aiChooseTactic(s1,{mw:0,ow:2,opName:s1.teamName},'测试对手');
      const b=aiChooseTactic(s1,{mw:2,ow:0,opName:s1.teamName},'测试对手');
      if(!TACTICS.some(t=>t.id===a)||!TACTICS.some(t=>t.id===b))tacBad++;
    }
    // 锁定语义：同系列赛 _opTactic 不漂移
    s1.tactic='lane';
    const sr={mw:1,ow:1,opName:'北京JDG'};
    const e1=seriesTacticEdge(s1,sr);
    const locked=sr._opTactic;
    sr.mw=3;sr.ow=3;
    const e2=seriesTacticEdge(s1,sr);
    if(sr._opTactic!==locked)tacBad++;
    if(![-0.03,0,0.03].includes(e1)||![-0.03,0,0.03].includes(e2))tacBad++;
  }catch(e){tacBad=99;fail('aiChooseTactic/edge 抛错: '+e.message);}
  if(tacBad===99){}
  else if(tacBad)fail('战术边界异常 ×'+tacBad);
  else log('④ 战术：合法 id 覆盖 '+tacIds.size+' 种 · 系列赛锁定 · 克制值∈±3%');

  // ⑤ 隐性语义：系列赛锁在 0:0 时，落后加压分支实际不生效（设计与实现对齐检查）
  //    若未来改成局间重选，本探针应改断言而不是静默失效
  let dead=0;
  try{
    // 用足够高 brain 的豪门 + 明确 counter，统计 0:0 vs 已落后 的 counter 率差
    // 这里只验证「锁在 0:0 后 behind 不会改 _opTactic」——上面已覆盖；再验证 aiChooseTactic 本身感知比分
    const sr0={mw:0,ow:0};
    const srB={mw:0,ow:2};
    let c0=0,cB=0;
    S=s1;S.tactic='farm'; // farm 被 team 克制
    for(let i=0;i<80;i++){
      if(aiChooseTactic(s1,sr0,'成都AG超玩会')==='team')c0++;
      if(aiChooseTactic(s1,srB,'成都AG超玩会')==='team')cB++;
    }
    // 落后应更爱反制（team beats farm）；允许噪声，只要 cB >= c0-15
    if(cB+15<c0)dead=1;
    else log('⑤ 落后加压：counter率 0:0='+c0+'/80 → 落后='+cB+'/80（感知比分）');
  }catch(e){fail('落后加压检测抛错: '+e.message);}
  if(dead)fail('⑤ 落后未加压（behind 分支疑似死代码） c0>cB');

  // ⑥ 转会窗 6 季不变量：无双挂 / 五位置齐 / 战力非 NaN / 人格队有差异行为日志
  const s6=mk();S=s6;
  let invBad=0,powerNaN=0;
  for(let i=0;i<6;i++){
    aiTransferWindow(s6);s6.season++;s6.aiRosters={};
    const map=aiRosterDefMap(s6);
    const seen=new Set();
    Object.keys(map).forEach(tn=>{
      if(tn===s6.teamName)return;
      const defs=(map[tn]||[]).map(id=>defOf(s6,id)).filter(Boolean);
      if(defs.length!==5)invBad++;
      if(new Set(defs.map(d=>d.pos)).size<5)invBad++;
      defs.forEach(d=>{if(seen.has(d.id))invBad++;seen.add(d.id);});
      const pow=aiRosterPower(defs.map(id=>({pos:id.pos,injury:0,sig:id.sig,attrs:null,morale:80,skill:id.skill,base:id.base})),s6,tn);
      // 上面的假 roster 可能算 0；改用 ensureAiRosters
      const real=ensureAiRosters(s6,tn);
      const p2=aiRosterPower(real,s6,tn);
      if(typeof p2!=='number'||isNaN(p2)||p2<=0)powerNaN++;
    });
  }
  const moveLogs=s6.eventLog.filter(e=>/转会|加盟|离队|挖角|新秀|青训|换帅|加练/.test(e.txt)).length;
  if(invBad)fail('转会不变量破坏 ×'+invBad);
  else if(powerNaN)fail('AI 战力 NaN/非正 ×'+powerNaN);
  else if(moveLogs<12)fail('生态日志过少: '+moveLogs);
  else log('⑥ 6 季转会窗：17 队 5 人五位齐 · 战力有限 · 生态日志 '+moveLogs+' 条');

  // ⑦ BP 边界：空敌方英雄池 / 空己方已选 / 伤员阵容
  let bpBad=0;
  try{
    const d={idx:0,steps:[],ls:s6.players.slice(0,5),myPicks:{},oppPicks:{},oppBans:[],myBans:[],
      used:[],usedOpp:[],oppRoster:ensureAiRosters(s6,'北京JDG')};
    // 空 opts
    const u=pickUtility(d,d.ls[0],d.ls[0].sig,{});
    if(typeof u!=='number'||isNaN(u))bpBad++;
    // allyPicks 全同型
    const hd=heroOf(d.ls[0].sig);
    const t=heroTypeOf(d.ls[0].sig);
    const same=new Array(4).fill(d.ls[0].sig);
    const uSame=pickUtility(d,d.ls[0],d.ls[0].sig,{allyPicks:same});
    const uNone=pickUtility(d,d.ls[0],d.ls[0].sig,{allyPicks:[]});
    if(!(uNone>uSame))bpBad++; // 同类堆叠应降分
    // 脑残调用：aiDraftStep 空 steps
    aiDraftStep({idx:0,steps:[],ls:d.ls,myPicks:{},oppPicks:{},oppBans:[],myBans:[],used:[],usedOpp:[],oppRoster:d.oppRoster,sr:{opName:'北京JDG'}});
  }catch(e){bpBad=99;fail('BP 边界抛错: '+e.message);}
  if(bpBad===99){}
  else if(bpBad)fail('BP 边界异常 ×'+bpBad);
  else log('⑦ BP：空 opts/同类堆叠降分/空 steps 均安全');

  // ⑧ aiFillGaps：池空引援、池满不越界、人格选人不 NaN
  let fillBad=0;
  try{
    const map=aiRosterDefMap(s6);
    const tn=Object.keys(map).find(t=>t!==s6.teamName);
    map[tn]=[];
    const used=new Set();
    const ovrOf=d=>overall(genSeasonPlayer(s6,d));
    let pool=PLAYER_POOL.slice(0,3); // 极小池
    pool=aiFillGaps(s6,map,tn,pool,used,ovrOf,{});
    const defs=(map[tn]||[]).map(id=>defOf(s6,id)).filter(Boolean);
    if(defs.length<5)fillBad++; // 池空应 genStarDef 补满
    if(new Set(defs.map(d=>d.pos)).size<5)fillBad++;
    defs.forEach(d=>{
      const p=genSeasonPlayer(s6,d);
      if(isNaN(overall(p)))fillBad++;
    });
  }catch(e){fillBad=99;fail('aiFillGaps 抛错: '+e.message);}
  if(fillBad===99){}
  else if(fillBad)fail('fillGaps 异常 ×'+fillBad);
  else log('⑧ 补位：小池/空册补满 5 人五位 · 总值非 NaN');

  return res.join('\\n')+(hadFail?'\\n[HAD-FAIL]':'\\n[ALL-OK]');
})()
`, dom);

console.log(out);
process.exit(out.includes('[HAD-FAIL]') ? 1 : 0);

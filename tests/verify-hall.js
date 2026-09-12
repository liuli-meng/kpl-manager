// 荣誉馆 + 战绩分享图 + AI 难度分层回归
// 运行：node tests/verify-hall.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 荣誉馆页面骨架：三种身份都能渲染
  S=newState('荣誉馆队','⚔️');fillRoster(S,'star','star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  initGroups(S);S.transferWindow=0;S.preseason=false;
  // 灌入荣誉数据
  S.honors=[{season:1,title:'2026 春季赛 总冠军',champion:true,roster:'甲、乙、丙、丁、戊'},
            {season:1,title:'2026 春季赛 亚军',champion:false}];
  S.titleHistory=[{season:1,split:'spring',event:'春季赛',champ:'荣誉馆队'},
                  {season:1,split:'summer',event:'夏季赛',champ:'荣誉馆队'},
                  {season:1,split:'spring',event:'挑战者杯',champ:'别家'}];
  S.fmvpHonor=[{year:2026,event:'春季赛',name:'甲',team:'荣誉馆队'}];
  S.awards=[{season:1,first:[{pos:'top',name:'甲',team:'荣誉馆队',ovr:90}],
             second:[{pos:'jg',name:'乙',team:'荣誉馆队',ovr:85}]}];
  renderHall();
  const hall=document.querySelector('#page-hall').innerHTML||'';
  ['荣誉馆','本队荣誉墙','王朝纪录','历届冠军','FMVP','赛季最佳阵容'].forEach(t=>{
    if(!hall.includes(t))fail('荣誉馆缺区块: '+t);
  });
  if(!hall.includes('shareHonorCard'))fail('荣誉馆缺少分享图入口');
  if(!hall.includes('甲'))fail('荣誉/阵容内容未渲染');
  log('① 荣誉馆：荣誉墙/王朝/历届冠军/FMVP/最佳阵容五区块 + 分享入口');

  // ② 王朝段抽取：两连冠成段，单冠不成段
  const runs=hallDynastyRuns(S);
  if(runs.length!==1||runs[0].team!=='荣誉馆队'||runs[0].n!==2)fail('王朝段抽取错误: '+JSON.stringify(runs));
  else log('② 王朝段：春+夏两连冠 → 1 段王朝（挑战者杯冠军不同队不计入）');

  // ③ 分享图：canvas 桩可生成不抛错；无 getContext 时静默 toast
  let shareErr='';
  try{shareHonorCard();}catch(e){shareErr=e.message;}
  if(shareErr)fail('分享图生成异常: '+shareErr);
  else log('③ 战绩分享图：shareHonorCard 不抛错（沙箱 canvas 桩下走失败/成功均可）');

  // ④ AI 难度分层：豪门 mul > 中游 > 弱旅；连冠加压
  const s4=newState('难度队','⚔️');fillRoster(s4,'mid');
  s4.coach={...COACH_POOL.find(c=>c.id==='co12')};
  s4.lineup=s4.players.map(p=>p.id);s4.seedPower=teamPower(s4);
  initGroups(s4);
  const elite=aiTierOf(s4,'成都AG超玩会'); // seed 640
  const weak=aiTierOf(s4,'常山UUG'); // 弱旅
  if(elite!=='elite')fail('AG 应为 elite，实为 '+elite);
  else if(weak!=='weak')fail('UUG 应为 weak，实为 '+weak);
  const mE=aiDiffMul(s4,'成都AG超玩会'),mW=aiDiffMul(s4,'常山UUG');
  if(!(mE>mW))fail('豪门难度系数应高于弱旅: '+mE+' vs '+mW);
  s4.titleHistory=[{season:1,split:'spring',event:'春季赛',champ:'难度队'},
                   {season:1,split:'summer',event:'夏季赛',champ:'难度队'}];
  const mPress=aiDiffMul(s4,'成都AG超玩会');
  if(!(mPress>mE))fail('玩家连冠后 AI 难度应加压: '+mE+' → '+mPress);
  log('④ AI 难度：AG=elite('+mE+') · UUG=weak('+mW+') · 玩家两连冠后豪门系数 → '+mPress.toFixed(2));

  // ⑤ 三身份 MODE_PAGES 含 hall
  if(!MODE_PAGES.manager.includes('hall')||!MODE_PAGES.player.includes('hall')||!MODE_PAGES.coach.includes('hall'))
    fail('MODE_PAGES 未为三种身份开放荣誉馆');
  else log('⑤ 导航：manager/player/coach 均含 hall 页签');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);

// Phase4 纯函数单元测试：clamp / winChance / overall / wageOf / valueOf /
// boardKpiTarget / singleGame 形状与胜负对齐 / pickedHero / tacticWeights 兜底 / playerPower 基础
// 运行：node tests/verify-pure.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=t=>res.push('[PASS] '+t);

  // ① clamp：夹取与边界
  if(clamp(5,1,10)!==5)fail('clamp 中值未原样返回: '+clamp(5,1,10));
  else if(clamp(-1,1,10)!==1)fail('clamp 下界失效: '+clamp(-1,1,10));
  else if(clamp(99,1,10)!==10)fail('clamp 上界失效: '+clamp(99,1,10));
  else if(clamp(1,1,10)!==1||clamp(10,1,10)!==10)fail('clamp 端点未命中');
  else ok('① clamp 夹取与端点');

  // ② winChance：对称、等强 0.5、单调
  const wEq=winChance(500,500);
  const wHi=winChance(600,400), wLo=winChance(400,600);
  if(Math.abs(wEq-0.5)>1e-9)fail('等强 winChance≠0.5: '+wEq);
  else if(!(wHi>0.5&&wLo<0.5))fail('强弱方向反了: hi='+wHi+' lo='+wLo);
  else if(Math.abs(wHi+wLo-1)>1e-9)fail('winChance 不对称: '+wHi+'+'+wLo);
  else if(!(winChance(700,400)>wHi))fail('winChance 不随战力差单调');
  else ok('② winChance 对称/等强0.5/单调');

  // ③ overall：加权落在属性范围内、空属性回落 70
  const pMid={pos:'mid',attrs:{lane:80,farm:80,team:80,mind:80}};
  const oMid=overall(pMid);
  if(oMid!==80)fail('overall 四维 80 未得 80: '+oMid);
  else{
    const oEmpty=overall({pos:'top',attrs:{}});
    if(oEmpty!==70)fail('overall 空属性未回落 70: '+oEmpty);
    else{
      const oN=overall(null);
      if(!(oN>=69&&oN<=71))fail('overall(null) 异常: '+oN);
      else ok('③ overall 加权与空属性回落');
    }
  }

  // ④ wageOf / valueOf：单调且夹在经济刻度内
  const w40=wageOf(40), w99=wageOf(99);
  if(!(w40>=ECON.playerWageMin&&w40<=ECON.playerWageMax))fail('wageOf(40) 越界: '+w40);
  else if(!(w99>=ECON.playerWageMin&&w99<=ECON.playerWageMax))fail('wageOf(99) 越界: '+w99);
  else if(!(w99>w40))fail('wageOf 不随总值单调: 40→'+w40+' 99→'+w99);
  else if(!(valueOf(99)>valueOf(40)))fail('valueOf 不随总值单调');
  else if(valueOf(40)<0||valueOf(99)>ECON.transferCap)fail('valueOf 越过转会封顶');
  else ok('④ wageOf/valueOf 单调且在经济刻度内（w40='+w40+' w99='+w99+'）');

  // ⑤ boardKpiTarget：按上年名次 5/10/14（中档校准，不苛求必夺冠）；首年按分组
  const t1=boardKpiTarget(2,{teamName:'A',groups:{}});
  const t2=boardKpiTarget(6,{teamName:'A',groups:{}});
  const t3=boardKpiTarget(14,{teamName:'A',groups:{}});
  if(t1!==5||t2!==10||t3!==14)fail('boardKpiTarget 名次映射错: '+[t1,t2,t3].join('/'));
  else{
    const sG1={teamName:'AG',groups:{G1:['AG']}};
    const sG2={teamName:'X',groups:{G2:['X']}};
    const sB={teamName:'Y',groups:{G3:['Y']}};
    if(boardKpiTarget(null,sG1)!==5)fail('G1 首年目标应为 5');
    else if(boardKpiTarget(null,sG2)!==10)fail('G2 首年目标应为 10');
    else if(boardKpiTarget(null,sB)!==14)fail('G3 首年目标应为 14');
    else ok('⑤ boardKpiTarget 名次 5/10/14 + 首年分组');
  }

  // ⑥ singleGame 形状 + 胜方击杀更多 + 击杀/经济夹取
  let shapeOk=true, alignOk=true, clampOk=true, n=0, wins=0;
  for(let i=0;i<80;i++){
    const g=singleGame(520,480);
    n++;
    if(g.w)wins++;
    if(!(typeof g.w==='boolean'&&typeof g.myK==='number'&&typeof g.opK==='number'
      &&typeof g.gold==='number'&&typeof g.pWin==='number'&&Array.isArray(g.evs)))shapeOk=false;
    if(g.w&&!(g.myK>g.opK))alignOk=false;
    if(!g.w&&!(g.opK>g.myK))alignOk=false;
    if(g.myK<3||g.myK>28||g.opK<3||g.opK>28)clampOk=false;
    if(Math.abs(g.gold)>14)clampOk=false;
  }
  if(!shapeOk)fail('singleGame 返回形状不完整');
  else if(!alignOk)fail('singleGame 胜方击杀未严格更多');
  else if(!clampOk)fail('singleGame 击杀/经济未夹取');
  else if(wins<n*0.3||wins>n*0.9)fail('singleGame 胜率异常（520vs480）: '+wins+'/'+n);
  else ok('⑥ singleGame 形状/胜方击杀对齐/夹取（胜 '+wins+'/'+n+'）');

  // ⑦ pickedHero：BP 选了用 BP，否则招牌
  const ph={pos:'mid',sig:'不知火舞'};
  const sPick={pick:{mid:'上官婉儿'}};
  if(pickedHero(sPick,ph)!=='上官婉儿')fail('pickedHero 未优先 BP 选择');
  else if(pickedHero({pick:{}},ph)!=='不知火舞')fail('pickedHero 未回落招牌');
  else if(pickedHero({},ph)!=='不知火舞')fail('pickedHero 无 pick 未回落招牌');
  else ok('⑦ pickedHero BP 优先 / 招牌回落');

  // ⑧ tacticWeights：空对象/缺字段回落 BASE_W（防 NaN）
  S=undefined;
  const w0=tacticWeights();
  if(Math.abs(w0.lane+w0.farm+w0.team+w0.mind-1)>1e-9)fail('tacticWeights 默认权重和≠1');
  else{
    S={tacticW:{}};
    const wEmpty=tacticWeights();
    if(typeof wEmpty.lane!=='number'||!isFinite(wEmpty.lane))fail('空 tacticW 未回落 BASE_W');
    else{
      S={tacticW:{lane:0.42,farm:0.18,team:0.25,mind:0.15}};
      const wSet=tacticWeights();
      if(wSet.lane!==0.42)fail('有效 tacticW 未生效');
      else ok('⑧ tacticWeights 空对象回落 / 有效权重生效');
    }
  }

  // ⑨ playerPower：null→0；伤停/低体力打折
  if(playerPower(null)!==0)fail('playerPower(null)≠0');
  else{
    const base={pos:'mid',attrs:{lane:80,farm:80,team:80,mind:80},energy:100,injury:0};
    S={};
    const p0=playerPower(base);
    const pInj=playerPower({...base,injury:3});
    const pTired=playerPower({...base,energy:20});
    if(!(p0>0))fail('playerPower 基础值非正: '+p0);
    else if(!(pInj<p0))fail('伤停未打折: '+pInj+' vs '+p0);
    else if(!(pTired<p0))fail('低体力未打折: '+pTired+' vs '+p0);
    else ok('⑨ playerPower null→0 · 伤停/低体力打折（'+p0+'→伤'+pInj+'/疲'+pTired+'）');
  }

  // ⑩ DebugPanel：默认关闭、API 齐全、show/hide 不抛错
  if(typeof DebugPanel==='undefined')fail('DebugPanel 未加载');
  else if(typeof DebugPanel.show!=='function'||typeof DebugPanel.hide!=='function'||typeof DebugPanel.toggle!=='function')fail('DebugPanel API 不齐');
  else if(DebugPanel.isOn())fail('DebugPanel 默认不应开启');
  else{
    try{
      DebugPanel.show();
      const onAfterShow=DebugPanel.isOn();
      DebugPanel.hide();
      const onAfterHide=DebugPanel.isOn();
      if(!onAfterShow)fail('DebugPanel.show 后 isOn 仍 false');
      else if(onAfterHide)fail('DebugPanel.hide 后 isOn 仍 true');
      else ok('⑩ DebugPanel 默认关 · show/hide 切换正常');
    }catch(e){fail('DebugPanel show/hide 抛错: '+e.message);}
  }

  return res.join('\\n')+(hadFail?'\\n[FAIL]':'\\n[PASS]');
})()
`, dom);

console.log(out);
if (String(out).includes('[FAIL]')) process.exit(1);

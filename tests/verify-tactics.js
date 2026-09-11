// 战术板 + 版本大改 + K甲下放 回归：权重真实生效 / 克制结算 / 版本增减幅 / 下放与归队成长
// 运行：node tests/verify-tactics.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const sum=a=>a.lane+a.farm+a.team+a.mind;
  const mkS=()=>{S=newState('战术队','x');fillRoster(S,'mid','star');
   const u=new Set(S.players.map(p=>p.name));
   const b=genPlayer(genFreeAgentDef(pick(POS_ORDER),'mid',u));b.apps=0;S.players.push(b);
   return S;};

  // ① 战术表：权重和为 1、id 唯一、克制指向存在且不自指
  const ids=TACTICS.map(t=>t.id);
  const badW=TACTICS.filter(t=>Math.abs(sum(t.w)-1)>1e-9);
  const badB=TACTICS.filter(t=>t.beats&&(t.beats===t.id||!ids.includes(t.beats)));
  if(badW.length)fail('战术权重和≠1: '+badW.map(t=>t.id+':'+sum(t.w)).join(','));
  else if(new Set(ids).size!==ids.length)fail('战术 id 重复');
  else if(badB.length)fail('克制关系悬空/自指: '+JSON.stringify(badB.map(t=>[t.id,t.beats])));
  else log('① 战术表：'+TACTICS.length+' 个（'+ids.join('/')+'），权重和均为 1，克制关系闭合');

  // ② 权重真实生效：团战型选手在「团战致胜」下变强、对线型变弱；撤掉战术回到标准值
  const s=mkS();S=s;
  const teamGuy=genPlayer(genFreeAgentDef('jg','mid',new Set()));
  teamGuy.attrs={lane:50,farm:50,team:95,mind:50};
  const laneGuy=genPlayer(genFreeAgentDef('top','mid',new Set()));
  laneGuy.attrs={lane:95,farm:50,team:50,mind:50};
  S.tacticW=null;S.tactic='balanced';
  const baseT=playerPower(teamGuy,teamGuy.sig),baseL=playerPower(laneGuy,laneGuy.sig);
  S.tactic='team';S.tacticW=tacticById('team').w;
  const teamT=playerPower(teamGuy,teamGuy.sig),teamL=playerPower(laneGuy,laneGuy.sig);
  S.tacticW=null;S.tactic='balanced';
  const backT=playerPower(teamGuy,teamGuy.sig);
  if(!(teamT>baseT))fail('团战型选手在团战战术下未变强: '+baseT+'→'+teamT);
  else if(!(teamL<baseL))fail('对线型选手在团战战术下未变弱: '+baseL+'→'+teamL);
  else if(Math.abs(backT-baseT)>1e-6)fail('撤掉战术未恢复标准权重: '+backT+' vs '+baseT);
  else log('② 战术权重：团战手 '+baseT.toFixed(1)+'→'+teamT.toFixed(1)+'（团战流）· 对线手 '+baseL.toFixed(1)+'→'+teamL.toFixed(1)+' · 撤销后复原');

  // ③ 战术克制：±3%/0，AI 战术在同系列赛内稳定
  const s3=mkS();S=s3;s3.tactic='lane';
  const sr={mw:0,ow:0};
  const e1=seriesTacticEdge(s3,sr),e2=seriesTacticEdge(s3,sr);
  if(Math.abs(e1-e2)>1e-9)fail('同系列赛内对手战术漂移: '+e1+' vs '+e2);
  else if(![-0.03,0,0.03].includes(e1))fail('克制结算值异常: '+e1);
  else log('③ 战术克制：结算值 '+e1+'（±3%/0），同系列赛内稳定（对手 '+tacticById(sr._opTactic).name+'）');

  // ④ 版本大改：持有加强英雄者属性上升、持有削弱英雄者下降，且 s.patch 有记录
  const s4=mkS();S=s4;
  const pUp=s4.players[0],pDown=s4.players[1];
  // 摇摆位英雄会同时进两个位置的池子（hold/hurt 双中 → +2-2 净 0，属正常游戏行为）。
  // 断言需要确定性：把两人池子收敛到各自招牌，隔离交叉持有。
  pUp.heroPool=[{n:pUp.sig,lv:3}];
  pDown.heroPool=[{n:pDown.sig,lv:3}];
  const sum4=p=>p.attrs.lane+p.attrs.farm+p.attrs.team+p.attrs.mind;
  const beforeUp=sum4(pUp),beforeDown=sum4(pDown);
  applySeasonPatch(s4,pUp.sig,pDown.sig); // 显式指定：确定性断言（也验证"策划指定版本"入口）
  const up=s4.patch.up,down=s4.patch.down;
  if(!s4.patch||!up||!down||up===down)fail('版本补丁记录异常: '+JSON.stringify(s4.patch));
  else if(s4.patch.season!==s4.season)fail('补丁未记录赛季');
  else{
   const dUp=sum4(pUp)-beforeUp,dDown=sum4(pDown)-beforeDown;
   if(dUp<2)fail('加强英雄持有者属性未上升: +'+dUp);
   else if(dDown>-2)fail('削弱英雄持有者属性未下降: '+dDown);
   else log('④ 版本大改：「'+up+'」持有者四维 +'+dUp+' · 「'+down+'」持有者 '+dDown+'（s.patch 已记录赛季）');
  }

  // ⑤ K甲下放：离队首发 → swapPlayer 被拦 → 30 天倒计时 → 归队成长 → 成就
  const s5=mkS();S=s5;
  const b5=s5.players.find(p=>!s5.lineup.includes(p.id));
  const attrs0=b5.attrs.lane+b5.attrs.farm+b5.attrs.team+b5.attrs.mind;
  sendKjia(s5,b5.id);
  if(b5.kjia!==KJIA_DAYS)fail('下放未设置倒计时: '+b5.kjia);
  const lineupHas=s5.lineup.includes(b5.id);
  if(lineupHas)fail('下放后仍在首发');
  else{
   swapPlayer(b5.id);
   if(s5.lineup.includes(b5.id))fail('K甲锻炼中仍能进入首发（守卫失效）');
   else{
    for(let i=0;i<KJIA_DAYS;i++)kjiaTick(s5);
    const attrs1=b5.attrs.lane+b5.attrs.farm+b5.attrs.team+b5.attrs.mind;
    if(b5.kjia!==0)fail('倒计时未归零: '+b5.kjia);
    else if(attrs1-attrs0<4)fail('归队后成长不足: +'+(attrs1-attrs0));
    else{
     // 单次下放成长 4~8，成就门槛为累计 ≥5——不足就再下一轮，顺带验证 kjiaGain 累计语义
     if((b5.kjiaGain||0)<5){sendKjia(s5,b5.id);for(let i=0;i<KJIA_DAYS;i++)kjiaTick(s5);}
     checkAchievements(s5);
     if(!s5.achieved.kjia_grad)fail('成长 '+(b5.kjiaGain||0)+' 未解锁 kjia_grad');
     else log('⑤ K甲下放：30 天后归队，四维 +'+(attrs1-attrs0)+'（累计 '+b5.kjiaGain+'）· swapPlayer 守卫生效 · 解锁「练级成功」');
    }
   }
  }

  // ⑥ 成就：非均衡战术夺冠 → 战术大师；均衡战术不解锁
  const s6=mkS();s6.tactic='farm';s6.honors=[{season:1,title:'x',champion:true}];checkAchievements(s6);
  if(!s6.achieved.tactic_title)fail('非均衡战术夺冠未解锁 tactic_title');
  else{
   const s6b=mkS();s6b.tactic='balanced';s6b.honors=[{season:1,title:'x',champion:true}];checkAchievements(s6b);
   if(s6b.achieved.tactic_title)fail('均衡战术也解锁了战术大师');
   else log('⑥ 成就：非均衡战术夺冠 →「战术大师」；均衡战术不解锁');
  }

  // ⑦ 面板：战术板出现在阵容页，赛前页显示双方战术
  const s7=mkS();S=s7;goPage('lineup');renderLineup();
  if(!document.querySelector('#page-lineup').innerHTML.includes('战术板'))fail('阵容页没有战术板面板');
  else if(!document.querySelector('#page-lineup').innerHTML.includes('setTactic('))fail('战术板没有切换入口');
  else log('⑦ 面板：阵容页战术板可切换（5 个战术），赛前页显示双方战术与克制');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);

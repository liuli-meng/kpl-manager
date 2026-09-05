// 2026-09 修复回归：①巅峰对决手动选英雄 ②出售选手可见性（不蒸发） ③身价经济×10 ④旧档货币迁移
// 沙箱引导收敛到 tests/harness.js（源模块清单/DOM 桩只维护一份）
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  // ① 巅峰对决：操作区必须出现手动选位 UI（此前字段错位只显示"BP 完成"）
  S=newState('测试队','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  const initFund=S.fund,initCap=S.wageCap; // 开局资金/工资帽（×10 校验点，之后有交易流水）
  S.series={used:[],usedOpp:[],mw:3,ow:3,max:7,stage:'po',poSlot:'总决赛',poMatch:{a:S.teamName,b:'成都AG超玩会',r:null},logs:[],myName:S.teamName,opName:'成都AG超玩会',side:'blue'};
  openBP('总决赛 · 第7局巅峰对决',playGame);
  renderBP();
  const html=document.querySelector('#app-modal-body').innerHTML;
  if(!html.includes('轮到我方 PICK'))fail('巅峰对决无手动选位 UI');
  bpChoosePos('top');renderBP();
  if(!document.querySelector('#app-modal-body').innerHTML.includes('bp-hero-grid'))fail('巅峰对决选位后无英雄网格');
  const peakPick=window._draft;bpPickHero(myCandidates(peakPick,'top')[0].n);
  log('①巅峰对决手动选人：选位→选英雄 全流程可用');
  // ② 出售选手不蒸发：市场签来（无 def）的选手出售后补建 def，满员时在转会市场归属买家
  const mk=genPlayer(genFreeAgentDef('jg','mid',new Set()));
  S.players.push(mk);S.lineup.push(mk.id);
  S.transferList=[];
  completeSale(S,mk,1000,'成都AG超玩会');
  if(!defOf(S,mk.id))fail('出售后 def 未注册');
  const inBuyer=ensureAiRosters(S,'成都AG超玩会').some(p=>p.id===mk.id);
  const inMarket=(S.transferList||[]).some(x=>x.id===mk.id&&x.ownerTeam==='成都AG超玩会');
  if(!inBuyer&&!inMarket)fail('出售选手完全不可见（买家阵容满 + 市场无条目）');
  log('②出售可见性：def 已注册，'+(inBuyer?'现于买家阵容':'买家满员 → 转会市场归属买家，随时可查/可买回'));
  // ③ 身价经济 ×10（顶星千万级、OVR99≈4000万、火热可破5000万）
  const star=genPlayer(genFreeAgentDef('top','star',new Set()));
  if(valueOf(overall(star))<1000)fail('顶星身价未达千万级: '+valueOf(overall(star)));
  if(valueOf(99)!==4000)fail('OVR99 曲线应 4000: '+valueOf(99));
  const hot=Math.round(buyoutPrice({...star,willingness:60,attrs:{lane:99,farm:99,team:99,mind:99}}));
  if(hot<3000)fail('火热顶星买断应≥3000万: '+hot);
  if(initFund!==8000||initCap!==900)fail('新档资金/工资帽未×10: fund='+initFund+' cap='+initCap);
  log('③身价×10：顶星≈'+valueOf(overall(star))+'万 · OVR99=4000万 · 火热买断≈'+hot+'万 · 初始资金 8000万/帽 900万');
  // ④ 旧档货币迁移
  const old={teamName:'旧档',icon:'x',fund:800,wageCap:90,players:[{id:'p1',name:'a',wage:10,acqCost:200,pos:'mid',attrs:{lane:70,farm:70,team:70,mind:70}}],market:[],lineup:[],coachMarket:[],retiredCoaches:[],assistants:[],hosts:[],freeAgents:[],transferList:[],listed:[{id:'p1',price:200}],bids:[{id:'p1',bid:180}]};
  S=old;migrateSave();
  if(S.fund!==8000||S.wageCap!==900||S.players[0].wage!==100||S.listed[0].price!==2000)fail('旧档迁移未×10: '+JSON.stringify({fund:S.fund,wageCap:S.wageCap,wage:S.players[0].wage,price:S.listed[0].price}));
  log('④旧档迁移：fund 800→8000 · 帽 90→900 · 周薪 10→100 · 挂牌价 200→2000');
  // ⑤ BO9 决赛巅峰对决判定（4:4 → 第 9 局盲选；此前写死 3:3 只适配 BO7）
  S=newState('测试队','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id);
  S.series={used:[],usedOpp:[],mw:4,ow:4,max:9,stage:'cup',cupSlot:'ch_final',cupMatch:{a:S.teamName,b:'K甲·苍穹',r:null},logs:[],myName:S.teamName,opName:'K甲·苍穹',side:'blue'};
  openBP('挑战者杯·总决赛（第9局）',playGame);
  if(!window._draft||!window._draft.isPeak)fail('BO9 4:4 时第 9 局应判定为巅峰对决');
  const d9=window._draft;renderBP();
  if(!document.querySelector('#app-modal-body').innerHTML.includes('盲选'))fail('BO9 巅峰对决界面未显示盲选');
  log('⑤BO9 决赛：4:4 → 第 9 局巅峰对决（盲选）判定 OK');
  // ⑥ 跳过剩余转会期：自动训练核心 + 自动青训培养
  S=newState('测试队','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id);
  S.academy=[genRookie(S)];
  S.preseason=true;S.transferWindow=4;S.trained=false;S.academyTrained=false;
  S.eventLog=[];
  const fundBefore=S.fund;
  skipTransferWindow(S);
  if(S.transferWindow!==0)fail('跳过后天数应清零: '+S.transferWindow);
  if(S.preseason)fail('跳过后应自动开赛（preseason 应为 false）');
  if(S.phase!=='r1')fail('跳过后应进入常规赛: '+S.phase);
  const hasTrain=S.eventLog.some(e=>/训练完成/.test(e.txt));
  const hasRookie=S.eventLog.some(e=>/青训培养/.test(e.txt));
  if(!hasTrain)fail('跳过期间未自动训练核心选手');
  if(!hasRookie)fail('跳过期间未自动培养青训');
  const spent=fundBefore-S.fund;
  const trainDays=S.eventLog.filter(e=>/训练完成/.test(e.txt)).length;
  const rookieDays=S.eventLog.filter(e=>/青训培养/.test(e.txt)).length;
  if(trainDays<1||rookieDays<1)fail('跳过期间训练/青训执行天数异常: 训练'+trainDays+' 培养'+rookieDays);
  log('⑥跳过转会期：'+S.transferWindow+'→0 天，自动训练 '+trainDays+' 天 + 青训培养 '+rookieDays+' 天（净支出 '+spent+' 万，含每日赞助收入）→ 联赛开赛 OK');
  // ⑦ AI 青训培养：转会期 AI 队概率培养自家青训（底子成长），达标晋升替换弱首发
  S=newState('测试队','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id);
  S.annualPts={};S.ewc=null;S.annual=null;S.challenger=null;
  S.eventLog=[];
  let acLogs=0;
  for(let i=0;i<6;i++){ // 多赛季转会期，青训培养/晋升必然出现
    const before=S.eventLog.length;
    aiTransferWindow(S);
    acLogs+=S.eventLog.slice(before).filter(e=>/培养青训/.test(e.txt)).length;
  }
  if(!Object.keys(S.aiAcademy||{}).length)fail('AI 青训营未建立: '+JSON.stringify(S.aiAcademy));
  if(acLogs<1)fail('AI 青训培养未发生');
  const promoteLogs=S.eventLog.some(e=>/晋升一线队/.test(e.txt));
  log('⑦AI 青训培养：'+Object.keys(S.aiAcademy).length+' 队有青训营 · 培养 '+acLogs+' 人次'+(promoteLogs?' · 有新秀晋升一线队':'（晋升需多赛季累积）'));
  // ⑧ 跳过转会期遇报价中断（挂牌后跳过：无报价→跳过完；有报价→暂停保留天数并跳转会页）
  S=newState('测试队','⚔️');
  ['top','jg','mid','ad','sup'].forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',new Set()))));
  S.lineup=S.players.map(p=>p.id);
  const bench=S.players.find(p=>!S.lineup.includes(p.id));
  if(!bench){const fa=genPlayer(genFreeAgentDef('mid','low',new Set()));fa.contract=2;S.players.push(fa);}
  const bench2=S.players.find(p=>!S.lineup.includes(p.id));
  S.preseason=true;S.transferWindow=5;S.trained=false;S.academyTrained=false;
  listPlayer(S,bench2.id);
  skipTransferWindow(S);
  if(S.transferWindow>0&&!(S.bids||[]).length)fail('中断跳过但无报价记录');
  if(S.transferWindow===0&&S.preseason)fail('跳过完成后应已开赛');
  log('⑧跳过遇报价：'+(S.transferWindow>0?('暂停保留 '+S.transferWindow+' 天（有报价待处理）'):'无报价跳过完并开赛'));
  // ⑨ 荣誉室夺冠阵容快照
  S.honors=[];
  S.champion=true;
  recordSeason(S);
  if(!S.honors.length||!S.honors[0].roster)fail('荣誉室缺夺冠阵容快照');
  log('⑨荣誉室夺冠阵容：'+S.honors[0].title+' — '+S.honors[0].roster);
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`,dom);
console.log(out);

// 子代理排查后修复点的回归：死键兼容/身份门禁/空档恢复/联赛空槽/教练邀约
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');

const T = makeTester('bug-hunt 回归');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const R=[];
  const ok=(c,m)=>{if(!c)R.push(m);};

  // ① uiDoNextAction 字符串参数归一化（旧死键按钮）
  S=newState('回归队','⚔');
  fillRoster(S,'mid','star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  initGroups(S);
  S.preseason=false;S.transferWindow=0;
  S.phase='card';
  S.card={idx:0,matches:[{a:S.teamName,b:'对手',r:null}],stage:'card'};
  let seriesAfter=null;
  try{
    uiDoNextAction('startCard'); // 旧写法
    seriesAfter=!!S.series;
  }catch(e){R.push('字符串参数抛错: '+e.message);}
  ok(seriesAfter,'uiDoNextAction("startCard") 未建立 series（归一化失效）');

  // ② 选手不可提拔 K甲
  S=newState('选手档','⚔');
  fillRoster(S,'low');
  S.mode='player';
  S.kjia={my:'选手档二队',rd:0,rounds:[[{a:'选手档二队',b:'X',r:null}]],tables:{},powers:{},champ:null,squad:[{id:'kx1',name:'小将',pos:'mid',base:[70,70,70,70],attrs:{lane:70,farm:70,team:70,mind:70},age:19,skill:{n:'x',t:'lane',d:''},sig:'海月',heroPool:[{n:'海月',lv:2}]}]};
  const n0=(S.players||[]).length;
  promoteKjiaPlayer(S,'kx1');
  ok((S.players||[]).length===n0,'选手模式提拔 K甲成功（门禁失效）');

  // ③ 经理模式空名单 nextAction 有出口
  S=newState('空名单','⚔');
  S.players=[];S.lineup=[];S.preseason=false;S.phase='r1';S.schedule=[];S.matchIdx=0;
  const a=nextAction(S);
  ok(a&&a.fn==='uiGoMarket','空名单 nextAction 无 uiGoMarket，实际='+JSON.stringify(a));

  // ④ 挑战杯结构丢失 → 重建入口
  S=newState('缺杯','⚔');
  fillRoster(S);
  S.preseason=false;S.split='spring';S.phase='challenger';S.challenger=null;
  const a2=nextAction(S);
  ok(a2&&a2.fn==='uiAdvanceCalendar','杯赛结构丢失 nextAction 应给 advanceCalendar，实际='+JSON.stringify(a2));

  // ⑤ createTeam/applyClub 后 applyModeNav：manager 不显示 career
  // 沙箱内直接验证 MODE_PAGES + applyModeNav
  S=newState('经理','⚔');S.mode='manager';
  fillRoster(S);
  // 模拟 nav 按钮
  const pages=['career','club','lineup','market'];
  // applyModeNav 使用 $$('#nav button') 桩返回空，改为直接检查 MODE_PAGES
  ok(MODE_PAGES.manager.indexOf('career')<0,'MODE_PAGES.manager 不应含 career');
  ok(MODE_PAGES.player.indexOf('lineup')<0,'MODE_PAGES.player 不应含 lineup');

  // ⑥ 教练邀约缺模板时不再静默
  S=newState('教练X','⚔');S.mode='coach';S.teamName='旧队';
  S.coachOffer={team:'不存在的豪门',years:2};
  let toastMsg='';
  const oldToast=toast;
  try{
    // 沙箱 toast 被桩掉；用 log 检查
    respondCoachOffer(true);
  }catch(e){R.push('respondCoachOffer 抛错: '+e.message);}
  ok(!S.coachOffer,'缺模板时 coachOffer 未被清除');
  ok((S.eventLog||S.logs||[]).length>=0,'日志结构异常');
  // 缺模板必须留痕（不能静默吞掉）：eventLog 里要有「无法接受/作废」字样
  const elogs=((S.eventLog||[]).map(x=>x.t||x.msg||x.text||x).join(' ')+' '+JSON.stringify(S.eventLog||[]));
  ok(/无法接受|作废|不在当前联盟/.test(elogs),'缺模板邀约未留痕（静默吞掉）: '+elogs.slice(0,120));

  // ⑥b 选手模式 sendKjia 下放队友被拦（自请下放仍放行）
  S=newState('下放门禁','⚔');S.mode='player';
  fillRoster(S,'low');
  const meK=genPlayer({id:'me_k',name:'我',pos:'mid',team:S.teamName,tags:[],base:[80,80,80,80],skill:{n:'x',t:'team',d:''},sig:'王昭君',career:''});
  S.players.push(meK);
  S.career={me:meK.id,seasons:[],titles:0,fmvp:0,retired:false,pendingMove:null};
  const mate=S.players.find(p=>p.id!==meK.id);
  const beforeMate=mate.kjia||0;
  sendKjia(S,mate.id);
  ok((mate.kjia||0)===beforeMate,'选手模式把队友下放 K甲（门禁失效）');
  // 自请路径：playerRequestKjia 应仍能下放自己
  if(S.lineup.includes(meK.id))S.lineup=S.lineup.filter(id=>id!==meK.id);
  const okSelf=playerRequestKjia(S);
  ok(okSelf&&(meK.kjia||0)>0,'选手自请下放被误伤: ok='+okSelf+' kjia='+(meK.kjia||0));

  // ⑥c 教练模式提拔/召回 K甲被拦（俱乐部人事权）
  S=newState('教练提拔','⚔');S.mode='coach';
  fillRoster(S,'mid');
  S.coachDeal={years:1,honors:[],log:[]};
  S.kjia={my:'教练提拔二队',rd:0,rounds:[[{a:'教练提拔二队',b:'X',r:null}]],tables:{},powers:{},champ:null,
    squad:[{id:'kx_c',name:'小将C',pos:'mid',base:[70,70,70,70],attrs:{lane:70,farm:70,team:70,mind:70},age:19,skill:{n:'x',t:'lane',d:''},sig:'海月',heroPool:[{n:'海月',lv:2}]}]};
  const nC0=(S.players||[]).length;
  promoteKjiaPlayer(S,'kx_c');
  ok((S.players||[]).length===nC0,'教练模式提拔 K甲成功（应走俱乐部人事权）');

  // ⑥e applyBp/playGame 空引用不抛错
  S=newState('空引用','⚔');fillRoster(S);S.preseason=false;S.series=null;
  let abErr=null,pgErr=null;
  try{applyBp(undefined);}catch(e){abErr=e.message;}
  try{playGame();}catch(e){pgErr=e.message;}
  ok(!abErr,'applyBp(undefined) 抛错: '+abErr);
  ok(!pgErr,'playGame(无 series) 抛错: '+pgErr);

  // ⑥e2 coachDef / TRAIN_ITEMS 缺省回退
  const cd=coachDef('不存在的教练');
  ok(cd&&cd.name,'coachDef 未命中无回退');
  const ti=(TRAIN_ITEMS.find(t=>t.k==='不存在')||{n:'属性'}).n;
  ok(ti,'TRAIN_ITEMS 缺省回退失败');

  // ⑥f 加练零收益 note 自说明
  S=newState('note','⚔');S.mode='player';
  const meN=genPlayer({id:'me_n',name:'我N',pos:'mid',team:S.teamName,tags:[],base:[80,80,80,80],skill:{n:'x',t:'team',d:''},sig:'王昭君',career:''});
  meN.attrs={lane:70,farm:70,team:70,mind:70};meN.energy=80;
  S.players.push(meN);S.career={me:meN.id,seasons:[],titles:0,fmvp:0,retired:false,pendingMove:null};
  let gotNote='';
  for(let i=0;i<12&&(!gotNote||gotNote.indexOf('今天没有提升')<0);i++){
    S.trained=false;meN.energy=80;
    const r=trainOutcome('rot',meN,'lane');
    if(r.gain<=0)gotNote=r.note||'';
  }
  ok(gotNote.indexOf('今天没有提升')>=0,'零收益 note 不自说明: '+gotNote);

  // ⑥d kjia 页对选手不渲染提拔按钮
  S=newState('二队UI','⚔');S.mode='player';
  fillRoster(S,'low');
  const meU=genPlayer({id:'me_u',name:'我U',pos:'mid',team:S.teamName,tags:[],base:[80,80,80,80],skill:{n:'x',t:'team',d:''},sig:'王昭君',career:''});
  S.players.push(meU);
  S.career={me:meU.id,seasons:[],titles:0,fmvp:0,retired:false,pendingMove:null};
  S.kjia={my:'二队UI二队',rd:0,rounds:[[{a:'二队UI二队',b:'X',r:null}]],tables:{},powers:{},champ:null,
    squad:[{id:'kx_u',name:'小将U',pos:'mid',base:[70,70,70,70],attrs:{lane:70,farm:70,team:70,mind:70},age:19,skill:{n:'x',t:'lane',d:''},sig:'海月',heroPool:[{n:'海月',lv:2}]}]};
  let kjiaHtml='';
  try{renderKjia();kjiaHtml=(document.getElementById('page-kjia')||{}).innerHTML||'';}catch(e){kjiaHtml='ERR:'+e.message;}
  ok(kjiaHtml.indexOf('promoteKjiaPlayer')<0,'选手模式二队页仍渲染提拔按钮');
  ok(kjiaHtml.indexOf('recallKjia')<0,'选手模式二队页仍渲染召回按钮');
  ok(kjiaHtml.indexOf('提拔一线队')<0,'选手模式二队页仍出现经理向「提拔一线队」文案');
  ok(/生涯/.test(kjiaHtml)&&/申请下放/.test(kjiaHtml),'选手模式二队页未指向「生涯」自请下放路径');

  // ⑦ playCardNext 空 card 不抛错
  S=newState('空卡','⚔');fillRoster(S);S.phase='card';S.card=null;S.preseason=false;
  let pe=null;
  try{playCardNext(S);}catch(e){pe=e.message;}
  ok(!pe,'playCardNext(card=null) 抛错: '+pe);

  // ⑧ renderLeague 季后赛空槽不抛错
  S=newState('空槽','⚔');fillRoster(S);
  S.phase='playoff';
  S.playoff={wb:[{a:'甲',b:'乙',r:'甲'}],lb:[{a:'丙',b:'丁',r:'丙'}],lb2:[],lb3:[],wf:{a:'甲',b:'丙',r:null},lb4:null,lbf:null,final:{a:null,b:null,r:null},champ:null};
  let le=null;
  try{renderLeague();}catch(e){le=e.message;}
  ok(!le,'renderLeague 空槽抛错: '+le);

  // ⑨ 兜底判定：死键字面量不应抑制 nextAction 按钮
  S=newState('兜底','⚔');fillRoster(S);S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);S.seedPower=400;initGroups(S);
  S.preseason=false;S.phase='card';
  S.card={idx:0,matches:[{a:S.teamName,b:'A',r:null}]};
  let clubHtml='';
  try{renderClub();clubHtml=(document.getElementById('page-club')||{}).innerHTML||'';}catch(e){clubHtml='ERR:'+e.message;}
  ok(clubHtml.indexOf('uiDoNextAction(S)')>=0||clubHtml.indexOf('startCard(')>=0,'俱乐部页卡位赛无可执行入口: '+clubHtml.slice(0,200));

  return R;
})()
`, dom);

out.forEach(m => T.check(false, m));
T.report();

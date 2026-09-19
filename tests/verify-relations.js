// 战队关系事件：信任度增减 / 选择题 / 待办渲染
// 运行：node tests/verify-relations.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const mk=(mode)=>{
   S=newState('关系队','x');fillRoster(S,'mid','mid');
   S.coach={...COACH_POOL.find(c=>c.id==='co12')};
   S.lineup=S.players.map(p=>p.id);
   S.mode=mode||'manager';
   S.preseason=false;S.transferWindow=0;S.day=1;
   return S;
  };

  // ① boardRelDelta 升降与钳制（单次事件 delta 限制在 [-15,12]，防关系条被一次刷穿）
  S=mk();S.board.trust=60;
  const d1=boardRelDelta(S,10,'测试升温');
  const d2=boardRelDelta(S,-40,'测试打压'); // 实际生效 -15
  if(S.board.trust!==55)fail('①信任度 60+10-15 应为 55: '+S.board.trust);
  else if(d1!==10||d2!==-15)fail('①delta 返回值异常 '+d1+'/'+d2);
  else{
   S.board.trust=95;boardRelDelta(S,20,'上限');
   const hi=S.board.trust;
   S.board.trust=5;boardRelDelta(S,-30,'下限');
   if(hi!==100||S.board.trust!==0)fail('①钳制失败 hi='+hi+' lo='+S.board.trust);
   else log('①关系增减：60+10-15=55 · 单次 clamp[-15,12] · 信任度钳制 [0,100]');
  }

  // ② 选择题：登记 + 按选项结算（信任/资金/士气）
  S=mk();S.fund=500;S.board.trust=60;
  S.clubChoice={id:'gala',title:'股东答谢晚宴',text:'出席或代劳',
   opts:[{l:'盛装出席',trust:4,fund:0,morale:0,note:'股东满意'},{l:'让助教代劳',trust:-2,fund:0,morale:2,note:'队员看到你备战'}]};
  const ok=applyClubChoice(S,0);
  if(!ok||S.clubChoice)fail('②选项未消费');
  else if(S.board.trust!==64)fail('②信任未 +4: '+S.board.trust);
  else log('②选择题：出席 → 信任 60→64 · 待办清空');

  // ③ 负面选项：士气联动
  S=mk();S.fund=500;S.board.trust=60;
  const mor0=S.players[0].morale;
  S.clubChoice={id:'sponsor',title:'赞助商点名',text:'x',
   opts:[{l:'商务优先',trust:5,fund:40,morale:-4,note:'赞助满意'},{l:'竞技优先',trust:2,fund:0,morale:5,note:'更衣室点赞'}]};
  applyClubChoice(S,0);
  if(S.fund<=500)fail('③资金未加 40: '+S.fund);
  else if(S.players[0].morale>=mor0-3)fail('③士气未下降: '+mor0+'→'+S.players[0].morale);
  else log('③商务优先：资金+40 · 士气 '+mor0+'→'+S.players[0].morale+' · 信任+5（当前 '+S.board.trust+'）');

  // ④ 选手模式不触发
  S=mk('player');S.career={me:S.players[0].id,seasons:[],titles:0,role:'rot',stats:{trained:0,social:0,media:0,matches:0}};
  S.board.trust=60;
  clubRelTick(S);
  if(S.clubChoice)fail('④选手模式不该出关系选择题');
  else log('④选手生涯：clubRelTick 不触发董事会关系事件');

  // ⑤ 自动/选择事件均可改变关系（强制走通两条路径）
  S=mk();S.board.trust=60;S.streak=5;
  // 强制自动事件路径：先 roll < p，再 roll >= 0.4
  const realR=Math.random;let step=0;
  Math.random=function(){step++;return step%2===0?0.9:0.05;};
  let autoHits=0;
  for(let i=0;i<10;i++){S.clubChoice=null;const t0=S.board.trust;clubRelTick(S);if(S.board.trust!==t0)autoHits++;}
  // 强制选择题路径
  step=0;Math.random=function(){return 0.1;}; // 进 tick 且 <0.4 → 选择题
  S.clubChoice=null;clubRelTick(S);
  const hasChoice=!!S.clubChoice;
  Math.random=realR;
  if(autoHits<1)fail('⑤强制自动事件未改写信任: hits='+autoHits);
  else if(!hasChoice)fail('⑤强制路径未生成选择题');
  else log('⑤关系事件：自动路径 '+autoHits+'/10 次改信任 · 选择题已登记「'+S.clubChoice.title+'」');

  // ⑥ 俱乐部面板含关系事件按钮
  S=mk();S.board.trust=70;
  S.clubChoice={id:'fans',title:'球迷围堵主场',text:'连续失利后球迷拉横幅',
   opts:[{l:'公开道歉',trust:3,fund:-20,morale:4,note:'口碑回暖'},{l:'强硬回应',trust:-4,fund:0,morale:-3,note:'公关失分'}]};
  let rErr='';
  try{goPage('club');}catch(e){rErr=e.message;}
  const body=document.querySelector('#page-club').innerHTML;
  if(rErr)fail('⑥俱乐部页渲染: '+rErr);
  else if(body.indexOf('关系事件')<0||body.indexOf('公开道歉')<0)fail('⑥面板缺关系选择题');
  else log('⑥俱乐部页：关系事件卡片与选项按钮渲染 OK');

  // ⑦ 定义表齐全
  const ch=clubRelChoices(S);
  if(ch.length<4)fail('⑦关系选择题过少: '+ch.length);
  else if(ch.some(c=>!c.opts||c.opts.length<2))fail('⑦存在无选项的关系事件');
  else log('⑦关系事件库：'+ch.length+' 道选择题（'+ch.map(c=>c.title).join('、')+'）');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);

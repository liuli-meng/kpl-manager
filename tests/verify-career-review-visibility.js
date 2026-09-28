// 同类问题回归：生涯页/年度回顾 后半程信息完整
// 运行：node tests/verify-career-review-visibility.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 生涯页：系列赛进行中显示对手/比分
  S=newState('生涯显示',' x');fillRoster(S,'mid');
  S.mode='player';
  S.career={me:S.players[0].id,seasons:[],titles:0,fmvp:0,allstar:0,stats:{matches:0},role:'rot'};
  S.lineup=S.players.map(p=>p.id);
  S.phase='r1';
  S.schedule=[{round:1,opp:'北京JDG',result:null,myScore:0,opScore:0,mid:'reg_r1_1'}];
  S.matchIdx=0;
  S.series={used:[],usedOpp:[],mw:1,ow:0,max:5,stage:'regular',mid:'reg_r1_1',logs:[],myName:S.teamName,opName:'北京JDG',side:'blue'};
  const b1=careerMatchBrief();
  if(!b1||b1.kind!=='series')fail('系列赛 brief 未识别');
  else if(b1.opp!=='北京JDG'||b1.sub.indexOf('1:0')<0)fail('系列赛对手/比分错: '+JSON.stringify(b1));
  else log('① 生涯 brief：系列赛 1:0 vs 北京JDG');

  // ② renderCareer 包含对阵面板
  let h='';
  try{renderCareer();h=document.getElementById('page-career').innerHTML||'';}catch(e){fail('renderCareer 抛错: '+e.message);}
  if(h.indexOf('系列赛进行中')<0)fail('生涯页无系列赛面板');
  else if(h.indexOf('北京JDG')<0)fail('生涯页无对手');
  else log('② 生涯页：系列赛面板已挂载');

  // ③ 未开赛：下一场比赛
  S.series=null;
  const b2=careerMatchBrief();
  if(!b2||b2.kind!=='next'||b2.opp!=='北京JDG')fail('下一场比赛 brief 错: '+JSON.stringify(b2));
  else log('③ 生涯 brief：下一场比赛 vs 北京JDG');

  // ④ 季后赛对手待定/已定
  S.phase='playoff';
  S.series=null;
  S.playoff={
   wb:[{a:S.teamName,b:'X',r:S.teamName},{a:'Y',b:'Z',r:'Y'}],
   lb:[{a:'A',b:'B',r:'A'},{a:'C',b:'D',r:'C'}],
   lb2:[{a:'X',b:null,r:null},{a:'Z',b:null,r:null}],
   lb3:[{a:null,b:null,r:null},{a:null,b:null,r:null}],
   wf:{a:S.teamName,b:'Y',r:null},
   lb4:{a:null,b:null,r:null},lbf:{a:null,b:null,r:null},final:{a:null,b:null,r:null},champ:null};
  const b3=careerMatchBrief();
  if(!b3||b3.opp!=='Y')fail('季后赛 brief 对手错: '+JSON.stringify(b3));
  else log('④ 生涯 brief：季后赛 vs Y（'+(b3.sub||b3.title)+'）');

  // ⑤ 退役页最后一战
  S.mode='player';
  S.career={retired:true,legacy:{name:'老将',age:31},seasons:[{year:2026,team:'T',apps:10,kda:'1/1/1',mvp:1,titles:1}],titles:1,fmvp:0,allstar:0};
  S.history=[{opp:'成都AG超玩会',stage:'季后赛',score:'1:4',win:false}];
  S.phase='eliminated';
  let h2='';
  try{renderCareer();h2=document.getElementById('page-career').innerHTML||'';}catch(e){fail('退役 render 抛错: '+e.message);}
  if(h2.indexOf('退役')<0)fail('退役页缺失');
  else if(h2.indexOf('成都AG超玩会')<0)fail('退役页无最后一战对手');
  else log('⑤ 退役页：最后一战 vs 成都AG超玩会');

  // ⑥ 履历 15 季截断说明
  S.career={me:S.players[0].id,seasons:Array.from({length:15},(_,i)=>({year:2020+i,team:'T',apps:1,kda:'1/1/1',mvp:0,ovr:80,val:100})),titles:0,fmvp:0,allstar:0,stats:{}};
  S.phase='r1';S.series=null;S.schedule=[{round:1,opp:'A',result:null,myScore:0,opScore:0,mid:'reg_r1_1'}];S.matchIdx=0;
  let h3='';
  try{renderCareer();h3=document.getElementById('page-career').innerHTML||'';}catch(e){fail('履历 render 抛错: '+e.message);}
  if(h3.indexOf('仅保留最近 15 季')<0)fail('履历截断无说明');
  else log('⑥ 生涯履历：15 季截断已标注');

  // ⑦ 年度回顾 10 份截断说明
  S.mode='manager';
  S.yearReviews=Array.from({length:10},(_,i)=>({year:2016+i,stages:[],honors:[],transfers:[],keys:[],board:null}));
  let h4='';
  try{renderBiz();h4=document.getElementById('page-biz').innerHTML||'';}catch(e){fail('renderBiz 抛错: '+e.message);}
  if(h4.indexOf('仅保留最近 10 年')<0)fail('年度回顾截断无说明');
  else log('⑦ 年度回顾：10 份截断已标注');

  return res.join('\\n')+(hadFail?'\\n[HAD-FAIL]':'\\n[ALL-OK]');
})()
`, dom);

console.log(out);
process.exit(out.includes('[HAD-FAIL]') ? 1 : 0);

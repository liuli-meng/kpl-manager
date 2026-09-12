// 比赛文案升级 + AI 赛后战报回归：多样性 / 语境编织 / 系列赛去重 / AI 开关与回退
// 运行：node tests/verify-commentary.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const mkS=()=>{S=newState('文案队','⚔️');fillRoster(S,'mid','star');
   const u=new Set(S.players.map(p=>p.name));
   const b=genPlayer(genFreeAgentDef(pick(POS_ORDER),'mid',u));S.players.push(b);
   return S;};
  const mkSr=(max)=>({used:[],usedOpp:[],mw:0,ow:0,max:max||5,stage:'regular',logs:[],myName:S.teamName,opName:'测试对手',side:'blue'});

  // ① 多样性：同一队伍连打 200 局，文案行去重后应远超旧版 30 条池子
  const s1=mkS();S=s1;S.tactic='team';S.tacticW=tacticById('team').w;
  const seen=new Set();
  for(let i=0;i<200;i++){
   const sr=mkSr();sr._usedTxt=[];
   const mvp=(()=>{const p=s1.players[0];return {id:p.id,name:p.name,k:7,d:1,a:9};})();
   const g={w:i%2===0,myK:rnd(6,13),opK:rnd(3,12)};
   genMatchStory(sr,g,mvp).forEach(l=>seen.add(l));
  }
  if(seen.size<100)fail('文案多样性不足：200 局仅 '+seen.size+' 种不同句子（应≥100）');
  else log('① 多样性：200 局产出 '+seen.size+' 种不同文案句（旧版全池仅 ~30 条模板）');

  // ② 语境编织：MVP 名字与真实 KDA、战术名应出现在文案里
  let mvpHit=0,tactHit=0,heroHit=0;
  const sigHero=s1.players[0].sig;
  for(let i=0;i<120;i++){
   const sr=mkSr();sr._usedTxt=[];
   const p=s1.players[0];
   const mvp={id:p.id,name:p.name,k:8,d:2,a:7};
   const lines=genMatchStory(sr,{w:true,myK:10,opK:4},mvp);
   if(lines.some(l=>l.includes(p.name)&&(l.includes('8/2/7'))))mvpHit++;
   if(lines.some(l=>l.includes('团战致胜')))tactHit++;
   if(lines.some(l=>l.includes(sigHero)))heroHit++;
  }
  if(mvpHit<5)fail('MVP 名字/KDA 未织进收尾文案（120 局仅 '+mvpHit+' 次）');
  else if(tactHit<3)fail('战术名未织进文案（120 局仅 '+tactHit+' 次）');
  else if(heroHit<3)fail('招牌英雄名未织进文案（120 局仅 '+heroHit+' 次）');
  else log('② 语境编织：MVP KDA（'+mvpHit+'次）· 战术名（'+tactHit+'次）· 招牌英雄（'+heroHit+'次）都进了句子');

  // ③ 系列赛去重：同一场系列赛内句式模板不重复
  const s3=mkS();S=s3;
  const sr3=mkSr();
  for(let i=0;i<7;i++)genMatchStory(sr3,{w:i%2===0,myK:8,opK:5},{id:s3.players[0].id,name:s3.players[0].name,k:5,d:3,a:6});
  const dup=sr3._usedTxt.filter((k,i)=>sr3._usedTxt.indexOf(k)!==i);
  if(dup.length)fail('系列赛内句式重复: '+dup.slice(0,3).join(','));
  else log('③ 系列赛去重：7 局共用一个 _usedTxt 记录，无重复句式（随存档持久化）');

  // ④ 边界：无 MVP（旧调用口径）/空对手阵容不崩
  try{
   const sr4=mkSr();genMatchStory(sr4,{w:false,myK:3,opK:10},undefined);
   const sr5=mkSr();S.players=[];genMatchStory(sr5,{w:true,myK:9,opK:2},undefined);
  }catch(e){fail('空 MVP/空名单崩溃: '+e.message);}
  S=s1;
  log('④ 边界：无 MVP / 空名单调用不崩溃');

  // ⑤ AI 战报开关：默认关闭零请求；开启且有端点才出占位框；无 fetch 环境失败回退
  const s5=mkS();S=s5;
  try{localStorage.removeItem('km_ai_set');}catch(e){}
  const sr5b=mkSr();
  const r5={win:true,logs:[' 测试'],opName:'对手',stageTxt:'常规赛',score:'3:1',mvps:[]};
  S.history=[{yr:2026,opp:'对手',stage:'常规赛',score:'3:1',win:true,logs:[' 测试']}];
  showMatchModal(r5,'测试赛');
  let body=document.querySelector('#app-modal-body').innerHTML;
  if(body.includes('ai-report-box'))fail('默认关闭时不应出现 AI 战报占位框');
  // 开启（写入本机设置，base 缺省仍不算开启）
  localStorage.setItem('km_ai_set',JSON.stringify({on:true,base:''}));
  if(aiEnabled())fail('base 为空时 aiEnabled 应为 false');
  localStorage.setItem('km_ai_set',JSON.stringify({on:true,base:'https://example.invalid/chat'}));
  if(!aiEnabled())fail('on+base 应判定为开启');
  showMatchModal(r5,'测试赛');
  body=document.querySelector('#app-modal-body').innerHTML;
  if(!body.includes('ai-report-box'))fail('开启后未渲染 AI 战报占位框');
  // 无 fetch 环境：aiFillReport 应走失败回退且不抛出
  aiFillReport(r5);
  body=document.querySelector('#app-modal-body').innerHTML;
  if(!body.includes('失败'))fail('无 fetch 环境未走失败回退文案');
  else log('⑤ AI 战报：默认零请求 → 开启出占位框 → 无 fetch 静默回退（引擎不受影响）');

  // ⑥ AI 战报入复盘：h.aiReport 在重放中渲染
  S.history[0].aiReport='这是一段 AI 生成的赛后战报。';
  showReplay(S.history[0]);
  body=document.querySelector('#app-modal-body').innerHTML;
  if(!body.includes('AI 战报')||!body.includes('这是一段 AI 生成的赛后战报'))fail('复盘未渲染 AI 战报');
  else log('⑥ 复盘渲染：aiReport 已入册并在重放中显示（离线可回看）');

  try{localStorage.removeItem('km_ai_set');}catch(e){}
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);

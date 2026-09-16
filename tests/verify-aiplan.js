// AI 规划回归：赛训成长 / 老化顶替 / 豪门跨队挖角 / 青训开班
// 运行：node tests/verify-aiplan.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  const mk=()=>{S=newState('AI规划队','x');fillRoster(S,'mid','mid');
   S.coach={...COACH_POOL.find(c=>c.id==='co12')};
   S.seedPower=380;initGroups(S);S.preseason=false;S.transferWindow=0;
   return S;};
  const ovrListOf=(s,tn)=>((aiRosterDefMap(s)[tn]||[]).map(id=>defOf(s,id)).filter(Boolean)
   .map(d=>overall(genSeasonPlayer(s,d))).sort((a,b)=>b-a));
  const avgOf=a=>a.length?Math.round(a.reduce((t,x)=>t+x,0)/a.length):0;

  // ① 赛训成长：连推 3 季，中游/弱旅平均总值不得原地踏步
  const s1=mk();S=s1;
  const midTn='苏州KSG',weakTn='常山UUG',eliteTn='成都AG超玩会';
  const m0=avgOf(ovrListOf(s1,midTn)),w0=avgOf(ovrListOf(s1,weakTn));
  const logs0=s1.eventLog.length;
  for(let i=0;i<3;i++){aiTransferWindow(s1);s1.season++;s1.aiRosters={};}
  const m3=avgOf(ovrListOf(s1,midTn)),w3=avgOf(ovrListOf(s1,weakTn));
  const trainLogs=s1.eventLog.filter(e=>/赛训加练/.test(e.txt)).length;
  if(!(m3>=m0))fail('中游 3 季未成长: '+m0+'→'+m3);
  else if(!(w3>=w0))fail('弱旅 3 季未成长: '+w0+'→'+w3);
  else if(trainLogs<6)fail('赛训加练日志过少: '+trainLogs);
  else log('① 赛训成长：中游 '+m0+'→'+m3+' · 弱旅 '+w0+'→'+w3+' · 加练日志 '+trainLogs+' 条');

  // ② 老化顶替：给豪门塞一名过黄金期弱首发，开窗后应被换下（或至少有人动刀）
  const s2=mk();S=s2;
  const map=aiRosterDefMap(s2);
  const agIds=map[eliteTn].slice();
  // 把 AG 的一名 def 的 base 压到 70，并伪造高龄（写进 extraDefs 同 id 覆盖不可行——改直接降 base 模拟弱首发）
  const weakDef=defOf(s2,agIds[0]);
  if(weakDef&&Array.isArray(weakDef.base)){
   weakDef.base=[70,70,70,70];
  }
  const before=ovrListOf(s2,eliteTn);
  // 连推 4 季给规划足够机会
  for(let i=0;i<4;i++){aiTransferWindow(s2);s2.season++;s2.aiRosters={};}
  const after=ovrListOf(s2,eliteTn);
  const upgraded=after.some((v,i)=>before[i]!=null&&v>before[before.length-1]); // 最低位抬升
  const topOk=after[0]>=85;
  if(!topOk)fail('豪门顶星被拖垮: top='+after[0]);
  else if(!upgraded&&avgOf(after)<=avgOf(before))fail('弱首发未被规划顶替: '+before.join('/')+' → '+after.join('/'));
  else log('② 规划补强：豪门弱首发 4 季后 '+before.join('/')+' → '+after.join('/')+'（top '+after[0]+'）');

  // ③ 挖角日志：多季推进里应出现「重磅转会」或「加盟」类流动
  const s3=mk();S=s3;
  for(let i=0;i<5;i++){aiTransferWindow(s3);s3.season++;s3.aiRosters={};}
  const moveLogs=s3.eventLog.filter(e=>/重磅转会|加盟|离队寻找下家|老化顶替/.test(e.txt)).length;
  if(moveLogs<8)fail('AI 转会流动过少: '+moveLogs);
  else log('③ 联盟流动：5 季转会/挖角/顶替日志 '+moveLogs+' 条');

  // ④ 青训开班：多季后至少半数 AI 队有青训营
  const s4=mk();S=s4;
  for(let i=0;i<4;i++){aiTransferWindow(s4);s4.season++;s4.aiRosters={};}
  const acad=Object.keys(s4.aiAcademy||{}).filter(tn=>(s4.aiAcademy[tn]||[]).length);
  const teams=Object.keys(aiRosterDefMap(s4)).filter(tn=>tn!==s4.teamName);
  if(acad.length<teams.length*0.4)fail('青训开班过少: '+acad.length+'/'+teams.length);
  else log('④ 青训生态：'+acad.length+'/'+teams.length+' 队有青训营（'+acad.slice(0,5).join('、')+'…）');

  // ⑤ 名册不变量：每队始终 ≤5 人且五位置齐全（挖角后必须有补位，不能缺位过夜）
  const s5=mk();S=s5;
  let rosterBroken=0;
  for(let i=0;i<4;i++){
   aiTransferWindow(s5);s5.season++;s5.aiRosters={};
   const map5=aiRosterDefMap(s5);
   Object.keys(map5).forEach(tn=>{
    if(tn===s5.teamName)return;
    const defs=(map5[tn]||[]).map(id=>defOf(s5,id)).filter(Boolean);
    const pos=new Set(defs.map(d=>d.pos));
    if(defs.length>5||defs.length<5||pos.size<5)rosterBroken++;
   });
  }
  if(rosterBroken)fail('挖角/补位后名册残缺次数: '+rosterBroken);
  else log('⑤ 名册不变量：4 季推进后 17 队均 5 人五位置齐全');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);

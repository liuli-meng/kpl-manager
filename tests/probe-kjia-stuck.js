// 探针：K甲赛程是否随 nextDay 推进；收官后是否自动开新一届；读档是否丢状态；残缺 kjia 是否拖垮 nextDay
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

function run(label, code) {
  const { dom } = makeDom();
  injectHelpers(dom);
  return vm.runInContext(code, dom);
}

const out = run('kjia-stuck', `
(function(){
  const res=[]; const fail=m=>{res.push('[FAIL] '+m);};
  const log=t=>res.push('[PASS] '+t);
  const addBench=(s,band)=>{const u=new Set(s.players.map(p=>p.name));const b=genPlayer(genFreeAgentDef(pick(POS_ORDER),band||'mid',u));b.apps=0;s.players.push(b);return b;};

  // ===== ① nextDay 日推进：必须真正打过比赛（允许整届后自动开新一届） =====
  const s1=newState('推进队','x');fillRoster(s1,'mid','star');addBench(s1);S=s1;
  initKjia(s1);
  const snap=[];
  let threw=null;
  let maxRd=0,maxPlayed=0,restarts=0,prevChamp=null;
  for(let i=0;i<16;i++){
    try{ nextDay(s1); }
    catch(e){ threw='day'+(i+1)+': '+e.message; break; }
    const k=s1.kjia;
    const played=(k.rounds||[]).reduce((t,rd)=>t+rd.filter(m=>m&&m.r).length,0);
    if(k.rd>maxRd)maxRd=k.rd;
    if(played>maxPlayed)maxPlayed=played;
    if(prevChamp&&k.champ===null&&k.rd===0)restarts++;
    if(k.champ)prevChamp=k.champ;
    snap.push({d:s1.day,kd:k.day,rd:k.rd,played,champ:!!k.champ});
  }
  if(threw) fail('① nextDay 抛错中断推进: '+threw);
  else if(maxRd<1||maxPlayed<4) fail('① 推进 16 天几乎没打比赛: maxRd='+maxRd+' maxPlayed='+maxPlayed+' last='+JSON.stringify(snap[snap.length-1]));
  else log('① nextDay 推进 OK：峰值 rd='+maxRd+' 场次='+maxPlayed+' 收官重开='+restarts+' 次');

  // ===== ② 整届应收官；收官后自动开新一届（赛程不冻结） =====
  const s2=newState('整届队','x');fillRoster(s2,'mid','star');S=s2;
  initKjia(s2);
  let th2=null, sawFinish=false, champ0=null;
  for(let i=0;i<15;i++){
    try{ nextDay(s2); }catch(e){ th2=e.message; break; }
    if(s2.kjia.champ){ sawFinish=true; champ0=s2.kjia.champ; break; }
  }
  const k2=s2.kjia;
  const played2=(k2.rounds||[]).reduce((t,rd)=>t+rd.filter(m=>m&&m.r).length,0);
  if(th2) fail('② 整届推进抛错: '+th2);
  else if(!sawFinish&&played2<20) fail('② 15 天未收官且出分不足: '+played2+' rd='+k2.rd+' champ='+k2.champ);
  else {
    let th3=null;
    for(let i=0;i<3;i++){ try{nextDay(s2);}catch(e){ th3=e.message; break; } }
    const k2b=s2.kjia;
    if(th3) fail('② 收官后 nextDay 抛错: '+th3);
    else if(k2b.champ&&k2b.rd>=(k2b.rounds||[]).length) fail('② 收官后未自动开新一届（仍 champ='+k2b.champ+' rd='+k2b.rd+'）');
    else if(!(k2b.rounds||[]).length) fail('② 新一届 rounds 为空');
    else log('② 整届收官（上届冠军='+(champ0||'—')+'）· 自动开新一届 rd='+k2b.rd+'/'+k2b.rounds.length);
  }

  // ===== ③ 读档往返：kjia 进度不得丢、不得重置 =====
  const s3=newState('读档队','x');fillRoster(s3,'mid','star');addBench(s3);S=s3;
  initKjia(s3);
  const b3=s3.players.find(p=>!s3.lineup.includes(p.id));
  sendKjia(s3,b3.id);
  for(let i=0;i<5;i++)nextDay(s3);
  const before={rd:s3.kjia.rd,day:s3.kjia.day,played:s3.kjia.rounds.flat().filter(m=>m.r).length,sq:s3.kjia.squad.length,pkjia:b3.kjia};
  save();
  S=null;
  const okLoad=load();
  const s3b=S;
  const after=okLoad&&s3b&&s3b.kjia?{rd:s3b.kjia.rd,day:s3b.kjia.day,played:s3b.kjia.rounds.flat().filter(m=>m.r).length,sq:(s3b.kjia.squad||[]).length,pkjia:(s3b.players.find(p=>p.id===b3.id)||{}).kjia}:null;
  if(!okLoad) fail('③ load 失败');
  else if(!after) fail('③ 读档后 kjia 丢失');
  else if(after.rd!==before.rd||after.day!==before.day||after.played!==before.played) fail('③ 读档重置了 K甲进度: '+JSON.stringify(before)+' → '+JSON.stringify(after));
  else if(after.sq!==before.sq) fail('③ 读档后二队班底人数变了: '+before.sq+'→'+after.sq);
  else if(after.pkjia!==before.pkjia) fail('③ 读档后下放天数变了: '+before.pkjia+'→'+after.pkjia);
  else {
    let th4=null;
    try{ for(let i=0;i<4;i++)nextDay(S); }catch(e){th4=e.message;}
    if(th4) fail('③ 读档后继续 nextDay 抛错: '+th4);
    else if(S.kjia.rd<before.rd && !(S.kjia.rd===0&&S.kjia.day===0)) fail('③ 读档后 rd 倒退且未重开');
    else log('③ 读档往返 OK：进度保持 rd='+before.rd+' day='+before.day+' played='+before.played+'，续推正常');
  }

  // ===== ④ 残缺 kjia 对象：不得让整条 nextDay 挂掉，必须自愈重建 =====
  const s4=newState('残缺队','x');fillRoster(s4,'mid','star');S=s4;
  s4.kjia={teams:['a'],powers:{},rounds:null,rd:0,day:0,tables:{},results:[],squad:[],champ:null,my:'a'};
  let th5=null;
  try{ nextDay(s4); }catch(e){ th5=e.message; }
  if(th5) fail('④ 残缺 kjia 弄挂 nextDay: '+th5);
  else if(!s4.kjia||!Array.isArray(s4.kjia.rounds)||!s4.kjia.rounds.length) fail('④ 残缺 kjia 未被修复重建');
  else log('④ 残缺 kjia 被安全重建（'+s4.kjia.rounds.length+' 轮），nextDay 不挂');

  // ===== ⑤ 误传动作名字符串：应归一化到 S（历史 P0） =====
  const s5=newState('按钮队','x');fillRoster(s5,'mid','star');S=s5;
  S.preseason=false;S.transferWindow=0;S.phase='card';
  S.card={matches:[{a:S.teamName,b:'对手队',r:null}],idx:0};
  let th6=null, actStr=null, actObj=null;
  try{ actStr=nextAction('startCard'); actObj=nextAction(S); }catch(e){ th6=e.message; }
  if(th6) fail('⑤ nextAction(字符串) 抛错: '+th6);
  else if(!actStr) fail('⑤ nextAction(字符串) 仍返回 null（按钮死链）');
  else if(!actObj||actStr.type!==actObj.type) fail('⑤ 字符串入参未归一化到 S: '+JSON.stringify(actStr)+' vs '+JSON.stringify(actObj));
  else {
    try{ uiDoNextAction('startCard'); }catch(e){ th6='ui:'+e.message; }
    if(th6) fail('⑤ uiDoNextAction(字符串) 抛错: '+th6);
    else if(!S.series) fail('⑤ uiDoNextAction(字符串) 未建立 series（按钮点了没反应）');
    else log('⑤ 字符串入参归一化 OK：nextAction/uiDoNextAction 旧写法都能推进');
  }

  if(res.some(r=>r.startsWith('[FAIL]'))) throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join('\\n');
})()
`);

console.log(out);

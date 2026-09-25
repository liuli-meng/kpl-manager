/* 选手生涯日决策引擎（媒体采访 / 更衣室互动 / 合同角色 / 国家队专注）。
   从 career/ui 拆出：选手主动路径的规则与结算集中在此，UI 只渲染与转发。
   与 S.trained（每日成长行动）并行：社交有独立 socialUsed，媒体是事件驱动。 */
const PLAYER_ROLES={
  star:{n:'当家核心',d:'要求稳定首发；坐板凳时士气跌得更快，首发时人气与忠诚涨得更稳'},
  rot:{n:'轮换拼图',d:'接受合理轮换；板凳士气更稳，出场时成长略快'},
  proj:{n:'长期培养',d:'以成长为先；加练收益更稳，适合新秀/海归沉淀'},
};
function defaultRoleForArch(id){return id==='youth'?'proj':id==='returnee'?'star':'rot';}
function playerRole(s){return (s&&s.career&&s.career.role)||'rot';}
function setPlayerRole(s,role){
  if(!s||s.mode!=='player'||!s.career)return false;
  if(!PLAYER_ROLES[role])return false;
  if(s.career.role===role)return false;
  s.career.role=role;
  const me=myPlayer(s);
  logEvent(s,' 合同角色调整：'+((me&&me.name)||'你')+' 将以「'+PLAYER_ROLES[role].n+'」姿态征战（'+PLAYER_ROLES[role].d+'）');
  save();renderAll();
  return true;
}
/* ================= 更衣室互动（与训练并行的第二行动位） ================= */
const SOCIAL_ACTIONS={
  bond:{n:'更衣室聚餐',d:'全队士气+2 · 你士气+3 · 体力-5',energy:5},
  help:{n:'陪替补加练',d:'一名队友属性+1 · 你人气+1 · 体力-8',energy:8},
  stream:{n:'直播整活',d:'人气+3 · 心态-1（状态低迷时可能反噬）',energy:4},
};
function playerSocial(s,key){
  s=s||S;
  if(!s||s.mode!=='player')return false;
  const me=myPlayer(s);
  if(!me)return false;
  if(s.career&&s.career.retired){toast('职业生涯已退役');return false;}
  if(s.socialUsed){toast('今天已经参与过更衣室/社交活动了');return false;}
  if(me.injury>0&&key!=='bond'){toast('伤停中，先养伤（聚餐仍可参加）');return false;}
  const act=SOCIAL_ACTIONS[key];
  if(!act)return false;
  if(me.energy<act.energy){toast('体力不足（需 '+act.energy+'）');return false;}
  s.career.stats=s.career.stats||{trained:0,social:0,media:0,matches:0};
  if(key==='bond'){
    s.players.forEach(p=>{p.morale=clamp(p.morale+2,20,100);});
    me.morale=clamp(me.morale+3,20,100);
    me.energy=clamp(me.energy-act.energy,0,ENERGY_MAX);
    logEvent(s,' 更衣室：'+me.name+' 组局聚餐，全队士气回暖');
  }else if(key==='help'){
    const mates=(s.players||[]).filter(p=>{const st=playerStatus(p,s);return p.id!==me.id&&!st.loanOut&&!st.kjia&&!st.retiring;});
    if(!mates.length){toast('队内暂无陪练对象');return false;}
    const t=pick(mates);
    const ak=pick(['lane','farm','team','mind']);
    t.attrs[ak]=clamp(t.attrs[ak]+1,40,99);
    me.popularity=Math.min(99,(me.popularity||0)+1);
    me.energy=clamp(me.energy-act.energy,0,ENERGY_MAX);
    t.morale=clamp(t.morale+4,20,100);
    logEvent(s,' 更衣室：'+me.name+' 陪 '+t.name+' 加练，队友属性提升（'+{lane:'对线',farm:'运营',team:'团战',mind:'心态'}[ak]+'+1）');
  }else if(key==='stream'){
    const hot=(me.val||100)>=105;
    const back=!hot&&(me.val||100)<92&&Math.random()<0.35;
    me.popularity=Math.min(99,(me.popularity||0)+(back?0:3));
    me.attrs.mind=clamp(me.attrs.mind-(back?2:1),40,99);
    me.energy=clamp(me.energy-act.energy,0,ENERGY_MAX);
    if(back){
      logEvent(s,' 媒体：'+me.name+' 直播翻车被带节奏，人气未涨、心态受挫');
    }else if(hot){
      me.popularity=Math.min(99,(me.popularity||0)+1);
      logEvent(s,' 直播：'+me.name+' 整活出圈（人气+4）——状态火热自带流量');
    }else{
      logEvent(s,' 直播：'+me.name+' 整活出圈（人气+3）');
    }
  }
  s.socialUsed=true;
  s.career.stats.social++;
  save();renderAll();
  return true;
}
/* ================= 媒体采访（赛后/偶发事件，三选一） ================= */
function mediaPool(){
  return [
   {id:'form',q:'最近状态不错，媒体问你如何看待自己的发挥？',
    opts:[
     {id:'humble',l:'还没到巅峰，继续打磨',tip:'心态+1 · 人气+1',fn:(s,me)=>{me.attrs.mind=clamp(me.attrs.mind+1,40,99);me.popularity=Math.min(99,(me.popularity||0)+1);return '低调回应赢得尊重';}},
     {id:'hype',l:'这就是我的时代',tip:'人气+4（状态低迷会翻车）',fn:(s,me)=>{const hot=(me.val||100)>=100;if(hot){me.popularity=Math.min(99,(me.popularity||0)+4);return '自信宣言引爆热搜';}me.popularity=Math.max(0,(me.popularity||0)-2);me.attrs.mind=clamp(me.attrs.mind-1,40,99);return '被嘲「言过其实」，人气下滑';}},
     {id:'team',l:'功劳是全队的',tip:'全队士气+2 · 人气+1',fn:(s,me)=>{s.players.forEach(p=>{p.morale=clamp(p.morale+2,20,100);});me.popularity=Math.min(99,(me.popularity||0)+1);return '更衣室好感度上升';}},
    ]},
   {id:'bench',q:'连续坐板凳，记者追问你的未来。',
    opts:[
     {id:'fight',l:'用训练说话',tip:'心态+1 · 下次加练多+1',fn:(s,me)=>{me.attrs.mind=clamp(me.attrs.mind+1,40,99);s.career.mediaBuff='train';return '训练态度被点赞';}},
     {id:'loan',l:'不排除租借找机会',tip:'人气+2 · 队友小幅寒心',fn:(s,me)=>{me.popularity=Math.min(99,(me.popularity||0)+2);const mates=(s.players||[]).filter(p=>p.id!==me.id);if(mates.length){const t=pick(mates);t.morale=clamp(t.morale-3,20,100);}return '转会传闻升温';}},
     {id:'loyal',l:'我忠于这支队',tip:'全队士气+1 · 心态+1',fn:(s,me)=>{s.players.forEach(p=>{p.morale=clamp(p.morale+1,20,100);});me.attrs.mind=clamp(me.attrs.mind+1,40,99);return '队内口碑回暖';}},
    ]},
   {id:'title',q:'夺冠后发布会，镜头全部对准你。',
    opts:[
     {id:'share',l:'FMVP属于全队',tip:'全队士气+3 · 人气+2',fn:(s,me)=>{s.players.forEach(p=>{p.morale=clamp(p.morale+3,20,100);});me.popularity=Math.min(99,(me.popularity||0)+2);return '大气发言圈粉';}},
     {id:'self',l:'我就是关键先生',tip:'人气+6 · 队友士气-1',fn:(s,me)=>{me.popularity=Math.min(99,(me.popularity||0)+6);s.players.forEach(p=>{if(p.id!==me.id)p.morale=clamp(p.morale-1,20,100);});return '个人品牌暴涨，更衣室微词';}},
     {id:'next',l:'冠军只是开始',tip:'心态+2 · 人气+1',fn:(s,me)=>{me.attrs.mind=clamp(me.attrs.mind+2,40,99);me.popularity=Math.min(99,(me.popularity||0)+1);return '格局打开';}},
    ]},
  ];
}
function maybeOpenMedia(s,ctx){
  if(!s||s.mode!=='player'||!s.career||s.career.retired)return false;
  if(s.career.media)return false; // 已有待答采访
  const me=myPlayer(s);
  if(!me)return false;
  // ctx: 'match' | 'day' | 'title'
  let chance=0,pool=mediaPool();
  if(ctx==='title')chance=1;
  else if(ctx==='match')chance=0.45;
  else chance=s.day%5===0?0.35:0.08;
  if(Math.random()>chance)return false;
  let q;
  if(ctx==='title')q=pool.find(x=>x.id==='title');
  else if((s.career.benchDays||0)>=3)q=pool.find(x=>x.id==='bench');
  else q=pool.find(x=>x.id==='form');
  if(!q)q=pool[0];
  s.career.media={id:q.id,q:q.q,opts:q.opts.map(o=>({id:o.id,l:o.l,tip:o.tip})),day:s.day,ctx:ctx||'day'};
  s.career.stats=s.career.stats||{trained:0,social:0,media:0,matches:0};
  logEvent(s,' 媒体：赛后发布会邀约——去「生涯」页接受采访（三选一会影响人气/士气/心态）');
  return true;
}
function playerRespondMedia(s,idx){
  s=s||S;
  if(!s||s.mode!=='player'||!s.career||!s.career.media)return false;
  const me=myPlayer(s);
  if(!me)return false;
  const pool=mediaPool().find(x=>x.id===s.career.media.id);
  const opt=pool&&pool.opts[idx|0];
  if(!opt){toast('采访选项无效');return false;}
  const why=opt.fn(s,me);
  s.career.stats=s.career.stats||{trained:0,social:0,media:0,matches:0};
  s.career.stats.media++;
  s.career.media=null;
  logEvent(s,' 媒体采访：'+me.name+' 选择「'+opt.l+'」——'+why);
  toast(why);
  save();renderAll();
  return true;
}
function playerMediaDayTick(s){
  if(!s||s.mode!=='player')return;
  // 有待答采访就不再叠加；隔天仍有概率被追问
  maybeOpenMedia(s,'day');
}
/* ================= 国家队集训专注（选手可操作面） ================= */
const NAT_FOCUS={
  form:{n:'状态拉满',d:'集训汇报额外状态+1，体力消耗+3'},
  rest:{n:'养精蓄锐',d:'体力+8/次，状态成长放缓'},
  bond:{n:'更衣室外交',d:'国家队队友人气+1，你心态+1'},
};
function setNatFocus(s,fk){
  if(!s||s.mode!=='player'||!s.career)return false;
  const me=myPlayer(s);
  if(!me||!natCamping(s,me)){toast('你不在国家队集训中');return false;}
  if(!NAT_FOCUS[fk])return false;
  s.career.natFocus=fk;
  logEvent(s,' 国家队集训策略：'+me.name+' 将「'+NAT_FOCUS[fk].n+'」（'+NAT_FOCUS[fk].d+'）');
  save();renderAll();
  return true;
}
/* 由 natCampTick 在玩家入选时调用：按专注微调日结 */
function applyNatFocus(s,p){
  if(!s||s.mode!=='player'||!s.career||!p)return;
  const me=myPlayer(s);
  if(!me||me.id!==p.id)return;
  const fk=s.career.natFocus||'form';
  if(fk==='form'){
    p.natCampForm=clamp((p.natCampForm||0)+1,0,5);
    p.energy=clamp(p.energy-3,0,ENERGY_MAX);
  }else if(fk==='rest'){
    p.energy=clamp(p.energy+8,0,ENERGY_MAX);
    p.natCampForm=clamp((p.natCampForm||0)-0,0,5); // 不额外加状态
  }else if(fk==='bond'){
    p.attrs.mind=clamp(p.attrs.mind+1,40,99);
    p.popularity=Math.min(99,(p.popularity||0)+1);
  }
}
/* ================= 状态驱动成长（加练不能一直涨） =================
   状态 form：表现 val + 士气 + 体力 + 年龄（过黄金期扣分）
   个人天花板 peak：开局按年龄/总值定房间；到顶后只维持，火热才偶发突破 */
function playerForm(p){
  if(!p)return 50;
  const val=(p.val==null)?100:p.val;
  // 表现是主信号：90→40 / 110→70 / 130→100
  const v=clamp((val-90)*1.5+40,0,100);
  const mo=clamp(p.morale==null?70:p.morale,0,100);
  const en=p.energy==null?100:clamp(p.energy,0,ENERGY_MAX||100);
  let f=v*0.5+mo*0.25+en*0.25;
  const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
  if((p.age||0)>m.gold)f-=(p.age-m.gold)*6;
  if((p.injury||0)>0)f-=15;
  return clamp(Math.round(f),0,100);
}
function formLabel(f){
  return f>=80?'火热':f>=55?'平稳':'低迷';
}
function ensurePlayerPeak(p){
  if(!p)return null;
  if(p.peak&&p.peak.lane!=null)return p.peak;
  const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
  const age=p.age==null?20:p.age;
  let room;
  if(age<18)room=12;
  else if(age<m.gold-1)room=8;
  else if(age<=m.gold)room=5;
  else if(age<m.retire)room=2;
  else room=0;
  const o=overall(p);
  if(o>=90)room=Math.min(room,3);
  else if(o>=85)room=Math.min(room,5);
  p.peak={};
  ['lane','farm','team','mind'].forEach(k=>{
    const a=p.attrs[k]||70;
    p.peak[k]=clamp(a+room,a,96);
  });
  return p.peak;
}
/* 加练一次的结果：看状态与天花板，不保证上涨 */
function trainOutcome(role,p,k){
  ensurePlayerPeak(p);
  const form=playerForm(p);
  const attr=p.attrs[k]||70;
  const peak=(p.peak&&p.peak[k]!=null)?p.peak[k]:attr;
  const room=Math.max(0,peak-attr);
  const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
  const pastGold=(p.age||0)>m.gold;
  if(room<=0){
    if(!pastGold&&form>=90&&Math.random()<0.08){
      p.peak[k]=clamp(peak+1,40,98);
      return {gain:1,form,peak:p.peak[k],note:'突破个人天花板'};
    }
    return {gain:0,form,peak,note:pastGold?'已过巅峰，只能维持':'已到个人天花板'};
  }
  let gain;
  if(form>=80){
    gain=(room>=2&&Math.random()<0.5)?2:1;
    if(role==='proj'&&room>=2)gain=2;
  }else if(form>=55){
    gain=Math.random()<0.55?1:0;
    if(gain===1&&room>=2&&Math.random()<0.2)gain=2;
  }else{
    gain=Math.random()<0.2?1:0;
  }
  if(pastGold&&gain>0&&Math.random()<0.5)gain=0; // 下滑期再砍半
  if(gain>room)gain=room;
  // note 要能独立说明结果：零收益时不能只丢一个状态词（UI toast / 日志 / 探针都读它）
  const base=formLabel(form);
  return {gain,form,peak,note:gain>0?base:base+'，今天没有提升'};
}
function benchMoraleDelta(role,base){
  if(role==='star')return base*2;
  return base;
}
/* 赛后钩子：选手模式可能触发媒体；sr 用于判定是否决赛夺冠（phase 可能尚未写成 champion） */
function playerAfterMatch(s,finalWin,sr){
 if(!s||s.mode!=='player')return;
 s.career.stats=s.career.stats||{trained:0,social:0,media:0,matches:0};
 s.career.stats.matches++;
 const isTitle=finalWin&&(s.phase==='champion'||(sr&&(sr.poSlot==='总决赛'||['ch_final','ewc_final','apo_final'].includes(sr.cupSlot))));
 if(isTitle)maybeOpenMedia(s,'title');
 else maybeOpenMedia(s,'match');
}
/* ================= 每日成长行动：加练 / 英雄特训 / 休息 =================
   从 ui-career.js 下沉（README 约定：规则与结算进引擎文件，ui*.js 只渲染与 onclick 转发）。
   三条行动原本写在 UI 里，导致能量门槛、媒体加成、伤情恢复这些规则测试覆盖不到、也调不动。
   统一返回 {ok,reason,...}：UI 只负责 toast(reason) 与 save/renderAll，不再自己判资格。 */
function playerTrainDay(s,k){
 if(!s||s.mode!=='player')return {ok:false,reason:''};
 if(s.trained)return {ok:false,reason:'今天已经练过了，明天再来'};
 const me=myPlayer(s);if(!me)return {ok:false,reason:''};
 if(s.career&&s.career.retired)return {ok:false,reason:'职业生涯已结束'};
 const blocked=trainBlockedReason(s,me);
 if(blocked)return {ok:false,reason:blocked};
 if(me.energy<10)return {ok:false,reason:'体力不足（需 10），先休息'};
 const r=trainOutcome(playerRole(s),me,k);
 // 采访「用训练说话」：本次有空间则保底/加成 +1，用完即清
 if(s.career&&s.career.mediaBuff==='train'){
  s.career.mediaBuff=null;
  const room=Math.max(0,(r.peak!=null?r.peak:99)-(me.attrs[k]||0));
  if(room>0){
   if(r.gain<1)r.gain=1;
   else if(r.gain<room)r.gain=Math.min(r.gain+1,room);
   r.note=(r.note||'状态平稳')+' · 采访加成';
  }
 }
 me.attrs[k]=clamp(me.attrs[k]+r.gain,40,99);
 me.energy=clamp(me.energy-10,0,ENERGY_MAX);
 s.trained=true;
 if(s.career){s.career.stats=s.career.stats||{trained:0,social:0,media:0,matches:0};s.career.stats.trained++;}
 const label={lane:'对线',farm:'运营',team:'团战',mind:'心态'}[k]||'属性';
 logEvent(s, r.gain>0
  ?(' 加练'+label+'：'+me.name+' '+r.note+'，属性 +'+r.gain+'（状态 '+r.form+' · 天花板 '+(r.peak||'—')+'）')
  :(' 加练'+label+'：'+me.name+' '+r.note+'（状态 '+r.form+'）'));
 return {ok:true,gain:r.gain,note:r.note};
}
function playerHeroTrainDay(s){
 if(!s||s.mode!=='player')return {ok:false,reason:''};
 if(s.trained)return {ok:false,reason:'今天已经练过了'};
 const me=myPlayer(s);if(!me)return {ok:false,reason:''};
 if(s.career&&s.career.retired)return {ok:false,reason:'职业生涯已结束'};
 const blocked=trainBlockedReason(s,me);
 if(blocked)return {ok:false,reason:blocked};
 if(me.energy<15)return {ok:false,reason:'体力不足（需 15），先休息'};
 const cand=(me.heroPool||[]).filter(h=>h.lv===2&&h.n!==me.sig);
 if(!cand.length)return {ok:false,reason:'没有可升绝活的熟练英雄（先在英雄池把英雄练到「熟练」）'};
 const h=pick(cand);h.lv=3;
 me.energy=clamp(me.energy-15,0,ENERGY_MAX);
 s.trained=true;
 logEvent(s,' 英雄特训：'+me.name+' 把 '+h.n+' 练成了绝活（战力 +8%）');
 return {ok:true,hero:h.n};
}
function playerRestDay(s){
 if(!s||s.mode!=='player')return {ok:false,reason:''};
 if(s.trained)return {ok:false,reason:'今天已经休息过了'};
 const me=myPlayer(s);if(!me)return {ok:false,reason:''};
 const injBefore=me.injury||0;
 me.energy=clamp(me.energy+55,0,ENERGY_MAX);
 me.morale=clamp(me.morale+4,20,100);
 if(me.injury>0)me.injury=Math.max(0,me.injury-2); // 与教练模式全队休息同规则：休息加速养伤
 s.trained=true;
 logEvent(s,' 休息一天：'+me.name+' 体力恢复'+(injBefore>0?'，伤情 '+injBefore+'→'+me.injury+' 天':''));
 return {ok:true};
}

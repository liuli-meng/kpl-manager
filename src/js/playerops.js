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
    const mates=(s.players||[]).filter(p=>p.id!==me.id&&!p.loanOut&&!(p.kjia>0)&&!p.retiring);
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
/* ================= 角色对板凳/成长的修正（由 career/train 调用） ================= */
function benchMoraleDelta(role,base){
  if(role==='star')return base*2;
  return base;
}
function trainGainMin(role){return role==='proj'?2:1;}
function trainGainRoll(role){
  return rnd(trainGainMin(role),2);
}
/* 赛后钩子：选手模式可能触发媒体 */
function playerAfterMatch(s,finalWin){
  if(!s||s.mode!=='player')return;
  s.career.stats=s.career.stats||{trained:0,social:0,media:0,matches:0};
  s.career.stats.matches++;
  if(finalWin&&s.phase==='champion')maybeOpenMedia(s,'title');
  else maybeOpenMedia(s,'match');
}

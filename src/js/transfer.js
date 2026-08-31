/* 生成 AI 战队阵容（BP 界面可见对手选手与招牌英雄） */
function ensureAiRosters(s,teamName){
  s.aiRosters=s.aiRosters||{};
  if(s.aiRosters[teamName])return s.aiRosters[teamName];
  const map=aiRosterDefMap(s);
  const ids=map[teamName];
  if(!ids)return [];
  s.aiPower=s.aiPower||{};
  const ownedIds=new Set(s.players.map(p=>p.id));
  const ownedNames=new Set(s.players.map(p=>p.name));
  const roster=ids.map(pid=>{
    const def=defOf(s,pid);
    if(!def)return null;
    if(s.retiredDefs&&s.retiredDefs.includes(pid))return null; // 已退役：空位由青训递补
    if(ownedIds.has(def.id)||ownedNames.has(def.name))return null; // 已被玩家签走：不再出现在对手阵中
    const p=genSeasonPlayer(s,def);
    return p;
  }).filter(Boolean).filter(p=>p.age<(AGE_MODEL[p.pos]||AGE_MODEL.mid).retire); // 到龄退役，空位由青训递补
  // 空位用本队青训递补，保证 5 人；查重必须看全局（玩家+青训营+市场+其他 AI 队缓存），
  // 否则 A/B 两队各自补青训会挑到同一个名字（跨队重名 bug）
  ['top','jg','mid','ad','sup'].forEach(pos=>{
    if(roster.some(p=>p.pos===pos))return;
    const usedNames=rookieUsedNames(s);
    roster.forEach(p=>usedNames.add(p.name));
    const p=genSeasonPlayer(s,genAcademyDef(pos,usedNames,s.season));
    roster.push(p);
  });
  s.aiRosters[teamName]=roster;
  s.aiPower[teamName]=aiRosterPower(roster); // AI 战力=真实阵容结算（与玩家 teamPower 同刻度）
  return roster;
}
/* AI 选手随赛季年龄成长/衰减（与玩家 newSeason 同规则），联赛会随赛季演化
   黄金期每年 +1~2 点（原固定 +1 追不上玩家的训练速度，AI 会原地踏步） */
function ageDrift(p){
  const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
  if(p.age<=m.gold){
    p.attrs[pick(['lane','farm','team','mind'])]=clamp(p.attrs[pick(['lane','farm','team','mind'])]+rnd(2,3),55,99);
  }else if(p.age<m.retire){
    const key=pick(['lane','farm','team','mind']);
    p.attrs[key]=clamp(p.attrs[key]-rnd(1,m.decay),40,99);
  }
}
/* 从原始定义重建选手：年龄逐年推进到当前赛季，成长/衰减逐年结算
   （修复旧版年龄一次跳 N-1 岁但只结算 1 年成长的问题，黄金期选手会真实变强） */
function genSeasonPlayer(s,def){
  const p=genPlayer(def);
  for(let i=0;i<s.season-1;i++){p.age++;ageDrift(p);}
  return p;
}
/* 青训递补选手定义（不占用联盟注册名额，与玩家、各队均不重名）
   底子随赛季水涨船高（每赛季+2，封顶+14）：明星到龄退役后联盟战力不至于塌方 */
let _acSeq=0;
function genAcademyDef(pos,usedNames,season){
  let name=typeof ACADEMY_NAMES!=='undefined'?ACADEMY_NAMES.find(n=>!usedNames.has(n)):null;
  if(!name){do{name='青训'+(++_acSeq);}while(usedNames.has(name));} // 自增序号兜底：名字空间耗尽也不会死循环
  usedNames.add(name);
  const cands=HEROES.filter(h=>h.pos[0]===pos);
  const boost=Math.min(2*((season||1)-1),14);
  const b=v=>clamp(v+boost,40,99);
  return {id:'ac_'+pos+'_'+Math.random().toString(36).slice(2,7),name,pos,team:null,tags:['🌱'],
    base:[b(68),b(68),b(70),b(72)],skill:{n:'青训体系',t:'team',d:'团战属性额外+8%'},
    sig:pick(cands.length?cands:HEROES).n,career:'本队青训营提拔，阶梯赛历练稳定。'};
}
/* ================= AI 转会生态 =================
   AI 阵容以「选手定义(def)」持久化在 s.aiRosterDefs（初始=AI_ROSTERS），每赛季转会期：
   退役结算 → 缺位补强 → 明星流转 → 新星出道。真实选手在联盟内流转，
   玩家始终有明星可挖；青训递补只做兜底，联盟不再随退役塌方。 */
function aiRosterDefMap(s){
  if(!s.aiRosterDefs){
    s.aiRosterDefs={};
    for(const tn in AI_ROSTERS)s.aiRosterDefs[tn]=AI_ROSTERS[tn].p.slice();
  }
  return s.aiRosterDefs;
}
function defOf(s,pid){return PLAYER_POOL.find(d=>d.id===pid)||FA_2026.find(d=>d.id===pid)||(s.extraDefs||[]).find(d=>d.id===pid)||null;}
function aiDetachDef(s,pid){ // def 被玩家签走：从所有 AI 队除名，原队转会期自动补强
  if(!defOf(s,pid))return;
  const map=aiRosterDefMap(s);
  for(const tn in map)map[tn]=map[tn].filter(id=>id!==pid);
}
function aiAttachDef(s,pid,teamName){ // def 流入某 AI 队（位置与名额合法才接收）
  const def=defOf(s,pid);
  if(!def)return;
  const map=aiRosterDefMap(s);
  if(!map[teamName]||map[teamName].length>=5)return;
  if(map[teamName].some(id=>{const d=defOf(s,id);return d&&d.pos===def.pos;}))return;
  aiDetachDef(s,pid);
  const arr=map[teamName]; // aiDetachDef 会整体替换各队数组，必须在除名后重取引用，否则 push 到孤儿数组、该选手从联盟消失
  arr.push(pid);
  s.aiRosters={}; // 名册缓存失效：该选手立即为买方出战、原队除名（与 negoComplete 同步，否则整个赛季缓存都是旧的）
}
/* 新星出道：生成一名新秀 def 进入联盟流转（补真实选手的退役折损）
   底子随赛季水涨船高（每赛季+2，封顶+12）：新生代一代比一代强，联盟整体缓慢上探 */
function genStarDef(s,usedNames,forcePos){
  const pos=forcePos||pick(POS_ORDER);
  let name=ACADEMY_NAMES.find(n=>!usedNames.has(n));
  if(!name){do{name='新星'+(++_acSeq);}while(usedNames.has(name));} // 自增序号兜底：名字空间耗尽也不会死循环
  usedNames.add(name);
  const sk=pick([['lane','线霸体系','对线属性额外+10%'],['farm','运营体系','运营属性额外+10%'],
                 ['team','团战体系','团战属性额外+10%'],['mind','大心脏体系','心态属性额外+10%']]);
  const boost=Math.min(2*((s.season||1)-1),12);
  const b=v=>clamp(v+boost,40,99);
  return {id:'ns_'+s.season+'_'+Math.random().toString(36).slice(2,7),name,pos,team:null,tags:['🌱'],
    base:[b(rnd(74,84)),b(rnd(74,84)),b(rnd(74,84)),b(rnd(74,84))],
    skill:{n:sk[1],t:sk[0],d:sk[2]},sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n,
    career:'赛季'+s.season+'从青训营出道的新生代，天赋肉眼可见。'};
}
/* AI 转会期（newSeason 内调用）：联盟生态推进 */
function aiTransferWindow(s){
  const map=aiRosterDefMap(s);
  s.extraDefs=s.extraDefs||[];
  s.retiredDefs=s.retiredDefs||[];
  const teams=Object.keys(map).filter(tn=>tn!==s.teamName);
  const roll={}; // def 当前赛季估值（窗口内缓存，避免同 def 多次随机重掷）
  const ovrOf=def=>roll[def.id]||(roll[def.id]=overall(genSeasonPlayer(s,def)));
  // ① 退役结算：到龄选手离开联盟（转型教练/主播进入名宿市场）
  teams.forEach(tn=>{
    map[tn]=map[tn].filter(pid=>{
      const def=defOf(s,pid);
      if(!def)return false;
      if(s.retiredDefs.includes(pid))return false;
      const p=genSeasonPlayer(s,def);
      const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
      if(p.age>=m.retire){
        s.retiredDefs.push(pid);
        retireToCoach(s,p);
        logEvent(s,'🎖️ '+p.name+'（'+p.age+'岁）宣布退役，'+tn+' 腾出'+POS[p.pos][0]+'位置');
        return false;
      }
      return true;
    });
  });
  // ② 自由池：未被任何 AI 队签下的 def（原版无队选手、被放走的老将、待业新星）
  // 先清「幽灵注册」：玩家已买走的 def 若残留在某 AI 队注册表（旧档/并发路径），一律除名——
  // 否则该位置被幽灵占位，球队永远补不进真人（上场时 ownedIds 过滤又打不出战力）
  teams.forEach(tn=>{
    map[tn]=map[tn].filter(pid=>!s.players.some(x=>x.id===pid));
  });
  const assigned=new Set();
  teams.forEach(tn=>map[tn].forEach(id=>assigned.add(id)));
  // 自由池必须排除玩家已拥有的 def：否则会被 AI「签走」成幽灵，占住别人阵容还补不了强
  let freePool=PLAYER_POOL.concat(s.extraDefs).filter(d=>!assigned.has(d.id)&&!s.retiredDefs.includes(d.id)&&!s.players.some(x=>x.id===d.id)).slice();
  // ③ 缺位补强：弱队优先，按位置签自由池最强者；池里没有该位置候选人时
  //    直接引进一名新援（青训提拔/次级联赛引援）——绝不让空位拖一整赛季
  const order=teams.slice().sort((a,b)=>(s.aiPower[a]||400)-(s.aiPower[b]||400));
  const usedNames=rookieUsedNames(s); // 全局查重（玩家/青训/市场/各队缓存）
  PLAYER_POOL.concat(s.extraDefs).forEach(d=>usedNames.add(d.name));
  order.forEach(tn=>{
    let guard=0;
    while(map[tn].length<5&&guard++<6){
      const have=new Set(map[tn].map(id=>defOf(s,id)).filter(Boolean).map(d=>d.pos));
      const need=POS_ORDER.find(pos=>!have.has(pos));
      if(!need)break;
      const cands=freePool.filter(d=>d.pos===need);
      let def;
      if(cands.length){
        def=cands.sort((a,b)=>ovrOf(b)-ovrOf(a))[0];
        freePool=freePool.filter(d=>d!==def);
        logEvent(s,'🤝 转会：'+def.name+' 加盟 '+tn+'（'+POS[def.pos][0]+'）');
      }else{
        def=genStarDef(s,usedNames,need); // 自由池无人可签：按缺位引进新援（对位培养，底子随赛季水涨船高）
        s.extraDefs.push(def);
        logEvent(s,'🎯 补强：'+tn+' 引进 '+def.name+'（'+POS[def.pos][0]+' · 次级联赛引援）');
      }
      map[tn].push(def.id);
    }
  });
  // ④ 明星流转：每队有五成概率用自由池明显更强的同位置选手换下一名首发
  order.forEach(tn=>{
    if(Math.random()>=0.5||map[tn].length<5||!freePool.length)return;
    let best=null;
    map[tn].forEach(pid=>{
      const def=defOf(s,pid);
      if(!def)return;
      const cur=ovrOf(def);
      freePool.forEach(d=>{
        if(d.pos!==def.pos)return;
        const gain=ovrOf(d)-cur;
        if(gain>=4&&(!best||gain>best.gain))best={gain,pid,def,out:def};
      });
    });
    if(best){
      const out=best.out;
      freePool=freePool.filter(d=>d!==best.def);
      map[tn]=map[tn].map(id=>id===best.pid?best.def.id:id);
      freePool.push(out);
      logEvent(s,'🔄 转会：'+best.def.name+' 加盟 '+tn+'，'+out.name+' 离队寻找下家');
    }
  });
  // ⑤ 新星出道：每赛季 2-3 名新秀进入联盟（对冲各位置退役潮，优先补缺位，否则待业进自由市场）
  const births=rnd(2,3);
  for(let i=0;i<births;i++){
    const def=genStarDef(s,usedNames);
    s.extraDefs.push(def);
    const tn=order.find(t=>map[t].length<5&&!map[t].some(id=>{const d=defOf(s,id);return d&&d.pos===def.pos;}));
    if(tn){map[tn].push(def.id);logEvent(s,'🌟 新星出道：'+def.name+'（'+POS[def.pos][0]+'）加盟 '+tn);}
    else{logEvent(s,'🌟 新星出道：'+def.name+'（'+POS[def.pos][0]+'）进入自由市场');}
  }
}
/* 构建转会市场：各 AI 队选手（含非卖品与意愿） */
function buildTransferMarket(s){
  s.transferList=[];
  const U=new Set(); // 非卖品按原队设定（建队核心走到哪都是队魂）
  for(const tn in AI_ROSTERS)AI_ROSTERS[tn].u.forEach(id=>U.add(id));
  const map=aiRosterDefMap(s);
  for(const tn in map){
    if(tn===s.teamName)continue;
    map[tn].forEach(pid=>{
      if(s.players.some(x=>x.id===pid))return; // 玩家已拥有
      if((s.retiredDefs||[]).includes(pid))return; // 已退役
      const def=defOf(s,pid);
      if(!def)return;
      const p=genSeasonPlayer(s,def); // 与 AI 名册同规则：年龄逐年推进+成长结算
      p.ownerTeam=tn;
      p.untouchable=U.has(pid);
      // 达到位置退役年龄（野射24/对抗中26/辅助31）：不进买断池，老将转向名宿市场（教练/主播）
      const am=AGE_MODEL[p.pos]||AGE_MODEL.mid;
      if(p.age>=am.retire){retireToCoach(s,p);return;}
      if(p.age>am.gold)p.aging=true; // 已过黄金期：买来即巅峰末期
      // 非卖品并非永远忠诚：意愿随年龄衰减（30岁+大幅松动，队魂也会离队）
      if(p.untouchable){
        const decay=p.age>=30?rnd(30,45):p.age>=27?rnd(12,22):rnd(0,8);
        p.willingness=clamp(rnd(85,100)-decay,25,100);
      }
      s.transferList.push(p);
    });
  }
  s.transferList.sort((a,b)=>overall(b)-overall(a));
  // 自由球员：26 年自由市场（真实 KPL 选手轮换上架，签一人少一人）+ 各队无球可打的替补
  s.freeAgents=[];
  const seenFA=new Set();
  shuffle(FA_2026.filter(d=>!s.players.some(x=>x.id===d.id)&&!(s.retiredDefs||[]).includes(d.id))).slice(0,3).forEach(def=>{
    seenFA.add(def.id);
    const p=genSeasonPlayer(s,def);
    p.signCost=Math.round(valueOf(overall(p))*0.7); // 真实选手身价 7 折直签
    p.freeAgent=true;
    p.willingness=rnd(70,95); // 合同到期，寻求下家
    s.freeAgents.push(p);
  });
  while(s.freeAgents.length<3){
    const pos=pick(POS_ORDER);
    const assigned=new Set(); // 各 AI 队在册 def：真正的无球可打者才能进自由市场
    const dmap=aiRosterDefMap(s);
    for(const tn in dmap){if(tn===s.teamName)continue;dmap[tn].forEach(id=>assigned.add(id));}
    const pool=PLAYER_POOL.concat(s.extraDefs||[]).filter(d=>d.pos===pos&&!seenFA.has(d.id)
      &&!assigned.has(d.id)&&!(s.retiredDefs||[]).includes(d.id)&&!s.players.some(x=>x.id===d.id));
    if(!pool.length)break;
    const def=pick(pool);
    seenFA.add(def.id);
    const p=genSeasonPlayer(s,def);
    p.signCost=Math.round(valueOf(overall(p))*0.58); // 无球可打，按身价 58 折直签
    p.freeAgent=true;
    p.willingness=rnd(70,100); // 无球可打，想走
    s.freeAgents.push(p);
  }
  s.freeAgents.sort((a,b)=>overall(b)-overall(a));
}
/* 买断费：基础价（总值曲线） × 战力加成 × 意愿系数（意愿低=更难挖） */
function buyoutPrice(p){
  const base=valueOf(overall(p));
  const powBonus=1+Math.max(0,(playerPower(p,p.sig)-55)/200);
  const wilMult=p.willingness>=60?1:p.willingness>=30?1.5:2.2;
  return Math.round(base*powBonus*wilMult);
}
/* 非卖品强挖：2.5倍溢价，成功率=意愿缺口，失败意愿-10（多次尝试终能打动） */
function untouchablePrice(p){return Math.round(buyoutPrice(p)*2.5);}
function raidChance(p){return clamp((100-p.willingness)/100,0.02,0.8);}
/* ================= FC26 式转会谈判 =================
   玩家报「转会费+年薪」组合报价 → 对方评估 → 最多 3 轮拉锯：
   每轮被拒后对方给出明确还价，接受还价即成交；超轮次或强挖失败则谈判破裂。
   超帽不拒签：允许超工资帽签约，超出部分每周缴纳 60% 奢侈税（发薪日结算，经营页可见）。 */
function negoWageDemand(p){
  return Math.max(2,Math.round(p.wage*(1.15+(100-p.willingness)/120)));
}
function negoAskFee(p){
  return p.untouchable?untouchablePrice(p):buyoutPrice(p);
}
function overCapTax(s,extraWage){
  const over=Math.max(0,weeklyWage(s)+(extraWage||0)-s.wageCap);
  return {over,tax:Math.round(over*0.6)};
}
function negoCapCheck(s,p){
  const {over,tax}=overCapTax(s,p.wage);
  if(over<=0)return true;
  return confirm('⚠️ 超帽签约：签下 '+p.name+' 后周薪 '+(weeklyWage(s)+p.wage)+'万（帽 '+s.wageCap+'万），超出 '+over+'万/周 需每周缴纳 60% 奢侈税（'+tax+'万/周）。\n多花钱可以，确定签下？');
}
function negoComplete(s,p,fee){
  const from=p.ownerTeam,isFA=p.freeAgent;
  delete p.ownerTeam;delete p.untouchable;delete p.freeAgent;delete p.signCost;
  if(fee!=null)p.acqCost=fee; // 买入价锚定（自由球员记 0，转售按保底价压）
  s.players.push(p);
  aiDetachDef(s,p.id); // 从 AI 阵容除名（若为 def）：原队下个转会期自动补强
  if(isFA)s.freeAgents=(s.freeAgents||[]).filter(x=>x.id!==p.id);
  s.transferList=(s.transferList||[]).filter(x=>x.id!==p.id);
  s.aiRosters={}; // 玩家签走任何选手后重建全部对手名册（自由球员也可能是他人首发，防同一名选手出现在两队）
}
function openNegotiation(s,pid){
  const p=s.transferList.find(x=>x.id===pid)||(s.freeAgents||[]).find(x=>x.id===pid);
  if(!p){toast('该选手不在转会市场');return;}
  if(s.players.some(x=>x.id===pid)){toast('已拥有该选手');return;}
  window._nego={s,pid,round:1,
    freeAgent:!!p.freeAgent,
    askFee:p.freeAgent?0:negoAskFee(p),
    askWage:negoWageDemand(p)};
  renderNego();
}
function negoRow(label,value,extra){return `<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--dim)">${label}</span><b>${value}${extra||''}</b></div>`;}
function renderNego(){
  const n=window._nego;if(!n)return;
  const s=n.s,p=s.transferList.find(x=>x.id===n.pid)||(s.freeAgents||[]).find(x=>x.id===n.pid);
  if(!p){window._nego=null;return;}
  const cur=weeklyWage(s);
  let html=`<h2>🤝 转会谈判 <span class="tag">第 ${n.round}/3 轮</span></h2>
  <div class="match" style="margin:10px 0;padding:10px 12px">
    <div class="center" style="margin-bottom:6px"><b style="font-size:16px;color:${ovrColor(overall(p))}">${p.name}</b>
      <span class="dim">${POS[p.pos][0]} · 总值${overall(p)} · ${p.age}岁 · 战力 ${playerPower(p,p.sig)}</span></div>
    ${negoRow('现效力',p.freeAgent?'自由球员（无球可打）':p.ownerTeam||'—')}
    ${negoRow('本人意愿',p.willingness+' / 100',p.willingness<40?' <span style="color:var(--red)">（很可能拒绝）</span>':'')}
    ${negoRow('对方心理价位',n.freeAgent?'—（仅谈薪资）':n.askFee+'万 转会费')}
    ${negoRow('期望年薪',n.askWage+'万')}
    ${(()=>{const {over,tax}=overCapTax(s,p.wage);return negoRow('签后周薪',(cur+p.wage)+' / 帽 '+s.wageCap+'万',over>0?` <span style="color:var(--red)">超帽${over}万 · 税${tax}万/周</span>`:' <span style="color:var(--green)">帽内</span>');})()}
    ${p.untouchable?`<div class="hint" style="color:var(--red)">🔒 非卖品：需 ${n.askFee}万 溢价强挖，每轮谈判有失败风险</div>`:''}
  </div>
  <div class="hint" style="margin-bottom:8px">报价需同时满足「转会费 ≥ 心理价位」和「年薪 ≥ 期望」，也可压价试探——但每被拒一轮，对方要价上涨，第 3 轮仍不满足则谈判破裂（意愿-10）。</div>
  ${n.msg?`<div class="event-card" style="margin-bottom:10px">${n.msg}</div>`:''}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
    <label style="flex:1;min-width:120px">转会费(万)<input id="nego-fee" type="number" class="hd-in" value="${n.freeAgent?0:Math.round(n.askFee*0.8)}" ${n.freeAgent?'disabled':''} style="width:100%;margin-top:4px"></label>
    <label style="flex:1;min-width:120px">年薪(万)<input id="nego-wage" type="number" class="hd-in" value="${n.askWage}" style="width:100%;margin-top:4px"></label>
  </div>
  <div class="center" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
    <button class="btn" onclick="negoQuit()">🚪 放弃</button>
    ${!n.freeAgent?`<button class="btn" onclick="negoFillAsk()">🎯 满足要价</button>`:''}
    <button class="btn primary" onclick="negoSubmit()">📤 递交报价</button>
  </div>`;
  $('#app-modal-body').innerHTML=html;
  $('#app-modal').classList.add('on');
}
function negoFillAsk(){
  const n=window._nego;if(!n)return;
  // 意愿低的选手需要溢价才肯加盟（1.3 倍转会费），“满足要价”直接给出可成交的数
  const mult=(n.s.transferList.find(x=>x.id===n.pid)||{}).willingness<30?1.3:1;
  $('#nego-fee').value=Math.round(n.askFee*mult);$('#nego-wage').value=n.askWage;
}
function negoQuit(){
  window._nego=null;closeModal('app-modal');toast('已退出谈判');
}
function negoSubmit(){
  const n=window._nego;if(!n)return;
  const s=n.s,p=s.transferList.find(x=>x.id===n.pid)||(s.freeAgents||[]).find(x=>x.id===n.pid);
  if(!p){window._nego=null;closeModal('app-modal');toast('谈判对象已失效（被他人签走或市场刷新）');return;}
  const fee=n.freeAgent?0:Math.max(0,parseInt($('#nego-fee').value,10)||0);
  const wage=Math.max(1,parseInt($('#nego-wage').value,10)||0);
  if(!n.freeAgent&&fee>s.fund){n.msg='💸 俱乐部资金不足（现有 '+fmt(s.fund)+'万，报价 '+fee+'万）。';renderNego();return;}
  // 非卖品强挖：每轮都掷成功率，失败=本轮破裂且要价上涨
  if(p.untouchable&&Math.random()>raidChance(p)){
    p.willingness=clamp(p.willingness-10,5,100);
    n.askFee=Math.round(n.askFee*1.15);n.askWage=negoWageDemand(p);
    n.round++;
    logEvent(s,'❌ 强挖 '+p.name+' 被拒（'+(p.ownerTeam||'原俱乐部')+' 态度强硬，意愿-10）');
    if(n.round>3){negoBreak(s,p,'强挖多次未果');return;}
    n.msg='🚫 '+p.ownerTeam+' 拒绝放人！对方态度更加强硬（意愿降至 '+p.willingness+'，要价已上调）。';
    renderNego();return;
  }
  // 评估：转会费/年薪是否达到逐轮上涨的要价
  const feeOk=n.freeAgent||fee>=n.askFee;
  const wageOk=wage>=n.askWage;
  const willingOk=p.willingness>=30||fee>=n.askFee*1.3; // 意愿低但要价给足也能打动
  if(feeOk&&wageOk&&willingOk){
    if(!negoCapCheck(s,p))return; // 超帽需确认（奢侈税），取消则留在谈判
    if(!n.freeAgent)s.fund-=fee;
    p.wage=wage;
    negoComplete(s,p,n.freeAgent?0:fee);
    logEvent(s,(n.freeAgent?'⚪ 签下自由球员 ':'💰 转会达成！')+' '+p.name+' 加盟 '+s.teamName+(n.freeAgent?'（年薪 '+wage+'万）':'（转会费 '+fee+'万 · 年薪 '+wage+'万）'));
    if(fee>=300)logEvent(s,'💣 重磅转会！联盟震动');
    window._nego=null;closeModal('app-modal');
    save();renderAll();toast('🎉 谈判成功！'+p.name+' 加盟');
    return;
  }
  // 被拒：给还价，要价上涨
  n.round++;
  n.askFee=n.freeAgent?0:Math.round(n.askFee*(feeOk?1:1.12));
  n.askWage=Math.round(n.askWage*(wageOk?1:1.1));
  const why=[];
  if(!feeOk)why.push('转会费低于心理价位');
  if(!wageOk)why.push('年薪不够');
  if(!willingOk)why.push('本人无意加盟');
  if(n.round>3){negoBreak(s,p,why.join('、'));return;}
  n.msg='🚫 对方摇头：'+why.join('、')+'。<br>📩 经纪人放话——'+(n.freeAgent?'':'转会费至少 <b style="color:var(--gold)">'+n.askFee+'万</b>，')+'年薪 <b style="color:var(--gold)">'+n.askWage+'万</b> 才考虑。';
  renderNego();
}
function negoBreak(s,p,reason){
  p.willingness=clamp(p.willingness-10,5,100);
  logEvent(s,'❌ 与 '+p.name+' 的谈判破裂（'+reason+'），选手意愿-10');
  window._nego=null;closeModal('app-modal');
  save();renderAll();toast('谈判破裂：'+p.name+' 不为所动');
}

/* ================= 卖方谈判（FC26 式：多家俱乐部竞价，你抬价/递要价/接受） =================
   与买方对称：意向俱乐部数量由总值/人气决定，预算按俱乐部身价；
   三轮内递交心理要价——要价≤对方预算则接受、接近预算则给最终报价、过高直接退出；
   任何时候可接受某个报价；「回收商」一口价永远兜底（原秒卖价）。
   转售保护：刚买入未打满 5 场的选手，报价被压在买入价九折内（杜绝低价买高价卖的套利）。 */
function sellAskPrice(p){
  const base=Math.round(valueOf(overall(p))*0.92);
  const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
  const ageF=p.age<=m.gold?1.1:p.age>=m.retire-1?0.7:0.9; // 黄金期溢价，临近退役打折
  const popF=1+(p.popularity||0)/250; // 人气=商业价值
  const valF=(p.val||100)/100; // 比赛表现浮动：状态火热溢价、持续低迷打折（70%~150%）
  return Math.round(base*ageF*popF*valF);
}
/* 表现状态标签（身价浮动可视化） */
function perfLabel(p){
  const v=p.val||100;
  return v>=125?'🔥火热':v>=110?'↗走高':v>=95?'—稳定':v>=80?'↘下滑':'❄️低迷';
}
/* 转售上限：有买入记录且出场<5 时返回价格上限，否则 null（无限制） */
function sellCeiling(p){
  if(p.acqCost==null||(p.caps||0)>=5)return null;
  const anchor=(p.acqCost||0)>0?p.acqCost:Math.round(valueOf(overall(p))*0.65);
  return Math.round(anchor*0.9);
}
function openSellNego(s,pid){
  const p=s.players.find(x=>x.id===pid);
  if(!p)return;
  if(p.loan){toast('租借选手不属于俱乐部，不能出售');return;}
  if((s.listed||[]).some(x=>x.id===pid)){toast('该选手已挂牌，请先撤牌或等待报价');return;}
  const ask=sellAskPrice(p);
  const cap=sellCeiling(p);
  let cnt=overall(p)>=88?rnd(2,3):overall(p)>=78?rnd(1,2):(Math.random()<0.6?1:0); // 总值/人气决定意向俱乐部数
  if((p.popularity||0)>50)cnt++;
  const pool=AI_TEAMS.filter(t=>t.name!==s.teamName).slice();
  const clubs=[];
  for(let i=0;i<cnt&&pool.length;i++){
    const t=pool.splice(Math.floor(Math.random()*pool.length),1)[0];
    const wealth=0.85+(t.power/640)*0.5; // 豪门预算更足
    let max=Math.round(ask*wealth*rnd(90,115)/100);
    if(cap!=null)max=Math.min(max,cap);
    clubs.push({name:t.name,max,bid:Math.round(max*rnd(60,78)/100),status:'active'});
  }
  window._sellNego={s,pid,round:1,ask,lock:cap!=null,lockCaps:Math.min(p.caps||0,4),
    lowball:Math.round(valueOf(overall(p))*0.65),
    clubs,
    msg:clubs.length?'收到 '+clubs.length+' 家俱乐部的初步报价：可直接接受、对某家逐轮抬价，或统一递交心理要价。':'暂无俱乐部感兴趣——可去挂牌等报价，或接受回收商一口价。'};
  renderSellNego();
}
function renderSellNego(){
  const n=window._sellNego;if(!n)return;
  const s=n.s,p=s.players.find(x=>x.id===n.pid);
  if(!p){window._sellNego=null;return;}
  const rows=n.clubs.map((c,i)=>{
    const badge=c.status==='agreed'?'<span class="green">✅ 接受你的要价</span>'
      :c.status==='final'?'<span style="color:var(--gold)">最终报价 · 不再抬</span>'
      :c.status==='walked'?'<span class="red">已退出</span>'
      :'<span style="color:var(--dim)">有意向</span>';
    const btn=c.status==='walked'?'':`<button class="btn sm primary" style="margin:0;min-width:56px" onclick="sellAcceptClub(${i})">接受</button>`;
    return `<div class="match" style="margin-bottom:6px;padding:8px 10px">
      <div class="vs"><span class="tname" style="font-size:13px">${c.name}</span><div class="power" style="font-size:10px">${badge}</div></div>
      <div class="score" style="font-size:13px;min-width:0">${c.bid}万</div>
      ${btn}
    </div>`;
  }).join('');
  const lowballRow=`<div class="match" style="margin-bottom:6px;padding:8px 10px">
    <div class="vs"><span class="tname" style="font-size:13px">回收商</span><div class="power" style="font-size:10px"><span style="color:var(--dim)">一口价打包带走</span></div></div>
    <div class="score" style="font-size:13px;min-width:0">${n.lowball}万</div>
    <button class="btn sm" style="margin:0;min-width:56px" onclick="sellAcceptClub(-1)">接受</button>
  </div>`;
  const html=`<h2><span class="h-ic">${ic('coin')}</span>出售谈判 <span class="tag">${p.name} · 第 ${Math.min(n.round,3)}/3 轮</span></h2>
  <div class="hint" style="margin-bottom:8px">${POS[p.pos][1]} · 总值${overall(p)} · ${p.age}岁 · 战力 ${playerPower(p,p.sig)} · 人气 ${p.popularity||0} · 表现 <b class="${(p.val||100)>=110?'green':(p.val||100)<90?'red':''}">${perfLabel(p)} ${p.val||100}%</b><br>心理要价随比赛表现浮动（火热最高 +50%、低迷最低 -30%）；要价≤预算即成交、接近预算给最终报价、太高直接吓跑；三轮后未成交只剩回收商。</div>
  ${rows}${lowballRow}
  ${n.lock?`<div class="hint" style="margin:8px 0;color:var(--gold)">🔒 新援保护期：${p.name} 尚未代表球队打满 5 场（当前 ${n.lockCaps}/5），俱乐部报价压在买入价九折内——先让他上场，打满后恢复真实身价。</div>`:''}
  ${n.msg?`<div class="hint" style="margin:8px 0;color:var(--cyan)">${n.msg}</div>`:''}
  <div style="display:flex;gap:8px;align-items:center;margin:10px 0">
    <span style="font-size:12px;color:var(--dim);white-space:nowrap">心理要价</span>
    <input id="sell-ask" type="number" value="${n.ask}" style="flex:1;background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px 10px;font-size:14px">
    <button class="btn primary" onclick="sellSubmitAsk()">📨 递交要价</button>
  </div>
  <div class="center" style="display:flex;gap:8px;justify-content:center">
    <button class="btn" onclick="sellQuit()">🚪 停止出售</button>
  </div>`;
  $('#app-modal-body').innerHTML=html;
  $('#app-modal').classList.add('on');
}
function sellSubmitAsk(){
  const n=window._sellNego;if(!n)return;
  const A=Math.max(1,parseInt($('#sell-ask').value,10)||0);
  n.ask=A;n.round++;
  let agreed=0,finals=0,left=0;
  n.clubs.forEach(c=>{
    if(c.status!=='active')return;
    if(A<=c.max){c.bid=A;c.status='agreed';agreed++;}
    else if(A<=c.max*1.25){c.bid=c.max;c.status='final';finals++;}
    else{c.status='walked';left++;}
  });
  if(n.round>3){
    n.clubs.forEach(c=>{if(c.status==='active'){c.bid=c.max;c.status='final';}});
    n.msg='📩 最后通牒：三轮报价结束，仍在谈的俱乐部给出了最终报价——接受或放弃。';
  }else if(agreed){
    n.msg='✅ '+agreed+' 家俱乐部接受你的要价，点「接受」即可成交！';
  }else if(finals){
    n.msg='📩 '+finals+' 家俱乐部给出了最终报价，再抬价他们就退出了'+(left?'，另有 '+left+' 家已离场':'')+'。';
  }else{
    n.msg='😅 要价太高，俱乐部都在观望或离场……';
  }
  renderSellNego();
}
function sellAcceptClub(i){
  const n=window._sellNego;if(!n)return;
  const s=n.s;
  let team,fee;
  if(i<0){team='回收商';fee=n.lowball;}
  else{
    const c=n.clubs[i];
    if(!c||c.status==='walked'){toast('该俱乐部已退出谈判');return;}
    team=c.name;fee=c.bid;
  }
  const p=s.players.find(x=>x.id===n.pid);
  if(!p)return;
  const wasStarter=s.lineup.includes(p.id);
  completeSale(s,p,fee,team);
  if(wasStarter&&!s.players.some(x=>x.pos===p.pos))toast('⚠️ '+POS[p.pos][0]+'位置已无人，记得补签');
  window._sellNego=null;closeModal('app-modal');
  save();renderAll();toast(p.name+' 已售出（'+fee+'万）');
}
function sellQuit(){
  window._sellNego=null;closeModal('app-modal');toast('已停止出售，选手留队');
}
/* 成交共用：转会费入账 + 名册/首发/挂牌清理 */
function completeSale(s,p,fee,team){
  s.fund+=fee;
  s.players=s.players.filter(x=>x.id!==p.id);
  if(s.lineup.includes(p.id))s.lineup=s.lineup.filter(x=>x!==p.id);
  if(s.pick)delete s.pick[p.pos];
  s.listed=(s.listed||[]).filter(x=>x.id!==p.id);
  s.bids=(s.bids||[]).filter(x=>x.id!==p.id);
  aiAttachDef(s,p.id,team); // 买入方 AI 队在册（若为 def），下赛季起为他出战
  logEvent(s,'💰 '+p.name+' 转会至 '+team+'（转会费 '+fee+'万）');
  if(fee>=300)logEvent(s,'💣 重磅转会！联盟震动');
}

/* 玩家挂牌 / 撤牌 */
function listPlayer(s,pid){
  const p=s.players.find(x=>x.id===pid);
  if(!p)return;
  if(p.loan){toast('租借选手不属于俱乐部，不能挂牌');return;}
  if(s.lineup.includes(pid)){toast('请先将该选手移出首发');return;}
  if((s.listed||[]).some(x=>x.id===pid)){toast('该选手已在挂牌名单');return;}
  const price=Math.round(valueOf(overall(p))*(p.willingness>=60?0.8:1.1));
  s.listed=[...(s.listed||[]),{id:pid,price}];
  toast(p.name+' 已挂牌（'+price+'万）'+(p.willingness>=60?'，本人愿意转会':'，本人不太愿意'));
  logEvent(s,'📋 '+p.name+' 进入转会市场（挂牌 '+price+'万）');
  save();renderAll();
}
function delistPlayer(s,pid){
  s.listed=(s.listed||[]).filter(x=>x.id!==pid);
  s.bids=(s.bids||[]).filter(x=>x.id!==pid);
  toast('已撤牌');
  save();renderAll();
}
/* 转会期内每天 AI 队可能报价 */
function aiBidTick(s){
  (s.listed||[]).forEach(item=>{
    if((s.bids||[]).some(b=>b.id===item.id))return;
    if(Math.random()<0.3){
      const team=pick(AI_TEAMS.filter(t=>t.name!==s.teamName));
      const p=s.players.find(x=>x.id===item.id);
      let bid=Math.round(item.price*(0.85+Math.random()*0.35));
      if(p){const cap=sellCeiling(p);if(cap!=null)bid=Math.min(bid,cap);} // 挂牌报价同样受转售保护
      s.bids=[...(s.bids||[]),{id:item.id,team:team.name,bid}];
      if(p)toast('📩 '+team.name+' 对 '+p.name+' 报价 '+bid+'万！');
    }
  });
  // 联盟内部重磅转会：非卖品意愿松动后被豪门挖走（队魂也会离队）——真实变更其 AI 队在册
  if(Math.random()<0.15){
    const candidates=(s.transferList||[]).filter(p=>p.untouchable&&p.willingness<75);
    if(candidates.length){
      const p=pick(candidates);
      const buyer=pick(AI_TEAMS.filter(t=>t.name!==p.ownerTeam&&t.name!==s.teamName));
      const price=untouchablePrice(p);
      aiAttachDef(s,p.id,buyer.name);
      logEvent(s,'💣 重磅转会！'+p.name+' 以 '+price+'万 转会至 '+buyer.name+'（非卖品破例放行）');
      s.transferList=s.transferList.filter(x=>x.id!==p.id);
    }
  }
  // 转会窗内 AI 补强：每天有概率有 AI 队签走一名自由球员——
  // 缺位的队直接认领；满编的队用更强的自由球员顶替弱首发（被顶替者流入自由市场）
  if(Math.random()<0.3&&(s.freeAgents||[]).length){
    const fa=pick(s.freeAgents);
    const map=aiRosterDefMap(s);
    const faOvr=overall(fa);
    const buyers=[];
    Object.keys(map).forEach(tn=>{
      if(tn===s.teamName)return;
      const cur=map[tn].map(id=>defOf(s,id)).filter(Boolean);
      const atPos=cur.find(d=>d.pos===fa.pos);
      if(!atPos){if(cur.length<5)buyers.push({tn,replace:null});}
      else if(faOvr-overall(genSeasonPlayer(s,atPos))>=3)buyers.push({tn,replace:atPos}); // 明显更强才动首发
    });
    const buyer=buyers.sort((a,b)=>(s.aiPower[a.tn]||400)-(s.aiPower[b.tn]||400))[0]; // 弱旅优先
    s.freeAgents=s.freeAgents.filter(x=>x.id!==fa.id);
    if(buyer){
      if(buyer.replace){
        aiDetachDef(s,buyer.replace.id); // 旧首发除名：下个转会期进自由池流转
        logEvent(s,'📝 转会动态：'+buyer.replace.name+' 被 '+buyer.tn+' 放弃，流入自由市场');
      }
      const def=defOf(s,fa.id);
      if(def&&!s.retiredDefs.includes(def.id)&&!(s.extraDefs||[]).some(x=>x.id===def.id))s.extraDefs.push(def);
      aiAttachDef(s,fa.id,buyer.tn); // 名册缓存失效：该选手立即为买方出战
      logEvent(s,'📝 转会动态：'+fa.name+'（'+POS[fa.pos][0]+'）以自由身加盟 '+buyer.tn+(buyer.replace?'，顶替 '+buyer.replace.name:''));
    }else{
      logEvent(s,'📝 转会动态：'+fa.name+' 被海外联赛球队签走，退出自由市场');
    }
  }
}
function acceptBid(s,id){
  const b=(s.bids||[]).find(x=>x.id===id);
  const p=s.players.find(x=>x.id===id);
  if(!b||!p)return;
  completeSale(s,p,b.bid,b.team);
  save();renderAll();toast('转会完成！');
}
function rejectBid(s,id){
  s.bids=(s.bids||[]).filter(x=>x.id!==id);
  save();renderAll();toast('已拒绝报价');
}
function endTransferWindow(s){
  s.listed=[];
  s.bids=[];
  s.transferList=[];
}
/* ================= 赛前转会期（开局/新赛季先组队，再开赛） =================
   转会期内：转会市场全开放（买断/挂牌/自由市场刷新免费/顶星供给增加），
   不能打比赛；天数用完自动结束，也可随时提前结束。 */
function endPreseason(s){
  if(!confirm('确定结束转会期？剩余天数作废，阵容锁定后联赛正式开始'))return;
  autoFillLineup(s);
  const miss=POS_ORDER.filter(pos=>!s.players.some(p=>p.pos===pos));
  if(miss.length){toast('❌ '+miss.map(pos=>POS[pos][0]).join('、')+' 位置无人，无法开始联赛，请先签约选手');return;}
  s.preseason=false;
  s.transferWindow=0;
  endTransferWindow(s);
  logEvent(s,'📋 转会期结束！'+s.teamName+' 赛季'+s.season+'阵容锁定，联赛正式开始');
  logEvent(s,'⚔️ 首战在即：俱乐部页开赛，每场赛前可调整首发、BP 中可换替补');
  save();renderAll();
  toast('联赛正式开始！去俱乐部页查看赛程');
}
/* 刷新自由市场：转会窗内每日首次免费（可重复刷但按 5 万/次收费） */
function refreshMarket(s){
  const inWindow=s.transferWindow>0;
  const free=inWindow&&!s.marketRefreshed;
  if(!free){
    if(s.fund<5){toast('资金不足（刷新需 5 万）');return;}
    s.fund-=5;
  }
  const usedNames=rookieUsedNames(s); // 全局查重：市场生成的选手不与联盟任何人重名
  s.market=[];
  for(let i=0;i<6;i++){
    const roll=Math.random();
    const band=inWindow?(roll<0.2?'star':roll<0.6?'mid':'low'):(roll<0.1?'star':roll<0.5?'mid':'low'); // 转会窗内顶星供给增加
    const np=genPlayer(genFreeAgentDef(pick(POS_ORDER),band,usedNames));
    if(Math.random()<0.15)np.discount=0.8; // 特惠上架（15% 概率 8 折，对应市场页划线价/特惠标签）
    s.market.push(np);
  }
  s.marketRefreshed=true;
  // 教练市场：随机 3 名候选教练（与现任不重复）
  s.coachMarket=s.coachMarket||[];
  const coachSeen=new Set();
  if(s.coach)coachSeen.add(s.coach.id);
  let cGuard=0;
  while(s.coachMarket.length<3&&cGuard++<40){
    const c=pick(COACH_POOL);
    if(coachSeen.has(c.id))continue;
    coachSeen.add(c.id);s.coachMarket.push({...c});
  }
  s.coachMarket.sort((a,b)=>(b.rating||0)-(a.rating||0));
  save();renderAll();
  toast(free?'转会窗内免费刷新（每日首次）':'市场已刷新（-5万）');
}
/* 签约主教练：已有教练时直接换帅（旧帅离任） */
function signCoach(s,c){
  if(!c){toast('教练信息无效，请先刷新市场');return;}
  if(s.fund<c.cost){toast('资金不足（签约费 '+c.cost+'万）');return;}
  if(s.coach&&s.coach.id===c.id){toast('该教练已是你队主教练');return;}
  s.fund-=c.cost;
  s.coachMarket=(s.coachMarket||[]).filter(x=>x.id!==c.id); // 已执教教练移出市场
  if(s.coach)logEvent(s,'🔁 换帅！'+s.coach.name+' 离任，'+c.name+' 出任主教练');
  else logEvent(s,'🤝 签约主教练 '+c.name+'（'+(c.rating||80)+'评分·'+COACH_STYLE[c.style]+'型）');
  s.coach={...c};
  save();renderAll();toast(c.name+' 执教！全队战力+'+c.bonus+'%');
}
/* 解雇主教练：无教练期间全队无教练加成 */
function fireCoach(s){
  if(!s.coach){toast('当前没有主教练');return;}
  logEvent(s,'👋 '+s.coach.name+' 与俱乐部解约离任');
  s.coach=null;
  save();renderAll();
}

/* ================= 租借系统（非转会期唯一的人员流动方式） =================
   转会窗关闭时不能买卖选手，但可以向其他战队租借替补：支付租金（身价 15%），
   租借 21 天，到期自动归队；非卖品不可租，同时最多租 2 人；租借期间原队出青训递补。 */
const LOAN_DAYS=21;
function untouchableSet(){
  const U=new Set();
  for(const tn in AI_ROSTERS)AI_ROSTERS[tn].u.forEach(id=>U.add(id));
  return U;
}
function loanRent(p){return Math.max(8,Math.round(valueOf(overall(p))*0.15));}
function loanCandidates(s){
  const U=untouchableSet();
  const map=aiRosterDefMap(s);
  const out=[];
  for(const tn in map){
    if(tn===s.teamName)continue;
    (ensureAiRosters(s,tn)||[]).forEach(p=>{
      if(U.has(p.id))return; // 非卖品：队魂不外借
      out.push({p,from:tn,rent:loanRent(p)});
    });
  }
  return out.sort((a,b)=>overall(b.p)-overall(a.p));
}
function loanPlayer(s,teamName,pid){
  if(s.transferWindow>0){toast('转会窗内可以直接买断，无需租借');return;}
  if((s.players||[]).filter(p=>p.loan).length>=2){toast('租借名额已满（最多同时租借 2 人）');return;}
  const p=(ensureAiRosters(s,teamName)||[]).find(x=>x.id===pid);
  if(!p){toast('该选手不在租借名单');return;}
  if(untouchableSet().has(p.id)){toast(p.name+' 是非卖品，不外借');return;}
  const rent=loanRent(p);
  if(s.fund<rent){toast('资金不足（租金 '+rent+'万）');return;}
  s.fund-=rent;
  p.loan={from:teamName,days:LOAN_DAYS};
  s.players.push(p);
  aiDetachDef(s,p.id); // 原队除名（真实 def）：租借期内原队青训递补
  s.aiRosters={};      // 名册缓存失效
  logEvent(s,'🤝 租借达成：'+p.name+'（'+POS[p.pos][0]+' · 总值'+overall(p)+'）从 '+teamName+' 租借 '+LOAN_DAYS+' 天，租金 '+rent+'万');
  save();renderAll();toast(p.name+' 租借加盟！'+LOAN_DAYS+' 天后自动归队');
}
function tickLoans(s){
  (s.players||[]).slice().forEach(p=>{
    if(!p.loan)return;
    p.loan.days--;
    if(p.loan.days<=0){
      const from=p.loan.from;
      logEvent(s,'📤 租借到期：'+p.name+' 返回 '+from);
      s.players=s.players.filter(x=>x.id!==p.id);
      const li=s.lineup.indexOf(p.id);
      if(li>=0)s.lineup.splice(li,1);
      if(s.pick)delete s.pick[p.pos];
      aiAttachDef(s,p.id,from); // 真实 def 回归原队（ac_ 递补则自然消散）
      s.aiRosters={};
    }
  });
}

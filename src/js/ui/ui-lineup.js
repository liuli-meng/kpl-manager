/* 阵容页 UI（从 ui.js 拆出：只搬渲染，引擎仍在 train/transfer/clubops） */
function renderLineup(){
 const ls=rosterLineup(S),bn=rosterBench(S);
 const bonds=activeBonds(S);
 let html=pageHint('lineup')+`<div class="panel"><h3>首发阵容 <span class="tag">${POS_ORDER.length}人</span></h3>
 <div class="dim" style="font-size:12px;margin-bottom:10px">总战力 <b class="cyan">${fmt(teamPower(S))}</b> · 总身价 <b class="gold">${fmt(ls.reduce((t,p)=>t+sellAskPrice(p),0))}</b> · 士气均值 ${Math.round(ls.reduce((t,p)=>t+p.morale,0)/Math.max(1,ls.length))}% · 周薪合计 <b class="gold">${weeklyWage(S)}万</b></div>
 <div class="grid g5">${POS_ORDER.map(pos=>{
 const p=ls.find(x=>x.pos===pos);
 if(!p)return `<div class="pcard" style="border-style:dashed;display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:12px;min-height:120px">${POS[pos][1]} ${POS[pos][0]}<br>空缺</div>`;
 return pcard(p,`<div style="display:flex;gap:6px"><button class="btn sm" style="flex:1" onclick="swapPlayer('${p.id}')">→ 换下</button><button class="btn sm ${S.captain===p.id?'gold':''}" style="flex:1" onclick="setCaptain('${p.id}')" title="队长在阵时全队战力+2%，任命时全队士气提升">${S.captain===p.id?'摘袖标':'任队长'}</button></div>${(S.mode||'manager')==='manager'?`<button class="btn sm danger" style="width:100%;margin-top:6px" onclick="openSellNego(S,'${p.id}')"> 出售</button>`:''}`);
 }).join('')}</div></div>`;
 html+=`<div class="panel"><h3>替补席 <span class="tag">${bn.filter(p=>!(p.kjia>0)).length}人${bn.some(p=>p.kjia>0)?' + K甲'+bn.filter(p=>p.kjia>0).length:''}</span></h3>
 <div class="hint" style="margin-bottom:8px">板凳不是终点：教练/经理可把没出场的选手 <b>下放 K甲</b>（二队练级）或 <b>外租</b>（去缺人的队打主力）；选手生涯则在「生涯」页自己申请。归队都带成长；练满 ${KJIA_MIN_RECALL} 天可提前召回。</div>
 ${bn.length?`<div class="grid g4">${bn.map(p=>{
 const lo=p.loanOut;
 const busy=playerBusy(S,p);
 const onKjia=p.kjia>0;
 return pcard(p,`${lo?`<div class="hint" style="margin-bottom:6px;color:var(--cyan)">租借 ${lo.team} · 剩 ${lo.days} 天</div>`:''}${onKjia?`<div class="hint" style="margin-bottom:6px">K甲锻炼中 · 剩 ${p.kjia} 天 · 已练 ${kjiaDaysServed(p)} 天</div>`:''}
 ${onKjia?`<button class="btn sm primary" onclick="recallKjia('${p.id}')" title="提前召回：至少练满 ${KJIA_MIN_RECALL} 天，成长按已练天数折算">↩ 召回一队</button>`:`
 <button class="btn sm primary" onclick="swapPlayer('${p.id}')" ${busy?'disabled':''}>↑ 放入首发</button>
 ${S.mode==='manager'?`<button class="btn sm danger mt8" onclick="openSellNego(S,'${p.id}')" ${busy?'disabled':''}> 出售（谈判）</button>`:''}
 <button class="btn sm mt8" onclick="sendKjia('${p.id}')" title="下放 K甲 ${KJIA_DAYS} 天：二队真实出战，归队带成长"> 下放 K甲</button>
 <button class="btn sm mt8" onclick="clubLoanOutPlayer(S,'${p.id}')" title="外租 ${LOAN_DAYS} 天：去缺人的俱乐部打主力，租金入账，归队带成长"> 外租练级</button>`}`);
 }).join('')}</div>`:'<div class="hint">暂无替补——转会市场签人，或等俱乐部自动引援</div>'}
 </div>`;
 // 战术板：选倾向 = 改四维权重（没有最优解，只有最适合阵容的解）；克制 ±3% 在比赛模拟处结算
 {
 const cur=tacticById(S.tactic||'balanced');
 html+=`<div class="panel"><h3>战术板 <span class="tag">当前：${cur.name}</span></h3>
 <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${TACTICS.map(t=>`<button class="btn sm ${t.id===(S.tactic||'balanced')?'primary':''}" onclick="setTactic('${t.id}')" title="${t.desc}${t.beats?' · 克制「'+tacticById(t.beats).name+'」':''}">${t.name}</button>`).join('')}</div>
 <div class="hint">${cur.desc}${cur.beats?' · 克制「'+tacticById(cur.beats).name+'」、被「'+TACTICS.filter(t=>t.beats===cur.id).map(t=>t.name).join('/')+'」克制':''}。权重只作用在我方战力上（对手战术每场随机，赛前页可见克制结果）。</div>
 </div>`;
 }
 // 战队羁绊（上场选手触发，属于阵容维度）
 html+=`<div class="panel"><h3>战队羁绊 <span class="tag">同队上场生效</span></h3>`;
 if(bonds.length){
 html+=bonds.map(c=>`<div class="event-card"><div class="et">${c.desc}</div></div>`).join('');
 }else{
 html+=`<div class="hint">暂无生效羁绊。凑齐同队选手上场可触发战力加成（如 AG超玩会 / eStarPro / 重庆狼队 全阵容+12%，主播天团、XYG青训、三冠传奇等）；夺冠后「冠军班底」羁绊更容易达成</div>`;
 }
 const cc=S.champCore;
 if(cc&&cc.ids&&cc.ids.length){
 const n=ls.filter(p=>cc.ids.includes(p.id)).length;
 html+=`<div class="event-card" style="margin-top:6px;border-color:${n>=3?'rgba(217,164,65,.55)':'var(--line)'}">
 <div class="et"><b class="gold">冠军班底</b> · ${(cc.label||'夺冠')}${cc.titles>1?' ×'+cc.titles+'冠':''}
 —— 当前首发同场 <b class="${n>=3?'gold':''}">${n}</b>/5 人${n>=3?'（羁绊已生效）':'（≥3 人触发战力加成，连冠再升一档）'}</div>
 <div class="hint" style="margin-top:4px">班底：${(cc.names||[]).join('、')||'—'}</div></div>`;
 }
 html+=`</div>`;
 $('#page-lineup').innerHTML=html;
}
function swapPlayer(pid){
 const p=findPlayer(S,pid);
 const inLineup=S.lineup.includes(pid);
 if(!inLineup&&p.kjia>0){toast(p.name+' 正在 K甲锻炼（剩余 '+p.kjia+' 天），暂不能进入首发');return;}
 if(!inLineup&&!matchEligible(S,p)){toast(p.name+' '+matchIneligibleReason(S,p)+'，不能进入首发');return;}
 if(inLineup){
 // 有同位置替补则对位换人；没有也允许直接下场（位置空缺）——否则满员时卖不掉、工资帽腾不出，买不了新人的死锁
 const bn=rosterBench(S).filter(x=>x.pos===p.pos&&x.injury<=0); // 伤员不可顶替上场
 if(bn.length){
 S.lineup[S.lineup.indexOf(pid)]=bn[0].id;
 toast(`${p.name} 换下，${bn[0].name} 上场`);
 }else{
 S.lineup.splice(S.lineup.indexOf(pid),1);
 toast(`${p.name} 已下场（${POS[p.pos][0]}空缺）——可出售/挂牌后补人，开赛前该位置必须有人`);
 }
 }else{
 const cur=rosterLineup(S).find(x=>x.pos===p.pos);
 if(cur){S.lineup[S.lineup.indexOf(cur.id)]=pid;toast(`${cur.name} 换下，${p.name} 上场`);}
 else{S.lineup.push(pid);toast(`${p.name} 加入首发`);}
 }
 if(S.pick)delete S.pick[p.pos]; // 换人后该位置英雄需重新 BP
 save();renderAll();
}

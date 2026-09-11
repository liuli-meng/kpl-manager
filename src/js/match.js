
/* ===== 比赛文字直播（借鉴 esports-manager 事件解说体系：事件驱动 + 多模板随机） ===== */
function genMatchStory(sr,g){
 const myLs=rosterLineup(S);
 const opR=ensureAiRosters(S,sr.opName)||[];
 const R=arr=>arr[Math.floor(Math.random()*arr.length)];
 const myA=()=>myLs.length?R(myLs).name:'我方选手';
 const myB=()=>myLs.length?R(myLs).name:'我方选手';
 const opA=()=>opR.length?R(opR).name:'对方选手';
 const opB=()=>opR.length?R(opR).name:'对方选手';
 const lane=()=>R(['对抗路','发育路','中路']);
 const win=g.w;
 const diff=Math.abs(g.myK-g.opK);
 const close=diff<=2,blowout=diff>=5;
 const mins=[3,6,9,13,17,21];
 const lines=[];
 // 一血
 const fbMy=Math.random()<(win?0.62:0.38);
 lines.push(fbMy
 ? `第${mins[0]}分钟，一血爆发！${myA()} 单杀 ${opB()}，拿下开门红！`
 : `第${mins[0]}分钟，${opA()} 拿到一血，我方 ${myB()} 被击杀。`);
 for(let i=1;i<mins.length;i++){
 const m=mins[i];
 const myEvent=Math.random()<(win?0.7:0.36);
 const pool=myEvent
 ? ['kill','kill','obj','tower','fight','fight']
 : ['opkill','opkill','opobj','optower','opfight'];
 const kind=R(pool);
 const t=R({
 kill:[
 `${myA()} 配合 ${myB()} 抓死 ${opA()}，节奏来了！`,
 `${myA()} 草丛蹲伏，一套连招带走 ${opA()}！`,
 `${myA()} 极限反杀 ${opA()}，丝血逃生！`,
 `${myA()} 绕后切入，${opA()} 来不及反应直接蒸发！`,
 `${myA()} 越塔强杀 ${opA()}，打得真凶！`,
 ],
 obj:[
 `我方稳稳控下暴君，经济小优！`,
 `${myA()} 抢下暗影主宰，召唤主宰先锋推进！`,
 `风暴龙王刷新，我方抱团控下，局面大好！`,
 ],
 tower:[
 `我方推掉对方${lane()}一塔，打开局面！`,
 `${myA()} 带线推进，对方${lane()}二塔告破！`,
 `我方强上高地，${lane()}高地塔被磨掉大半！`,
 ],
 fight:[
 `河道团战，我方 1 换 3，血赚！`,
 `${myA()} 大招开团，我方打出 0 换 4！`,
 `ACE！我方团灭对手，天平彻底倾斜！`,
 `${myA()} 关键绕后开团，直接打崩对方阵型！`,
 ],
 opkill:[
 `${opA()} 越塔强杀我方 ${myB()}，这波有点亏。`,
 `对方 ${opA()} 开团，我方 ${myB()} 被集火击杀。`,
 `${opA()} 蹲到我方 ${myB()}，视野缺失导致掉点。`,
 ],
 opobj:[
 `对方收下暴君，经济被拉开一点。`,
 `对方拿到暗影主宰，兵线压力陡增。`,
 ],
 optower:[
 `对方推掉我方${lane()}一塔，需要稳住。`,
 `我方${lane()}二塔被破，对方视野压进来了。`,
 ],
 opfight:[
 `团战失利，我方 2 换 1，有点难受。`,
 `对方打出 ACE，我方被打了一波团灭。`,
 ],
 }[kind]);
 lines.push(`第${m}分钟，${t}`);
 }
 // 收官
 const endM=22+Math.floor(Math.random()*10);
 if(win){
 if(close)lines.push(`第${endM}分钟，逆风翻盘！${myA()} 关键抢龙，一波推平水晶拿下本局！`);
 else if(blowout)lines.push(`第${endM}分钟，碾压局！${myA()} 带队直取水晶，对手毫无还手之力！`);
 else lines.push(`第${endM}分钟，兵线进塔，${myA()} 点掉水晶，拿下本局！`);
 }else{
 if(close)lines.push(`第${endM}分钟，基地前最后一波团战失利，水晶告破……可惜了。`);
 else if(blowout)lines.push(`第${endM}分钟，对方带着主宰先锋推上高地，水晶告破，惨败一局。`);
 else lines.push(`第${endM}分钟，对方推掉水晶……${opA()} 这局发挥确实好。`);
 }
 return lines.map(l=>' '+l);
}
/* ================= 比赛流程（KPL 赛制：常规赛 BO5 / 季后赛 BO7 全局BP） ================= */
function singleGame(my,op){
 const w=Math.random()<winChance(my,op);
 return {w,myK:rnd(6,13),opK:rnd(6,13)};
}
/* 每局表现结算：为全体首发生成 KDA，滚动更新身价（均衡值=100×平均表现），并选出 MVP
 perf≈1 为平：EMA 每局向 100×近期表现收敛，区间 70~150；MVP 额外 +3 */
function gamePerform(winner){
 const ls=rosterLineup(S);
 if(!ls.length)return null;
 let best=null,bs=-1;
 ls.forEach(p=>{
 const pw=playerPower(p,pickedHero(S,p));
 const k=rnd(1,12),d=rnd(0,6),a=rnd(0,12);
 const score=k*3+a*2-d*1.5+(winner?6:2)+pw*0.5+rnd(0,3);
 const perf=(k*3+a*2-d*1.5)/25+(winner?0.35:-0.15);
 p.val=clamp(Math.round((p.val||100)*0.92+perf*8),70,150);
 p.kTotal=(p.kTotal||0)+k;p.dTotal=(p.dTotal||0)+d;p.aTotal=(p.aTotal||0)+a; // 赛季累计（场均展示用）
 if(score>bs){bs=score;best={id:p.id,name:p.name,k,d,a};}
 });
 return best;
}

function startMatch(){
 if(S.preseason){toast(' 赛前转会期进行中：先去转会市场完成组队，结束转会期后联赛才开始');return;}
 const m=S.schedule[S.matchIdx];
 if(!m){toast('赛程已结束');return;}
 // 系列赛中断恢复：不重置比分，直接回到赛前准备
 if(S.series&&S.series.stage==='regular'){
 showPreMatch(PHASE_NAME[S.phase]+' 第'+m.round+'/'+KPL.ROUNDS+'轮 vs '+m.opp+' · 第'+(S.series.mw+S.series.ow+1)+'局（'+S.series.mw+':'+S.series.ow+'）');
 return;
 }
 S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:firstSide(S,'regular')};S.seriesAuto=false;
 resetOppEnergy(S,m.opp); // 对手体力回满：衰减只在系列赛内累积
 showPreMatch(PHASE_NAME[S.phase]+' 第'+m.round+'/'+KPL.ROUNDS+'轮 vs '+m.opp+' · 第1局（BO5 全局BP）');
}

/* ================= 赛前准备（调整首发 → 对手情报 → 进入 BP） ================= */
function showPreMatch(title){
 autoFillLineup(S);
 window._prepTitle=title||'';
 window._prepPos=null;
 renderPreMatch();
}
/* 选手在本位置的最佳英雄与战力（情报/换人参考） */
function playerBest(p){
 let best=null,bp=-1;
 (p.heroPool||[]).forEach(x=>{
 const h=heroOf(x.n);
 if(h&&h.pos.includes(p.pos)){const v=playerPower(p,x.n);if(v>bp){bp=v;best=x.n;}}
 });
 return {hero:best,pow:bp<0?playerPower(p,null):Math.round(bp)};
}
function renderPreMatch(){
 const sr=S.series;if(!sr)return;
 const ls=rosterLineup(S),bn=rosterBench(S);
 const opR=ensureAiRosters(S,sr.opName)||[];
 const my=teamPower(S)*(1+seriesTacticEdge(S,sr)),op=powerOf(S,sr.opName); // 战术克制 ±3% 在此生效
 const wr=Math.round(winChance(my,op)*100);
 // 战术板：显示双方战术与克制结果（edge 已计入上面的战力）
 const tactHtml=(S.tactic&&S.tactic!=='balanced')?`<div class="hint" style="margin-bottom:8px">战术板：我方「${tacticById(S.tactic).name}」 vs 对方「${tacticById(sr._opTactic||'balanced').name}」${seriesTacticEdge(S,sr)>0?' <span class="green">· 战术克制 +3%</span>':(seriesTacticEdge(S,sr)<0?' <span style="color:var(--red)">· 被克制 −3%</span>':' · 互不克制')}</div>`:'';
 const midSeries=sr.mw+sr.ow>0;
 // 我方首发行
 const myRows=POS_ORDER.map(pos=>{
 const p=ls.find(x=>x.pos===pos);
 if(!p)return `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--line)"><span class="tag">${POS[pos][1]}</span><span class="red" style="font-size:12px">该位置无人，请签约或改位置</span></div>`;
 const b=playerBest(p);
 const engTxt=`<span style="color:${p.energy>=60?'var(--dim)':p.energy>=40?'var(--gold)':'var(--red)'}">体力${p.energy}</span>`;
 const morTxt=`<span style="color:${p.morale>=70?'var(--dim)':p.morale>=50?'var(--gold)':'var(--red)'}">士气${p.morale}</span>`;
 const st=(p.injury>0?`<span class="red">伤停${p.injury}天</span> `:'')+engTxt+' '+morTxt;
 return `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--line)">
 <span class="tag" style="min-width:44px;text-align:center">${POS[pos][1]}</span>
 <b style="font-size:12px;min-width:52px">${p.name}</b>
 <span style="font-size:11px;color:var(--dim)">战力 <b style="color:var(--cyan)">${b.pow}</b> · ${b.hero||'—'}</span>
 <span style="font-size:11px;margin-left:auto">${st}</span>
 <button class="btn sm" onclick="prepChoosePos('${pos}')">换人</button>
 </div>`;
 }).join('');
 // 换人面板（同位置替补）
 let swapPanel='';
 if(window._prepPos){
 const pos=window._prepPos,cur=ls.find(x=>x.pos===pos);
 const cands=bn.filter(x=>x.pos===pos&&x.injury<=0); // 伤员不可登场
 swapPanel=`<div style="background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:8px 0">
 <div style="font-size:12px;font-weight:800;margin-bottom:6px">替补 ${POS[pos][0]}（换下 ${cur?cur.name:'空缺'}）</div>
 ${cands.length?cands.map(p=>{const b=playerBest(p);return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px dashed var(--line)">
 <b style="font-size:12px;min-width:52px">${p.name}</b>
 <span style="font-size:11px;color:var(--dim)">战力 <b style="color:var(--cyan)">${b.pow}</b> · ${b.hero||'—'} · 总值${overall(p)}</span>
 <button class="btn sm primary" style="margin-left:auto" onclick="prepSwapIn('${p.id}')">上场</button>
 </div>`;}).join(''):'<div class="hint">该位置没有替补，可去转会市场签人</div>'}
 <button class="btn sm mt8" onclick="window._prepPos=null;renderPreMatch()">收起</button>
 </div>`;
 }
 // 对手情报：按威胁排序，最强点标 （BAN 优先目标）
 const intel=opR.map(p=>({p,b:playerBest(p)})).sort((a,b)=>b.b.pow-a.b.pow);
 const maxThreat=intel.length?intel[0].b.pow:0;
 const opRows=intel.map(({p,b})=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--line)">
 <span class="tag" style="min-width:44px;text-align:center">${POS[p.pos][1]}</span>
 <b style="font-size:12px;min-width:52px">${p.name}</b>
 <span style="font-size:11px;color:var(--dim)">招牌 ${p.sig||'—'}</span>
 <span style="font-size:11px;margin-left:auto">${b.pow>=maxThreat&&maxThreat>0?' ':''}威胁 <b style="color:var(--red)">${b.pow}</b></span>
 </div>`).join('');
 $('#app-modal-body').innerHTML=`
 <h2>赛前准备 <span class="tag">${sr.max===7?'BO7 · 含巅峰对决':'BO5 · 全局BP'}</span></h2>
 <div class="hint" style="text-align:center;margin-bottom:8px">${window._prepTitle}${midSeries?` · 当前比分 <b>${sr.mw}:${sr.ow}</b>（<span style="cursor:help" title="我方已用：${(sr.used||[]).join('、')||'无'}
对方已用：${(sr.usedOpp||[]).join('、')||'无'}">全局BP已用 · 我方 ${(sr.used||[]).length} / 对方 ${(sr.usedOpp||[]).length}</span>）`:''}</div>
 ${tactHtml||''}
 <div style="display:flex;gap:8px;margin-bottom:10px">
 <div style="flex:1;background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;text-align:center">
 <div style="font-size:11px;color:var(--dim)">${S.teamName}</div>
 <div style="font-size:18px;font-weight:800;color:var(--cyan)">${my}</div></div>
 <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:92px">
 <div style="font-size:11px;color:var(--dim)">赛前预估</div>
 <div style="font-size:17px;font-weight:800;color:${wr>=55?'var(--green)':wr>=45?'var(--gold)':'var(--red)'}">${wr}%</div></div>
 <div style="flex:1;background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;text-align:center">
 <div style="font-size:11px;color:var(--dim)">${sr.opName}</div>
 <div style="font-size:18px;font-weight:800;color:var(--red)">${op}</div></div>
 </div>
 <div style="font-size:12px;font-weight:800;margin:6px 0 2px">我方首发（可调整）</div>
 ${myRows}
 ${swapPanel}
 <div style="font-size:12px;font-weight:800;margin:10px 0 2px">对手情报 <span class="tag"> 为最强点 · BP 优先 BAN</span></div>
 ${opRows||'<div class="hint">对方情报未知（盲选局）</div>'}
 <div class="center mt12" style="display:flex;gap:8px;justify-content:center">
 <button class="btn" onclick="closeModal('app-modal')">返回</button>
 <button class="btn primary" onclick="closeModal('app-modal');openBP(window._prepTitle,playGame)">进入 BP 选英雄 →</button>
 </div>`;
 $('#app-modal').classList.add('wide');
 $('#app-modal').classList.add('on');
}
function prepChoosePos(pos){window._prepPos=pos;renderPreMatch();}
function prepSwapIn(pid){
 const p=S.players.find(x=>x.id===pid);
 if(p.injury>0){toast(p.name+' 伤停中（还剩'+p.injury+'天），无法登场');return;}
 const cur=rosterLineup(S).find(x=>x.pos===p.pos);
 if(!cur)return;
 S.lineup[S.lineup.indexOf(cur.id)]=p.id;
 if(S.pick)delete S.pick[p.pos]; // 换人后该位置英雄需重新 BP
 save();
 window._prepPos=null;
 toast(cur.name+' 换下，'+p.name+' 首发');
 renderPreMatch();
}
function playGame(){
 const sr=S.series;
 // 有效战力结算：BAN/选人质量/红蓝 counter 全部折算进胜负（详见 bpEffective）
 const isLastPeak=sr.max>=7&&sr.mw+sr.ow===sr.max-1; // 巅峰对决：无 BP，不吃任何修正（BO7 第7局 / BO9 第9局）
 const v=bpEffective({myBans:sr.myBans,oppBans:sr.oppBans,oppPicks:sr.oppPicks,side:sr.side,isPeak:isLastPeak,opName:sr.opName,opRoster:ensureAiRosters(S,sr.opName)||[],used:sr.used,usedOpp:sr.usedOpp});
 const g=singleGame(v.my,v.op);
 // 每小局双方消耗体力（8/局）：系列赛越深越考验轮换——替补体力满员是翻盘资本
 const opR=ensureAiRosters(S,sr.opName)||[];
 rosterLineup(S).forEach(p=>{p.energy=clamp(p.energy-8,0,ENERGY_MAX);p.caps=(p.caps||0)+1;}); // caps：出场记录（转售保护期解锁用）
 opR.forEach(p=>p.energy=clamp(p.energy-8,0,ENERGY_MAX));
 if(g.w)sr.mw++;else sr.ow++;
 const isPeak=sr.max>=7&&sr.mw+sr.ow===sr.max-1;
 const tag=isPeak?' 巅峰对决（盲选）':'';
 const mvp=gamePerform(g.w);
 if(mvp){const mp=S.players.find(x=>x.id===mvp.id);if(mp){mp.mvp=(mp.mvp||0)+1;mp.popularity=Math.min(99,(mp.popularity||0)+2);mp.val=clamp((mp.val||100)+3,70,150);}} // MVP：人气+2、身价+3
 if(mvp)sr.mvpIds=(sr.mvpIds||[]).concat(mvp.id); // 系列赛各局 MVP 记录（FMVP 评选用）
 sr.logs.push('第'+(sr.mw+sr.ow)+'局 '+(g.w?'':'')+' 我方 '+g.myK+'-'+g.opK+' '+(g.w?'击败':'憾负')+' '+sr.opName+' ｜ 总比分 '+sr.mw+':'+sr.ow+tag+' '+(sr.side==='red'?'红方':'蓝方')+' '+pick(CASTER)+(mvp?' ｜ MVP：'+mvp.name+'（'+mvp.k+'/'+mvp.d+'/'+mvp.a+'）':''));
 // 文字直播（借鉴 esports-manager 事件解说体系）
 sr.logs.push(...genMatchStory(sr,g));
 const need=Math.ceil(sr.max/2);
 if(sr.mw>=need||sr.ow>=need){
 finishSeries(sr.mw>=need);
 }else{
 // 进入下一局：败方选边（KPL 规则：第2-6局败方选边；第7局巅峰对决由第6局败方选边）
 const nextTitle=(sr.stage==='card'?'卡位赛':sr.stage==='po'?(sr.poSlot==='总决赛'?'总决赛':'季后赛'):PHASE_NAME[S.phase])+' · 第'+(sr.mw+sr.ow+1)+'局（当前 '+sr.mw+':'+sr.ow+'）';
 if(S.seriesAuto){
 autoPlayNext(); // 本系列赛自动BP模式
 }else if(!g.w){
 // 玩家本局落败 → 玩家拥有选边权
 showSideChoice(nextTitle);
 }else{
 // AI 落败 → AI 自动选边
 sr.side=aiPickSide(S);
 openBP(nextTitle,playGame);
 }
 }
}
function recordSeason(s){
 try{
 s.honors=s.honors||[];
 s.honors.push({season:s.season,title:(s.champion?(splitLabel(s)+' 总冠军'):(splitLabel(s)+' 亚军')),champion:!!s.champion,roster:titleRoster(s)});
 s.honors=s.honors.slice(-20);
 }catch(e){}
}
function finishSeries(finalWin){
 const sr=S.series;
 S._lastMvps=(sr.mvpIds||[]).slice(); // 本系列赛各局 MVP（决赛后评 FMVP 用）
 // 出场统计（更衣室系统用）：本系列赛首发的选手各记一次出场——替补的不满按"出场差距"累积
 rosterLineup(S).forEach(p=>{p.apps=(p.apps||0)+1;});
 S.series=null; // 先清系列赛状态，再走收尾链（playoffStep/playCardNext 可能立即开启下一场）
 // 体力按小局在 playGame 中逐局扣除，此处不再重复扣
 // 赛后小概率有人受伤：伤停必须休息，受伤瞬间立即换替补（阵容页即时反映）
 if(Math.random()<0.08){
 const ls=rosterLineup(S);
 if(ls.length){const p=pick(ls);p.injury=rnd(2,4);logEvent(S,' '+p.name+' 在比赛中受伤，将伤停'+p.injury+'天（必须休息）');autoFillLineup(S);}
 }
 const winGames=sr.mw; // 2026 KPL 奖金按胜小局数结算
 // 连胜/连败手感（常规赛与季后赛系列赛均计入）
 if(sr.stage==='regular'||sr.stage==='po'){
 S.streak=(S.streak||0)+(finalWin?1:-1);
 if(S.streak>=3)logEvent(S,' '+S.streak+'连胜！队伍手感火热（全队战力+'+clamp(S.streak,-5,5)*2+'%）');
 else if(S.streak<=-3)logEvent(S,' '+(-S.streak)+'连败，士气低迷（全队战力'+clamp(S.streak,-5,5)*2+'%）');
 }
 let title='';
 if(sr.stage==='regular'){
 const g=myGroup(S);
 const t=(g&&S.tables[g])?S.tables[g][S.teamName]:null;
 const m=S.schedule[S.matchIdx];
 const ot=(g&&S.tables[g])?S.tables[g][m.opp]:null;
 m.result=finalWin?'W':'L';m.myScore=sr.mw;m.opScore=sr.ow;
 if(t){
 if(finalWin){t.w++;t.pts++;}else{t.l++;}
 t.pw+=sr.mw;
 }
 // 对手积分行同步记账：AI 赛程按轮转法生成（我的场次被排除，对手实际在另一轮与我交手），
 // 不补记对手行其战绩将永远缺这场球（我赢它没记输、我输它没记赢），积分/排名/S-A-B 晋级全部失真
 if(ot){
 if(finalWin){ot.l++;}else{ot.w++;ot.pts++;}
 ot.pw+=sr.ow;
 }
 const bonus=winGames*80;
 S.fund+=bonus;
 if(finalWin&&Math.random()<0.5)S.fund+=200;
 S.players.forEach(p=>p.morale=clamp(p.morale+(finalWin?8:-8),20,100));
 logEvent(S,' '+PHASE_NAME[S.phase]+'：'+S.teamName+' '+(finalWin?'胜':'负')+' '+sr.opName+' '+sr.mw+':'+sr.ow+'（小局奖金 '+bonus+'万）');
 S.matchIdx++;
 simulateAiRound(S,m.round); // 本轮打完，联盟其他场次同步开打并更新积分
 if(S.matchIdx>=KPL.ROUNDS)advancePhase(S);
 title=S.teamName+' vs '+sr.opName;
 }else if(sr.stage==='card'){
 const m=sr.cardMatch;
 m.r=finalWin?sr.myName:sr.opName;
 const bonus=winGames*120;
 S.fund+=bonus;
 S.players.forEach(p=>p.morale=clamp(p.morale+(finalWin?8:-8),20,100));
 logEvent(S,'卡位赛：'+S.teamName+' '+(finalWin?'晋级':'遗憾落败')+' '+sr.mw+':'+sr.ow+'（奖金 '+bonus+'万）');
 title='卡位赛'+(finalWin?'晋级':'出局');
 S.card.idx++;
 if(S.card.idx>=S.card.matches.length)finishCard(S);
 else playCardNext(S);
 }else if(sr.stage==='po'){
 const m=sr.poMatch;
 m.r=finalWin?sr.myName:sr.opName;
 const bonus=winGames*150;
 S.fund+=bonus;
 if(finalWin&&sr.poSlot==='总决赛')S.fund+=600;
 if(!finalWin&&sr.poSlot!=='总决赛'){
 // 联盟分润：按出局名次（总决赛败者的亚军分润由 playoffStep 冠军分支统一发放，此处不再发，避免双倍）
 const place=poPlace(sr.poSlot,false);
 leaguePayout(S,place);
 }
 S.players.forEach(p=>p.morale=clamp(p.morale+(finalWin?8:-8),20,100));
 logEvent(S,' 季后赛（'+sr.poSlot+'）：'+S.teamName+' '+(finalWin?'晋级':'出局')+' '+sr.mw+':'+sr.ow+(sr.poSlot==='总决赛'&&finalWin?'——夺得总冠军！':'')+'（奖金 '+bonus+'万）');
 title=sr.poSlot==='总决赛'?(finalWin?'我们是冠军！':'总决赛落幕'):'季后赛'+(finalWin?'晋级':'出局');
 playoffStep(S);
 }else if(sr.stage==='cup'){
 // 杯赛系列赛（EWC / 年度总决赛：擂台赛·突围赛·淘汰赛）
 const m=sr.cupMatch;
 m.r=finalWin?sr.myName:sr.opName;
 if(m.a===sr.myName){m.ms=sr.mw;m.es=sr.ow;}else{m.ms=sr.ow;m.es=sr.mw;} // 擂台赛积分按 a/b 记小局
 const bonus=winGames*120;
 S.fund+=bonus;
 S.players.forEach(p=>p.morale=clamp(p.morale+(finalWin?8:-8),20,100));
 logEvent(S,' '+sr.cupLabel+'：'+S.teamName+' '+(finalWin?'胜':'负')+' '+sr.opName+' '+sr.mw+':'+sr.ow+'（奖金 '+bonus+'万）');
 title=sr.cupLabel+(finalWin?' · 晋级':' · 落败');
 if(S.phase==='ewc')ewcStep(S);
 else if(S.phase==='challenger')challengerStep(S);
 else annualStep(S);
 }
 const r={win:finalWin,logs:sr.logs,opName:sr.opName};
 // 比赛复盘记录（含巅峰对决名场面标记）
 S.history=S.history||[];
 S.history.unshift({
 yr:gameYear(S), // 年度归属（赛季回顾·关键战役按年筛选用）
 opp:sr.opName,stage:sr.stage==='card'?'卡位赛':sr.stage==='po'?(sr.poSlot||'季后赛'):sr.stage==='cup'?sr.cupLabel:PHASE_NAME[S.phase],
 score:sr.mw+':'+sr.ow,win:finalWin,logs:sr.logs,
 peak:sr.max>=7&&sr.mw+sr.ow===sr.max // 打满最后一局（BO7 4:3 / BO9 5:4）= 巅峰对决名场面
 });
 S.history=S.history.slice(0,20);
 save();renderAll();
 showMatchModal(r,title||S.teamName+' vs '+sr.opName);
}
function startPlayoff(){if(S.preseason){toast(' 转会期进行中，联赛尚未开始');return;}playoffStep(S);}
function startCard(){if(S.preseason){toast(' 转会期进行中，联赛尚未开始');return;}playCardNext(S);}
function showMatchModal(r,title){
 try{(r.win?SFX.win():SFX.lose());}catch(_){}
 const mb=$('#app-modal');$('#app-modal-body').innerHTML=`
 <h2>${title||(r.win?'比赛胜利':'比赛失利')}</h2>
 <div class="logbox" style="max-height:60vh">${r.logs.map(l=>`<div class="${l.includes('胜')?'win':l.includes('负')?'lose':'info'}">${l}</div>`).join('')}</div>
 <div class="center mt16">
 ${(S.phase==='champion'||S.phase==='eliminated')?`<button class="btn gold" onclick="closeModal('app-modal');advanceCalendar(S)">${calendarNextLabel(S)}</button>`
 :(S.preseason?`<button class="btn gold" onclick="closeModal('app-modal');goPage('market')"> 进入转会期（组队备战）</button>`
 :`<button class="btn primary" onclick="closeModal('app-modal');nextDay(S);goPage('club')">继续（推进一天）</button>`)}
 </div>`;
 mb.classList.add('on');
}

/* ================= 比赛模拟（Elo 胜率） ================= */
/* ================= 常量 ================= */

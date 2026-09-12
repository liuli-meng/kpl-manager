/* K甲联赛·二队（season.js 机械拆出） */
/* ================= K甲联赛（二队 · 次级联赛完整版） =================
 二队常驻 K甲：8 队单循环 7 轮，每 2 天一轮，与 KPL 赛段并行推进（每赛段重新开赛）。
 下放（sendKjia）的选手进入二队阵容真实出战——每场生成 KDA/MVP 累计进
 p.kjiaStats / p.kjiaLog，「二队」页可查积分榜、赛程与表现数据。
 成长两条路：场上好表现小概率即时 +1；归队时 kjiaTick 结算 +2~4×2——都计入
 p.kjiaGain（成就「练级成功」依据）。平衡门禁的模拟不下放选手，本系统不触碰门禁校准区间。 */
const KJIA_DAYS=30;
const KJIA_AI_TEAMS=['K甲·苍穹','K甲·星火','K甲·沧澜','K甲·曜石','K甲·铁鳞','K甲·游隼','K甲·雾嶂'];
const KJIA_EVERY=2; // 每 2 天一轮（7 轮=14 天，转会期 7 天内先打 3 轮）
const KJIA_FILLER_NAMES=['冷峤','照野','束禾','闻鹿','栖迟','枕流','叩舷','扫雪','拾星','衔山','汲露','司南','执桨','引笛','泊岸','拓海','听澜','折桨','纵马','悬旌','负剑','摘星','衔烛','趁风'];
function kjiaMyName(s){return s.teamName+'二队';}
function kjiaSquad(s){ // 二队阵容 = K甲班底 + 下放选手（同一位置取战力高者出场，结算在 kjiaTeamPower）
 return ((s.kjia&&s.kjia.squad)||[]).concat((s.players||[]).filter(p=>p.kjia>0));
}
function kjiaTeamPower(s){ // 与 aiRosterPower 同刻度：五位置最强者求和 × 士气系数；次级联赛体系折算 ×0.9（无教练组）
 const r=kjiaSquad(s);
 if(!r.length)return 0;
 const best={};
 r.forEach(p=>{const v=playerPower(p,p.sig);if(best[p.pos]==null||v>best[p.pos])best[p.pos]=v;});
 let sum=0;POS_ORDER.forEach(pos=>{if(best[pos]!=null)sum+=best[pos];});
 const morale=clamp(r.reduce((t,p)=>t+(p.morale||80),0)/r.length/100,0.82,1.1);
 return Math.round(sum*morale*0.9);
}
function kjiaFiller(s,pos,used){ // 二队 K甲班底：低总值的常驻注册选手（下放的一队选手来了就顶替出场）
 const name=poolName(KJIA_FILLER_NAMES,used);used.add(name);
 const base=[0,1,2,3].map(()=>rnd(62,74));
 return genPlayer({id:'kjf_'+gameYear(s)+'_'+pos+'_'+Math.random().toString(36).slice(2,7),name,pos,team:kjiaMyName(s),tags:['K甲'],
 base,skill:{n:'次级联赛',t:pick(['lane','farm','team','mind']),d:'K甲班底选手，等一个上调一队的机会'},
 sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n,career:kjiaMyName(s)+' 班底选手，常年在次级联赛征战。'});
}
function initKjia(s){ // 每个赛段（春/夏）重开一届 K甲
 const my=kjiaMyName(s);
 const teams=[...KJIA_AI_TEAMS,my];
 const powers={};
 KJIA_AI_TEAMS.forEach((t,i)=>{powers[t]=i<3?rnd(360,392):rnd(328,388);}); // 苍穹/星火/沧澜为K甲豪门（与挑战者杯赛道强度对齐）
 // 舍转法单循环：8 队 7 轮 × 4 场（与 buildGroupSchedule 同一算法）
 const rounds=[];
 const arr=teams.slice(1);
 for(let r=0;r<teams.length-1;r++){
 const ring=[teams[0],...arr],pairs=[];
 for(let i=0;i<teams.length/2;i++){const a=ring[i],b=ring[teams.length-1-i];if(a&&b)pairs.push({a,b,r:null,ms:0,es:0});}
 rounds.push(pairs);
 arr.unshift(arr.pop());
 }
 const tables={};teams.forEach(t=>tables[t]={w:0,l:0,pts:0,pw:0});
 const used=new Set((s.players||[]).map(p=>p.name));
 const squad=POS_ORDER.map(pos=>kjiaFiller(s,pos,used));
 s.kjia={teams,powers,rounds,rd:0,day:0,tables,results:[],squad,champ:null,my};
 return s.kjia;
}
function kjiaRank(s){ // K甲积分榜名次（冠军=榜首）
 const k=s.kjia;if(!k)return [];
 return Object.keys(k.tables).sort((a,b)=>k.tables[b].pts-k.tables[a].pts||k.tables[b].pw-k.tables[a].pw);
}
function kjiaPerform(s,demoted,won,m,round){ // 二队每场为下放选手结算 KDA/MVP/即时成长
 if(!demoted.length)return;
 const my=kjiaMyName(s);
 const opp=m.a===my?m.b:m.a;
 const myScore=m.a===my?m.ms:m.es,opScore=m.a===my?m.es:m.ms;
 let mvp=null,bs=-1;
 const rows=demoted.map(p=>{
 const k=rnd(1,9)+(won?1:0),d=rnd(0,5),a=rnd(0,10);
 const score=k*3+a*2-d*1.5+(won?6:2)+playerPower(p,p.sig)*0.5+rnd(0,3);
 const st=p.kjiaStats=p.kjiaStats||{apps:0,k:0,d:0,a:0,mvp:0,wins:0};
 st.apps++;st.k+=k;st.d+=d;st.a+=a;if(won)st.wins++;
 if(won&&Math.random()<0.3){const key=pick(['lane','farm','team','mind']);p.attrs[key]=clamp(p.attrs[key]+1,40,99);p.kjiaGain=(p.kjiaGain||0)+1;}
 if(score>bs){bs=score;mvp=p;}
 return {p,k,d,a};
 });
 if(mvp)mvp.kjiaStats.mvp++;
 rows.forEach(({p,k,d,a})=>{
 p.kjiaLog=p.kjiaLog||[];
 p.kjiaLog.unshift('第'+round+'轮 vs '+opp+' '+(won?'胜':'负')+' '+myScore+':'+opScore+' · '+k+'/'+d+'/'+a+(p===mvp?' · 单局MVP':''));
 p.kjiaLog=p.kjiaLog.slice(0,6);
 });
}
function kjiaNextRound(s){
 const k=s.kjia;
 const rd=k.rounds[k.rd];
 const my=k.my;
 const demoted=(s.players||[]).filter(p=>p.kjia>0);
 rd.forEach(m=>{
 const pwA=m.a===my?kjiaTeamPower(s):k.powers[m.a];
 const pwB=m.b===my?kjiaTeamPower(s):k.powers[m.b];
 let mw=0,ow=0;
 for(let i=1;i<=5&&mw<3&&ow<3;i++){if(Math.random()<winChance(pwA,pwB))mw++;else ow++;}
 m.ms=mw;m.es=ow;m.r=mw>ow?m.a:m.b;
 const ta=k.tables[m.a],tb=k.tables[m.b];
 if(m.r===m.a){ta.w++;ta.pts++;tb.l++;}else{tb.w++;tb.pts++;ta.l++;}
 ta.pw+=mw;tb.pw+=ow;
 if(m.a===my||m.b===my)kjiaPerform(s,demoted,m.r===my,m,k.rd+1);
 });
 const rep=rd.map(m=>m.a+' '+m.ms+':'+m.es+' '+m.b).join('；');
 k.results.unshift({round:k.rd+1,txt:rep});k.results=k.results.slice(0,10);
 logEvent(s,' K甲联赛（第'+(k.rd+1)+'轮）：'+rep);
 k.rd++;
 if(k.rd>=k.rounds.length)finishKjiaSplit(s);
}
function kjiaDayTick(s){ // 挂在 nextDay：日历推进 K甲轮次（旧档懒初始化，读档即有联赛）
 if(!s.kjia)initKjia(s);
 if(s.kjia.rd>=s.kjia.rounds.length)return; // 本赛段已收官，等下个赛段重开
 s.kjia.day++;
 if(s.kjia.day%KJIA_EVERY===0)kjiaNextRound(s);
}
function finishKjiaSplit(s){
 const k=s.kjia;if(!k||k.champ)return;
 const rank=kjiaRank(s);
 k.champ=rank[0];
 const myRank=rank.indexOf(k.my)+1;
 logEvent(s,' K甲联赛收官：'+k.champ+' 夺得本赛段冠军（'+k.my+' 名次：第'+myRank+'）');
 if(k.champ===k.my){
 grantPrize(s,13,'K甲夺冠奖金');addFans(s,2,'二队 K甲夺冠');
 (s.players||[]).filter(p=>p.kjia>0).forEach(p=>{p.morale=clamp(p.morale+5,20,100);});
 logEvent(s,' 二队 K甲夺冠！关注度上涨（粉丝+2万）——下放练级的价值兑现了');
 }
}
function sendKjia(s,id){
 const p=(s.players||[]).find(x=>x.id===id);
 if(!p){toast('选手不在阵中');return;}
 if(p.kjia){toast(p.name+' 已在 K甲锻炼（剩余 '+p.kjia+' 天）');return;}
 if(p.injury>0){toast(p.name+' 正在伤停，无法下放');return;}
 if(p.loan){toast(p.name+' 是租借选手，不能下放 K甲');return;}
 if((s.listed||[]).some(x=>x.id===id)){toast(p.name+' 挂牌中（已有报价会一并作废），请先撤牌再下放');return;}
 s.players=s.players.filter(x=>x.id!==id||true); // 保留在册（仅离开首发）
 if(s.captain===id){s.captain=null;logEvent(s,' 队长 '+p.name+' 下放 K甲，袖标摘除');}
 const li=(s.lineup||[]).indexOf(id);
 if(li>=0)s.lineup.splice(li,1);
 p.kjia=KJIA_DAYS;
 logEvent(s,' 下放 K甲：'+p.name+'（'+POS[p.pos][0]+'）加入二队征战 K甲联赛 '+KJIA_DAYS+' 天——真实出战积累表现数据，「二队」页可查，归队时带成长回来');
 save();renderAll();
}
function kjiaTick(s){ // 每天结算一次；到期归队并成长
 (s.players||[]).forEach(p=>{
 if(!p.kjia)return;
 p.kjia--;
 if(p.kjia>0)return;
 p.kjia=0;
 const keys=['lane','farm','team','mind'];
 let gain=0;
 for(let i=0;i<2;i++){const k=keys.splice(Math.floor(Math.random()*keys.length),1)[0];const d=rnd(2,4);p.attrs[k]=clamp(p.attrs[k]+d,40,99);gain+=d;}
 p.kjiaGain=(p.kjiaGain||0)+gain; // 成就「练级成功」依据（含 K甲场上的即时成长）
 const st=p.kjiaStats;
 logEvent(s,' K甲归队：'+p.name+' 锻炼归来，属性成长 +'+gain+'（K甲累计出场 '+(st?st.apps:0)+' 场'+(st?' · 场均 '+Math.round(st.k/st.apps*10)/10+'/'+Math.round(st.d/st.apps*10)/10+'/'+Math.round(st.a/st.apps*10)/10:'')+'）');
 });
}

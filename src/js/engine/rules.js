/* ================= KPL 联盟规则扩展 =================
 ① 临时席位：固定 16 + 临时 2；临时席年度垫底可被收回，由 K甲/资格赛队伍顶上（只升不降）
 ② 转会窗分段：前 4 天「自由交易」可买断/直签；后 3 天「挂牌期」只挂牌/竞价/续约/租借
 ③ 直进青训营：开季俱乐部可直进 2 名新秀（对齐官方直进名额） */
const TEMP_SEAT_COUNT=2;
const TRANSFER_FREE_DAYS=4; // 7 天窗：前 4 自由交易，后 3 挂牌期
const YOUTH_DIRECT_ENTRY=2;
function transferPhase(s){ // 'free' | 'list' | null
 if(!s||!s.preseason||(s.transferWindow||0)<=0)return null;
 const total=(s.transferWindowStart||7);
 const used=total-(s.transferWindow||0);
 return used<TRANSFER_FREE_DAYS?'free':'list';
}
function transferPhaseLabel(s){
 const ph=transferPhase(s);
 if(ph==='free')return '自由交易期';
 if(ph==='list')return '挂牌期';
 return '';
}
function canFreeSign(s){ // 买断/自由市场直签是否开放
 return transferPhase(s)==='free';
}
function initTempSeats(s){
 if(!s)return;
 if(s.tempSeats&&s.tempSeats.length===TEMP_SEAT_COUNT)return;
 // 默认：联盟里战力中等偏下的两支 AI 队挂临时席
 const pool=AI_TEAMS.map(t=>t.name).filter(n=>n!==s.teamName);
 if(pool.length<TEMP_SEAT_COUNT){s.tempSeats=pool.slice();return;}
 // 取 seed 较低的两支作初始临时席（可被收回）
 const sorted=pool.slice().sort((a,b)=>{
 const ta=AI_TEAMS.find(x=>x.name===a),tb=AI_TEAMS.find(x=>x.name===b);
 return (ta&&ta.seed||0)-(tb&&tb.seed||0);
 });
 s.tempSeats=sorted.slice(0,TEMP_SEAT_COUNT);
 s.tempSeatLog=s.tempSeatLog||[];
}
function isTempSeat(s,team){
 return !!(s&&s.tempSeats&&s.tempSeats.includes(team));
}
/* 年度轮换时结算临时席：垫底临时席收回 → K甲冠军顶上（名字进联盟） */
function settleTempSeats(s){
 if(!s)return;
 initTempSeats(s);
 if(!s.tempSeats||!s.tempSeats.length)return;
 const pts=s.annualPts||{};
 // 临时席里年度积分最低的收回
 let worst=null,worstPts=Infinity;
 s.tempSeats.forEach(t=>{
 const p=pts[t]||0;
 if(p<worstPts){worstPts=p;worst=t;}
 });
 if(!worst)return;
 // K甲冠军：优先本届 s.kjia 的 AI 冠军；否则造一支次级豪门名
 let incoming=null;
 try{
 const k=s.kjia;
 if(k&&k.champ&&k.champ!==kjiaMyName(s)&&!AI_TEAMS.some(t=>t.name===k.champ)){
 incoming=k.champ; // 次级 AI 队名
 }else if(k&&k.champ){
 // 我的二队夺冠：俱乐部获「资格赛关注」——临时席由 K甲积分榜次席 AI 顶上
 const rank=kjiaRank(s)||[];
 incoming=rank.find(n=>n!==k.champ&&n!==kjiaMyName(s))||null;
 }
 }catch(e){}
 if(!incoming){
 // 兜底：用未占用的 K甲 AI 名
 incoming=KJIA_AI_TEAMS.find(n=>!AI_TEAMS.some(t=>t.name===n))||('K甲·新军'+gameYear(s));
 }
 s.tempSeats=s.tempSeats.filter(t=>t!==worst);
 if(!s.tempSeats.includes(incoming))s.tempSeats.push(incoming);
 s.tempSeatLog=s.tempSeatLog||[];
 s.tempSeatLog.unshift(gameYear(s)+'：收回 '+worst+' 临时席 → '+incoming+' 顶上');
 s.tempSeatLog=s.tempSeatLog.slice(0,8);
 try{
 logEvent(s,' 临时席变动：'+worst+' 席位收回，'+incoming+' 获得下赛季 KPL 临时席位（固定席位不降级）');
 }catch(e){}
 // 我的二队若夺冠，额外公告
 try{
 if(s.kjia&&s.kjia.champ===kjiaMyName(s)){
 logEvent(s,' 二队 K甲夺冠——俱乐部斩获临时席位资格赛话语权（关注度+）');
 addFans(s,1,'K甲夺冠·席位资格');
 }
 }catch(e){}
}
function tempSeatsPanelHtml(){
 const s=S;
 if(!s||!s.tempSeats||!s.tempSeats.length)return '';
 let html=`<div class="panel"><h3>临时席位 <span class="tag">固定 16 + 临时 ${TEMP_SEAT_COUNT} · 只升不降</span></h3>
 <div class="hint" style="margin-bottom:8px">KPL 固定席位不会降级；临时席由 K甲/资格赛队伍打上来，年度成绩垫底可能被收回。你的俱乐部是固定席，不受收回影响。</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">${s.tempSeats.map(t=>`<span class="tag" style="border-color:var(--gold)">${crest(null,t,14)} ${t} · 临时</span>`).join('')}</div>`;
 if((s.tempSeatLog||[]).length){
 html+=`<div class="hint">近年变动：${s.tempSeatLog.slice(0,4).map(l=>_escTxt(l)).join('<br>')}</div>`;
 }
 html+=`</div>`;
 return html;
}
/* 直进青训营：开季补 2 名（若营未满） */
function youthDirectEntry(s){
 if(!s||s.mode!=='manager')return;
 if(s._youthDirectSeason===s.season&&s._youthDirectSplit===s.split)return;
 s.academy=s.academy||[];
 let n=0;
 while(n<YOUTH_DIRECT_ENTRY&&s.academy.length<6){
 try{
 const r=genRookie(s);
 s.academy.push(r);
 n++;
 }catch(e){break;}
 }
 if(n){
 s._youthDirectSeason=s.season;s._youthDirectSplit=s.split;
 try{logEvent(s,' 青训营直进 '+n+' 名新秀（官方直进名额 '+YOUTH_DIRECT_ENTRY+'）——培养后可用自留签晋升');}catch(e){}
 }
}
/* 转会窗分段：买入类操作在挂牌期拦截 */
function freeSignBlockedReason(s){
 if(canFreeSign(s))return '';
 if(!s||!s.preseason)return '';
 return '已进入挂牌期（后 '+TRANSFER_FREE_DAYS+' 天）——只能挂牌/竞价/续约/租借，不能买断直签';
}

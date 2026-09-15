/* 亚运会·国家队征召（season.js 机械拆出） */
/* ================= 亚运会·国家队征召（亚运年夏季赛前宣布） =================
 真实逻辑：名单在夏赛开打前公布，入选选手整个夏季赛在国家队集训/出征，缺席俱乐部比赛。
 俱乐部损失核心战力，但可用替补/转会/青训顶位；亚运结束后选手归队并带回奖牌加成。 */
function natCamping(s,p){return !!(p&&p.natCamp&&!s.agDone&&s.split==='summer');}
function announceNatCamp(s){
 s.natAnnounced=true;
 s.natCampDay=0;
 const squad=agSelectSquad(s); // 全联盟各位置总值最高（实时阵容）
 const owned=new Set(s.players.map(p=>p.id));
 const mine=squad.filter(p=>owned.has(p.id));
 s.natSquad=squad.map(p=>({name:p.name,pos:p.pos,mine:owned.has(p.id),ovr:overall(p)}));
 s.natCampIds=mine.map(p=>p.id);
 mine.forEach(p=>{p.natCamp=true;p.natCampForm=0;});
 autoFillLineup(s); // 集训选手立刻换下首发（同位置替补择优顶上；无替补则位置空缺）
 if(mine.length){
 const names=mine.map(p=>p.name+'（'+POS[p.pos][0]+'）').join('、');
 logEvent(s,' 国家队征召：'+names+' 入选中国代表队！夏赛期间集训+出征名古屋亚运会，缺席俱乐部整个夏季赛');
 const empty=POS_ORDER.filter(pos=>!s.lineup.some(id=>{const p=s.players.find(x=>x.id===id);return p&&p.pos===pos;}));
 if(empty.length)logEvent(s,' 警告：'+empty.map(pos=>POS[pos][0]).join('、')+'没有替补可顶——转会市场签替补 / 训练页提拔青训，否则该位置整段夏季赛无法出战');
 }else{
 logEvent(s,' '+gameYear(s)+' 亚运年：中国代表队集结完毕（本队无选手入选，不受影响）');
 }
}
/* 集训日结：征召选手在国家队有球可打——状态/默契随集训累积，出征前热身赛再抬一档。
 与俱乐部训练互斥（natCamping 时 doTrain/playerTrain 已拦截），集训本身就是他们的「训练」。 */
function natCampTick(s){
 if(!s||s.split!=='summer'||s.agDone||!s.natAnnounced)return;
 const camped=(s.players||[]).filter(p=>p.natCamp);
 if(!camped.length)return;
 s.natCampDay=(s.natCampDay||0)+1;
 const day=s.natCampDay;
 // 每 5 天一次集训汇报：属性小幅上探 + 集训状态（出征战力加成）
 if(day%5===0){
 camped.forEach(p=>{
 const key=pick(['lane','farm','team','mind']);
 p.attrs[key]=clamp(p.attrs[key]+rnd(0,1),40,99);
 p.natCampForm=clamp((p.natCampForm||0)+1,0,5);
 p.energy=clamp(p.energy+8,0,ENERGY_MAX);
 p.morale=clamp(p.morale+2,20,100);
 if(typeof applyNatFocus==='function')applyNatFocus(s,p); // 选手可选集训专注
 });
 const names=camped.map(p=>p.name).join('、');
 logEvent(s,' 国家队集训第'+day+'天：'+names+' 与国家队合练（状态 +'+camped[0].natCampForm+' · 小幅成长）——俱乐部只能靠替补顶住夏赛');
 }
 // 集训热身：开赛前最后阶段（第 20 天）打一场教学赛，状态再抬
 if(day===20){
 camped.forEach(p=>{p.natCampForm=clamp((p.natCampForm||0)+2,0,5);p.morale=clamp(p.morale+4,20,100);});
 logEvent(s,' 国家队集训热身赛：中国代表队内部对抗收官，'+camped.map(p=>p.name).join('、')+' 状态拉满，即将出征亚运会');
 }
}
/* 出征时把集训状态折算进中国队战力（setupAsianGames 读） */
function natCampFormBonus(s,p){
 if(!p||!p.natCamp)return 0;
 return Math.round((p.natCampForm||0)*1.5); // 最高 +7.5 点有效战力刻度
}
/* 旧版「青训临时借调」机制已移除（2026-09：顶位一律用队内替补，没有就签人——买替补成为正式策略）。
 旧档中残留的 natFill 选手由 finishAsianGames 收官清理与禁售守卫兼容处理。 */

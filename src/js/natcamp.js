/* 亚运会·国家队征召（season.js 机械拆出） */
/* ================= 亚运会·国家队征召（亚运年夏季赛前宣布） =================
 真实逻辑：名单在夏赛开打前公布，入选选手整个夏季赛在国家队集训/出征，缺席俱乐部比赛。
 俱乐部损失核心战力，但可用替补/转会/青训顶位；亚运结束后选手归队并带回奖牌加成。 */
function natCamping(s,p){return !!(p&&p.natCamp&&!s.agDone&&s.split==='summer');}
function announceNatCamp(s){
 s.natAnnounced=true;
 const squad=agSelectSquad(s); // 全联盟各位置总值最高（实时阵容）
 const owned=new Set(s.players.map(p=>p.id));
 const mine=squad.filter(p=>owned.has(p.id));
 s.natSquad=squad.map(p=>({name:p.name,pos:p.pos,mine:owned.has(p.id),ovr:overall(p)}));
 s.natCampIds=mine.map(p=>p.id);
 mine.forEach(p=>{p.natCamp=true;});
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
/* 旧版「青训临时借调」机制已移除（2026-09：顶位一律用队内替补，没有就签人——买替补成为正式策略）。
 旧档中残留的 natFill 选手由 finishAsianGames 收官清理与禁售守卫兼容处理。 */

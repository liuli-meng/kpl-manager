/* aiCoach — 选手/教练模式竞技 AI（Phase2 从 match.js 原样迁出）
 * 加载：必须在 match.js 之后。对外全局名不变，调用点无需改。
 * 职责：排阵（coachPickLineup）+ 自动系列赛（playerAutoSeries）。
 * 玩家转会谈判在 transfer.js；本文件不碰买卖。
 */
function coachPickLineup(s){ // 教练排首发：同位置健康者中取战力更强者（体力/士气实时计入）
 if(s.mode!=='player')return;
 const me=myPlayer(s);
 if(!me)return;
 // 统一出战资格：伤停/亚运集训/未满18岁均不可进首发（与青训晋升、swapPlayer 同规则）
 if(!matchEligible(s,me)){
 if(me.injury>0&&!s._meOutNoted){logEvent(s,' 伤停报告：'+me.name+'（'+me.injury+' 天恢复）本场缺席');s._meOutNoted=true;}
 if(s.lineup.includes(me.id))s.lineup.splice(s.lineup.indexOf(me.id),1);
 return;
 }
 s._meOutNoted=false;
 const rival=s.players.filter(p=>p.pos===me.pos&&p.id!==me.id&&matchEligible(s,p))
 .sort((a,b)=>playerPower(b)-playerPower(a))[0];
 const li=s.lineup.indexOf(me.id);
 if(!rival){if(li<0)s.lineup.push(me.id);return;}
 const myPow=playerPower(me,(s.pick&&s.pick[me.pos])||me.sig);
 const rivPow=playerPower(rival,rival.sig);
 if(myPow>=rivPow){
 if(li<0){const ri=s.lineup.indexOf(rival.id);if(ri>=0)s.lineup[ri]=me.id;else s.lineup.push(me.id);}
 }else if(li>=0)s.lineup[li]=rival.id;
}

function playerAutoSeries(s,opName,bo){ // 自动打完整场系列赛，返回 series 形状对象（finishSeries 可直接消费）
 coachPickLineup(s);
 autoFillLineup(s); // 我方不可出战时同位置替补顶上；转会/伤停/集训后不留空位
 resetOppEnergy(s,opName);
 const sr={used:[],usedOpp:[],mw:0,ow:0,max:bo,logs:[],myName:s.teamName,opName,side:firstSide(s,'regular',opName)};
 if(typeof annualMarkSeriesStart==='function')annualMarkSeriesStart(s,sr); // 年总：记首发/出场
 const need=Math.ceil(bo/2);
 let guard=0,myApps=0,myK=0,myD=0,myA=0,myMvp=0;
 while(sr.mw<need&&sr.ow<need&&guard++<bo+2){
 if(typeof annualAutoRotate==='function'){try{annualAutoRotate(s,sr);}catch(e){}} // 大师组官方轮换
 const my=teamPower(s),op=powerOf(s,opName);
 const g=singleGame(my,op);
 rosterLineup(s).forEach(p=>{p.energy=clamp(p.energy-8,0,ENERGY_MAX);p.caps=(p.caps||0)+1;});
 if(g.w)sr.mw++;else sr.ow++;
 if(typeof annualMarkPlayed==='function'){try{annualMarkPlayed(s,sr);}catch(e){}}
 const mvp=gamePerform(g.w);
 if(mvp){const mp=s.players.find(x=>x.id===mvp.id);if(mp){mp.mvp=(mp.mvp||0)+1;mp.popularity=Math.min(99,(mp.popularity||0)+2);mp.val=clamp((mp.val||100)+3,70,150);}}
 if(mvp){sr.mvpIds=(sr.mvpIds||[]).concat(mvp.id);sr.mvpKda=(sr.mvpKda||[]).concat(mvp.k+'/'+mvp.d+'/'+mvp.a);}
 const me=myPlayer(s);
 const meIn=me&&rosterLineup(s).some(p=>p.id===me.id);
 if(meIn){myApps++;myK+=me._lk||0;myD+=me._ld||0;myA+=me._la||0;if(mvp&&mvp.id===me.id)myMvp++;}
 sr.logs.push('第'+(sr.mw+sr.ow)+'局  我方 '+g.myK+'-'+g.opK+' '+(g.w?'击败':'憾负')+' '+opName+' ｜ 总比分 '+sr.mw+':'+sr.ow+(mvp?' ｜ MVP：'+mvp.name+'（'+mvp.k+'/'+mvp.d+'/'+mvp.a+'）':''));
 sr.logs.push(...genMatchStory(sr,g,mvp));
 }
 if(myApps)sr.logs.push(' 本场你的数据：出战 '+myApps+' 局 · 合计 '+myK+'/'+myD+'/'+myA+(myMvp?' · 拿下 '+myMvp+' 次单局MVP':'（尚无单局MVP）'));
 return sr;
}

/* AI 行为日志（轻量，info 默认不落盘，km_trace=1 可见） */
;(function aiCoachLogWrap(){
  const _pick=coachPickLineup;
  coachPickLineup=function(s){
    const r=_pick.apply(this,arguments);
    try{if(typeof gameLog!=='undefined')gameLog.info('aiCoach','pickLineup',{mode:s&&s.mode,lineup:s&&s.lineup&&s.lineup.slice()});}catch(e){}
    return r;
  };
  const _auto=playerAutoSeries;
  playerAutoSeries=function(s,opName,bo){
    const sr=_auto.apply(this,arguments);
    try{if(typeof gameLog!=='undefined'&&sr)gameLog.info('aiCoach','autoSeries',{op:opName,bo:bo,mw:sr.mw,ow:sr.ow});}catch(e){}
    return sr;
  };
})();

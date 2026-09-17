/* 赛季推进状态机（引擎层，无 UI）。
   约定：只通过 nextAction/runEngineAction 驱动；stepCalendar 返回 {ok, action, phase, next}。
   目的：把「点什么 → 发生什么 → 现在该点什么」收成可测的一跳，而不是 UI 散落 onclick。 */
function stepCalendar(s,userAct){
 if(!s)return {ok:false,reason:'no-state'};
 const before=s.phase;
 let act=userAct&&userAct.type?userAct:nextAction(s);
 if(!act)return {ok:false,reason:'idle',phase:before,next:null};
 // 引擎动作：允许测试直接给 {type:'startCup'} 覆盖 nextAction 的 label/fn
 const ran=runEngineAction(s,act);
 if(!ran)return {ok:false,reason:'unknown-action:'+act.type,phase:before,next:nextAction(s)};
 const after=s.phase;
 return {ok:true,action:act.type,before,after,next:nextAction(s)};
}
/* 连推直到无可推进或达到 max 步（供门禁/探针） */
function pumpCalendar(s,max){
 const log=[];
 let g=0;
 while(g++<(max||200)){
  const r=stepCalendar(s,null);
  if(!r.ok)break;
  log.push(r.action+' '+r.before+'→'+r.after);
  // 系列赛打开时停住，由调用方收 series（与 UI 一致：不能无限 pump 跳过 BP）
  if(s.series)break;
 }
 return {steps:log,phase:s.phase,next:nextAction(s),guard:g};
}

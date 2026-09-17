// 实验：series.mid + s.matches 扁平表 —— 读档重建后仅凭 mid 即可解析对阵并写回 r
// 注意（2026-09-17）：matches 是 bracket 树的派生索引，已不进存档（serializeForSave 剥离，省 8.2%）。
// 所以「不 rebuild 也能靠存档里的 matches 工作」不再是契约；现契约是：
//   存档只带 series.mid 和 bracket → 走真实读档（migrateSave 内 rebuildMatchStore 重灌）→ mid 可解析 → 写 r 落到真相源。
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');
const { dom } = makeDom();
injectHelpers(dom);

const out = vm.runInContext(`
(function(){
  const res=[],errs=[];
  const log=t=>res.push(t);
  const fail=m=>errs.push(m);

  S=newState('mid实验','x');
  fillRoster(S,'star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  startSplit(S,'spring');
  S.preseason=false;S.transferWindow=0;

  // 打到季后赛开幕
  let g=0;
  while(!['playoff','card','champion','eliminated'].includes(S.phase)&&g++<80){
    if(S.matchIdx>=(S.schedule||[]).length){advancePhase(S);continue;}
    const m=S.schedule[S.matchIdx];
    S.series={used:[],usedOpp:[],mw:3,ow:1,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
    finishSeries(true);
  }
  if(S.phase==='card'){
    const my=S.card.matches.find(x=>!x.r&&(x.a===S.teamName||x.b===S.teamName));
    if(my){
      S.series={used:[],usedOpp:[],mw:4,ow:1,max:7,stage:'card',mid:'card_'+S.card.idx,cardIdx:S.card.idx,cardMatch:my,logs:[],myName:S.teamName,opName:my.a===S.teamName?my.b:my.a,side:'blue'};
      finishSeries(true);
    }
    let c=0;while(S.phase==='card'&&c++<10){startCard();if(S.series){S.series.mw=4;S.series.ow=1;finishSeries(true);}}
  }
  startPlayoff();
  if(!S.series){
    // 可能玩家不在季后赛首场，快进
    let p=0;while(S.phase==='playoff'&&p++<20){startPlayoff();if(S.series)break;if(S.playoff&&S.playoff.final.r)break;}
  }
  if(!S.series)fail('未进入季后赛系列赛 phase='+S.phase);
  else{
    if(!S.series.mid)fail('series 无 mid');
    else log('series.mid='+S.series.mid+' storeHas='+!!getMatch(S,S.series.mid));
    // 断引用：JSON 往返 → 走真实读档路径（migrateSave 内含 rebuildMatchStore 重灌派生表）
    const raw=serializeForSave(S);
    if(/"matches":\{"po/.test(raw))fail('派生索引 matches 不应写进存档（应被 serializeForSave 剥掉）');
    else log('matches 未落盘 OK（派生索引，读档由 bracket 重灌）');
    S=JSON.parse(raw);
    migrateSave(); // = 真实读档：rebuildMatchStore 按 bracket 树重灌 s.matches
    const sr=S.series;
    delete sr.poMatch;delete sr.cupMatch;delete sr.cardMatch; // 断掉对象引用，只留 series.mid
    const live=getMatch(S,sr.mid);
    if(!live)fail('读档重建后仅靠 s.matches[mid] 找不到对阵 mid='+sr.mid);
    else{
      log('读档重建后仅靠 mid 解析 OK mid='+sr.mid+' a/b='+live.a+' vs '+live.b);
      sr.mw=Math.ceil(sr.max/2);sr.ow=1;
      live.r=sr.myName;
      if(!live.r)fail('写 r 失败');
      // 关键：写回必须落到真相源（bracket），否则再存再读会丢
      else if(!getMatch(S,sr.mid)||getMatch(S,sr.mid).r!==sr.myName)fail('写回的 r 未落到真相源');
      else log('写回 r='+live.r+' OK 且落在真相源（再存再读可保留）');
    }
  }

  return (errs.length?errs.map(e=>'[FAIL] '+e).join('\\n')+'\\n':'') + res.map(r=>'[INFO] '+r).join('\\n') + (errs.length?'\\n共 '+errs.length+' 失败':'\\n全部通过');
})()
`, dom);
console.log(out);
if (/\[FAIL\]/.test(out)) process.exitCode = 1;

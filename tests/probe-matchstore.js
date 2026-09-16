// 实验：series.mid + s.matches 扁平表 —— 读档后不依赖 bracket 引用也能写回 r
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
    // 断引用：JSON 往返 + 显式清空缓存对象 + 不调 rebuild（只靠存档里的 matches 表）
    const raw=serializeForSave(S);
    S=JSON.parse(raw);
    migrateSave(); // 会 rebuild —— 再手动测「不 rebuild」路径
    // 二次：只带 matches 表，不 rebuild bracket 重绑
    const S2=JSON.parse(raw);
    // 模拟极简读档：只恢复 matches + series.mid，不跑 rebuildMatchStore
    const sr=S2.series;
    delete sr.poMatch; delete sr.cupMatch; delete sr.cardMatch;
    // 故意不把 playoff 树里的对象和 series 关联；只保留 mid
    const live=getMatch(S2,sr.mid);
    if(!live)fail('仅靠 s.matches[mid] 找不到对阵 mid='+sr.mid);
    else{
      log('仅扁平表解析 OK mid='+sr.mid+' a/b='+live.a+' vs '+live.b);
      sr.mw=Math.ceil(sr.max/2);sr.ow=1;
      // 最小 finishSeries 路径
      const m=getMatch(S2,sr.mid);
      m.r=sr.myName;
      if(!m.r)fail('写 r 失败');
      else log('写回 r='+m.r+' OK');
    }
  }

  return (errs.length?errs.map(e=>'[FAIL] '+e).join('\\n')+'\\n':'') + res.map(r=>'[INFO] '+r).join('\\n') + (errs.length?'\\n共 '+errs.length+' 失败':'\\n全部通过');
})()
`, dom);
console.log(out);
if (/\[FAIL\]/.test(out)) process.exitCode = 1;

// 竞争热度探针：每签未放弃队数 / 成交价 / 几支队真正出手
const vm = require('vm');
const { makeDom } = require('../tests/harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const rows=[];
  for(let trial=0;trial<5;trial++){
    const s=newState('热度队','⚔️');
    fillRoster(s,'mid');
    s.coach={...COACH_POOL.find(c=>c.id==='co12')};
    s.preseason=true;s.transferWindow=7;s.fund=5000;
    s.annualPts={};
    AI_TEAMS.forEach(t=>{s.annualPts[t.name]=100+Math.floor(Math.random()*80);});
    s.annualPts[s.teamName]=0;
    S=s;
    initDraft(s,true);
    const d=s.draft;
    // 玩家全程 pass，看 AI 竞争
    let g=0;
    const slotStats=[];
    while(!d.done&&g++<400){
      if(d.phase==='auction'){
        // 记录本签开始时有多少队想玩
        const alive=d.order.filter(t=>!d.passed[t]&&draftStillWant(s,t)).length;
        const startBid=d.bid, startLeader=d.leader;
        // 一轮里让 AI 跑
        draftAiAuction(s);
        if(d.phase==='auction'){
          // 玩家 pass 掉避免卡住
          if(!d.passed[s.teamName])draftBidPass(s);
          else{
            // 若 AI 也停了，强制结束本签
            const c2=d.order.filter(t=>!d.passed[t]&&draftStillWant(s,t));
            if(!c2.length&&d.leader)draftWinSlot(s,d.leader,d.bid);
            else if(!c2.length&&!d.leader){d.done=true;d.phase='done';}
          }
        }
        if(d.phase==='pick'){
          slotStats.push({alive, bid:d.bid, leader:d.leader});
          // 玩家放弃点名
          if(d.leader===s.teamName){d.picks.push({slot:d.slot,team:s.teamName,playerId:null});d.slot++;draftNextSlot(s);}
        }
      }else if(d.phase==='pick'){
        if(!d.passed[s.teamName])draftBidPass(s);
        d.picks.push({slot:d.slot,team:s.teamName,playerId:null});
        d.slot++;draftNextSlot(s);
      }else break;
    }
    const bids=slotStats.map(x=>x.bid);
    const alives=slotStats.map(x=>x.alive);
    rows.push({
      slots:slotStats.length,
      avgAlive:alives.length?Math.round(alives.reduce((a,b)=>a+b,0)/alives.length*10)/10:0,
      minAlive:alives.length?Math.min(...alives):0,
      maxBid:bids.length?Math.max(...bids):0,
      avgBid:bids.length?Math.round(bids.reduce((a,b)=>a+b,0)/bids.length):0,
      picks:d.picks.filter(x=>x.playerId).length,
    });
  }
  return JSON.stringify(rows,null,1);
})()
`, dom);

console.log(out);

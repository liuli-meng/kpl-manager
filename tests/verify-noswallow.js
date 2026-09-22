// 「选手被吞」回归：租借回流 / 卖出挂账 / 自由市场重建 / 关窗清表 都不得让人从联盟蒸发
// 运行：node tests/verify-noswallow.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const inLeague=(s,id)=>(s.players||[]).some(p=>p.id===id)
    ||(s.freeAgents||[]).some(p=>p.id===id)
    ||(s.transferList||[]).some(p=>p.id===id)
    ||(s.academy||[]).some(p=>p.id===id)
    ||(s.market||[]).some(p=>p.id===id)
    ||Object.values(aiRosterDefMap(s)||{}).some(arr=>(arr||[]).indexOf(id)>=0)
    ||Object.values(s.aiRosters||{}).some(arr=>(arr||[]).some(p=>p&&p.id===id))
    ||Object.values(s.loanBenches||{}).some(arr=>(arr||[]).some(p=>p&&p.id===id))
    ||(s.aiAcademy&&Object.values(s.aiAcademy).some(arr=>(arr||[]).indexOf(id)>=0));

  // ① 合成租借替补到期：不能只删不入册
  {
    const s=newState('我方','x'); S=s; fillRoster(s,'mid');
    const cand=loanCandidates(s)[0];
    if(!cand){fail('① 无可租候选');}
    else{
      const pid=cand.p.id;
      loanPlayer(s,cand.from,pid);
      const mine=(s.players||[]).find(p=>p.id===pid);
      if(!mine)fail('① 租借未入我方名单');
      else{
        mine.loan.days=1;
        tickLoans(s);
        if((s.players||[]).some(p=>p.id===pid))fail('① 到期后仍挂在我方名单');
        else if(!inLeague(s,pid))fail('① 合成替补租借到期后从联盟蒸发');
        else log('① 合成/替补租借到期后仍可在联盟找到（'+pid+'）');
      }
    }
  }

  // ② 真实 AI def 租借到期且原队同位被占：应回自由市场，不得蒸发
  {
    const s=newState('我方','x'); S=s; fillRoster(s,'mid');
    const map=aiRosterDefMap(s);
    const tn=Object.keys(map).filter(t=>t!==s.teamName)[0];
    ensureAiRosters(s,tn);
    const roster=(s.aiRosters[tn]||[]).slice();
    const target=roster.find(p=>p.id&&!String(p.id).startsWith('loan_bench_'))||roster[0];
    if(!target){fail('② 目标 AI 选手缺失');}
    else{
      const pid=target.id;
      ensureDef(s,target);
      target.loan={from:tn,days:1};
      s.players.push(target);
      aiDetachDef(s,pid);
      s.aiRosters={};
      const blockers=[];
      for(let i=0;i<5;i++){
        const pos=['top','jg','mid','ad','sup'][i];
        const id='block_'+tn+'_'+i;
        ensureDef(s,{id,name:'占位'+i,pos,base:[70,70,70,70],skill:{n:'x',t:'team',d:'x'},sig:'镜'});
        blockers.push(id);
      }
      map[tn]=blockers;
      tickLoans(s);
      if((s.players||[]).some(p=>p.id===pid))fail('② 到期后仍挂在我方名单');
      else if(!inLeague(s,pid))fail('② 原队占位后租借回流被吞：'+pid);
      else if(!(s.freeAgents||[]).some(p=>p.id===pid))fail('② 未能入自由市场，却不在其他池：'+pid);
      else log('② 原队占位时租借回流落入自由市场（'+pid+'）');
    }
  }

  // ③ completeSale 买家满编：不得挂进会被清空的 transferList
  {
    const s=newState('我方','x'); S=s; fillRoster(s,'mid');
    const p=s.players.find(x=>!s.lineup.includes(x.id))||s.players[s.players.length-1];
    const pid=p.id;
    const map=aiRosterDefMap(s);
    const tn=Object.keys(map).filter(t=>t!==s.teamName)[0];
    map[tn]=['top','jg','mid','ad','sup'].map((pos,i)=>{
      const id='full_'+tn+'_'+i;
      ensureDef(s,{id,name:'满编'+i,pos,base:[70,70,70,70],skill:{n:'x',t:'team',d:'x'},sig:'镜'});
      return id;
    });
    s.aiRosters={};
    completeSale(s,p,100,tn);
    if((s.players||[]).some(x=>x.id===pid))fail('③ 出售后仍在我方名单');
    else if((s.transferList||[]).some(x=>x.id===pid))fail('③ 挂进了会被关窗/存档清空的 transferList');
    else if(!inLeague(s,pid))fail('③ 卖出后从联盟蒸发：'+pid);
    else log('③ 买家满编时卖出收容进自由市场（'+pid+'）');
  }

  // ④ endTransferWindow 不得吞掉未入册条目
  {
    const s=newState('我方','x'); S=s; fillRoster(s,'mid');
    const ghost=genPlayer(genFreeAgentDef('mid','low',new Set()));
    ghost.ownerTeam='虚空队';
    ghost.untouchable=false;
    s.transferList=[ghost];
    endTransferWindow(s);
    if((s.transferList||[]).length!==0)fail('④ 关窗后 transferList 未清空');
    else if(!inLeague(s,ghost.id))fail('④ 关窗清表把未入册选手吞掉：'+ghost.id);
    else log('④ 关窗清表前把未入册选手收容进自由市场');
  }

  // ⑤ buildTransferMarket 不得清空已有自由球员（含主动放走）
  {
    const s=newState('我方','x'); S=s; fillRoster(s,'mid');
    const p=s.players[s.players.length-1];
    p.contract=0;
    const pid=p.id;
    releasePlayer(s,pid);
    if(!(s.freeAgents||[]).some(x=>x.id===pid))fail('⑤ 放走后未进自由市场');
    else{
      buildTransferMarket(s);
      if(!(s.freeAgents||[]).some(x=>x.id===pid))fail('⑤ 转会市场重建后放走的选手被吞：'+pid);
      else log('⑤ releasePlayer 放走的选手在市场重建后仍留在自由市场');
    }
  }

  // ⑥ ensureDef + parkFreeAgent 合成选手可收容
  {
    const s=newState('我方','x'); S=s; fillRoster(s,'mid');
    const p=genPlayer(genFreeAgentDef('ad','mid',new Set()));
    s.players.push(p);
    parkFreeAgent(s,p,'测试收容');
    if((s.players||[]).some(x=>x.id===p.id))fail('⑥ 收容后仍在我方名单');
    else if(!(s.freeAgents||[]).some(x=>x.id===p.id))fail('⑥ parkFreeAgent 未入自由市场');
    else if(!defOf(s,p.id))fail('⑥ parkFreeAgent 未补 def');
    else log('⑥ ensureDef/parkFreeAgent：无 def 合成选手可安全收容');
  }

  return {res,hadFail};
})()
`, dom);

out.res.forEach(line => console.log(line));
process.exit(out.hadFail ? 1 : 0);

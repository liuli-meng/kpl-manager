// 谈判讲价回归：接近要价应可成交；压价后对方让步而不是无限涨价
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');

function run() {
  const t = makeTester('nego');
  const { dom } = makeDom();
  const out = vm.runInContext(`
(function(){
  const res=[];const fail=m=>res.push('[FAIL] '+m);const ok=m=>res.push('[OK] '+m);
  const _ra=renderAll,_sv=save;renderAll=function(){};save=function(){};
  try{
    S=newState('谈判队','N');
    fillRoster(S,'star');
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.lineup=S.players.map(p=>p.id);S.seedPower=teamPower(S);
    startSplit(S,'spring');
    S.fund=50000; // 保证第二轮溢价报价也付得起
    buildTransferMarket(S);
    // 找一个可谈的非卖品=false 选手
    const p=S.transferList.find(x=>!x.untouchable&&x.willingness>=40);
    if(!p)fail('市场无可谈选手');
    else{
      ok('目标 '+p.name+' wil='+p.willingness);
      // 模拟 openNegotiation 状态
      window._nego={pid:p.id,round:1,freeAgent:false,askFee:negoAskFee(p),askWage:negoWageDemand(p)};
      if(window._nego.s)fail('_nego 不应持有 s 引用（换档会断链）');
      // 桩 DOM 输入
      const feeEl=document.getElementById('nego-fee');
      const wageEl=document.getElementById('nego-wage');
      // 满足要价路径
      negoFillAsk();
      // 直接调结算逻辑副本：用 negoSubmit 前注入 input 值
      // harness 的 input value 可写
      feeEl.value=String(Math.round(window._nego.askFee));
      wageEl.value=String(window._nego.askWage);
      // 用 100% 意愿保证可谈
      p.willingness=90;
      const before=S.players.length;
      negoSubmit();
      if(S.players.length!==before+1){
        fail('全款要价未成：players='+S.players.length+' msg='+(window._nego&&window._nego.msg));
      }else ok('全款要价成交');

      // 第二名选手：95% 报价应有机会（高意愿）
      const p2=S.transferList.find(x=>!x.untouchable&&x.id!==p.id);
      if(p2){
        p2.willingness=95;
        window._nego={pid:p2.id,round:1,freeAgent:false,askFee:negoAskFee(p2),askWage:negoWageDemand(p2)};
        document.getElementById('nego-fee').value=String(Math.round(window._nego.askFee*0.95));
        document.getElementById('nego-wage').value=String(window._nego.askWage);
        const b2=S.players.length;
        let tries=0;
        while(S.players.length===b2&&tries++<5&&window._nego){
          negoSubmit();
          if(window._nego){
            document.getElementById('nego-fee').value=String(window._nego.askFee);
            document.getElementById('nego-wage').value=String(window._nego.askWage);
          }
        }
        if(S.players.length===b2+1)ok('讲价/追价成交');
        else fail('5 轮内未成交 tries='+tries+' still='+(window._nego?window._nego.msg:'broke'));
      }
    }
  }catch(e){fail('throw '+e.message);}
  renderAll=_ra;save=_sv;
  return res.join('\\n');
})()
`, dom);
  String(out).split('\n').forEach(line => {
    if (line.startsWith('[FAIL]')) t.check(false, line.slice(7));
    else if (line.startsWith('[OK]')) console.log('  ' + line);
  });
  if (t.errors.length) {
    t.errors.forEach(e => console.error('  ' + e));
    console.error('nego: FAIL');
    process.exitCode = 1;
  } else console.log('nego: PASS');
}
run();

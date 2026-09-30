// 工资帽经济修复回归
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
 const res=[];let hadFail=false;
 const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
 const log=t=>res.push('[PASS] '+t);

 // ① 缺工资帽回落 150（不是旧 90）
 S={teamName:'缺帽',players:[{id:'p1',wage:20}],fund:100,moneyScaled:true,econReal:true};
 migrateSave();
 if(S.wageCap!==ECON.wageCapDefault)fail('缺工资帽应补 ECON.wageCapDefault，实为 '+S.wageCap);
 else log('① 缺工资帽回落 150（现役经济刻度）');

 // ② mid 阵容开局帽内（不含教练；star 档+顶帅可能压线 151>150，属随机而非规则错误）
 S=newState('帽内队','帽');fillRoster(S,'mid');
 const ww=weeklyWage(S);
 if(ww>S.wageCap)fail('mid 开局即超帽: '+ww+' > '+S.wageCap);
 else log('② mid 开局周薪 '+ww+' / 帽 '+S.wageCap+'（无教练，帽内）');

 // ③ 代言：人气×0.3（不是 ×3）——必须钉生产常量，防止重构又写回 1.2
 if(ENDORSE_PER_POP!==0.3)fail('ENDORSE_PER_POP 漂移: '+ENDORSE_PER_POP+'（应 0.3）');
 S.players.forEach(p=>p.popularity=40);
 const endorse=Math.round(S.players.reduce((t,p)=>t+p.popularity*ENDORSE_PER_POP,0)*fanMul(S,300));
 if(endorse>80)fail('5人人气40 代言应远小于 80，实为 '+endorse+'（疑似×3 残留）');
 else log('③ 代言按人气×'+ENDORSE_PER_POP+'：5×40人气 → 周入约 '+endorse+' 万（不再刷爆基金）');

 // ④ 王朝帽成长放缓：正常+80 / 2连冠+30（st≥3 更狠到 +15，见 verify-year3-doc）
 function titleBase(){
  const t=newState('帽队','帽');fillRoster(t,'mid');
  t.coach={...COACH_POOL.find(c=>c.id==='co12')};
  t.lineup=t.players.map(p=>p.id);t.seedPower=teamPower(t);
  initGroups(t);t.split='summer';t.phase='champion';
  return t;
 }
 S=titleBase();
 const c0=S.wageCap;
 newSeason(S);
 const g1=S.wageCap-c0;
 S=titleBase();S.titleHistory=[{season:1,champ:'帽队'},{season:2,champ:'帽队'}];
 const c1=S.wageCap;
 newSeason(S);
 const g2=S.wageCap-c1;
 if(g1!==80||g2!==30)fail('帽成长异常: 正常+'+g1+' 2连冠+'+g2+'（应 80/30）');
 else log('④ 帽成长：正常 +'+g1+' · 2连冠 +'+g2+'（王朝放缓）');

 if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
 return res.join('\\n');
})()
`, dom);

console.log(out);

// 位置专精：生成选手四维必须「像这个位置的人」
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=t=>res.push('[PASS] '+t);
  const _ra=renderAll,_sv=save;renderAll=function(){};save=function(){};
  const KEYS=['lane','farm','team','mind'];

  function topAttr(p){
    let best=KEYS[0],bv=-1;
    KEYS.forEach(k=>{if(p.attrs[k]>bv){bv=p.attrs[k];best=k;}});
    return best;
  }
  // 每个位置各造 40 人，统计「主属性是否最高」
  // 主属性对齐 POS_W 最高权重；并列时看主/次命中
  const wantTop={top:'lane',jg:'farm',mid:'team',ad:'farm',sup:'mind'};
  const wantTop2={top:['lane','team'],jg:['farm','team'],mid:['team','lane'],ad:['farm','lane'],sup:['mind','team']};
  POS_ORDER.forEach(pos=>{
    let hit=0,hit2=0,n=40,skOk=0;
    for(let i=0;i<n;i++){
      const def=genFreeAgentDef(pos,'mid',new Set());
      const p=genPlayer(def);
      const t=topAttr(p);
      if(t===wantTop[pos])hit++;
      if(wantTop2[pos].includes(t))hit2++;
      else if(pos==='sup'&&(t==='mind'||t==='team'))hit2++;
      if(wantTop2[pos].includes(p.skill.t))skOk++;
    }
    const rate=Math.round(hit/n*100), rate2=Math.round(hit2/n*100), skRate=Math.round(skOk/n*100);
    if(hit2<n*0.7)fail(pos+' 主/次属性命中过低: top1='+rate+'% top2='+rate2+'%');
    else if(skRate<n*0.6)fail(pos+' 技能类型对位过低: '+skRate+'%');
    else ok(pos+'：主属性命中 '+rate+'% · 主/次 '+rate2+'% · 技能对位 '+skRate+'%');
  });

  // 青训/新星/时代也必须对位（并列最高也算命中——四维同值时 topAttr 会取第一键，不应误判）
  const maxOf=p=>Math.max(...KEYS.map(k=>p.attrs[k]));
  const ac=genPlayer(genAcademyDef('jg',new Set(),1));
  const st=genPlayer(genStarDef({season:1},new Set(),'sup'));
  const acMax=maxOf(ac),stMax=maxOf(st);
  if(!(ac.attrs.farm===acMax||ac.attrs.team===acMax))fail('青训打野不对位: '+JSON.stringify(ac.attrs)+' skill='+ac.skill.t);
  else ok('青训打野对位：'+JSON.stringify(ac.attrs));
  if(!(st.attrs.mind===stMax||st.attrs.team===stMax))fail('新星游走不对位: '+JSON.stringify(st.attrs)+' skill='+st.skill.t);
  else ok('新星游走对位：'+JSON.stringify(st.attrs));

  renderAll=_ra;save=_sv;
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join('\\n');
})()
`, dom);

console.log(out);

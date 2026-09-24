// Phase3：ModalStack / openModal / scheduleSave / canBuy
// 运行：node tests/verify-modal-stack.js
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');
const { dom } = makeDom();
const t = makeTester('modal-stack');

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=m=>res.push('[PASS] '+m);

  // 1) ModalStack 基础（用 getElementById 走同一 elCache，与 $ 一致）
  try{
    if(typeof ModalStack!=='object'||typeof openModal!=='function'||typeof closeModal!=='function')
      fail('ModalStack/openModal/closeModal missing');
    else{
      ModalStack.clear();
      openModal('m-a');openModal('m-b');
      if(ModalStack.top()!=='m-b'||ModalStack.size()!==2)fail('stack top/size '+ModalStack.top()+'/'+ModalStack.size());
      else ok('open pushes stack');
      closeModal('m-b');
      if(ModalStack.top()!=='m-a'||ModalStack.size()!==1)fail('close mid top='+ModalStack.top());
      else ok('close pops stack');
      closeModal('m-a');
      if(ModalStack.size()!==0)fail('size after clear='+ModalStack.size());
      else ok('stack drains');
    }
  }catch(e){fail('ModalStack throw '+e.message);}

  // 2) openModal wide 标记
  try{
    const c=document.getElementById('m-c');
    openModal('m-c',{wide:true});
    if(!c.classList.contains('on')||!c.classList.contains('wide'))fail('wide/on classes');
    else ok('openModal wide+on');
    closeModal('m-c');
    if(c.classList.contains('on')||c.classList.contains('wide'))fail('close should strip wide');
    else ok('close strips wide');
  }catch(e){fail('openModal throw '+e.message);}

  // 3) scheduleSave 存在且可连点；save() 仍同步可调（verify-save 约束）
  try{
    S=newState('合并档','M');
    if(typeof scheduleSave!=='function')fail('scheduleSave missing');
    else{
      scheduleSave(5);scheduleSave(5);scheduleSave(5);
      ok('scheduleSave merge callable×3');
      if(typeof save!=='function')fail('save missing');
      else { save(); ok('save stays sync-callable'); }
    }
  }catch(e){fail('scheduleSave throw '+e.message);}

  // 4) canBuy 门面
  try{
    if(typeof canBuy!=='function')fail('canBuy missing');
    else{
      S=newState('权限队','P');
      S.mode='manager';
      if(!canBuy('buyPlayer',S))fail('manager canBuy 应放行');
      else ok('canBuy manager');
      S.mode='player';
      if(canBuy('buyPlayer',S))fail('player canBuy 应拦截');
      else ok('canBuy player blocked');
    }
  }catch(e){fail('canBuy throw '+e.message);}

  return res.join('\\n');
})()
`, dom);

const lines = String(out).split('\n').filter(Boolean);
for (const ln of lines) {
  if (ln.startsWith('[FAIL]')) t.check(false, ln.slice(6));
  else if (ln.startsWith('[PASS]')) console.log('  [OK] ' + ln.slice(7));
}
if (!t.report()) process.exit(1);
process.exit(0);

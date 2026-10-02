/* 沙箱保真门禁：测试沙箱的「模块加载语义」必须与浏览器 <script> 一致。
   为什么单独设一条门禁：这是**门禁自己的地基**。地基不一致时，两侧都会骗人 ——
   ① 沙箱把 40 个模块拼成一个脚本 → 后置模块的顶层 const 对前面模块变成 TDZ（typeof 也抛），
      而浏览器里它是「尚未声明」（typeof 得 'undefined'）。真实代价：data.js 的
      ensureYearEras 整段静默失败，沙箱里 KPL_ERAS 只剩 2/11 个年档，而浏览器里 11 个全在
      —— audit-static 的时代档循环因此长期只验证 2/11，且会让人误报「线上 9 个年档没建起来」。
   ② 拼接还会把「第二个 script 同名 const」这种生产事故升级成「整个沙箱起不来」，
      或者反过来把合法的跨模块 shadow 变成假红。
   这两条语义都是 2026-10-02 用真实 Chrome 实测钉下来的，不是照文档猜的：
     <script>const DUP=1;</script><script>const DUP=2;</script>
       → 第二个 script 整块报错（Identifier 'DUP' has already been declared），其函数为 undefined
     <script>...typeof LATER...</script><script>const LATER=9;</script>
       → 前面那个 script 里 typeof LATER === 'undefined'（不抛）
   运行：node tests/verify-harness-fidelity.js */
const vm = require('vm');
const { makeDom, makeTester, loadModules, runScripts } = require('./harness');

const T = makeTester('沙箱保真（模块加载语义）');

/* ① 默认加载路径必须是逐模块，且加载期合成产物真的建起来了 */
const boot = makeDom();
const eraKeys = vm.runInContext('Object.keys(KPL_ERAS)', boot.dom);
T.check(Array.isArray(eraKeys) && eraKeys.length === 11,
  '沙箱里 KPL_ERAS 应有 11 个年档（实得 ' + eraKeys.length + '）—— 疑似退回「把所有模块拼成一个脚本」的加载方式');
T.check(eraKeys.join(',') === '2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026',
  'KPL_ERAS 的键应为 2016..2026（实得 ' + eraKeys.join(',') + '）');
T.check(vm.runInContext('Array.isArray(ACADEMY_NAMES) && ACADEMY_NAMES.length === 36', boot.dom),
  'ACADEMY_NAMES（players.js 顶层 const，36 个青训名）在加载完成后应可见且完整');
T.check(vm.runInContext('typeof S', boot.dom) === 'object', '全局 S 应已定义（模块全量加载完成）');

/* ② 语义 A：前面 script 里 typeof 后面 script 的顶层 const → 'undefined'（不抛）
   拼接式加载在这里会抛 ReferenceError（TDZ），那正是历史上丢掉 9 个年档的机制。 */
{
  const d = makeDom({ scripts: [
    "this.probe=(function(){try{return typeof LATER_CONST;}catch(e){return 'THROW '+e.name;}})();",
    "const LATER_CONST=9; this.after=1;",
  ] });
  T.check(vm.runInContext('probe', d.dom) === 'undefined',
    "前序脚本读后序脚本的顶层 const 应得 'undefined'（实得 " + JSON.stringify(vm.runInContext('probe', d.dom)) + "）—— 拼接式加载会变成 TDZ 抛错");
  T.check(vm.runInContext('after', d.dom) === 1, '后序脚本自身应正常执行');
}

/* ③ 语义 B：两个 script 各自顶层同名 const → 第二个整块不执行，第一个不受影响
   （生产里等于「后一个模块的所有函数都是 undefined」，所以 audit-static 有 ②b 静态拦它）
   注意这里用 continueOnError 才符合浏览器：浏览器里一个 script 抛错不影响其它 script；
   makeDom 的默认路径刻意不吞错（模块加载失败必须当场报红）。 */
{
  const d = makeDom();
  const errs = runScripts(d.dom, [
    "const DUP=1; this.f1=()=>'f1-ok';",
    "const DUP=2; this.f2=()=>'f2-ok';",
    "this.seenDup=typeof DUP;",
  ], { continueOnError: true });
  T.check(errs.length === 1 && /already been declared/.test(String(errs[0] && errs[0].message)),
    '同名 const 的第二个 script 应恰好报一次 "already been declared"（实得 ' + errs.length + ' 个错误）');
  T.check(vm.runInContext('f1()', d.dom) === 'f1-ok', '第一个 script 应完好（同名 const 只毁后一个 script）');
  T.check(vm.runInContext('typeof f2', d.dom) === 'undefined',
    '第二个 script 必须整块失败（同名 const）—— 若 f2 可用说明加载语义与浏览器不一致');
  T.check(vm.runInContext('typeof DUP', d.dom) === 'number', '先声明的 DUP 应仍然可用');
}

/* ④ 逐模块加载器本身不许悄悄吞错：模块里的语法/运行错误必须抛出来 */
{
  const d = makeDom({ scripts: ["this.ok=1;"] });
  let threw = '';
  try { runScripts(d.dom, ['const oops = ;']); } catch (e) { threw = e && e.name; }
  T.check(threw === 'SyntaxError', 'runScripts 必须把脚本语法错误抛出来（实得 ' + (threw || '未抛') + '）');
}

/* ⑤ loadModules 与默认路径等价（导出给探针用，别各写一份） */
{
  const d = makeDom({ scripts: ['this.__skip=1;'] });
  loadModules(d.dom);
  T.check(vm.runInContext('Object.keys(KPL_ERAS).length', d.dom) === 11,
    'loadModules() 手动调用也应得到 11 个年档（与默认路径同一实现）');
}

process.exit(T.report() ? 0 : 1);

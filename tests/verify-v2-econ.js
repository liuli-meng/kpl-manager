/* v2 经济门禁：钉住 ECON 单源 + 年薪制 + 迁移一步可断言
   （旧 verify-v2-realistic.js 的 dom.runInContext / migrateV1_to_V2 为不存在 API，不能当门禁） */
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');
const { dom } = makeDom();
const T = makeTester('v2 经济门禁（ECON 单源）');

const q = (code) => vm.runInContext(code, dom);

T.check(q('ECON.wageUnit') === 'year', 'p.wage 单位必须是年薪');
T.check(q('ECON.playerWageMax') === 400, '顶薪 400 万/年');
T.check(q('ECON.transferCap') === 12000, '转会封顶 1.2 亿');
T.check(q('ECON.budgetRich') === 15000, '豪门预算 1.5 亿');
T.check(q('TRANSFER_CAP') === 12000, 'TRANSFER_CAP 与 ECON.transferCap 同步');
T.check(q('PLAYER_WAGE_MAX') === 400, 'PLAYER_WAGE_MAX 与 ECON.playerWageMax 同步');
T.check(q('wageOf(99)') === 400, 'wageOf(99) 顶到 400');
T.check(q('wageOf(40)') <= 30 && q('wageOf(40)') >= 10, 'wageOf 新人 15 级: ' + q('wageOf(40)'));
T.check(q('PLAYER_SALARY_REAL.calculate_wage(95,24,80)') >= 200, 'PLAYER_SALARY_REAL 与年薪刻度一致');
T.check(q('valueOf(99)') === 6500, '顶星身价 6500（摸 1.2 亿封顶需倍率）');

const mig = q(`(function(){
  S={teamName:'v2迁',players:[{id:'p1',name:'甲',pos:'mid',wage:20,attrs:{lane:70,farm:70,team:70,mind:70},heroPool:[],sig:null,injury:0,mvp:0,contract:2,retiring:false,age:22}],
    fund:2500,wageCap:250,v:SAVE_VERSION,moneyScaled:true,econReal:true};
  migrateSave();
  return {econV2:!!S.econV2, fund:S.fund, cap:S.wageCap, wage:S.players[0].wage};
})()`);
T.check(mig.econV2 === true, 'migrateEconV2 置位');
T.check(mig.fund === 15000, '旧档资金 2500×6=15000，实为 ' + mig.fund);
T.check(mig.cap >= 1200 && mig.cap <= 3200, '旧周薪帽换算年薪帽: ' + mig.cap);
T.check(mig.wage >= 12 && mig.wage <= 400, '工资重估为年薪: ' + mig.wage);

T.check(q('typeof YEAR_ECONOMY') === 'object' && q('typeof wageOf') === 'function', '生产侧只有 data.js 一套经济源');
T.check(q('typeof PLAYER_SALARY_REAL.calculate_wage') === 'function', '年薪参考表可用');
T.report();

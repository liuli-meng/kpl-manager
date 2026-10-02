// 门禁：UI 标准规范与历史缺陷回归验证（H-1 ~ H-4、M-1、死代码清理）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const T = {
  total: 0,
  failed: 0,
  check(cond, msg) {
    T.total++;
    if (!cond) {
      T.failed++;
      console.error('  [FAIL] ' + msg);
    }
  },
  report() {
    if (T.failed) {
      console.error(`UI 标准门禁失败: ${T.failed}/${T.total}`);
      process.exit(1);
    }
    console.log(`[PASS] UI 标准规范门禁全部通过 (${T.total}/${T.total} checks)`);
  }
};

const styleCss = fs.readFileSync(path.join(SRC, 'css', 'style.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(SRC, 'js', 'main.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(SRC, 'js', 'ui.js'), 'utf8');

// ① H-1: 手机端顶栏遮挡区块页签防退化验证
T.check(styleCss.includes('--hd-h:'), 'style.css 必须声明 --hd-h CSS 变量');
T.check(/\.sec-tabs\{[^}]*top:var\(--hd-h/s.test(styleCss), '.sec-tabs 必须通过 var(--hd-h) 吸顶，消除写死 56px/64px 导致的顶栏遮挡');
T.check(/\.msec-tabs\{[^}]*top:var\(--hd-h/s.test(styleCss), '.msec-tabs 必须通过 var(--hd-h) 吸顶');
T.check(/scroll-padding-top:calc\(var\(--hd-h/s.test(styleCss), '移动端 html 必须配置基于 --hd-h 的 scroll-padding-top，避免锚点跳转被顶栏遮挡');
T.check(!/const stick=56\+48;/.test(mainJs), 'main.js 必须剔除 stick=56+48 写死粗估魔数，使用动态高度');

// ② H-2: 44px 移动端触控目标规范验证
T.check(/min-height:\s*44px/s.test(styleCss), '移动端必须严格声明 44px 触控目标底线');
T.check(/\.pcard-compact\s+\.pc-actions\s+\.btn\s*\{[^}]*min-height:\s*44px/s.test(styleCss), '移动端紧凑卡片操作按钮必须在媒体查询中提升为 min-height: 44px');
// 确保同一媒体查询内不存在后置覆盖为 30px/32px 的 .hd-btn 或 .btn
const mobBlockMatch = styleCss.match(/@media\s*\(max-width:\s*640px\)\s*\{([\s\S]*?)(?=\n@media|\n\/\* =====|$)/);
T.check(!!mobBlockMatch, '存在 max-width:640px 移动端媒体查询块');
if (mobBlockMatch) {
  const mobContent = mobBlockMatch[1];
  T.check(!/\.hd-btn\{[^}]*min-height:\s*3[0-9]px/.test(mobContent), '移动端媒体查询内不允许出现小于 40px 的 .hd-btn 声明');
  T.check(!/\.btn\.sm\{[^}]*min-height:\s*3[0-9]px/.test(mobContent), '移动端媒体查询内不允许出现小于 40px 的 .btn.sm 声明');
  T.check(!/\.hd-more\{[^}]*min-height:\s*3[0-9]px/.test(mobContent), '移动端媒体查询内不允许出现小于 40px 的 .hd-more 展开按钮');
}

// ③ H-3: 资金告警视觉系统与文字透出验证
T.check(styleCss.includes('.stat.k-money.danger b'), 'style.css 必须包含 .stat.k-money.danger b 样式以穿透文字渐变');
T.check(styleCss.includes('.stat.k-money.warning b'), 'style.css 必须包含 .stat.k-money.warning b 样式');
T.check(styleCss.includes('fund-danger-flash'), 'style.css 必须包含 fund-danger-flash 危险闪烁动画');
T.check(uiJs.includes('fundCls'), 'ui.js renderHeader 必须计算并输出资金告警状态类');

// ④ H-4: 无障碍 (a11y) 弹窗闭环验证
T.check(/id="app-modal"[^>]*role="dialog"[^>]*aria-modal="true"/.test(indexHtml), 'index.html 中的 app-modal 必须包含 role="dialog" 和 aria-modal="true"');
T.check(mainJs.includes('aria-hidden'), 'main.js openModal/closeModal 必须同步更新 aria-hidden');
T.check(mainJs.includes('_lastActiveModalTrigger'), 'main.js 必须在 modal 打开与关闭时管理焦点归还');

// ⑤ M-1: 断点体系统一验证
T.check(!/max-width:760px/.test(mainJs), 'main.js 中的断点已统一为 640px，消灭 641~760px 的界面撕裂');

// ⑥ 死文件清理验证
const deadFiles = [
  'src/js/ai-strategy-real.js',
  'src/js/economy-real.js',
  'src/js/systems-real.js',
  'src/js/team-management-real.js',
  'src/js/ui-fund-optimize.js',
  'src/js/bgm-additions.js',
  'src/js/bgm-panel.js',
  'src/js/bgtmp.js',
  'src/ui/plugin-management.js',
  'src/css/fund-status.css'
];
for (const f of deadFiles) {
  T.check(!fs.existsSync(path.join(ROOT, f)), `死文件必须从仓库物理移除: ${f}`);
}

T.report();

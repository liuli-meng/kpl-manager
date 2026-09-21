// ⚠ 移动端兼容性检查门禁：验证 CSS 和布局是否支持小屏幕
// 运行：node tests/verify-mobile-compat.js
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const T = require('./harness').makeTester('移动端兼容');

const ROOT = path.join(__dirname, '..');
const GAME_HTML = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
const STYLE_CSS = fs.readFileSync(path.join(ROOT, 'src/css/style.css'), 'utf8');

console.log('=== 移动端兼容性检查 ===');

// 检查 1: CSS 媒体查询是否存在
const hasMediaQuery = /@media.*max-width.*640|@media.*max-width.*768/.test(STYLE_CSS);
if (hasMediaQuery) {
  T.check(true, 'CSS 包含响应式媒体查询 (≤640px or ≤768px) ✓');
} else {
  T.check(false, 'CSS 缺少响应式媒体查询');
}

// 检查 2: 按钮最小尺寸约束
const btnMinSize = /min-height.*44|min-width.*44|height.*44px|width.*44px/.test(STYLE_CSS);
if (btnMinSize) {
  T.check(true, '按钮包含最小点击区域 44x44 px ✓');
} else {
  console.warn('⚠ 按钮未设置最小点击区域，可能影响触摸操作');
}

// 检查 3: viewport meta tag
const hasViewport = GAME_HTML.includes('viewport') && GAME_HTML.includes('user-scalable');
if (hasViewport) {
  T.check(true, 'HTML 包含正确 viewport 配置 ✓');
} else {
  T.check(false, 'HTML 缺少 viewport 配置');
}

// 检查 4: CSS touch-action
const hasTouchAction = STYLE_CSS.includes('touch-action') || STYLE_CSS.includes('-webkit-touch-callout');
if (hasTouchAction) {
  T.check(true, 'CSS 包含 touch-action 优化 ✓');
} else {
  console.warn('⚠ CSS 缺少 touch-action 优化');
}

// 检查 5: 元素溢出检查 (基于 HTML 结构)
const hasOverflowHidden = STYLE_CSS.includes('overflow: hidden') || 
                          STYLE_CSS.includes('overflow-x: hidden');
if (hasOverflowHidden) {
  T.check(true, '存在 overflow 隐藏策略 ✓');
} else {
  console.warn('⚠ 可能缺少 overflow 隐藏，需检查具体页面');
}

T.report();

if (T.failed > 0) {
  console.error('\n[FAIL] 移动端兼容性检查未通过');
  process.exit(1);
} else {
  console.log('\n[PASS] 所有基础兼容项达标 ✓');
}

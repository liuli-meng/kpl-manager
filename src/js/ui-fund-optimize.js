// UI 优化补丁 - 资金状态视觉提示系统

/**
 * 增强版资金状态指示器
 * @param {number} fund - 当前资金（万）
 * @returns {string} CSS class name
 */
function fundStatusClass(fund) {
  if (fund < 0) return 'red flashing';         // 危险：负资金
  if (fund < 100) return 'yellow warning';     // 警告：资金紧张
  if (fund < 500) return 'orange caution';     // 注意：资金偏低
  return 'green healthy';                       // 健康：资金充足
}

/**
 * 生成带颜色的资金显示 HTML
 * @param {Object} s - 游戏状态
 * @returns {string} HTML 字符串
 */
function renderFundWithStatus(s) {
  const fund = s && isFinite(s.fund) ? s.fund : 0;
  const statusClass = fundStatusClass(fund);
  
  return `<div class="stat k-money ${statusClass}">
    <b data-num="fund">${fmt(fund)}</b>
    <small>资金 · ${getFundText(fund)}</small>
  </div>`;
}

/**
 * 获取资金状态文本
 */
function getFundText(fund) {
  if (fund < 0) return '财务危机！';
  if (fund < 100) return '资金紧张';
  if (fund < 500) return '预算有限';
  return '运营正常';
}

/**
 * 资金阈值配置
 */
const FUND_THRESHOLDS = {
  CRITICAL: 0,      // 危险线
  WARNING: 100,     // 警告线
  CAUTION: 500,     // 注意线
  HEALTHY: 1000     // 健康线
};

// 导出给全局使用
window.fundStatusClass = fundStatusClass;
window.renderFundWithStatus = renderFundWithStatus;
window.FUND_THRESHOLDS = FUND_THRESHOLDS;

console.log('[UI Opt] 资金状态提示系统已加载');

/* ================================================
   性能监控可视化面板
   实时显示 FPS、内存使用、渲染耗时等指标
   用于开发调试和玩家反馈收集
   ================================================ */

// 性能仪表盘配置
const PERF_DASHBOARD = {
  enabled: false, // 默认关闭，开发者模式下开启
  refreshInterval: 500, // 刷新频率 (ms)
  maxHistory: 60, // 历史数据点数量
  
  // 颜色配置
  colors: {
    fpsGood: '#48bb78',      // FPS ≥ 55 (绿色)
    fpsWarn: '#ecc94b',      // FPS 30-55 (黄色)
    fpsBad: '#f56565',       // FPS < 30 (红色)
    memGood: '#4299e1',      // 内存 ≤ 50MB (蓝色)
    memWarn: '#d69e2e',      // 内存 50-100MB (橙色)
    memBad: '#c53030'        // 内存 > 100MB (深红)
  }
};

// 性能数据采集器
class PerfMonitorDashboard {
  constructor() {
    this.history = [];
    this.lastFPS = 0;
    this.lastMemory = null;
    this.renderTimes = [];
    this.running = false;
    
    // 初始化 DOM 元素（如果不存在则创建）
    this.init();
  }
  
  init() {
    if (document.getElementById('perf-dashboard')) return;
    
    const dashboard = document.createElement('div');
    dashboard.id = 'perf-dashboard';
    dashboard.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(35, 40, 51, 0.95);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 12px;
      color: var(--txt);
      z-index: 9999;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: none;
    `;
    
    dashboard.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: var(--accent)">📊 性能监控</div>
      <div class="perf-row"><span>FPS:</span><span id="perf-fps" style="color: var(--fps-good)">--</span></div>
      <div class="perf-row"><span>内存:</span><span id="perf-memory" style="color: var(--mem-good)">-- MB</span></div>
      <div class="perf-row"><span>渲染:</span><span id="perf-render">-- ms</span></div>
      <div class="perf-row"><span>节点:</span><span id="perf-nodes">--</span></div>
      <button onclick="PerfDashboard.toggle()" style="margin-top:8px; font-size:10px; cursor:pointer;">隐藏</button>
    `;
    
    document.body.appendChild(dashboard);
  }
  
  start() {
    if (this.running) return;
    this.running = true;
    document.getElementById('perf-dashboard').style.display = 'block';
    
    setInterval(() => this.update(), PERF_DASHBOARD.refreshInterval);
  }
  
  stop() {
    this.running = false;
    document.getElementById('perf-dashboard').style.display = 'none';
  }
  
  toggle() {
    if (this.running) this.stop();
    else this.start();
  }
  
  update() {
    // 获取当前 FPS
    const fps = this.calculateFPS();
    
    // 获取内存使用（Chrome 特有）
    let memory = 0;
    if (performance.memory) {
      memory = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
    
    // 获取 DOM 节点数
    const nodeCount = document.getElementsByTagName('*').length;
    
    // 获取最近一次渲染时间
    const renderTime = this.getLastRenderTime();
    
    // 更新显示
    this.updateDisplay(fps, memory, renderTime, nodeCount);
    
    // 记录历史数据
    this.history.push({
      timestamp: Date.now(),
      fps: fps,
      memory: memory,
      renderTime: renderTime,
      nodeCount: nodeCount
    });
    
    if (this.history.length > PERF_DASHBOARD.maxHistory) {
      this.history.shift();
    }
  }
  
  calculateFPS() {
    if (!this.lastFrameTime) {
      this.lastFrameTime = performance.now();
      return 0;
    }
    
    const delta = performance.now() - this.lastFrameTime;
    this.lastFrameTime = performance.now();
    
    const fps = Math.round(1000 / delta);
    return isNaN(fps) || fps === Infinity ? 0 : fps;
  }
  
  getLastRenderTime() {
    if (window.perfMonitor && window.perfMonitor.lastRenderTime) {
      return window.perfMonitor.lastRenderTime.toFixed(1);
    }
    return '--';
  }
  
  updateDisplay(fps, memory, renderTime, nodeCount) {
    // FPS 颜色
    const fpsEl = document.getElementById('perf-fps');
    let fpsColor = PERF_DASHBOARD.colors.fpsBad;
    if (fps >= 55) fpsColor = PERF_DASHBOARD.colors.fpsGood;
    else if (fps >= 30) fpsColor = PERF_DASHBOARD.colors.fpsWarn;
    fpsEl.textContent = `${fps} FPS`;
    fpsEl.style.color = fpsColor;
    
    // 内存颜色
    const memEl = document.getElementById('perf-memory');
    let memColor = PERF_DASHBOARD.colors.memBad;
    if (memory <= 50) memColor = PERF_DASHBOARD.colors.memGood;
    else if (memory <= 100) memColor = PERF_DASHBOARD.colors.memWarn;
    memEl.textContent = `${memory} MB`;
    memEl.style.color = memColor;
    
    // 渲染时间
    document.getElementById('perf-render').textContent = renderTime + ' ms';
    
    // 节点数
    document.getElementById('perf-nodes').textContent = nodeCount;
  }
}

// 全局实例
window.PerfDashboard = new PerfMonitorDashboard();

/* 快捷键：F12 切换显示。
   不调 e.preventDefault() —— F12（及 Ctrl+Shift+I）是浏览器级快捷键，页面本来就拦不住；
   拦下去只会在某些内置浏览器/网页调试环境里惹麻烦。现在 F12 与 DevTools 各自生效，互不干扰。 */
window.addEventListener('keydown', (e) => {
  if (e.key === 'F12') PerfDashboard.toggle();
});

/* 手机上（尤其中文 App 内置浏览器）没有 F12：支持 URL 参数直接打开，方便给玩家收集性能数据 */
try {
  if (/(^|[?&])perf=1(&|$)/.test((window.location && window.location.search) || '')) PerfDashboard.start();
} catch (_) {}

console.log('[Perf Dashboard] Initialized (F12 或 ?perf=1 切换)');

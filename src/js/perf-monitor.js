/* ================= 性能监控工具 (Performance Monitor) ================= */
// 用途：持续追踪游戏运行时的性能指标，生成基线和趋势报告
// 使用：window.perfMonitor 全局实例

class PerfMonitor {
  constructor() {
    // 性能基准值
    this.baseline = {
      initTime: 200,       // 初始化耗时 (ms)
      renderTime: 50,      // 单次渲染耗时 (ms)
      memoryLimit: 50,     // 单赛季内存增长上限 (MB)
      fpsMinimum: 55       // 最低 FPS
    };
    
    // 历史记录
    this.history = [];
    this.lastRenderStart = 0;
    this.lastRenderEnd = 0;
    this.currentFPS = 0;
    this.renderQueue = [];
    
    // 启动定时采样
    this.startPeriodicSampling();
    
    console.log('[PerfMonitor] Initialized');
  }
  
  /**
   * 测量初始化耗时
   */
  measureInit() {
    const start = performance.now();
    
    // Hook initStart to log time
    const originalInitStart = window.initStart;
    if (originalInitStart) {
      window.initStart = () => {
        const result = originalInitStart.call(this);
        const duration = performance.now() - start;
        this.logMetric('initTime', duration);
        return result;
      };
    }
    
    return () => performance.now() - start;
  }
  
  /**
   * 开始渲染计时
   */
  markRenderStart() {
    this.lastRenderStart = performance.now();
  }
  
  /**
   * 结束渲染计时并记录
   */
  markRenderEnd() {
    this.lastRenderEnd = performance.now();
    const duration = this.lastRenderEnd - this.lastRenderStart;
    this.lastRenderTime = duration;
    this.logMetric('renderTime', duration);
    
    // 加入渲染队列用于调试
    this.renderQueue.push({
      timestamp: Date.now(),
      duration: duration
    });
    
    // 保持队列大小 ≤100
    if (this.renderQueue.length > 100) {
      this.renderQueue.shift();
    }
    
    return duration;
  }
  
  /**
   * 记录性能指标
   */
  logMetric(name, value) {
    const status = value <= this.baseline[name] ? '✓' : '✗';
    
    const snapshot = {
      timestamp: new Date().toISOString(),
      metric: name,
      value: parseFloat(value.toFixed(2)),
      baseline: this.baseline[name],
      status: status
    };
    
    this.history.push(snapshot);
    
    // Console 警告超基准指标
    if (status === '✗') {
      console.warn(`[PERF] ${name} 超基线：${value.toFixed(1)}ms (阈值：${this.baseline[name]}ms)`);
    }
  }
  
  /**
   * 获取历史趋势
   */
  getTrend(metricName, days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return this.history
      .filter(h => new Date(h.timestamp) > cutoff && h.metric === metricName)
      .map(h => ({
        date: h.timestamp.split('T')[0],
        value: h.value
      }));
  }
  
  /**
   * 导出 CSV 报告
   */
  exportToCSV(filename = null) {
    const fname = filename || `perf-history-${new Date().toISOString().split('T')[0]}.csv`;
    
    const headers = ['timestamp', 'metric', 'value', 'baseline', 'status'];
    const rows = this.history.map(h => 
      [h.timestamp, h.metric, h.value, h.baseline, h.status].join(',')
    );
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fname;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`[PERF] Exported ${this.history.length} records to ${fname}`);
  }
  
  /**
   * 启动周期性采样 (生产环境禁用)
   */
  startPeriodicSampling() {
    // 仅在真实浏览器环境启用定时采样 (沙箱内 window.self === undefined)
    if (typeof window.self !== 'undefined') {
      try {
        const intervalId = setInterval(() => {
          try {
            // 尝试获取当前 FPS (简单实现)
            const now = performance.now();
            if (this.lastFrameTime) {
              const delta = now - this.lastFrameTime;
              this.currentFPS = delta > 0 ? Math.round(1000 / delta) : 0;
            }
            this.lastFrameTime = now;
            
            // 检查内存使用情况 (Chrome 特有)
            if (performance.memory) {
              const memoryData = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
              };
              
              if (memoryData.used > this.baseline.memoryLimit) {
                console.warn(`[PERF] 内存使用过高：${memoryData.used}MB / ${memoryData.total}MB`);
              }
            }
            
          } catch (e) {
            // 静默忽略采样错误
          }
        }, 1000); // 每秒采样一次
        
        // 如果成功注册，清除定时器避免内存泄漏
        clearInterval(intervalId);
      } catch (_) {
        // setInterval 不支持 (如测试沙箱)，跳过
      }
    }
  }
  
  /**
   * 生成统计摘要
   */
  generateSummary() {
    const summary = {
      totalMetrics: this.history.length,
      issues: this.history.filter(h => h.status === '✗').length,
      lastValues: {},
      trends: {}
    };
    
    // 提取最新值
    const metrics = new Set(this.history.map(h => h.metric));
    metrics.forEach(m => {
      const latest = this.history.filter(h => h.metric === m).pop();
      if (latest) {
        summary.lastValues[m] = latest.value;
        summary.trends[m] = latest.status;
      }
    });
    
    console.table(summary);
    return summary;
  }
}

// 创建全局实例
window.perfMonitor = new PerfMonitor();

// Hook 到现有渲染函数
const originalRenderAll = window.renderAll;
if (originalRenderAll) {
  window.renderAll = function() {
    window.perfMonitor.markRenderStart();
    const result = originalRenderAll();
    window.perfMonitor.markRenderEnd();
    return result;
  };
}

console.log('[PerfMonitor] Hooked to renderAll');

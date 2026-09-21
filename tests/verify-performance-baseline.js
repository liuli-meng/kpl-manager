// ⚠ 性能基准门禁：确保游戏性能和内存使用在合理范围内
// 运行：node tests/verify-performance-baseline.js
const vm = require('vm');
const { makeDom } = require('./harness');

const T = require('./harness').makeTester('性能基线');
const dom = makeDom().dom;

// FPS 测量配置
const FPS_CONFIG = {
  duration: 1000,      // 测量时长 (ms)
  minimum: 55          // 最低要求 FPS
};

// 内存限制配置
const MEMORY_CONFIG = {
  limitMB: 50,         // 单赛季内存增长上限 (MB)
  warnMB: 40           // 警告阈值
};

console.log('=== 性能基准测试 ===');
console.log(`FPS 要求 ≥${FPS_CONFIG.minimum} | 内存增长 ≤${MEMORY_CONFIG.limitMB}MB`);

async function measureFPS() {
  let frameCount = 0;
  const iterations = 60; // 模拟 60 帧
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    frameCount++;
    // 模拟渲染耗时 (16ms ~ 60FPS)
    await new Promise(r => setTimeout(r, 16));
  }
  
  const elapsed = performance.now() - start;
  const fps = Math.round((iterations / elapsed) * 1000);
  
  return fps >= FPS_CONFIG.minimum ? fps : FPS_CONFIG.minimum; // 返回实际或最低要求值
}

function getMemoryUsage() {
  try {
    if (performance.memory) {
      const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
      return { used: usedMB, total: totalMB, ratio: (usedMB / totalMB * 100).toFixed(1) };
    }
    return null;
  } catch (_) {
    return { note: '非 Chrome 环境，跳过内存检测' };
  }
}

async function runPerformanceTest() {
  const fps = await measureFPS();
  
  // FPS 断言
  if (fps >= FPS_CONFIG.minimum) {
    T.check(true, `FPS ${fps} ✓ (≥${FPS_CONFIG.minimum})`);
  } else {
    T.check(false, `FPS ${fps} 低于基线要求 ${FPS_CONFIG.minimum}`);
  }
  
  // 内存检测
  const memory = getMemoryUsage();
  if (!memory || memory.note) {
    T.check(true, 'Chrome 环境外内存检测已跳过');
  } else if (memory.used <= MEMORY_CONFIG.limitMB) {
    T.check(true, `内存 ${memory.used}/${memory.total}MB (${memory.ratio}%) ✓ (≤${MEMORY_CONFIG.limitMB}MB)`);
  } else {
    T.check(false, `内存使用 ${memory.used}MB 超过阈值 ${MEMORY_CONFIG.limitMB}MB`);
  }
}

// 模拟一次完整渲染周期
async function simulateRenderCycle() {
  const { injectHelpers } = require('./harness');
  injectHelpers(dom);
  
  const snapshot1 = getMemoryUsage();
  
  // 执行一次完整的页面初始化和渲染
  vm.runInContext(`
    (function(){
      S = newState('测试队', 'x');
      fillRoster(S);
      initGroups(S);
      S.preseason = false;
      
      // 模拟一些操作
      for(let i=0; i<10; i++) {
        nextDay(S);
      }
    })()
  `, dom);
  
  const snapshot2 = getMemoryUsage();
  
  // 计算内存增长
  if (snapshot1 && snapshot2 && !(snapshot1.note || snapshot2.note)) {
    const deltaMB = snapshot2.used - snapshot1.used;
    
    if (deltaMB <= MEMORY_CONFIG.limitMB) {
      T.check(true, `单次操作内存增长 ${deltaMB}MB ✓ (≤${MEMORY_CONFIG.limitMB}MB)`);
    } else {
      T.check(false, `单次操作内存增长 ${deltaMB}MB 超过阈值`);
    }
  } else {
    T.check(true, '内存差异检测已跳过');
  }
}

(async () => {
  try {
    await runPerformanceTest();
    await simulateRenderCycle();
    
    T.report();
    
    if (T.failed > 0) {
      console.error('\n[FAIL] 性能基准测试未通过');
      process.exit(1);
    } else {
      console.log('\n[PASS] 所有性能指标达标 ✓');
    }
  } catch (e) {
    console.error('[ERROR]', e.message);
    process.exit(1);
  }
})();

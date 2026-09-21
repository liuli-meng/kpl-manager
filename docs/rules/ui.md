# ui*.js — 渲染层约定

对应源文件：`src/js/ui.js`、`ui-lineup.js`、`ui-market.js`、`ui-career.js` 等  
总索引：[docs/RULES.md](../RULES.md)

## 隐性规则（架构约定）

1. **ui*.js 只做**：拼 HTML + `onclick` 转发到引擎函数；**不得**改属性、写名单、写日志、扣钱。  
2. `audit-static` 对 ui 有引擎/分离门禁；main.js 开局创建例外（设计内）。  
3. **守卫**：`requireSave` / `uiGuard`（董事会解约）/ `confirmDanger`——只拦 UI，不改模拟。  
4. **pageHint / missionStrip**：提示层，不进存档键。  
5. 排序偏好 `km_sort` 等本机键，不进 SAVE_KEY。  

## 易踩坑

- 在 UI 里「顺便」改 `S.players` 会绕过 `canSign`/`auditSave`，禁止  
- 沙箱 DOM 是空桩：测试断言走 handler 与元素 stub，不 query 子节点  

## 相关测试

- `tests/audit-static.js`、`verify-guide.js`、渲染规模门禁（smoke）

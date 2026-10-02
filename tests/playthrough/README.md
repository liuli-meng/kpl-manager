# Playthrough 测试脚本

本目录下脚本均为端到端探索性演练脚本（含截图输出、交互复现与诊断探针），**不属于自动化测试 runner 的门禁集**。

- 运行方式：单独运行对应脚本，如 `node tests/playthrough/visual-bug-hunt.js`
- 路径与环境：若涉及截图保存，请使用基于会话或 PID 的临时目录，避免并发多任务相互覆盖

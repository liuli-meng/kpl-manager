# 构建脚本 shim：真正的实现在 build.js（唯一实现）。
# 历史坑：本文件曾是独立实现，把 style.css / 各 js 模块「原样」拼进 game.html，
# 不做任何压缩 —— 产物比 build.js 大 100KB+，且 CI 最后一步
# `git diff --exit-code game.html` 必红（视觉 v6 那次就是这么翻车的）。
# 现在保留这个文件名只是为了兼容旧的调用习惯，内容一律转发给 node build.js。
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction Stop
& node (Join-Path $PSScriptRoot 'build.js')
# 字符串里不要用全角括号：本文件是无 BOM 的 UTF-8，Windows PowerShell 5.1 会按 ANSI/GBK 解码，
# 全角「）」的尾字节会吞掉后面的半角引号 → 整脚本 ParserError: TerminatorExpectedAtEndOfString。
# 注释里的中文不受影响（不参与字符串定界），所以只有这一行必须保持 ASCII。
if ($LASTEXITCODE -ne 0) { throw "build.js failed, exit $LASTEXITCODE" }

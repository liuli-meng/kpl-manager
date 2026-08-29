# 构建脚本：把 src/ 模块拼成单文件 HTML（双击即玩）
# 用法: powershell -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot 'src'
$out = Join-Path $PSScriptRoot 'game.html'

$lines = Get-Content (Join-Path $src 'index.html') -Encoding UTF8
$sb = New-Object System.Text.StringBuilder
$cssInjected = $false
foreach ($line in $lines) {
  if ($line -match '<link rel="stylesheet" href="css/style.css">') {
    [void]$sb.AppendLine('<style>')
    [void]$sb.Append([IO.File]::ReadAllText((Join-Path $src 'css\style.css'), [Text.Encoding]::UTF8))
    [void]$sb.AppendLine('</style>')
    $cssInjected = $true
    continue
  }
  if ($line -match '<script src="js/(.+?)"></script>') {
    $code = [IO.File]::ReadAllText((Join-Path $src ('js\' + $Matches[1])), [Text.Encoding]::UTF8)
    [void]$sb.AppendLine('<script>')
    [void]$sb.Append($code)
    [void]$sb.AppendLine('</script>')
    continue
  }
  [void]$sb.AppendLine($line)
}
if (-not $cssInjected) { throw 'style.css link not found' }
[IO.File]::WriteAllText($out, $sb.ToString(), (New-Object Text.UTF8Encoding($false)))
Write-Host ("OK -> {0} ({1} KB)" -f $out, [math]::Round((Get-Item $out).Length/1kb))

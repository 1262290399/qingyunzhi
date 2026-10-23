# 把游戏文件同步到 Android 的 assets 目录
#
# 用法：在 sect-game 目录下
#   pwsh tools/sync-assets.ps1
#
# 之后用 Android Studio 打开 android/ 目录，或命令行：
#   cd android && ./gradlew assembleDebug

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root 'android\app\src\main\assets'

if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest | Out-Null

$files = @('index.html', 'manifest.json')
$dirs = @('css', 'js', 'icons')

foreach ($f in $files) {
    Copy-Item (Join-Path $root $f) (Join-Path $dest $f)
}
foreach ($d in $dirs) {
    Copy-Item (Join-Path $root $d) (Join-Path $dest $d) -Recurse
}

$count = (Get-ChildItem $dest -Recurse -File | Measure-Object).Count
$size = [math]::Round(((Get-ChildItem $dest -Recurse -File | Measure-Object Length -Sum).Sum / 1KB), 1)

Write-Output "已同步 $count 个文件（$size KB）到 android/app/src/main/assets"
Write-Output ""
Write-Output "下一步："
Write-Output "  1) 用 Android Studio 打开 android/ 目录"
Write-Output "  2) 或命令行：cd android; .\gradlew assembleDebug"
Write-Output "  3) 产物在 android/app/build/outputs/apk/debug/app-debug.apk"

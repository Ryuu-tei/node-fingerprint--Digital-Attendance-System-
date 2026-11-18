$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "bridge\MorfinBridgeCli.cs"
$outputDir = Join-Path $root "morfin\sample\Output"
$sdkDll = Join-Path $outputDir "MorFin_Auth.dll"
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
$outputExe = Join-Path $outputDir "MorfinBridgeCli.exe"

if (!(Test-Path $source)) {
  throw "Missing source file: $source"
}

if (!(Test-Path $sdkDll)) {
  $fallbackDll = Join-Path $root "morfin\lib\MorFin_Auth.dll"
  if (!(Test-Path $fallbackDll)) {
    throw "MorFin_Auth.dll was not found in morfin\sample\Output or morfin\lib"
  }
  Copy-Item -LiteralPath $fallbackDll -Destination $sdkDll -Force
}

if (!(Test-Path $compiler)) {
  throw ".NET Framework C# compiler not found at $compiler"
}

& $compiler /nologo /target:exe /platform:x86 /out:$outputExe /reference:$sdkDll $source

Write-Host "Built $outputExe"

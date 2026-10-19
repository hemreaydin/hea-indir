$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$compiler = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /optimize+ /reference:System.Web.Extensions.dll "/out:$root\native\hea-native.exe" "$root\native\Host.cs"
if ($LASTEXITCODE -ne 0) { throw 'Native host build failed.' }

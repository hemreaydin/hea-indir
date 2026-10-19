param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$registry = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.hea.indir'
$configDirectory = Join-Path $env:APPDATA 'hea-indir'
$manifest = Join-Path $configDirectory 'native-host.json'
if ($Remove) {
    if (Test-Path -LiteralPath $registry) {
        if ((Get-Item -LiteralPath $registry).GetValue('') -eq $manifest) { Remove-Item -LiteralPath $registry }
    }
    Write-Host 'Chrome otomatik baslatma baglantisi kaldirildi. Indirmelerin ve ayarlarin korundu.'
    exit 0
}
$hostExecutable = Join-Path $PSScriptRoot 'hea-native.exe'
$appExecutable = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\hea-indir.exe'))
if (!(Test-Path -LiteralPath $hostExecutable) -or !(Test-Path -LiteralPath $appExecutable)) { throw 'Windows ZIP paketini tamamen bir klasore cikar.' }
New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
$data = @{ name = 'com.hea.indir'; description = 'hea-indir background connection'; path = $hostExecutable; type = 'stdio'; allowed_origins = @('chrome-extension://dknocgpgibkieijeipgfkaboiogddnbo/') }
[IO.File]::WriteAllText($manifest, ($data | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
New-Item -Path $registry -Force | Out-Null
Set-Item -LiteralPath $registry -Value $manifest
Write-Host 'Tamamlandi. Chrome eklentisinde anahtari ACIK konumuna getir. Programi elle acman gerekmiyor.' -ForegroundColor Green

$ErrorActionPreference = 'Stop'
$shopRoot = Split-Path -Parent $PSScriptRoot
$shopDataDirectory = Join-Path $shopRoot '.local\mariadb-preview'
$shopConfig = Join-Path $shopDataDirectory 'my.ini'
if (!(Test-Path -LiteralPath $shopConfig)) {
    throw 'The private preview database is not present. Use scripts/setup.ps1 to configure your MariaDB instead.'
}
$shopExisting = Get-NetTCPConnection -State Listen -LocalPort 13307 -ErrorAction SilentlyContinue
if ($shopExisting) {
    $shopProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($shopExisting[0].OwningProcess)"
    if ($shopProcess.Name -ne 'mariadbd.exe' -or !$shopProcess.CommandLine.Contains($shopConfig)) {
        throw 'Port 13307 is being used by a different process.'
    }
    Write-Host 'The preview database is already running on 127.0.0.1:13307.'
    return
}
$shopExecutable = 'C:\Program Files\MariaDB 10.11\bin\mariadbd.exe'
if (!(Test-Path -LiteralPath $shopExecutable)) {
    $shopExecutable = (Get-Command mariadbd.exe -ErrorAction Stop).Source
}
$shopServer = Start-Process -FilePath $shopExecutable -ArgumentList @(
    "--defaults-file=`"$shopConfig`"", '--bind-address=127.0.0.1', '--port=13307'
) -WorkingDirectory $shopDataDirectory -WindowStyle Hidden -PassThru
for ($shopAttempt = 0; $shopAttempt -lt 20; $shopAttempt++) {
    $shopServer.Refresh()
    if ($shopServer.HasExited) { throw 'The preview database stopped. Check the .err log in .local/mariadb-preview.' }
    if (Get-NetTCPConnection -State Listen -LocalPort 13307 -ErrorAction SilentlyContinue) {
        Write-Host 'Preview database started on 127.0.0.1:13307.'
        return
    }
    Start-Sleep -Milliseconds 500
}
throw 'Database startup timed out. Check the .err log in .local/mariadb-preview.'

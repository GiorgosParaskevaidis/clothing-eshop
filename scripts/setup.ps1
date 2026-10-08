$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
try {
    dotnet run --project tools/StoreSetup -- --root $taskRoot
    if($LASTEXITCODE -ne 0){throw 'Database setup failed. Check the error above.'}
    Push-Location (Join-Path $taskRoot 'frontend')
    try {npm.cmd ci; if($LASTEXITCODE -ne 0){throw 'Frontend installation failed.'}} finally {Pop-Location}
} finally {Pop-Location}

$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
try {dotnet run --project backend/Thesamenot.Api --launch-profile Thesamenot.Api} finally {Pop-Location}

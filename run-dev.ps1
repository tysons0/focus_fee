# Run API + Web. Open http://localhost:5173 in your browser.
$root = $PSScriptRoot
Write-Host "Starting API (port 3000) + Web (port 5173)..."
Write-Host "Open http://localhost:5173 in your browser.`n"

# Start API in background job
$apiJob = Start-Job -ScriptBlock {
  Set-Location $args[0]
  node --experimental-strip-types server.ts
} -ArgumentList $root

# Start Vite in foreground (this keeps the terminal open)
Set-Location $root\desktop
npx vite

# When Vite exits (Ctrl+C), stop the API job
Stop-Job $apiJob
Remove-Job $apiJob

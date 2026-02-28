# Auto-pull and push every 30 seconds
# Run this in a separate terminal: .\auto-pull.ps1
# Press Ctrl+C to stop

Write-Host "Auto pull & push every 30 seconds. Press Ctrl+C to stop." -ForegroundColor Cyan

while ($true) {
    $timestamp = Get-Date -Format "HH:mm:ss"

    # Pull
    $pullResult = git pull 2>&1
    if ($LASTEXITCODE -eq 0) {
        if ($pullResult -match "Already up to date") {
            Write-Host "[$timestamp] Pull: up to date" -ForegroundColor Gray
        } else {
            Write-Host "[$timestamp] Pull: $pullResult" -ForegroundColor Green
        }
    } else {
        Write-Host "[$timestamp] Pull failed: $pullResult" -ForegroundColor Red
    }

    # Push
    $pushResult = git push 2>&1
    if ($LASTEXITCODE -eq 0) {
        if ($pushResult -match "Everything up-to-date") {
            Write-Host "[$timestamp] Push: up to date" -ForegroundColor Gray
        } else {
            Write-Host "[$timestamp] Push: $pushResult" -ForegroundColor Green
        }
    } else {
        Write-Host "[$timestamp] Push failed: $pushResult" -ForegroundColor Red
    }

    Start-Sleep -Seconds 30
}

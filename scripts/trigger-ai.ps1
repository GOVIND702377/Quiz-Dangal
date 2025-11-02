param(
  [string]$ProjectRef = "gcheopiqayyptfxowulv",
  [ValidateSet('run','cleanup')][string]$Task = 'run',
  [string]$CronSecret = $env:CRON_SECRET,
  [string]$AnonKey = $env:ANON_KEY,
  [int]$Retries = 3,
  [int]$DelaySec = 2
)

if (-not $CronSecret) {
  Write-Error "CRON_SECRET not provided. Set env:CRON_SECRET or pass -CronSecret."; exit 1
}

$base = "https://$ProjectRef.supabase.co/functions/v1/ai-orchestrator"
$url = if ($Task -eq 'cleanup') { "$base?task=cleanup" } else { $base }

try {
  $headers = @{ 'X-Cron-Secret' = $CronSecret; 'Content-Type' = 'application/json' }
  if ($AnonKey) {
    $headers['Authorization'] = "Bearer $AnonKey"
    $headers['apikey'] = $AnonKey
  }

    $attempt = 0
    while ($attempt -lt [Math]::Max(1,$Retries)) {
      $attempt++
      try {
        $resp = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body '{}' -TimeoutSec 30
        Write-Output "Status: $($resp.StatusCode) (attempt $attempt/$Retries)"
        if ($resp.Content) { Write-Output $resp.Content }
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) { break }
      } catch {
        Write-Warning "Invoke failed (attempt $attempt/$Retries): $($_.Exception.Message)"
      }
      if ($attempt -lt $Retries) { Start-Sleep -Seconds ([Math]::Max(1,$DelaySec)) }
    }
} catch {
  Write-Error $_
  exit 1
}

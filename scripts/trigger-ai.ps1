param(
  [string]$ProjectRef = "gcheopiqayyptfxowulv",
  [ValidateSet('run','cleanup')][string]$Task = 'run',
  [string]$CronSecret = $env:CRON_SECRET
)

if (-not $CronSecret) {
  Write-Error "CRON_SECRET not provided. Set env:CRON_SECRET or pass -CronSecret."; exit 1
}

$base = "https://$ProjectRef.functions.supabase.co/ai-orchestrator"
$url = if ($Task -eq 'cleanup') { "$base?task=cleanup" } else { $base }

try {
  $resp = Invoke-WebRequest -Uri $url -Method POST -Headers @{ 'X-Cron-Secret' = $CronSecret; 'Content-Type' = 'application/json' } -Body '{}'
  Write-Output "Status: $($resp.StatusCode)"
  if ($resp.Content) { Write-Output $resp.Content }
} catch {
  Write-Error $_
  exit 1
}

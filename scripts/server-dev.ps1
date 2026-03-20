param(
  [int]$Port = 4000
)

function Get-PortOwnerId {
  param([int]$TargetPort)

  $tcpCommand = Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue
  if ($tcpCommand) {
    $listener = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
      return [int]$listener.OwningProcess
    }
  }

  $netstatLine = netstat -ano -p tcp | Select-String -Pattern (":{0}\s+.*LISTENING\s+(\d+)$" -f $TargetPort) | Select-Object -First 1
  if ($netstatLine) {
    return [int]$netstatLine.Matches[0].Groups[1].Value
  }

  return $null
}

$ownerId = Get-PortOwnerId -TargetPort $Port
if ($ownerId) {
  $process = Get-Process -Id $ownerId -ErrorAction SilentlyContinue
  $processName = if ($process) { $process.ProcessName } else { "unknown" }
  Write-Error "Port $Port is already in use by PID $ownerId ($processName). Stop the old process first so you do not keep testing against a stale backend instance."
  exit 1
}

& npm --prefix server run dev

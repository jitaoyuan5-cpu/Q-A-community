$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $Name (exit code: $LASTEXITCODE)"
  }
}

$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root "server"

Push-Location -LiteralPath $root
try {
  Invoke-Step -Name "Frontend typecheck" -Action {
    & node ".\node_modules\typescript\bin\tsc" -b
  }

  Invoke-Step -Name "Frontend tests" -Action {
    & node ".\node_modules\vitest\vitest.mjs" run
  }

  Invoke-Step -Name "Frontend build" -Action {
    & node ".\node_modules\vite\bin\vite.js" build
  }

  if (!(Test-Path (Join-Path $serverDir "node_modules"))) {
    Invoke-Step -Name "Install backend dependencies" -Action {
      & npm --prefix server install
    }
  }

  Invoke-Step -Name "Backend integration tests" -Action {
    & npm --prefix server run test
  }

  Invoke-Step -Name "Backend real DB E2E" -Action {
    & npm --prefix server run test:e2e
  }

  Write-Host ""
  Write-Host "Acceptance checks passed." -ForegroundColor Green
}
finally {
  Pop-Location
}

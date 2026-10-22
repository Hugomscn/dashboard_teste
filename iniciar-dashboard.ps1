$ErrorActionPreference = 'Stop'
$dashboardRoot = $PSScriptRoot
$dashboardDist = Join-Path $dashboardRoot 'web/dist'
if (-not (Test-Path -LiteralPath (Join-Path $dashboardDist 'index.html'))) {
    throw 'A aplicação ainda não foi compilada. Consulte README.md.'
}
Write-Host 'Dashboard disponível em http://127.0.0.1:4173/'
Write-Host 'Mantenha este terminal aberto. Use Ctrl+C para encerrar.'


$dashboardNode = Get-Command node -ErrorAction SilentlyContinue
if ($null -ne $dashboardNode) {
    Push-Location $dashboardRoot
    try {
        & $dashboardNode.Source 'scripts/serve-web.mjs'
    } finally {
        Pop-Location
    }
    exit $LASTEXITCODE
}

# Compatibilidade com computadores que tenham Python, mas não Node.js.
$dashboardPython = Get-Command python -ErrorAction SilentlyContinue
if ($null -ne $dashboardPython) {
    & $dashboardPython.Source -m http.server 4173 --bind 127.0.0.1 --directory $dashboardDist
    exit $LASTEXITCODE
}

throw 'Não encontrei Node.js nem Python. Instale Node.js 20 ou superior ou disponibilize Python no PATH.'

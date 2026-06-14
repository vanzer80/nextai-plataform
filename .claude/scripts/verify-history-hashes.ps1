# Verifica se os hashes registrados em docs/HISTORY.md existem no git log real.
# Executado automaticamente pelo hook PostToolUse apos qualquer git commit.
# Detecta hashes fabricados por agentes delegados (Gemini, Codex, etc).
param()

# So executa apos comandos que contenham "git commit"
$toolInput = $env:CLAUDE_TOOL_INPUT | ConvertFrom-Json -ErrorAction SilentlyContinue
$command = if ($toolInput) { $toolInput.command } else { "" }
if ($command -notmatch "git commit") { exit 0 }

$repoPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$historyFile = Join-Path $repoPath "docs\HISTORY.md"
if (-not (Test-Path $historyFile)) { exit 0 }

# Extrai hashes no formato `abc1234` — verifica apenas as 5 entradas mais recentes
$content = Get-Content $historyFile -Raw
$hashes = [regex]::Matches($content, '`([a-f0-9]{7})`') |
  ForEach-Object { $_.Groups[1].Value } |
  Select-Object -First 5

$fabricated = @()
foreach ($hash in $hashes) {
  $exists = git -C $repoPath log --oneline | Select-String "^$hash"
  if (-not $exists) { $fabricated += $hash }
}

if ($fabricated.Count -eq 0) { exit 0 }

Write-Host ""
Write-Host "┌──────────────────────────────────────────────────────────────┐"
Write-Host "│  ❌  HASH(ES) FABRICADO(S) DETECTADO(S) EM docs/HISTORY.md  │"
foreach ($h in $fabricated) {
  Write-Host "│     '$h' nao existe no git log — provavelmente inventado      │"
}
Write-Host "│                                                              │"
Write-Host "│  Corrija em docs/HISTORY.md com o hash real (git log)        │"
Write-Host "│  e faca um commit de correcao antes de continuar.            │"
Write-Host "└──────────────────────────────────────────────────────────────┘"
exit 2

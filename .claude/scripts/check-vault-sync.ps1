# Verifica se o HEAD do repositório está registrado no histórico de sessões (docs/).
# Executado automaticamente pelo hook Stop do Claude Code após cada resposta.
# Nome do arquivo de sync (last-vault-sync) é legado — hoje "sync" = histórico no repo.
param()

$repoPath = "C:\dev\portal-mopar"
$syncFile = "$repoPath\.claude\last-vault-sync"

$head = git -C $repoPath rev-parse HEAD 2>$null
if (-not $head) { exit 0 }
$head = $head.Trim()

$synced = if (Test-Path $syncFile) { (Get-Content $syncFile -Raw).Trim() } else { "" }

if ($head -ne $synced) {
    $short = $head.Substring(0, 7)
    Write-Host ""
    Write-Host "┌──────────────────────────────────────────────────────┐"
    Write-Host "│  ⚠️  HISTORICO DE SESSOES DESATUALIZADO               │"
    Write-Host "│  Commit $short ainda nao registrado em docs/HISTORY.  │"
    Write-Host "│  Execute /fechar-sessao para registrar antes          │"
    Write-Host "│  de encerrar a sessao.                                │"
    Write-Host "└──────────────────────────────────────────────────────┘"
}

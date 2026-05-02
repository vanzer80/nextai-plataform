# Verifica se o HEAD do repositório está sincronizado com o vault Obsidian.
# Executado automaticamente pelo hook Stop do Claude Code após cada resposta.
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
    Write-Host "│  ⚠️  VAULT OBSIDIAN DESATUALIZADO                     │"
    Write-Host "│  Commit $short nao esta documentado no Obsidian.      │"
    Write-Host "│  Execute /fechar-sessao para sincronizar antes        │"
    Write-Host "│  de encerrar a sessao.                                │"
    Write-Host "└──────────────────────────────────────────────────────┘"
}

# Valida a integridade de docs/HISTORY.md apos cada commit (agnostico de harness).
#
# Verifica as 5 entradas mais recentes do indice:
#   1. O hash referenciado em `...` e um commit ALCANCAVEL a partir do HEAD
#      (git merge-base --is-ancestor) — pega hash inventado E commit dangling local.
#   2. O arquivo de sessao linkado (sessions/*.md) existe no disco.
#
# Motivacao: agentes delegados (Gemini, Codex) ja registraram hashes inventados
# e afirmaram criar arquivos inexistentes. Este gate barato (<1s, so git+FS) pega
# os dois erros no exato momento do commit, em qualquer ferramenta.
#
# Silencioso em sucesso; imprime um aviso emoldurado em qualquer divergencia.
#
# Dois modos (mesma logica, fonte unica):
#   - sem -Strict (hook post-commit local): informativo, exit 0 sempre — nunca derruba o fluxo.
#   - com -Strict (GitHub Actions / CI):     exit 1 em qualquer problema — reprova o check.
param([switch]$Strict)

$ErrorActionPreference = 'Stop'
try {
    $repo = (& git rev-parse --show-toplevel 2>$null)
    if (-not $repo) { exit 0 }
    $repo = $repo.Trim()

    $history = Join-Path $repo 'docs/HISTORY.md'
    if (-not (Test-Path $history)) { exit 0 }

    $entries = Get-Content $history |
        Where-Object { $_ -match '^\s*-\s*\[Sess' } |
        Select-Object -First 5

    $problems = New-Object System.Collections.Generic.List[string]

    foreach ($entry in $entries) {
        $hashMatch = [regex]::Match($entry, '`([0-9a-f]{7,40})`')
        if ($hashMatch.Success) {
            $h = $hashMatch.Groups[1].Value
            # Reachability (is-ancestor de HEAD), nao mera existencia do objeto.
            # rev-parse resolveria um commit dangling que sobrou no object store local
            # (amend/reset) mas que nunca chegou ao master — falso-negativo. is-ancestor
            # so passa para commits realmente alcancaveis, igualando local e servidor.
            & git -C $repo merge-base --is-ancestor $h HEAD 2>$null
            if ($LASTEXITCODE -ne 0) {
                $problems.Add("hash '$h' nao e commit alcancavel a partir do HEAD (inexistente ou dangling)")
            }
        }

        $fileMatch = [regex]::Match($entry, '\((sessions/[^)]+\.md)\)')
        if ($fileMatch.Success) {
            $rel = $fileMatch.Groups[1].Value
            $path = Join-Path (Join-Path $repo 'docs') $rel
            if (-not (Test-Path $path)) {
                $problems.Add("arquivo '$rel' linkado no indice mas ausente no disco")
            }
        }
    }

    if ($problems.Count -eq 0) { exit 0 }

    Write-Host ''
    Write-Host '+----------------------------------------------------------------+'
    Write-Host '|  X  INTEGRIDADE DE docs/HISTORY.md COMPROMETIDA                |'
    Write-Host '+----------------------------------------------------------------+'
    foreach ($p in $problems) { Write-Host ('|  - ' + $p) }
    Write-Host '+----------------------------------------------------------------+'
    Write-Host '|  Corrija o HISTORY.md com o dado real e faca um commit de      |'
    Write-Host '|  correcao. (Para auditoria completa: /verificar-delegacao)     |'
    Write-Host '+----------------------------------------------------------------+'
    if ($Strict) { exit 1 }
    exit 0
}
catch {
    # No hook local (advisory) jamais derruba o fluxo. No CI (-Strict) um erro
    # inesperado deve reprovar — falha silenciosa no servidor mascara o problema.
    if ($Strict) { Write-Host "verify-history-hashes: erro inesperado -> $_"; exit 1 }
    exit 0
}

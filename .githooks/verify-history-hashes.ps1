# Valida a integridade de docs/HISTORY.md apos cada commit (agnostico de harness).
#
# Verifica as 5 entradas mais recentes do indice:
#   1. O hash referenciado em `...` resolve para um commit real (git rev-parse).
#   2. O arquivo de sessao linkado (sessions/*.md) existe no disco.
#
# Motivacao: agentes delegados (Gemini, Codex) ja registraram hashes inventados
# e afirmaram criar arquivos inexistentes. Este gate barato (<1s, so git+FS) pega
# os dois erros no exato momento do commit, em qualquer ferramenta.
#
# Silencioso em sucesso; imprime um aviso emoldurado em qualquer divergencia.
# NUNCA falha o commit — governanca informativa, exit 0 sempre.
param()

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
            & git -C $repo rev-parse --verify --quiet "$h^{commit}" 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                $problems.Add("hash '$h' nao resolve para um commit real")
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
    exit 0
}
catch {
    # Um hook de governanca jamais pode derrubar o fluxo de commit.
    exit 0
}

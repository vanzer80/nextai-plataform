# Verificacao de handoff de agente delegado — PORTAVEL (qualquer harness: Claude, Codex, Gemini).
# Roda TODOS os checks mecanicos numa unica chamada e emite um relatorio legivel.
#
#   pwsh -File .claude/scripts/verify-delegation.ps1 [-Commit <hash>] [-Build] [-SkipTests]
#
# -Commit  hash reportado pelo agente (default HEAD)
# -Build   inclui "npm run build" (mais lento; gate de bundle do CLAUDE.md)
# -SkipTests pula o vitest (iteracao rapida)
#
# Exit 0 = todos os checks passaram; Exit 1 = ao menos um falhou.
# Fonte unica: a integridade do HISTORY.md e delegada a .githooks/verify-history-hashes.ps1
# (nao reimplementada aqui) — um lugar so define "hash valido = alcancavel a partir do HEAD".
param(
    [string]$Commit = 'HEAD',
    [switch]$Build,
    [switch]$SkipTests
)

$ErrorActionPreference = 'Continue'
$repo = (& git rev-parse --show-toplevel 2>$null)
if (-not $repo) { Write-Host 'Nao e um repositorio git.'; exit 1 }
$repo = $repo.Trim()
Set-Location $repo

$fail = 0
function Check($name, $ok, $detail) {
    $tag = if ($ok) { 'PASS' } else { 'FAIL' }
    $line = "[$tag] $name"
    if ($detail) { $line += " -> $detail" }
    Write-Host $line
    if (-not $ok) { $script:fail++ }
}

function Invoke-Native([string]$CommandLine) {
    # No Windows, "& npx/npm" resolve para shims .ps1 que NAO propagam o exit code real
    # (npx.ps1 devolve 1 mesmo quando o tsc passa — falso-positivo de falha). cmd /c usa
    # o .cmd e propaga o errorlevel correto. Fora do Windows, sh -c faz o equivalente.
    if ($IsWindows) { $out = & cmd /c "$CommandLine 2>&1" }
    else            { $out = & sh  -c "$CommandLine 2>&1" }
    return [pscustomobject]@{ Code = $LASTEXITCODE; Output = $out }
}

Write-Host '=== Verificacao de handoff (checks mecanicos) ==='

# 1. Commit reportado e ALCANCAVEL a partir do HEAD (nao mera existencia — pega dangling)
& git merge-base --is-ancestor $Commit HEAD 2>$null
Check "commit '$Commit' alcancavel a partir do HEAD" ($LASTEXITCODE -eq 0) `
    $(if ($LASTEXITCODE -ne 0) { 'inexistente ou dangling (nunca chegou ao master)' })

# 2. Integridade do docs/HISTORY.md — delega ao script do hook (fonte unica)
$histScript = Join-Path $repo '.githooks/verify-history-hashes.ps1'
if (Test-Path $histScript) {
    $null = & pwsh -NoProfile -File $histScript -Strict 2>&1
    Check 'integridade docs/HISTORY.md (hashes alcancaveis + arquivos de sessao existem)' ($LASTEXITCODE -eq 0) `
        $(if ($LASTEXITCODE -ne 0) { 'rode o script direto p/ ver os itens' })
} else {
    Check 'integridade docs/HISTORY.md' $false 'script .githooks/verify-history-hashes.ps1 ausente'
}

# 3. Working tree limpo — sobras nao commitadas indicam trabalho incompleto
$dirty = & git status --porcelain
Check 'working tree limpo' ([string]::IsNullOrWhiteSpace($dirty)) `
    $(if (-not [string]::IsNullOrWhiteSpace($dirty)) { 'ha mudancas nao commitadas' })

# 4. HEAD sincronizado com origin — o agente alegou push?
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null).Trim()
& git rev-parse --verify --quiet "origin/$branch" *> $null
if ($LASTEXITCODE -eq 0) {
    $ahead = (& git rev-list --count "origin/$branch..HEAD" 2>$null).Trim()
    Check "HEAD sincronizado com origin/$branch" ($ahead -eq '0') `
        $(if ($ahead -ne '0') { "$ahead commit(s) locais nao pushados" })
} else {
    Check "origin/$branch presente" $false 'branch remoto nao encontrado (faca git fetch)'
}

# 5. TypeScript — gate obrigatorio do projeto
$tsc = Invoke-Native 'npx tsc --noEmit'
Check 'tsc --noEmit (EXIT 0)' ($tsc.Code -eq 0) `
    $(if ($tsc.Code -ne 0) { 'erros de tipo — rode "npx tsc --noEmit"' })

# 6. Testes — contagem DINAMICA, nunca hardcoded
if (-not $SkipTests) {
    $vt = Invoke-Native 'npx vitest run'
    # Limpar ANSI ANTES de casar: a linha real tem escapes entre "Tests" e o numero,
    # e -CaseSensitive evita casar o "tests 14.81s" minusculo da linha "Duration".
    $clean = $vt.Output | ForEach-Object { $_ -replace '\x1b\[[0-9;]*m', '' }
    $summary = ($clean | Select-String -CaseSensitive -Pattern 'Tests\s+\d+\s+(passed|failed)' | Select-Object -First 1)
    $detail = if ($summary) { $summary.ToString().Trim() } else { '' }
    Check 'vitest run' ($vt.Code -eq 0) $detail
}

# 7. Build / bundle gate — opcional (mais lento)
if ($Build) {
    $b = Invoke-Native 'npm run build'
    Check 'npm run build' ($b.Code -eq 0) `
        $(if ($b.Code -ne 0) { 'build falhou' } else { 'confira o chunk principal <=100kB no log' })
}

Write-Host ''
if ($fail -eq 0) {
    Write-Host 'RESULTADO: tudo verde — checks mecanicos OK.'
    exit 0
}
Write-Host "RESULTADO: $fail check(s) falharam — ver [FAIL] acima."
exit 1

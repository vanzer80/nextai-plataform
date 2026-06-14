# Scanner de seguranca PORTAVEL (qualquer harness: Claude, Codex, Gemini, git manual).
# Camada MECANICA da governanca de seguranca — SO o que grep faz com ALTA precisao.
# O julgamento (authz, RLS, validacao de input, bypass arquitetural) fica na skill
# /revisar-seguranca; OWASP generico fica no /security-review nativo. Nao misture camadas.
#
#   pwsh -File .claude/scripts/security-scan.ps1 [-Staged] [-Range <base..head>] [-Full] [-Strict]
#
# Alvo do scan (default = mudancas nao-commitadas vs HEAD):
#   -Staged   diff em stage          (usado pelo hook .githooks/pre-commit)
#   -Range    intervalo 'base..head'  (usado pelo CI .github/workflows/security-scan.yml)
#   -Full     TODOS os arquivos versionados (auditoria pontual da base inteira)
#
# Disciplina de severidade (o que separa SAP-grade de linter barulhento):
#   [BLOCK]  zero falso-positivo. Com -Strict => exit 1 (gate de CI). Ex.: segredo hard-coded.
#   [WARN]   heuristica. NUNCA afeta o exit code. Sinaliza p/ a revisao humana/LLM decidir.
#
# Exit: 0 sempre, EXCETO -Strict com >=1 BLOCK -> exit 1. WARN nunca reprova nada.
# Fonte unica dos checks mecanicos de seguranca: este arquivo. Hook e CI apenas o invocam.
param(
    [switch]$Staged,
    [string]$Range,
    [switch]$Full,
    [switch]$Strict
)

$ErrorActionPreference = 'Continue'
$repo = (& git rev-parse --show-toplevel 2>$null)
if (-not $repo) { Write-Host 'Nao e um repositorio git.'; exit 0 }
$repo = $repo.Trim()
Set-Location $repo

# Arquivos que DOCUMENTAM os padroes de risco (este scanner, a skill, os docs de governanca):
# escanea-los dispararia o proprio scanner contra si mesmo. Excluidos sempre.
$ExcludeAlways = @(
    '.claude/scripts/security-scan.ps1',
    'CLAUDE.md', 'AGENTS.md', 'README.md', '.githooks/README.md'
)

function Test-Skip([string]$path, [bool]$forSecrets) {
    $p = $path -replace '\\', '/'
    if ($ExcludeAlways -contains $p) { return $true }
    if ($p -like 'docs/*') { return $true }
    if ($p -like '*/skills/revisar-seguranca/*') { return $true }
    if ($p -like 'node_modules/*' -or $p -like 'dist/*' -or $p -like 'build/*') { return $true }
    if ($forSecrets) {
        # Docs usam placeholders (nxtai_live_<token>); testes carregam JWTs de fixture.
        if ($p -like '*.md') { return $true }
        if ($p -like 'tests/*' -or $p -like '*/__tests__/*' -or $p -like '*.test.*' -or $p -like '*.spec.*') { return $true }
    }
    return $false
}

function Get-Ext([string]$path) {
    $i = $path.LastIndexOf('.')
    if ($i -lt 0) { return '' }
    return $path.Substring($i + 1).ToLower()
}

$codeExt = @('ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs')
$srcExt  = $codeExt + @('sql', 'json', 'yml', 'yaml', 'toml', 'env', 'sh', 'py', 'rb', 'go', 'java')
$textExt = $srcExt + @('md', 'css', 'scss', 'html', 'txt')

# --- Coleta das linhas a analisar ------------------------------------------------
$scanLines = New-Object System.Collections.Generic.List[object]
$sqlFiles  = New-Object System.Collections.Generic.List[string]

function Add-WholeFile([string]$file) {
    $abs = Join-Path $repo $file
    if (-not (Test-Path -LiteralPath $abs)) { return }
    $n = 0
    foreach ($ln in (Get-Content -LiteralPath $abs)) {
        $n++
        $scanLines.Add([pscustomobject]@{ File = $file; Line = $n; Text = [string]$ln })
    }
}

if ($Full) {
    foreach ($f in (& git ls-files)) {
        if ($f -like '*.sql' -and (($f -replace '\\', '/') -like 'supabase/*')) { $sqlFiles.Add($f) }
        if ($textExt -contains (Get-Ext $f)) { Add-WholeFile $f }
    }
} else {
    $diffArgs = @('diff', '--unified=0', '--no-color')
    if ($Staged) { $diffArgs += '--cached' } elseif ($Range) { $diffArgs += $Range }
    $curFile = $null
    $newLine = 0
    foreach ($line in (& git @diffArgs)) {
        if ($null -eq $line) { continue }
        $line = [string]$line
        if ($line -match '^\+\+\+ b/(.*)$') { $curFile = $matches[1]; continue }
        if ($line -match '^@@ -\d+(?:,\d+)? \+(\d+)') { $newLine = [int]$matches[1]; continue }
        if ($line.StartsWith('+') -and -not $line.StartsWith('+++')) {
            if ($curFile -and $curFile -ne '/dev/null') {
                $scanLines.Add([pscustomobject]@{ File = $curFile; Line = $newLine; Text = $line.Substring(1) })
            }
            $newLine++
        }
    }
    $nameArgs = @('diff', '--name-only', '--no-color')
    if ($Staged) { $nameArgs += '--cached' } elseif ($Range) { $nameArgs += $Range }
    foreach ($f in (& git @nameArgs)) {
        if ($f -like '*.sql' -and (($f -replace '\\', '/') -like 'supabase/*')) { $sqlFiles.Add($f) }
    }
}

# --- Achados ---------------------------------------------------------------------
$findings = New-Object System.Collections.Generic.List[object]
function Add-Finding($sev, $rule, $file, $lineNo, $text, $arm, $note) {
    $snip = ([string]$text).Trim()
    if ($snip.Length -gt 120) { $snip = $snip.Substring(0, 120) + '...' }
    $findings.Add([pscustomobject]@{ Sev = $sev; Rule = $rule; File = $file; Line = $lineNo; Snippet = $snip; Arm = $arm; Note = $note })
}

foreach ($l in $scanLines) {
    $ext = Get-Ext $l.File
    $t = $l.Text

    # ===== BLOCK — segredos hard-coded (zero-FP; escopo source, exclui .md/tests) =====
    if (($srcExt -contains $ext) -and -not (Test-Skip $l.File $true)) {
        if ($t -cmatch 'AIza[0-9A-Za-z\-_]{35}') {
            Add-Finding 'BLOCK' 'secret-google-key' $l.File $l.Line $t '' 'Chave Google/Gemini hard-coded — mover p/ Supabase secrets e ROTACIONAR.'
        }
        if ($t -match 'nxtai_live_[A-Za-z0-9]{16,}') {
            Add-Finding 'BLOCK' 'secret-nextai-key' $l.File $l.Line $t '' 'Chave de API NextAI literal — nunca commitar; banco guarda so o SHA-256.'
        }
        if ($t -match 'sk-[A-Za-z0-9\-_]{20,}') {
            Add-Finding 'BLOCK' 'secret-openai-key' $l.File $l.Line $t '' 'Chave OpenAI hard-coded — mover p/ secrets e ROTACIONAR.'
        }
    }

    # ===== BLOCK — tabela inexistente team_members (CLAUDE.md: usar public.users) =====
    if (-not (Test-Skip $l.File $false)) {
        if (($codeExt -contains $ext) -and $t -match '\.from\(\s*[''"]team_members[''"]') {
            Add-Finding 'BLOCK' 'team-members-table' $l.File $l.Line $t '' "Tabela 'team_members' nao existe — usar public.users via getTeamId()."
        }
        if ($ext -eq 'sql' -and $t -match '(?i)\b(from|join|into|update)\s+team_members\b') {
            Add-Finding 'BLOCK' 'team-members-table' $l.File $l.Line $t '' "Tabela 'team_members' nao existe — usar public.users."
        }
    }

    # ===== WARN — heuristicas (nunca bloqueiam; alimentam a revisao humana/LLM) =====
    if (($srcExt -contains $ext) -and -not (Test-Skip $l.File $true)) {
        if ($t -match 'eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}') {
            Add-Finding 'WARN' 'jwt-literal' $l.File $l.Line $t '' 'JWT hard-coded — confirme que NAO e service_role (critico); anon key tb deveria vir de env.'
        }
        if ($t -match '(?i)(service_role|secret|password|api[_-]?key|token)\s*[:=]\s*[''"][^''"]{12,}[''"]' `
                -and $t -notmatch '(?i)(process\.env|Deno\.env|import\.meta\.env|getenv|<|xxx|your[_-]|example|changeme|placeholder|\.\.\.)') {
            Add-Finding 'WARN' 'secret-assign' $l.File $l.Line $t '' 'Possivel segredo literal — confirme que vem de env/secret manager.'
        }
    }
    if (($codeExt -contains $ext) -and -not (Test-Skip $l.File $false)) {
        if ($t -match 'getPublicUrl\(') {
            Add-Finding 'WARN' 'storage-public-url' $l.File $l.Line $t '5' 'Bucket privado: usar createSignedUrls, nunca getPublicUrl.'
        }
        if ($t -match '\.(insert|update|upsert)\(\s*\{\s*\.\.\.') {
            Add-Finding 'WARN' 'body-spread-insert' $l.File $l.Line $t '53' 'Spread de body em insert/update via service_role = field injection. Usar whitelist (pick).'
        }
    }
    if ($ext -eq 'sql' -and -not (Test-Skip $l.File $false)) {
        if ($t -match '(?i)auth\.uid\(\)' -and $t -notmatch '(?i)select\s+auth\.uid\(\)') {
            Add-Finding 'WARN' 'rls-authuid-raw' $l.File $l.Line $t '58' 'Em policy, usar (SELECT auth.uid()) — auth.uid() cru reavalia por linha (initplan).'
        }
    }
}

# ===== WARN — checks por ARQUIVO em migrations SQL (precisam do contexto da funcao) =====
foreach ($f in ($sqlFiles | Select-Object -Unique)) {
    if (Test-Skip $f $false) { continue }
    $abs = Join-Path $repo $f
    if (-not (Test-Path -LiteralPath $abs)) { continue }
    $content = (Get-Content -LiteralPath $abs -Raw)
    if ($content -match '(?i)security\s+definer') {
        if ($content -notmatch '(?i)set\s+search_path') {
            Add-Finding 'WARN' 'secdef-no-searchpath' $f 0 'SECURITY DEFINER sem SET search_path' '22' "Toda funcao SECURITY DEFINER precisa de SET search_path = 'public' (search_path injection)."
        }
        if ($content -notmatch '(?i)revoke\s+execute') {
            Add-Finding 'WARN' 'secdef-no-revoke' $f 0 'SECURITY DEFINER sem REVOKE EXECUTE' '48' 'Fechar acesso anonimo: REVOKE EXECUTE FROM PUBLIC; FROM anon; GRANT TO authenticated.'
        }
    }
}

# --- Relatorio -------------------------------------------------------------------
$blocks = @($findings | Where-Object { $_.Sev -eq 'BLOCK' })
$warns  = @($findings | Where-Object { $_.Sev -eq 'WARN' })

Write-Host '=== security-scan (camada mecanica) ==='
if ($findings.Count -eq 0) {
    Write-Host '[OK] Nenhum padrao de risco nas mudancas analisadas.'
}
foreach ($sev in @('BLOCK', 'WARN')) {
    foreach ($it in @($findings | Where-Object { $_.Sev -eq $sev })) {
        $loc = if ($it.Line -gt 0) { "$($it.File):$($it.Line)" } else { $it.File }
        Write-Host ("[{0}] {1}  {2}" -f $it.Sev, $it.Rule, $loc)
        if ($it.Note) {
            $arm = if ($it.Arm) { " (armadilha #$($it.Arm))" } else { '' }
            Write-Host ("        -> {0}{1}" -f $it.Note, $arm)
        }
        if ($it.Snippet) { Write-Host ("        | {0}" -f $it.Snippet) }
    }
}
Write-Host ''
Write-Host ("Resumo: {0} BLOCK, {1} WARN." -f $blocks.Count, $warns.Count)

if ($Strict -and $blocks.Count -gt 0) {
    Write-Host 'RESULTADO: reprovado (-Strict) — resolva os [BLOCK] acima antes do merge.'
    exit 1
}
if ($blocks.Count -gt 0) {
    Write-Host 'RESULTADO: ha [BLOCK] — advisory neste modo (o CI roda -Strict e reprova).'
} else {
    Write-Host 'RESULTADO: sem bloqueios.'
}
exit 0

# Setup unico por clone: aponta o git para os hooks versionados deste repo.
# Idempotente — seguro reexecutar. Rode 1x apos clonar:  pwsh -File .githooks/install.ps1
param()
$repo = (& git rev-parse --show-toplevel).Trim()
& git -C $repo config core.hooksPath .githooks
Write-Host "core.hooksPath -> .githooks (governanca de commit ativa para qualquer harness)"

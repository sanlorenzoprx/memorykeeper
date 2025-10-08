[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Token,
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,
  [Parameter(Mandatory = $false)]
  [bool]$RunLocalBuild = $true
)

$ErrorActionPreference = "Stop"

function Ensure-InProjectPath {
  param([string]$Path)
  if (!(Test-Path -Path $Path)) {
    throw "Project path not found: $Path"
  }
  Set-Location -Path $Path
  if (!(Test-Path -Path (Join-Path $Path "pnpm-workspace.yaml"))) {
    throw "pnpm-workspace.yaml not found at $Path. Make sure this is the workspace root."
  }
}

function Ensure-GitRepo {
  if (-not (git rev-parse --is-inside-work-tree 2>$null)) {
    git init
  }
}

function Ensure-InitialCommit {
  $hasCommit = $true
  try {
    git rev-parse HEAD | Out-Null
  } catch {
    $hasCommit = $false
  }

  if (-not $hasCommit) {
    git add -A
    git commit -m "Initial commit"
  }
}

function Ensure-MainBranch {
  git branch -M main
}

function Set-Remote-WithToken {
  param([string]$Token, [string]$OwnerRepo)

  $tokenUrl = "https://$Token@github.com/$OwnerRepo.git"
  $plainUrl = "https://github.com/$OwnerRepo.git"

  $hasOrigin = $true
  try {
    git remote get-url origin | Out-Null
  } catch {
    $hasOrigin = $false
  }

  if ($hasOrigin) {
    git remote set-url origin $tokenUrl
  } else {
    git remote add origin $tokenUrl
  }

  return @{ TokenUrl = $tokenUrl; PlainUrl = $plainUrl }
}

function Sync-RemoteAuthoritative {
  param([string]$Remote = "origin", [string]$Branch = "main")

  git fetch $Remote

  $remoteMainExists = (& git ls-remote --heads $Remote $Branch) -ne $null
  if ($remoteMainExists) {
    git pull --rebase $Remote $Branch
  }
}

function Run-LocalBuildAndTests {
  pnpm --version | Out-Null
  pnpm install
  pnpm -w -r build
  pnpm -w -r tsc --noEmit
  pnpm -w -r test
}

function Push-And-Cleanup {
  param([string]$PlainUrl, [string]$Remote = "origin", [string]$Branch = "main")

  git push -u $Remote $Branch

  # Remove token from remote URL for safety
  git remote set-url $Remote $PlainUrl
}

# --- Main flow ---

Ensure-InProjectPath -Path $ProjectPath
Ensure-GitRepo
Ensure-InitialCommit
Ensure-MainBranch

$ownerRepo = "sanlorenzoprx/memorykeeper"
$urls = Set-Remote-WithToken -Token $Token -OwnerRepo $ownerRepo

Sync-RemoteAuthoritative -Remote "origin" -Branch "main"

if ($RunLocalBuild) {
  Run-LocalBuildAndTests
}

Push-And-Cleanup -PlainUrl $urls.PlainUrl -Remote "origin" -Branch "main"

Write-Host "Push complete. CI will run on GitHub (Actions tab) for workflow .github/workflows/ci.yml."
param(
  [string]$GodotExe = "godot",
  [string]$ProjectPath = ".",
  [string]$Preset = "Web",
  [string]$Output = "docs/index.html"
)

$ErrorActionPreference = "Stop"

Push-Location $ProjectPath
try {
  & $GodotExe --headless --path . --export-release $Preset $Output
  if ($LASTEXITCODE -ne 0) {
    throw "Godot export failed with code $LASTEXITCODE."
  }
  Write-Host "Export complete: $Output"
}
finally {
  Pop-Location
}

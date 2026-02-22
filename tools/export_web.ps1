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

  $fullOutputPath = Join-Path (Get-Location) $Output
  if (Test-Path $fullOutputPath) {
    $content = Get-Content $fullOutputPath -Raw

    $customStyle = @'
<style>
:root {
	--bg0: #081216;
	--bg1: #0f2832;
	--panel: rgba(13, 27, 34, 0.82);
	--panel-border: rgba(130, 193, 228, 0.28);
	--text: #f3fcff;
	--muted: #abd2e6;
}

html, body, #canvas {
	margin: 0;
	padding: 0;
	width: 100%;
	height: 100%;
}

body {
	color: var(--text);
	background:
		radial-gradient(1200px 520px at 50% 120%, rgba(73, 132, 168, 0.24), transparent 64%),
		linear-gradient(180deg, var(--bg1) 0%, var(--bg0) 100%);
	overflow: hidden;
	touch-action: none;
	font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif;
}

#canvas { display: block; }
#canvas:focus { outline: none; }

#status {
	position: fixed;
	inset: 0;
	display: grid;
	place-items: center;
	visibility: hidden;
}

#status-card {
	width: min(92vw, 520px);
	padding: 24px 24px 18px;
	border-radius: 16px;
	background: var(--panel);
	backdrop-filter: blur(5px);
	border: 1px solid var(--panel-border);
	box-shadow: 0 18px 46px rgba(0, 0, 0, 0.42);
}

#status-title {
	margin: 0;
	font-size: clamp(28px, 4vw, 36px);
	font-weight: 700;
	letter-spacing: 0.03em;
}

#status-subtitle {
	margin: 6px 0 16px;
	color: var(--muted);
	font-size: 14px;
	letter-spacing: 0.04em;
	text-transform: uppercase;
}

#status-progress {
	width: 100%;
	height: 10px;
	border: 0;
	border-radius: 999px;
	overflow: hidden;
	display: none;
	background: rgba(255, 255, 255, 0.16);
}

#status-progress::-webkit-progress-bar { background: rgba(255, 255, 255, 0.16); }
#status-progress::-webkit-progress-value { background: linear-gradient(90deg, #58b7ff 0%, #67ecff 100%); }
#status-progress::-moz-progress-bar { background: linear-gradient(90deg, #58b7ff 0%, #67ecff 100%); }

#status-notice {
	margin-top: 14px;
	padding: 10px 12px;
	border-radius: 10px;
	background: rgba(96, 20, 34, 0.56);
	border: 1px solid rgba(238, 99, 128, 0.52);
	font-size: 14px;
	line-height: 1.35;
	color: #ffe8ed;
	display: none;
}
</style>
'@

    $customStatus = @'
<div id="status">
	<div id="status-card">
		<h1 id="status-title">Skilling</h1>
		<p id="status-subtitle">Preparing World</p>
		<progress id="status-progress"></progress>
		<div id="status-notice"></div>
	</div>
</div>
'@

    $styleRegex = [regex]::new('<style>[\s\S]*?</style>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    $statusRegex = [regex]::new('<div id="status">[\s\S]*?<script src="index\.js"></script>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    $content = $styleRegex.Replace($content, $customStyle, 1)
    $content = $statusRegex.Replace($content, "$customStatus`r`n`t`t<script src=""index.js""></script>", 1)

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($fullOutputPath, $content, $utf8NoBom)
  }

  Write-Host "Export complete: $Output"
}
finally {
  Pop-Location
}

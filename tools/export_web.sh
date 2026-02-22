#!/usr/bin/env bash
set -euo pipefail

GODOT_BIN="${GODOT_BIN:-godot}"
PROJECT_PATH="${PROJECT_PATH:-.}"
PRESET="${PRESET:-Web}"
OUTPUT="${OUTPUT:-docs/index.html}"

cd "$PROJECT_PATH"
"$GODOT_BIN" --headless --path . --export-release "$PRESET" "$OUTPUT"
echo "Export complete: $OUTPUT"

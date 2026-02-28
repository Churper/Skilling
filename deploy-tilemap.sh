#!/usr/bin/env bash
# deploy-tilemap.sh — one-command tilemap deploy
# Usage: ./deploy-tilemap.sh [path-to-tilemap.json] [commit message]
#   If no path given, uses the latest tilemap*.json in ~/Downloads

set -e

DEST="docs/tilemap.json"

# Find source file
if [ -n "$1" ] && [ -f "$1" ]; then
  SRC="$1"
  shift
else
  # Auto-find latest tilemap export in Downloads
  SRC=$(ls -t ~/Downloads/tilemap*.json 2>/dev/null | head -1)
  if [ -z "$SRC" ]; then
    echo "No tilemap found. Usage: $0 [path/to/tilemap.json]"
    exit 1
  fi
  echo "Auto-detected: $SRC"
fi

# Validate JSON
node -e "
  const fs=require('fs'), d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
  const o=(d.objects||[]).length, h=Object.keys(d.heightOffsets||{}).length, c=Object.keys(d.colorOverrides||{}).length;
  console.log('  objects: '+o+'  heightOffsets: '+h+'  colorOverrides: '+c);
  if(!o && !h && !c){ console.error('Empty tilemap!'); process.exit(1); }
" "$SRC"

# Copy
cp "$SRC" "$DEST"
echo "Deployed to $DEST"

# Commit + push
MSG="${1:-Update tilemap from editor export}"
git add "$DEST"
git commit -m "$MSG"
git push
echo "Pushed."

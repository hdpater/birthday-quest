#!/usr/bin/env bash
# Launches the game locally with Vite's dev server and opens it in your browser.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Dependencies aren't installed yet. Run ./install.sh first." >&2
  exit 1
fi

npm run dev -- --open

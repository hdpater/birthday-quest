#!/usr/bin/env bash
# Installs everything needed to run the game locally.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node.js 18+ from https://nodejs.org/ and re-run this script." >&2
  exit 1
fi

node_major=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
if [ "$node_major" -lt 18 ]; then
  echo "Node.js 18+ is required (found $(node -v)). Please upgrade Node.js." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed (it normally ships with Node.js). Install Node.js from https://nodejs.org/ and re-run this script." >&2
  exit 1
fi

echo "Installing dependencies with npm..."
npm install

echo
echo "Done. Run ./run-game.sh to launch the game."

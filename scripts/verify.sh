#!/usr/bin/env sh
# Run from repo root: sh scripts/verify.sh
# Optional with dev server up: VERIFY_BASE_URL=http://localhost:3000 sh scripts/verify.sh
set -eu
cd "$(dirname "$0")/.."
node scripts/verify.mjs

#!/bin/sh
set -e

mkdir -p "$HOME/.claude"
[ -s "$HOME/.claude.json" ] || echo '{}' > "$HOME/.claude.json"

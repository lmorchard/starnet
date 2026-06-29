#!/usr/bin/env bash
# Phase 5 — rebuild the reduced 3-track corpus as Strudel. RUN BY LES (Vertex API cost).
#
# Run from tools/audio-reference/ (the dir with pyproject.toml, docs/, validator/).
# Prereqs: `uv sync --extra stems --extra dev`, `(cd validator && npm install)`, ADC logged in.
# Source mp3s live in ~/Downloads. Writes docs/<slug>.{md,json} + refreshes docs/index.json.
#
# Watch the [validate] lines: a clean run prints none. Flagged tracks (`_strudel_valid:false`)
# are kept but surfaced — review them in the player.
set -euo pipefail

DL="${HOME}/Downloads"
PROJECT="${GOOGLE_CLOUD_PROJECT:-moz-fx-future-products-nonprod}"
MODEL="${MODEL:-gemini-2.5-pro}"

analyze() {
  local file="$1" artist="$2" title="$3"
  echo "=== ${artist} — ${title} ===" >&2
  uv run audio-reference analyze "${DL}/${file}" \
    --artist "${artist}" --title "${title}" \
    --stems --stems-model htdemucs_ft \
    --model "${MODEL}" --project "${PROJECT}" --out docs
}

analyze "Agent Side Grinder Stripdown (Official Video).mp3"   "Agent Side Grinder" "Stripdown"
analyze "Dry Blood By Parallels (Official Music Video).mp3"   "Parallels"          "Dry Blood"
analyze "The Knife - Heartbeats (Official Video).mp3"         "The Knife"          "Heartbeats"

echo "done — open the player (uv run audio-reference play) and audition each track." >&2

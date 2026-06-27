#!/usr/bin/env bash
# Unified corpus re-run (all 11 tracks) with the FAST settings Les chose:
#   --stems-model htdemucs (single model, ~4x faster than htdemucs_ft)
#   --model gemini-2.5-flash (faster 'ears' pass)
# Overwrites docs/ one track at a time; appends counts to PROGRESS so it's watchable live.
# Run from tools/audio-reference/.
set -u

SESSION_DIR="$(cd "$(dirname "$0")" && pwd)"
PROGRESS="$SESSION_DIR/rerun_progress.log"
DL="$HOME/Downloads"
PROJECT="moz-fx-tabs-nonprod"
LOCATION="us-central1"
# Override via env, e.g. STEMS_MODEL=htdemucs_ft MODEL=gemini-2.5-pro bash rerun_all.sh
STEMS_MODEL="${STEMS_MODEL:-htdemucs}"
MODEL="${MODEL:-gemini-2.5-flash}"

# audiofile | artist | title | slug   (all 11 corpus tracks)
TRACKS=(
  "$DL/Agent Side Grinder Stripdown (Official Video).mp3|Agent Side Grinder|Stripdown|agent-side-grinder-stripdown"
  "$DL/The Unreality Industry.mp3|Black Lung|The Unreality Industry|black-lung-the-unreality-industry"
  "$DL/GHOST COP - PROBLEMS.mp3|Ghost Cop|Problems|ghost-cop-problems"
  "$DL/Kite Step Forward (Kite In China) Official Video.mp3|Kite|Step Forward|kite-step-forward"
  "$DL/Kontravoid - Native State (Official Video).mp3|Kontravoid|Native State|kontravoid-native-state"
  "$DL/Dry Blood By Parallels (Official Music Video).mp3|Parallels|Dry Blood|parallels-dry-blood"
  "$DL/The Gruesome Twosome - Hallucination Generation.mp3|The Gruesome Twosome|Hallucination Generation|the-gruesome-twosome-hallucination-generation"
  "$DL/The Knife - Heartbeats (Official Video).mp3|The Knife|Heartbeats|the-knife-heartbeats"
  "$DL/The Knife - Silent Shout (Official Music Video).mp3|The Knife|Silent Shout|the-knife-silent-shout"
  "$DL/TR_ST - Dressed For Space (Official Video).mp3|TR/ST|Dressed For Space|trst-dressed-for-space"
  "$DL/Trust - Icabod.mp3|TR/ST|Icabod|trst-icabod"
)

count_line() {
  python3 - "$1" <<'PY'
import json, sys
from collections import Counter
PERC = {"MembraneSynth", "MetalSynth", "NoiseSynth"}
slug = sys.argv[1]
try:
    d = json.load(open(f"docs/{slug}.json"))
except Exception as e:
    print(f"(no json: {e})"); sys.exit()
ts = d.get("score_spec", {}).get("tracks", [])
mel = sum(1 for t in ts if (t.get("synth") or {}).get("type") not in PERC)
perc = len(ts) - mel
by_stem = Counter()
for t in ts:
    by_stem[t.get("stem", "?")] += 1
stems = " ".join(f"{k}:{v}" for k, v in sorted(by_stem.items()))
print(f"mel={mel} perc={perc} total={len(ts)}  [{stems}]")
PY
}

echo "=== re-run ($STEMS_MODEL + $MODEL): ${#TRACKS[@]} tracks ===" > "$PROGRESS"
: > "$PROGRESS.stderr"
i=0
for entry in "${TRACKS[@]}"; do
  i=$((i+1))
  IFS='|' read -r audio artist title slug <<< "$entry"
  echo "[$i/${#TRACKS[@]}] START  $slug  ($artist - $title)" >> "$PROGRESS"
  if [ ! -f "$audio" ]; then
    echo "[$i/${#TRACKS[@]}] SKIP   $slug  (audio not found: $audio)" >> "$PROGRESS"
    continue
  fi
  if uv run audio-reference analyze "$audio" --artist "$artist" --title "$title" \
        --stems --stems-model "$STEMS_MODEL" --model "$MODEL" --no-midi --out docs \
        --project "$PROJECT" --location "$LOCATION" >> "$PROGRESS.stderr" 2>&1; then
    echo "[$i/${#TRACKS[@]}] DONE   $slug  $(count_line "$slug")" >> "$PROGRESS"
  else
    echo "[$i/${#TRACKS[@]}] FAIL   $slug  (see $PROGRESS.stderr)" >> "$PROGRESS"
  fi
done
echo "=== re-run complete ===" >> "$PROGRESS"

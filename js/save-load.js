// @ts-check
// Save/load game state — downloads state as JSON, restores from file upload.

import { serializeState, deserializeState, getState } from "./state.js";
import { emitEvent, E } from "./events.js";
import { addLogEntry } from "./log.js";

/** Save current game state as a downloadable JSON file. */
export function saveGame() {
  const snapshot = serializeState();
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `starnet-save-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  addLogEntry("[SYS] Game state saved.", "info");
}

/** Restore game state from a File object. */
export function restoreFromFile(file) {
  file.text().then((text) => {
    try {
      const snapshot = JSON.parse(text);
      deserializeState(snapshot);
      emitEvent(E.STATE_CHANGED, getState());
      addLogEntry(`[SYS] Game state loaded from ${file.name}.`, "info");
    } catch (e) {
      addLogEntry(`[SYS] Failed to load: ${e.message}`, "error");
    }
  });
}

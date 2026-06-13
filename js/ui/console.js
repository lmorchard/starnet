// @ts-check
// Console — keyboard command input for the log pane.
// Handles DOM input, history, tab completion, and command dispatch.
//
// All command logic lives in js/core/console-commands.js.
// This file's only responsibilities:
//   1. Wire the <input> element (keydown, history, tab completion).
//   2. Override the "cheat" command with browser-specific sub-commands
//      (relayout, restore) that need graph.js / DOM access.

import { getState, toggleMenuOpen, toggleHandCollapsed } from "../core/state.js";
import { addLogEntry } from "../core/log.js";
import { emitEvent, on, E } from "../core/events.js";
import { registerCommand, getCommand, tabComplete } from "../core/console-commands/index.js";

// ── Browser cheat extension ───────────────────────────────────────────────────
// Override the headless cheat entry with one that handles the two browser-only
// sub-commands, then delegates everything else to the core execute.

const coreCheat = getCommand("cheat");
registerCommand({
  verb: "cheat",
  complete: coreCheat.complete,
  execute(args) {
    const sub = args[0]?.toLowerCase();

    if (sub === "relayout") {
      const name = args[1]?.toLowerCase();
      import("./graph.js").then(({ relayout, getLayoutNames }) => {
        const used = relayout(name);
        if (name && used !== name) {
          addLogEntry(`[CHEAT] Unknown layout "${name}". Options: ${getLayoutNames().join(", ")}`, "error");
        } else {
          addLogEntry(`[CHEAT] Graph re-laid out (${used}).`, "success");
        }
      });
      return;
    }

    if (sub === "restore") {
      // Programmatic click — may not work in all browsers without a user gesture
      const input = /** @type {HTMLElement|null} */ (document.getElementById("load-file-input"));
      if (input) input.click();
      return;
    }

    if (sub === "fps") {
      // Dev frame-time meter — DOM/rAF, so lazy-loaded from the UI layer (#190).
      import("./fps-meter.js").then(({ toggleFpsMeter }) => {
        const on = toggleFpsMeter();
        addLogEntry(`[CHEAT] FPS meter ${on ? "ON" : "off"}.`, "meta");
      });
      return;
    }

    coreCheat.execute(args);
  },
});

// ── Menu toggle command ───────────────────────────────────────────────────────
// GUI/console symmetry: `menu` toggles the header controls panel identically
// to clicking the hamburger button.

registerCommand({
  verb: "menu",
  execute() {
    if (!getState()) { addLogEntry("menu: no active run.", "error"); return; }
    const open = toggleMenuOpen();
    const hudEl = /** @type {any} */ (document.getElementById("hud"));
    if (hudEl) hudEl.menuOpen = open;
    addLogEntry(`Controls panel ${open ? "open" : "closed"}.`, "meta");
  },
});

// ── Hand collapse toggle command ──────────────────────────────────────────────
// GUI/console symmetry: `hand` toggles the exploit hand panel identically
// to clicking the collapse button.

registerCommand({
  verb: "hand",
  execute() {
    if (!getState()) { addLogEntry("hand: no active run.", "error"); return; }
    const c = toggleHandCollapsed();
    const handEl = /** @type {any} */ (document.getElementById("hand-strip"));
    if (handEl) handEl.collapsed = c;
    addLogEntry(`Exploit hand ${c ? "collapsed" : "expanded"}.`, "meta");
  },
});

// ── History ───────────────────────────────────────────────────────────────────

let history = [];
let historyIndex = -1;

export function pushHistory(cmd) {
  if (!cmd) return;
  history.unshift(cmd);
  if (history.length > 50) history.length = 50;
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initConsole() {
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById("console-input"));
  if (!input) return;

  on(E.COMMAND_ISSUED, ({ cmd }) => pushHistory(cmd));

  input.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") {
      const raw = input.value.trim();
      input.value = "";
      historyIndex = -1;
      if (!raw) return;
      submitCommand(raw);

    } else if (evt.key === "ArrowUp") {
      evt.preventDefault();
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input.value = history[historyIndex];
      }

    } else if (evt.key === "ArrowDown") {
      evt.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = history[historyIndex];
      } else {
        historyIndex = -1;
        input.value = "";
      }

    } else if (evt.key === "Tab") {
      evt.preventDefault();
      handleTabComplete(input);
    }
  });
}

// Public API for programmatic command dispatch (LLM playtesting, etc.)
export function runCommand(raw) {
  submitCommand(raw);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

function submitCommand(raw) {
  emitEvent(E.COMMAND_ISSUED, { cmd: raw });
  const tokens = raw.trim().split(/\s+/);
  const verb = tokens[0].toLowerCase();
  const args = tokens.slice(1);
  const cmd = getCommand(verb);
  if (cmd?.execute) {
    cmd.execute(args);
  } else {
    addLogEntry(`Unknown command: ${verb}`, "error");
  }
}

// ── Tab completion ────────────────────────────────────────────────────────────

function handleTabComplete(input) {
  const result = tabComplete(input.value, getState());
  if (result.completed !== null) input.value = result.completed;
  result.suggestions.forEach((s) => addLogEntry(s, "meta"));
}

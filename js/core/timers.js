// @ts-check
// Centralized timer system — virtual tick clock, no OS handles.
// Advance with tick(n). Browser drives via setInterval(() => tick(1), TICK_MS).
// All state is plain data and fully serializable.

import { emitEvent, E } from "./events.js";
import { getVersion, getState } from "./state/index.js";
import { getActiveRun, requireActiveRun } from "./run-context.js";

export const TICK_MS = 100; // ms per tick; browser master interval uses this

// Named timer event constants — use these in scheduleEvent/scheduleRepeating/cancelAllByType/on()
export const TIMER = {
  ICE_MOVE:        "starnet:timer:ice-move",
  ICE_DETECT:      "starnet:timer:ice-detect",
  TRACE_TICK:      "starnet:timer:trace-tick",
  HEAT_DECAY:      "starnet:timer:heat-decay",
  // Probe, exploit, read, loot, reboot timers removed — timed-action operator handles these
};

// Per-run timer state (currentTick, nextId, entries Map) lives on the active
// RunContext — see run-context.js. A fresh context starts with an empty timer
// set, so a new run can never inherit the previous run's timers.
// _pauseCount is session pause state (tab-hidden / user pause), not per-run.
let _pauseCount = 0;

/** Register NodeGraph for tick advancement (on the active run context). */
export function setGraphForTick(graph) {
  const ctx = getActiveRun();
  if (ctx) ctx.nodeGraph = graph;
}

export function pauseTimers()  { _pauseCount++; }
export function resumeTimers() { if (_pauseCount > 0) _pauseCount--; }
export function isPaused()     { return _pauseCount > 0; }

export function scheduleEvent(type, delayMs, payload = {}, visibility = null) {
  const t = requireActiveRun("scheduleEvent").timers;
  const id = t.nextId++;
  const durationTicks = Math.max(1, Math.round(delayMs / TICK_MS));
  t.entries.set(id, {
    id,
    type,
    payload,
    fireAt: t.currentTick + durationTicks,
    intervalTicks: null,
    visible: !!visibility,
    label: visibility?.label ?? null,
    startedAt: t.currentTick,
    durationTicks,
  });
  return id;
}

export function scheduleRepeating(type, intervalMs, payload = {}) {
  const t = requireActiveRun("scheduleRepeating").timers;
  const id = t.nextId++;
  const intervalTicks = Math.max(1, Math.round(intervalMs / TICK_MS));
  t.entries.set(id, {
    id,
    type,
    payload,
    fireAt: t.currentTick + intervalTicks,
    intervalTicks,
    visible: false,
    label: null,
    startedAt: t.currentTick,
    durationTicks: intervalTicks,
  });
  return id;
}

export function tick(n = 1) {
  if (_pauseCount > 0) return;
  const ctx = getActiveRun();
  if (!ctx) return;
  const t = ctx.timers;
  const versionBefore = getVersion();
  t.currentTick += n;
  for (const [id, entry] of t.entries) {
    // Repeating timers fire once per elapsed interval; one-shots fire once.
    while (t.currentTick >= entry.fireAt) {
      emitEvent(entry.type, { ...entry.payload, timerId: id });
      if (entry.intervalTicks !== null) {
        entry.fireAt += entry.intervalTicks;
      } else {
        t.entries.delete(id);
        break;
      }
    }
  }
  // Advance NodeGraph internal clock (operators: clock, delay, watchdog, debounce)
  if (ctx.nodeGraph) {
    for (let i = 0; i < n; i++) ctx.nodeGraph.tick(1);
  }

  // Emit STATE_CHANGED once at the end of the tick cycle if any state mutation occurred.
  if (getVersion() !== versionBefore) {
    emitEvent(E.STATE_CHANGED, getState());
  }
}

export function cancelEvent(id) {
  getActiveRun()?.timers.entries.delete(id);
}

export function cancelAllByType(type) {
  const t = getActiveRun()?.timers;
  if (!t) return;
  for (const [id, entry] of t.entries) {
    if (entry.type === type) t.entries.delete(id);
  }
}

export function clearAll() {
  const ctx = getActiveRun();
  if (!ctx) return;
  ctx.timers.entries.clear();
  ctx.timers.currentTick = 0;
}

export function getVisibleTimers() {
  const t = getActiveRun()?.timers;
  if (!t) return [];
  return [...t.entries.values()]
    .filter((entry) => entry.visible)
    .map((entry) => ({
      label: entry.label,
      remaining: Math.max(0, Math.ceil((entry.fireAt - t.currentTick) * TICK_MS / 1000)),
      progress: Math.min(1, (t.currentTick - entry.startedAt) / entry.durationTicks),
    }));
}

export function serializeTimers() {
  const t = requireActiveRun("serializeTimers").timers;
  return { currentTick: t.currentTick, nextId: t.nextId, entries: [...t.entries.values()] };
}

export function deserializeTimers({ currentTick: ct, nextId: ni, entries }) {
  const t = requireActiveRun("deserializeTimers").timers;
  t.currentTick = ct;
  t.nextId = ni;
  t.entries.clear();
  for (const entry of entries) t.entries.set(entry.id, entry);
}

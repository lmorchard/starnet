// @ts-check
// Centralized timer system — virtual tick clock, no OS handles.
// Advance with tick(n). Browser drives via setInterval(() => tick(1), TICK_MS).
// All state is plain data and fully serializable.

import { emitEvent } from "./events.js";

export const TICK_MS = 100; // ms per tick; browser master interval uses this

let currentTick = 0;
let nextId = 1;

// timerId → { id, type, payload, fireAt, intervalTicks, visible, label, startedAt, durationTicks }
const timers = new Map();

export function scheduleEvent(type, delayMs, payload = {}, visibility = null) {
  const id = nextId++;
  const durationTicks = Math.max(1, Math.round(delayMs / TICK_MS));
  timers.set(id, {
    id,
    type,
    payload,
    fireAt: currentTick + durationTicks,
    intervalTicks: null,
    visible: !!visibility,
    label: visibility?.label ?? null,
    startedAt: currentTick,
    durationTicks,
  });
  return id;
}

export function scheduleRepeating(type, intervalMs, payload = {}) {
  const id = nextId++;
  const intervalTicks = Math.max(1, Math.round(intervalMs / TICK_MS));
  timers.set(id, {
    id,
    type,
    payload,
    fireAt: currentTick + intervalTicks,
    intervalTicks,
    visible: false,
    label: null,
    startedAt: currentTick,
    durationTicks: intervalTicks,
  });
  return id;
}

export function tick(n = 1) {
  currentTick += n;
  for (const [id, entry] of timers) {
    if (currentTick >= entry.fireAt) {
      emitEvent(`starnet:timer:${entry.type}`, { ...entry.payload, timerId: id });
      if (entry.intervalTicks !== null) {
        entry.fireAt += entry.intervalTicks;
      } else {
        timers.delete(id);
      }
    }
  }
}

export function cancelEvent(id) {
  timers.delete(id);
}

export function cancelAllByType(type) {
  for (const [id, entry] of timers) {
    if (entry.type === type) timers.delete(id);
  }
}

export function clearAll() {
  timers.clear();
  currentTick = 0;
}

export function getVisibleTimers() {
  return [...timers.values()]
    .filter((t) => t.visible)
    .map((t) => ({
      label: t.label,
      remaining: Math.max(0, Math.ceil((t.fireAt - currentTick) * TICK_MS / 1000)),
    }));
}

export function serializeTimers() {
  return { currentTick, nextId, entries: [...timers.values()] };
}

export function deserializeTimers({ currentTick: ct, nextId: ni, entries }) {
  currentTick = ct;
  nextId = ni;
  timers.clear();
  for (const entry of entries) timers.set(entry.id, entry);
}

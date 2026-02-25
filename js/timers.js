// @ts-check
// Centralized timer system for timed game events.
// All timers dispatch DOM custom events on fire: starnet:timer:{type}
// Timers with visibility metadata are exposed via getVisibleTimers() for UI rendering.

const timers = new Map(); // timerId → { handle, type, payload, visible, label, startedAt, durationMs, repeating }
let nextId = 1;

export function scheduleEvent(type, delayMs, payload = {}, visibility = null) {
  // visibility: null (hidden) or { label } (shown in UI with countdown)
  const id = nextId++;
  const startedAt = Date.now();
  const handle = setTimeout(() => {
    timers.delete(id);
    document.dispatchEvent(new CustomEvent(`starnet:timer:${type}`, { detail: { ...payload, timerId: id } }));
  }, delayMs);
  timers.set(id, {
    handle,
    type,
    payload,
    startedAt,
    durationMs: delayMs,
    visible: !!visibility,
    label: visibility?.label ?? null,
    repeating: false,
  });
  return id;
}

export function scheduleRepeating(type, intervalMs, payload = {}) {
  const id = nextId++;
  const handle = setInterval(() => {
    document.dispatchEvent(new CustomEvent(`starnet:timer:${type}`, { detail: { ...payload, timerId: id } }));
  }, intervalMs);
  timers.set(id, {
    handle,
    type,
    payload,
    startedAt: Date.now(),
    durationMs: intervalMs,
    visible: false,
    label: null,
    repeating: true,
  });
  return id;
}

export function cancelEvent(id) {
  const entry = timers.get(id);
  if (!entry) return;
  entry.repeating ? clearInterval(entry.handle) : clearTimeout(entry.handle);
  timers.delete(id);
}

export function cancelAllByType(type) {
  for (const [id, entry] of timers) {
    if (entry.type === type) {
      entry.repeating ? clearInterval(entry.handle) : clearTimeout(entry.handle);
      timers.delete(id);
    }
  }
}

export function clearAll() {
  for (const [, entry] of timers) {
    entry.repeating ? clearInterval(entry.handle) : clearTimeout(entry.handle);
  }
  timers.clear();
}

export function getVisibleTimers() {
  const now = Date.now();
  return [...timers.values()]
    .filter((t) => t.visible)
    .map((t) => ({
      label: t.label,
      remaining: Math.max(0, Math.ceil((t.durationMs - (now - t.startedAt)) / 1000)),
    }));
}

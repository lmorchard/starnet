// @ts-check
/** @typedef {import('./types.js').Message} Message */
/** @typedef {import('./types.js').MessageDescriptor} MessageDescriptor */

/**
 * Create a new message envelope.
 * @param {{ type: string, origin: string, payload?: Record<string, any>, destinations?: string[] | null }} opts
 * @returns {Message}
 */
export function createMessage({ type, origin, payload = {}, destinations = null }) {
  return { type, origin, path: [origin], destinations, payload };
}

/**
 * Return a new message with nodeId appended to path.
 * @param {Message} message
 * @param {string} nodeId
 * @returns {Message}
 */
export function appendPath(message, nodeId) {
  return { ...message, path: [...message.path, nodeId] };
}

/**
 * Return true if nodeId already appears in message path (cycle detection).
 * @param {Message} message
 * @param {string} nodeId
 * @returns {boolean}
 */
export function hasCycle(message, nodeId) {
  return message.path.includes(nodeId);
}

/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

// ─────────────────────────────────────────────────────────────
//  RED THREAD SOCKET
//
//  Central GM relay for all permission-gated operations.
//  Players cannot write scene flags or update unowned documents
//  directly — they emit a request packet here, the GM handles
//  it, then broadcasts results back to all clients.
//
//  Packet structure:
//  {
//    type:    string  — namespaced action e.g. "thread.create"
//    sceneId: string  — owning scene
//    payload: object  — action-specific data
//  }
//
//  Adding a new operation:
//    1. Call registerHandler(type, fn) from your module
//    2. Call request(type, sceneId, payload) to emit
//    3. Call broadcast(type, sceneId, data) to sync all clients
//    4. Register a receiver with registerReceiver(type, fn)
//       for client-side response handling
// ─────────────────────────────────────────────────────────────

const SOCKET_ID = "system.red-thread";

/** @type {Map<string, Function>} GM-side request handlers */
const _handlers  = new Map();

/** @type {Map<string, Function>} Client-side broadcast receivers */
const _receivers = new Map();

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────

/**
 * Call once in Hooks.once("ready").
 * Registers the socket listener for all clients.
 */
export function initSocket() {
  game.socket.on(SOCKET_ID, (packet) => {
    _handlePacket(packet);
  });
  console.log("Red Thread | Socket initialised.");
}

// ─────────────────────────────────────────────────────────────
//  REGISTRATION API
// ─────────────────────────────────────────────────────────────

/**
 * Register a GM-side handler for a request type.
 * The handler receives (scene, payload) and should return
 * the data to broadcast back to all clients, or null to skip.
 *
 * @param {string}   type     — e.g. "thread.create"
 * @param {Function} handler  — async (scene, payload) => broadcastData | null
 */
export function registerHandler(type, handler) {
  _handlers.set(type, handler);
}

/**
 * Register a client-side receiver for a broadcast type.
 * Called on all clients when the GM broadcasts after a write.
 *
 * @param {string}   type     — e.g. "thread.create"
 * @param {Function} receiver — (scene, data) => void
 */
export function registerReceiver(type, receiver) {
  _receivers.set(type, receiver);
}

// ─────────────────────────────────────────────────────────────
//  EMIT API
// ─────────────────────────────────────────────────────────────

/**
 * Send a request to the GM.
 * If the current user IS the GM, handle it locally immediately.
 *
 * @param {string} type
 * @param {string} sceneId
 * @param {object} payload
 */
export function request(type, sceneId, payload = {}) {
  const packet = { kind: "request", type, sceneId, payload };

  if (game.user.isGM) {
    // GM handles locally — no round trip needed
    _handlePacket(packet);
  } else {
    if (!_gmConnected()) {
      ui.notifications.warn("Red Thread | A GM must be connected to perform this action.");
      return;
    }
    game.socket.emit(SOCKET_ID, packet);
  }
}

/**
 * Broadcast result data to all clients after a GM write.
 * Also handles locally on GM since socket doesn't echo to sender.
 *
 * @param {string} type
 * @param {string} sceneId
 * @param {object} data
 */
export function broadcast(type, sceneId, data = {}) {
  const packet = { kind: "broadcast", type, sceneId, data };
  game.socket.emit(SOCKET_ID, packet);
  // GM handles locally since socket doesn't echo back to sender
  _handlePacket(packet);
}

// ─────────────────────────────────────────────────────────────
//  INTERNAL HANDLER
// ─────────────────────────────────────────────────────────────

async function _handlePacket(packet) {
  const { kind, type, sceneId, payload, data } = packet;
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  if (kind === "request") {
    // Only GM processes requests
    if (!game.user.isGM) return;

    const handler = _handlers.get(type);
    if (!handler) {
      console.warn(`Red Thread | No handler registered for type: "${type}"`);
      return;
    }

    const result = await handler(scene, payload);

    // Broadcast result to all clients if handler returned data
    if (result !== null && result !== undefined) {
      broadcast(type, sceneId, result);
    }

  } else if (kind === "broadcast") {
    const receiver = _receivers.get(type);
    if (!receiver) return;
    receiver(scene, data);
  }
}

// ─────────────────────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────────────────────

function _gmConnected() {
  return game.users.some(u => u.isGM && u.active);
}

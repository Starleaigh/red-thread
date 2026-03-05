/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { isCaseboard } from "../scene/scene-type.js";

// ─────────────────────────────────────────────────────────────
//  THREAD STORE
//
//  Thread schema:
//  {
//    id:          string   — unique identifier
//    fromTokenId: string   — token document id
//    toTokenId:   string   — token document id
//    color:       string   — "red" | "white" | "yellow" | "blue"
//    label:       string   — optional display label
//    sceneId:     string   — owning scene id
//  }
//
//  PERMISSIONS
//  Players pass only { fromTokenId, toTokenId } to GM.
//  GM validates, builds thread object, writes flag,
//  then syncs full thread array to all clients.
//  Players never need token document permissions.
// ─────────────────────────────────────────────────────────────

export const THREAD_COLORS = {
  red:    0xcc2200,
  white:  0xf0ede0,
  yellow: 0xf5c842,
  blue:   0x2255cc
};

const FLAG_SCOPE = "red-thread";
const FLAG_KEY   = "threads";
const SOCKET_ID  = "system.red-thread";

// ─────────────────────────────────────────────────────────────
//  SOCKET
// ─────────────────────────────────────────────────────────────

export function initThreadSocket() {
  game.socket.on(SOCKET_ID, (packet) => {
    _handleSocketPacket(packet);
  });
  console.log("Red Thread | Thread socket listener registered.");
}

function _emit(packet) {
  game.socket.emit(SOCKET_ID, packet);
}

async function _handleSocketPacket(packet) {
  const { type, sceneId } = packet;
  const scene = game.scenes.get(sceneId);
  if (!scene || !isCaseboard(scene)) return;

  if (type === "request") {
    // Only GM processes write requests
    if (!game.user.isGM) return;

    const { action, fromTokenId, toTokenId, thread, threadId } = packet;

    switch (action) {

      case "create": {
        // Validate both tokens exist on this scene
        const from = scene.tokens.get(fromTokenId);
        const to   = scene.tokens.get(toTokenId);
        if (!from || !to) {
          console.warn("Red Thread | Create request: token not found on scene.");
          return;
        }

        // Prevent duplicate threads
        const existing = getThreads(scene).find(t =>
          (t.fromTokenId === fromTokenId && t.toTokenId === toTokenId) ||
          (t.fromTokenId === toTokenId   && t.toTokenId === fromTokenId)
        );
        if (existing) return;

        const newThread = {
          id:          foundry.utils.randomID(),
          fromTokenId,
          toTokenId,
          color:       "red",
          label:       "",
          sceneId
        };

        await _writeCreate(scene, newThread);
        break;
      }

      case "update": {
        await _writeUpdate(scene, thread);
        break;
      }

      case "delete": {
        await _writeDelete(scene, threadId);
        break;
      }
    }

    // Sync full array to all clients after any write
    _syncAll(scene);

  } else if (type === "sync") {
    // All clients redraw from authoritative data
    console.log(`Red Thread | Sync received — ${packet.threads.length} thread(s).`);
    canvas.redThread?.renderer?.redrawFromData(packet.threads);
  }
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────

export function getThreads(scene) {
  return scene?.getFlag(FLAG_SCOPE, FLAG_KEY) ?? [];
}

export function getThread(scene, threadId) {
  return getThreads(scene).find(t => t.id === threadId);
}

export function getThreadsForToken(scene, tokenId) {
  return getThreads(scene).filter(
    t => t.fromTokenId === tokenId || t.toTokenId === tokenId
  );
}

/**
 * Request thread creation.
 * Players emit a request with just two token IDs.
 * GM validates and writes.
 */
export function requestCreateThread(scene, fromTokenId, toTokenId) {
  if (!isCaseboard(scene)) return;

  if (game.user.isGM) {
    // GM handles directly
    _handleSocketPacket({
      type:        "request",
      action:      "create",
      sceneId:     scene.id,
      fromTokenId,
      toTokenId
    });
  } else {
    if (!_gmConnected()) {
      ui.notifications.warn("Red Thread | A GM must be connected to create threads.");
      return;
    }
    _emit({ type: "request", action: "create", sceneId: scene.id, fromTokenId, toTokenId });
  }
}

/**
 * Request thread update (color/label).
 */
export function requestUpdateThread(scene, threadId, changes) {
  if (!isCaseboard(scene)) return;

  const thread = getThread(scene, threadId);
  if (!thread) return;

  const updated = {
    ...thread,
    color: changes.color ?? thread.color,
    label: changes.label ?? thread.label
  };

  if (game.user.isGM) {
    _handleSocketPacket({
      type:    "request",
      action:  "update",
      sceneId: scene.id,
      thread:  updated
    });
  } else {
    if (!_gmConnected()) {
      ui.notifications.warn("Red Thread | A GM must be connected to update threads.");
      return;
    }
    _emit({ type: "request", action: "update", sceneId: scene.id, thread: updated });
  }
}

/**
 * Request thread deletion.
 */
export function requestDeleteThread(scene, threadId) {
  if (!isCaseboard(scene)) return;

  if (game.user.isGM) {
    _handleSocketPacket({
      type:     "request",
      action:   "delete",
      sceneId:  scene.id,
      threadId
    });
  } else {
    if (!_gmConnected()) {
      ui.notifications.warn("Red Thread | A GM must be connected to delete threads.");
      return;
    }
    _emit({ type: "request", action: "delete", sceneId: scene.id, threadId });
  }
}

/**
 * Delete all threads connected to a token.
 * Called on token deletion.
 */
export function requestDeleteThreadsForToken(scene, tokenId) {
  const toDelete = getThreadsForToken(scene, tokenId);
  for (const thread of toDelete) {
    requestDeleteThread(scene, thread.id);
  }
}

// ─────────────────────────────────────────────────────────────
//  INTERNAL WRITES — GM only
// ─────────────────────────────────────────────────────────────

async function _writeCreate(scene, thread) {
  const threads = getThreads(scene);
  if (threads.find(t => t.id === thread.id)) return;
  await scene.setFlag(FLAG_SCOPE, FLAG_KEY, [...threads, thread]);
}

async function _writeUpdate(scene, thread) {
  const threads = getThreads(scene).map(t =>
    t.id === thread.id ? thread : t
  );
  await scene.setFlag(FLAG_SCOPE, FLAG_KEY, threads);
}

async function _writeDelete(scene, threadId) {
  const threads = getThreads(scene).filter(t => t.id !== threadId);
  await scene.setFlag(FLAG_SCOPE, FLAG_KEY, threads);
}

/**
 * Broadcast full thread array to all clients.
 * Also redraws locally on GM since socket doesn't echo to sender.
 */
function _syncAll(scene) {
  const threads = getThreads(scene);
  _emit({ type: "sync", sceneId: scene.id, threads });
  // GM redraws locally — socket doesn't echo back to sender
  canvas.redThread?.renderer?.redrawFromData(threads);
}

// ─────────────────────────────────────────────────────────────
//  AUTO-CLEANUP
// ─────────────────────────────────────────────────────────────

Hooks.on("deleteToken", (tokenDoc) => {
  const scene = tokenDoc.parent;
  if (!scene || !isCaseboard(scene)) return;
  requestDeleteThreadsForToken(scene, tokenDoc.id);
});

// ─────────────────────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────────────────────

function _gmConnected() {
  return game.users.some(u => u.isGM && u.active);
}

/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { isCaseboard } from "../scene/scene-type.js";

// ─────────────────────────────────────────────────────────────
//  THREAD STORE
//  All thread data lives as a scene flag:
//    scene.flags["red-thread"].threads  →  Thread[]
//
//  Thread schema:
//  {
//    id:          string   — unique identifier (randomID)
//    fromTokenId: string   — token document id
//    toTokenId:   string   — token document id
//    color:       string   — "red" | "white" | "yellow" | "blue"
//    label:       string   — optional display label
//    sceneId:     string   — owning scene id (for validation)
//  }
//
//  All mutations broadcast via socket so every connected
//  client updates their renderer without a full scene reload.
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
//  SOCKET SETUP
//  Register once on init. All clients listen for thread
//  mutations broadcast by the initiating client.
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

function _handleSocketPacket(packet) {
  const { action, sceneId, thread, threadId } = packet;
  const scene = game.scenes.get(sceneId);
  if (!scene || !isCaseboard(scene)) return;

  switch (action) {
    case "create": _applyCreate(scene, thread); break;
    case "update": _applyUpdate(scene, thread); break;
    case "delete": _applyDelete(scene, threadId); break;
  }
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Get all threads for a scene.
 * @param {Scene} scene
 * @returns {Thread[]}
 */
export function getThreads(scene) {
  return scene?.getFlag(FLAG_SCOPE, FLAG_KEY) ?? [];
}

/**
 * Get a single thread by ID.
 * @param {Scene} scene
 * @param {string} threadId
 * @returns {Thread|undefined}
 */
export function getThread(scene, threadId) {
  return getThreads(scene).find(t => t.id === threadId);
}

/**
 * Get all threads connected to a specific token (either end).
 * @param {Scene} scene
 * @param {string} tokenId
 * @returns {Thread[]}
 */
export function getThreadsForToken(scene, tokenId) {
  return getThreads(scene).filter(
    t => t.fromTokenId === tokenId || t.toTokenId === tokenId
  );
}

/**
 * Create a new thread between two tokens.
 * @param {Scene} scene
 * @param {string} fromTokenId
 * @param {string} toTokenId
 * @param {object} options
 * @param {string} [options.color="red"]
 * @param {string} [options.label=""]
 * @returns {Thread} the created thread
 */
export async function createThread(scene, fromTokenId, toTokenId, options = {}) {
  if (!isCaseboard(scene)) return null;

  // Prevent duplicate threads between the same two tokens
  const existing = getThreads(scene).find(t =>
    (t.fromTokenId === fromTokenId && t.toTokenId === toTokenId) ||
    (t.fromTokenId === toTokenId   && t.toTokenId === fromTokenId)
  );
  if (existing) {
    console.warn("Red Thread | Thread already exists between these tokens.");
    return existing;
  }

  const thread = {
    id:          foundry.utils.randomID(),
    fromTokenId,
    toTokenId,
    color:       options.color ?? "red",
    label:       options.label ?? "",
    sceneId:     scene.id
  };

  await _applyCreate(scene, thread);
  _emit({ action: "create", sceneId: scene.id, thread });

  return thread;
}

/**
 * Update an existing thread's properties.
 * @param {Scene} scene
 * @param {string} threadId
 * @param {Partial<Thread>} changes  — only color and label are mutable
 */
export async function updateThread(scene, threadId, changes) {
  if (!isCaseboard(scene)) return;

  const threads = getThreads(scene);
  const thread  = threads.find(t => t.id === threadId);
  if (!thread) return;

  // Only allow mutable fields to be changed
  const updated = {
    ...thread,
    color: changes.color ?? thread.color,
    label: changes.label ?? thread.label
  };

  await _applyUpdate(scene, updated);
  _emit({ action: "update", sceneId: scene.id, thread: updated });
}

/**
 * Delete a thread by ID.
 * @param {Scene} scene
 * @param {string} threadId
 */
export async function deleteThread(scene, threadId) {
  if (!isCaseboard(scene)) return;

  await _applyDelete(scene, threadId);
  _emit({ action: "delete", sceneId: scene.id, threadId });
}

/**
 * Delete all threads connected to a token.
 * Called automatically when a token is removed from the scene.
 * @param {Scene} scene
 * @param {string} tokenId
 */
export async function deleteThreadsForToken(scene, tokenId) {
  const toDelete = getThreadsForToken(scene, tokenId);
  for (const thread of toDelete) {
    await deleteThread(scene, thread.id);
  }
}

// ─────────────────────────────────────────────────────────────
//  INTERNAL APPLY FUNCTIONS
//  These write directly to scene flags.
//  Called both locally (after emit) and by socket handler
//  on remote clients (who don't re-emit).
// ─────────────────────────────────────────────────────────────

async function _applyCreate(scene, thread) {
  const threads = getThreads(scene);
  // Guard against duplicate apply on same client
  if (threads.find(t => t.id === thread.id)) return;
  await scene.setFlag(FLAG_SCOPE, FLAG_KEY, [...threads, thread]);
}

async function _applyUpdate(scene, thread) {
  const threads = getThreads(scene).map(t =>
    t.id === thread.id ? thread : t
  );
  await scene.setFlag(FLAG_SCOPE, FLAG_KEY, threads);
}

async function _applyDelete(scene, threadId) {
  const threads = getThreads(scene).filter(t => t.id !== threadId);
  await scene.setFlag(FLAG_SCOPE, FLAG_KEY, threads);
}

// ─────────────────────────────────────────────────────────────
//  AUTO-CLEANUP
//  When a token is deleted from a caseboard scene,
//  remove all threads connected to it automatically.
// ─────────────────────────────────────────────────────────────

Hooks.on("deleteToken", (tokenDoc) => {
  const scene = tokenDoc.parent;
  if (!scene || !isCaseboard(scene)) return;
  deleteThreadsForToken(scene, tokenDoc.id);
});

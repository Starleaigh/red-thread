/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { isCaseboard } from "../scene/scene-type.js";
import { request, registerHandler, registerReceiver } from "./socket.js";

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
//  All writes go through the central socket GM relay.
//  Call initThreadHandlers() once in Hooks.once("ready").
// ─────────────────────────────────────────────────────────────

export const THREAD_COLORS = {
  red:    0xcc2200,
  white:  0xf0ede0,
  yellow: 0xf5c842,
  blue:   0x2255cc
};

const FLAG_SCOPE = "red-thread";
const FLAG_KEY   = "threads";

// ─────────────────────────────────────────────────────────────
//  INIT — register handlers and receivers with central socket
// ─────────────────────────────────────────────────────────────

export function initThreadHandlers() {

  // ── GM handlers (write to flags, return full array) ───────

  registerHandler("thread.create", async (scene, { fromTokenId, toTokenId }) => {
    if (!isCaseboard(scene)) return null;

    // Validate both tokens exist on this scene
    const from = scene.tokens.get(fromTokenId);
    const to   = scene.tokens.get(toTokenId);
    if (!from || !to) {
      console.warn("Red Thread | Create: token not found on scene.");
      return null;
    }

    // Prevent duplicate threads
    const existing = getThreads(scene).find(t =>
      (t.fromTokenId === fromTokenId && t.toTokenId === toTokenId) ||
      (t.fromTokenId === toTokenId   && t.toTokenId === fromTokenId)
    );
    if (existing) return null;

    const thread = {
      id:          foundry.utils.randomID(),
      fromTokenId,
      toTokenId,
      color:       "red",
      label:       "",
      sceneId:     scene.id
    };

    const threads = [...getThreads(scene), thread];
    await scene.setFlag(FLAG_SCOPE, FLAG_KEY, threads);
    return { threads };
  });

  registerHandler("thread.update", async (scene, { thread }) => {
    if (!isCaseboard(scene)) return null;

    const threads = getThreads(scene).map(t =>
      t.id === thread.id ? thread : t
    );
    await scene.setFlag(FLAG_SCOPE, FLAG_KEY, threads);
    return { threads };
  });

  registerHandler("thread.delete", async (scene, { threadId }) => {
    if (!isCaseboard(scene)) return null;

    const threads = getThreads(scene).filter(t => t.id !== threadId);
    await scene.setFlag(FLAG_SCOPE, FLAG_KEY, threads);
    return { threads };
  });

  // ── Client receivers (redraw from authoritative data) ────

  const _redraw = (scene, { threads }) => {
    if (scene.id !== canvas.scene?.id) return;
    console.log(`Red Thread | Sync — ${threads.length} thread(s).`);
    canvas.redThread?.renderer?.redrawFromData(threads);
  };

  registerReceiver("thread.create", _redraw);
  registerReceiver("thread.update", _redraw);
  registerReceiver("thread.delete", _redraw);

  console.log("Red Thread | Thread handlers registered.");
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

export function requestCreateThread(scene, fromTokenId, toTokenId) {
  if (!isCaseboard(scene)) return;
  request("thread.create", scene.id, { fromTokenId, toTokenId });
}

export function requestUpdateThread(scene, threadId, changes) {
  if (!isCaseboard(scene)) return;

  const thread = getThread(scene, threadId);
  if (!thread) return;

  request("thread.update", scene.id, {
    thread: {
      ...thread,
      color: changes.color ?? thread.color,
      label: changes.label ?? thread.label
    }
  });
}

export function requestDeleteThread(scene, threadId) {
  if (!isCaseboard(scene)) return;
  request("thread.delete", scene.id, { threadId });
}

export function requestDeleteThreadsForToken(scene, tokenId) {
  for (const thread of getThreadsForToken(scene, tokenId)) {
    requestDeleteThread(scene, thread.id);
  }
}

// ─────────────────────────────────────────────────────────────
//  AUTO-CLEANUP
// ─────────────────────────────────────────────────────────────

Hooks.on("deleteToken", (tokenDoc) => {
  const scene = tokenDoc.parent;
  if (!scene || !isCaseboard(scene)) return;
  requestDeleteThreadsForToken(scene, tokenDoc.id);
});

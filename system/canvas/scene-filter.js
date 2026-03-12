/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { getSceneType, SCENE_TYPES } from "../scene/scene-type.js";

// ─────────────────────────────────────────────────────────────
//  SCENE COLOR FILTER
//
//  Per-scene-type monochrome / sepia filter with per-element
//  enable flags.
//
//  Settings layout (15 keys total):
//    caseboardFilter / theatreFilter / battlemapFilter
//      "none" | "monochrome" | "sepia"
//    + per-element booleans for each scene type:
//      Background, Tokens, Tiles
//      Pins + Threads (caseboard only)
//
//  Filters are applied at container level where possible so
//  newly placed objects inherit the filter automatically:
//    canvas.background  → scene background image
//    canvas.tiles       → all tile placeables
//    canvas.foreground  → overhead/roof tiles
//    token.mesh         → each token mesh (individual, because
//                         meshes live in PrimaryCanvasGroup
//                         separately from token containers)
//
//  Thread and pin containers are filtered individually.
//
//  PIXI filter instances are tagged _rtFilter so they can be
//  cleanly removed or swapped on any setting change.
//
//  Call registerFilterSettings() in Hooks.once("init").
//  Call initSceneFilter()        in Hooks.once("ready").
// ─────────────────────────────────────────────────────────────

let _cachedFilter     = null;
let _cachedFilterType = null;

// ── Filter factory ────────────────────────────────────────────

function _getFilter(type) {
  if (_cachedFilter && _cachedFilterType === type) return _cachedFilter;

  const f = new PIXI.ColorMatrixFilter();
  if (type === "monochrome") {
    f.desaturate();
  } else if (type === "sepia") {
    f.sepia(true);
  }
  f._rtFilter = true;
  _cachedFilter     = f;
  _cachedFilterType = type;
  return f;
}

// ── PIXI apply helper ─────────────────────────────────────────

function _applyTo(displayObject, filter) {
  if (!displayObject) return;

  const existing = (displayObject.filters ?? []).find(f => f._rtFilter);
  if (existing === filter) return; // already correct — skip

  displayObject.filters = (displayObject.filters ?? []).filter(f => !f._rtFilter);

  if (filter) {
    displayObject.filters = [...displayObject.filters, filter];
  }
}

// ── Derive active settings for the current scene ──────────────

function _getSceneSettings() {
  const sceneType = getSceneType(canvas.scene);

  const prefix =
    sceneType === SCENE_TYPES.CASEBOARD ? "caseboard" :
    sceneType === SCENE_TYPES.THEATRE   ? "theatre"   :
    "battlemap";

  const filterType = game.settings.get("red-thread", `${prefix}Filter`);
  const active     = filterType && filterType !== "none";

  return {
    filter:     active ? _getFilter(filterType) : null,
    background: active && game.settings.get("red-thread", `${prefix}Background`),
    tokens:     active && game.settings.get("red-thread", `${prefix}Tokens`),
    tiles:      active && game.settings.get("red-thread", `${prefix}Tiles`),
    pins:       active && sceneType === SCENE_TYPES.CASEBOARD &&
                  game.settings.get("red-thread", "caseboardPins"),
    threads:    active && sceneType === SCENE_TYPES.CASEBOARD &&
                  game.settings.get("red-thread", "caseboardThreads"),
  };
}

// ── Main apply ────────────────────────────────────────────────

export function applySceneFilter() {
  if (!canvas?.ready) return;

  const s = _getSceneSettings();

  // ── Background (PrimarySpriteMesh inside PrimaryCanvasGroup)
  // canvas.primary.background is the scene image mesh in V13.
  _applyTo(canvas.primary?.background, s.background ? s.filter : null);

  // ── Token meshes (PrimarySpriteMesh in PrimaryCanvasGroup)
  for (const token of canvas.tokens?.placeables ?? []) {
    _applyTo(token.mesh, s.tokens ? s.filter : null);
  }

  // ── Tile meshes (also PrimarySpriteMesh — must be filtered individually)
  for (const tile of canvas.tiles?.placeables ?? []) {
    _applyTo(tile.mesh, s.tiles ? s.filter : null);
  }
  // Overhead / roof tiles
  for (const tile of canvas.foreground?.placeables ?? []) {
    _applyTo(tile.mesh, s.tiles ? s.filter : null);
  }

  // ── Threads (caseboard only) ──────────────────────────────
  _applyTo(canvas.redThread?.threadsContainerAbove, s.threads ? s.filter : null);
  _applyTo(canvas.redThreadBg?.threadsContainer,    s.threads ? s.filter : null);

  // ── Pins (caseboard only) ─────────────────────────────────
  _applyTo(canvas.redThread?.pinsContainer, s.pins ? s.filter : null);
}

// ── Per-object helpers (called from hooks) ────────────────────

function _applyToToken(token) {
  if (!token?.mesh) return;
  const s = _getSceneSettings();
  _applyTo(token.mesh, s.tokens ? s.filter : null);
}

function _applyToTile(tile) {
  if (!tile?.mesh) return;
  const s = _getSceneSettings();
  _applyTo(tile.mesh, s.tiles ? s.filter : null);
}

// ── Settings registration ─────────────────────────────────────

const FILTER_CHOICES = {
  "none":       "None",
  "monochrome": "Monochrome",
  "sepia":      "Sepia",
};

function _reg(key, type, def, name, hint) {
  game.settings.register("red-thread", key, {
    name, hint,
    scope:  "world",
    config: true,
    type,
    ...(type === String ? { choices: FILTER_CHOICES } : {}),
    default: def,
    onChange: () => applySceneFilter(),
  });
}

export function registerFilterSettings() {

  // ── Caseboard ───────────────────────────────────────────────
  _reg("caseboardFilter",     String,  "none",  "Caseboard — Color Filter",     "Color grading applied to this scene type.");
  _reg("caseboardBackground", Boolean, true,    "Caseboard — Background",        "Apply the filter to the scene background image.");
  _reg("caseboardTokens",     Boolean, true,    "Caseboard — Tokens",            "Apply the filter to token photos.");
  _reg("caseboardTiles",      Boolean, true,    "Caseboard — Tiles",             "Apply the filter to placed tiles.");
  _reg("caseboardPins",       Boolean, false,   "Caseboard — Pins",              "Apply the filter to thread pins.");
  _reg("caseboardThreads",    Boolean, false,   "Caseboard — Threads",           "Apply the filter to connecting threads. Disable to keep threads in their original color.");

  // ── Theatre ─────────────────────────────────────────────────
  _reg("theatreFilter",       String,  "none",  "Theatre — Color Filter",        "Color grading applied to this scene type.");
  _reg("theatreBackground",   Boolean, true,    "Theatre — Background",          "Apply the filter to the scene background image.");
  _reg("theatreTokens",       Boolean, true,    "Theatre — Tokens",              "Apply the filter to token images.");
  _reg("theatreTiles",        Boolean, true,    "Theatre — Tiles",               "Apply the filter to placed tiles.");

  // ── Battlemap ────────────────────────────────────────────────
  _reg("battlemapFilter",     String,  "none",  "Battlemap — Color Filter",      "Color grading applied to this scene type.");
  _reg("battlemapBackground", Boolean, true,    "Battlemap — Background",        "Apply the filter to the scene background image.");
  _reg("battlemapTokens",     Boolean, true,    "Battlemap — Tokens",            "Apply the filter to token images.");
  _reg("battlemapTiles",      Boolean, true,    "Battlemap — Tiles",             "Apply the filter to placed tiles.");
}

// ── Hook initialization ───────────────────────────────────────

export function initSceneFilter() {

  // Full pass when the canvas finishes loading (covers all existing objects)
  Hooks.on("canvasReady", () => {
    applySceneFilter();
  });

  // All visual meshes live in PrimaryCanvasGroup and must be filtered individually.
  // Container-level filters on CanvasLayer wrappers (canvas.tiles, canvas.background)
  // have no effect on the PrimarySpriteMesh objects inside canvas.primary.

  Hooks.on("drawToken",    (token) => _applyToToken(token));
  Hooks.on("refreshToken", (token) => _applyToToken(token));

  // drawTile fires on creation and canvas init, covering newly placed tiles.
  Hooks.on("drawTile",    (tile) => _applyToTile(tile));
  Hooks.on("refreshTile", (tile) => _applyToTile(tile));

  console.log("Red Thread | Scene filter handlers registered.");
}
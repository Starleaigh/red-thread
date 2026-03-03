/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { isCaseboard } from "../scene/scene-type.js";

// ─────────────────────────────────────────────────────────────
//  SHEET PIN MIXIN
//  Provides caseboard pin functionality to any actor sheet.
//
//  Usage in a sheet class:
//    1. Add <div class="rt-pin-anchor"></div> to the HBS template
//    2. Call initSheetPin(this) at the END of _onRender()
//    3. Call teardownSheetPin(this) at the START of close()
//
//  The pin is injected into .rt-pin-anchor in the template.
//  Sheets without that element will never show a pin.
// ─────────────────────────────────────────────────────────────

const PIN_UNSET_SRC = "systems/red-thread/assets/images/pin-unset.svg";
const PIN_SET_SRC   = "systems/red-thread/assets/images/pin-set.svg";

// Track canvasReady hook IDs per sheet instance for clean teardown
const _hookIds = new WeakMap();

// ─────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Call this at the END of a sheet's _onRender().
 * @param {ActorSheetV2} sheet
 */
export function initSheetPin(sheet) {
  _injectPinElement(sheet);
  _registerCanvasHook(sheet);
}

/**
 * Call this at the START of a sheet's close().
 * @param {ActorSheetV2} sheet
 */
export function teardownSheetPin(sheet) {
  const hookId = _hookIds.get(sheet);
  if (hookId !== undefined) {
    Hooks.off("canvasReady", hookId);
    _hookIds.delete(sheet);
  }
}

// ─────────────────────────────────────────────────────────────
//  PIN ELEMENT
// ─────────────────────────────────────────────────────────────

function _injectPinElement(sheet) {
  if (!sheet.element) return;

  // Only inject if the template has nominated an anchor point
  const anchor = sheet.element.querySelector(".rt-pin-anchor");
  if (!anchor) return;

  const isBoard = isCaseboard(canvas.scene);

  let pinEl = anchor.querySelector(".rt-sheet-pin");

  if (!isBoard) {
    if (pinEl) pinEl.remove();
    return;
  }

  const isSet = _actorHasTokenOnScene(sheet.actor, canvas.scene);

  if (!pinEl) {
    // Build the pin element
    pinEl = document.createElement("div");
    pinEl.classList.add("rt-sheet-pin");

    // Initialise dataset.pinState so _animatePinChange can
    // detect a real transition on the very first click
    pinEl.dataset.pinState = isSet ? "set" : "unset";

    // Start in the correct visual class immediately
    if (!isSet) pinEl.classList.add("rt-pin-resting");

    const img = document.createElement("img");
    img.classList.add("rt-pin-img");
    img.src = isSet ? PIN_SET_SRC : PIN_UNSET_SRC;
    img.draggable = false;
    pinEl.appendChild(img);

    pinEl.addEventListener("click", (e) => _onPinClick(e, sheet));
    anchor.appendChild(pinEl);
  }

  // Sync visual state — handles scene-change updates on existing element
  _syncPinVisual(pinEl, isSet);
}

/**
 * Immediately sync pin visuals with no animation.
 * Used on first inject and on scene change via canvasReady.
 */
function _syncPinVisual(pinEl, isSet) {
  const img = pinEl.querySelector(".rt-pin-img");
  if (!img) return;

  pinEl.dataset.pinState = isSet ? "set" : "unset";
  pinEl.title = isSet ? "Remove from caseboard" : "Pin to caseboard";
  img.src = isSet ? PIN_SET_SRC : PIN_UNSET_SRC;

  if (isSet) {
    pinEl.classList.remove("rt-pin-resting", "rt-pin-pushing");
  } else {
    pinEl.classList.remove("rt-pin-pushing");
    pinEl.classList.add("rt-pin-resting");
  }
}

/**
 * Animate the pin transitioning between states after a click.
 * @param {HTMLElement} pinEl
 * @param {boolean} isSet — the NEW state to animate toward
 */
function _animatePinChange(pinEl, isSet) {
  const img = pinEl.querySelector(".rt-pin-img");
  if (!img) return;

  pinEl.dataset.pinState = isSet ? "set" : "unset";
  pinEl.title = isSet ? "Remove from caseboard" : "Pin to caseboard";

  if (isSet) {
    img.src = PIN_SET_SRC;
    pinEl.classList.remove("rt-pin-resting");
    pinEl.classList.add("rt-pin-pushing");

    setTimeout(() => {
      pinEl.classList.remove("rt-pin-pushing");
    }, 300);

  } else {
    img.src = PIN_UNSET_SRC;
    requestAnimationFrame(() => {
      pinEl.classList.remove("rt-pin-pushing");
      pinEl.classList.add("rt-pin-resting");
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  CLICK HANDLER
// ─────────────────────────────────────────────────────────────

async function _onPinClick(e, sheet) {
  e.preventDefault();
  e.stopPropagation();

  if (!isCaseboard(canvas.scene)) return;

  const actor = _resolveBaseActor(sheet.actor);
  if (!actor) {
    console.error("Red Thread | Sheet pin click: could not resolve base actor", sheet.actor);
    return;
  }

  const scene = canvas.scene;
  const wasSet = _actorHasTokenOnScene(actor, scene);
  console.log("Red Thread | Pin click — wasSet:", wasSet, "actor:", actor.name);

  if (wasSet) {
    await _deleteTokenFromScene(actor, scene);
  } else {
    await _createTokenOnScene(actor, scene);
  }

  const pinEl = sheet.element?.querySelector(".rt-pin-anchor .rt-sheet-pin");
  console.log("Red Thread | pinEl found:", !!pinEl);
  if (!pinEl) return;

  if (wasSet) {
    const nowSet = _actorHasTokenOnScene(actor, scene);
    console.log("Red Thread | After delete — nowSet:", nowSet);
    _animatePinChange(pinEl, nowSet);
  } else {
    console.log("Red Thread | After create — forcing animate to true");
    _animatePinChange(pinEl, true);
  }
}

// ─────────────────────────────────────────────────────────────
//  TOKEN CREATE / DELETE
// ─────────────────────────────────────────────────────────────

async function _createTokenOnScene(actor, scene) {
  const { width, height } = scene.dimensions.sceneRect;

  const tokenData = await actor.getTokenDocument({
    x: Math.floor(width  / 2),
    y: Math.floor(height / 2),
    actorLink: true,
    movementAction: "blink",
    "movement.showRuler": false
  });

  // render: false prevents Foundry triggering sheet re-renders on token creation
  await scene.createEmbeddedDocuments("Token", [tokenData.toObject()], { render: false });
  console.log(`Red Thread | Pinned "${actor.name}" to scene "${scene.name}".`);
}

async function _deleteTokenFromScene(actor, scene) {
  const tokenIds = scene.tokens
    .filter(t => t.actorId === actor.id && t.actorLink)
    .map(t => t.id);

  if (!tokenIds.length) return;

  // render: false prevents Foundry triggering sheet re-renders on token deletion
  await scene.deleteEmbeddedDocuments("Token", tokenIds, { render: false });
  console.log(`Red Thread | Unpinned "${actor.name}" from scene "${scene.name}".`);
}

// ─────────────────────────────────────────────────────────────
//  CANVAS READY HOOK
// ─────────────────────────────────────────────────────────────

function _registerCanvasHook(sheet) {
  teardownSheetPin(sheet); // clear any previous hook first

  const hookId = Hooks.on("canvasReady", () => {
    if (!sheet.element) return;
    _injectPinElement(sheet);
  });

  _hookIds.set(sheet, hookId);
}

// ─────────────────────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────────────────────

function _actorHasTokenOnScene(actor, scene) {
  if (!scene || !actor) return false;
  // Resolve base actor safely — baseActor can be undefined on some sheet types
  const baseActor = (actor.isToken && actor.baseActor) ? actor.baseActor : actor;
  if (!baseActor?.id) return false;
  return scene.tokens.some(t => t.actorId === baseActor.id && t.actorLink);
}

function _resolveBaseActor(actor) {
  if (!actor) return null;
  if (actor.isToken && actor.baseActor) return actor.baseActor;
  return actor;
}
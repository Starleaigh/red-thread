/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { isCaseboard } from "../scene/scene-type.js";

const PHOTO_BORDER_PX    = 5;
const PHOTO_BORDER_COLOR = 0xf8f4ec; // warm off-white / photo-print paper tone
const SHADOW_OFFSET_PX   = 4;
const SHADOW_ALPHA       = 0.35;
const TILT_MAX_DEG       = 7;        // maximum tilt angle in either direction

// ─────────────────────────────────────────────────────────────
//  TOKEN APPEARANCE — Caseboard Photo Frame
//
//  Every token on a caseboard scene is rendered as a pinned
//  photograph: a 5px off-white border with a drop shadow, tilted
//  at a slight random angle.
//
//  Tilt is derived deterministically from the token ID + current
//  grid position using a FNV-1a hash — no document writes needed,
//  all clients compute the same angle, and it changes naturally
//  every time the token moves to a new cell.
//
//  Token dimensions are kept at a maximum of 1×1 grid unit with
//  aspect ratio preserved (longer side = 1 grid, shorter side
//  scales proportionally). Dimension correction runs on
//  createToken for newly placed tokens, and on canvasReady for
//  all existing tokens (GM only — only one client writes).
//
//  Call initTokenAppearance() once in Hooks.once("ready").
// ─────────────────────────────────────────────────────────────

export function initTokenAppearance() {

  // ── Scene load: frame + proportional sizing for all tokens ──
  //
  // drawToken fires during canvas initialisation — before "ready"
  // registers the hook below. canvasReady catches everything
  // already on the scene. GM also corrects token proportions here
  // so the border shape matches the actual image.

  Hooks.on("canvasReady", async () => {
    if (!isCaseboard(canvas.scene)) return;
    for (const token of canvas.tokens?.placeables ?? []) {
      _applyAppearance(token);
      if (game.user.isGM) _setProportionalSize(token.document);
    }
  });

  // ── Photo frame + tilt: tokens placed or redrawn after canvas ready ─

  Hooks.on("drawToken", (token) => {
    if (!isCaseboard(canvas.scene)) return;
    _applyAppearance(token);
  });

  // ── Photo frame + tilt: refresh on token update (move, resize, etc.) ─

  Hooks.on("refreshToken", (token) => {
    if (!isCaseboard(canvas.scene)) return;
    _applyAppearance(token);
  });

  // ── Proportional sizing: newly placed tokens ──────────────────

  Hooks.on("createToken", async (tokenDoc, _options, userId) => {
    if (!isCaseboard(tokenDoc.parent)) return;
    if (userId !== game.user.id) return;
    await _setProportionalSize(tokenDoc);
  });

  console.log("Red Thread | Token appearance handlers registered.");
}

// ── Appearance: frame + tilt ──────────────────────────────────
//
// The token container's origin is at (0,0) = top-left of the
// bounding box.  token.mesh (PrimarySpriteMesh) lives in a
// separate PIXI layer and has anchor(0.5, 0.5), positioned at
// the bounding-box centre — so it rotates around the centre.
//
// To keep frame and image co-rotating we:
//   1. Wrap the frame Graphics in a sub-container whose pivot is
//      at (w/2, h/2) so its rotation origin matches the mesh.
//   2. Do NOT rotate the outer token container.
//   3. Set token.mesh.rotation to the same angle.

function _applyAppearance(token) {
  // During drag, token.isPreview is true and position updates on every mouse
  // move — each new position produces a different hash and the angle spins.
  // Hold the angle at 0 while dragging; the final tilt lands on release.
  const angle = token.isPreview ? 0 : _tiltAngle(token.document) * (Math.PI / 180);

  _ensurePhotoFrame(token, angle);
  if (token.mesh) token.mesh.rotation = angle;

  // The selection bounding box has no use on the caseboard — the photo
  // frame serves as the visual boundary.
  if (token.border) token.border.visible = false;
}

function _ensurePhotoFrame(token, angle) {
  // Clean up stale references after a full token redraw
  if (token._rtPhotoWrapper?.destroyed) {
    token._rtPhotoWrapper = null;
    token._rtPhotoFrame   = null;
  }

  if (!token._rtPhotoWrapper) {
    const wrapper = new PIXI.Container();
    const gfx     = new PIXI.Graphics();
    wrapper.addChild(gfx);
    token.addChildAt(wrapper, 0);   // behind mesh and all other children
    token._rtPhotoWrapper = wrapper;
    token._rtPhotoFrame   = gfx;
  }

  const b = PHOTO_BORDER_PX;
  const s = SHADOW_OFFSET_PX;
  const w = token.w;
  const h = token.h;

  // Centre the wrapper's pivot on the bounding-box midpoint so it
  // rotates around the same world point as token.mesh.
  token._rtPhotoWrapper.pivot.set(w / 2, h / 2);
  token._rtPhotoWrapper.position.set(w / 2, h / 2);
  token._rtPhotoWrapper.rotation = angle;

  token._rtPhotoFrame
    .clear()
    // Drop shadow — offset dark rect drawn first (behind the frame)
    .beginFill(0x000000, SHADOW_ALPHA)
    .drawRect(-b + s, -b + s, w + b * 2, h + b * 2)
    .endFill()
    // Photo frame
    .beginFill(PHOTO_BORDER_COLOR, 1)
    .drawRect(-b, -b, w + b * 2, h + b * 2)
    .endFill();
}

// ── Tilt angle — deterministic, no document writes ────────────
//
// FNV-1a 32-bit hash of "tokenId:x:y" maps to -TILT_MAX..+TILT_MAX.
// Same result on all clients. Changes whenever the token moves.

function _tiltAngle(tokenDoc) {
  const key = `${tokenDoc.id}:${tokenDoc.x}:${tokenDoc.y}`;
  let h = 2166136261; // FNV-1a offset basis
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619); // FNV prime
  }
  const range = TILT_MAX_DEG * 2 * 100;          // 0 .. 1399
  return ((h >>> 0) % range) / 100 - TILT_MAX_DEG;
}

// ── Proportional size helper ──────────────────────────────────

async function _setProportionalSize(tokenDoc) {
  try {
    const src = tokenDoc.texture.src;
    if (!src) return;

    // Use native Image for reliable natural pixel dimensions
    const { iw, ih } = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve({ iw: img.naturalWidth, ih: img.naturalHeight });
      img.onerror = reject;
      img.src = src;
    });

    if (!iw || !ih) return;

    let tw = 1;
    let th = 1;

    if (iw > ih) {
      // Landscape: width = 1 grid, height shrinks proportionally
      th = Math.round((ih / iw) * 100) / 100;
    } else if (ih > iw) {
      // Portrait: height = 1 grid, width shrinks proportionally
      tw = Math.round((iw / ih) * 100) / 100;
    }
    // Square: both remain 1

    const needsUpdate =
      Math.abs(tw - tokenDoc.width)  > 0.01 ||
      Math.abs(th - tokenDoc.height) > 0.01;

    if (needsUpdate) {
      await tokenDoc.update({ width: tw, height: th }, { animation: false });
    }
  } catch (err) {
    console.warn("RT | Could not determine token proportions for", tokenDoc.name, err);
  }
}

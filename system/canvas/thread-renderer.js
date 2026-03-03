/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { isCaseboard } from "../scene/scene-type.js";
import {
  getThreads,
  createThread,
  updateThread,
  deleteThread,
  THREAD_COLORS
} from "./thread-store.js";

// ─────────────────────────────────────────────────────────────
//  THREAD RENDERER
//  Draws threads as textured catenary curves between pins.
//
//  Phases:
//    Drawing mode  — click pin A, preview sags to cursor,
//                    click pin B, thread snaps taut
//    Display mode  — threads drawn taut between pin positions,
//                    redrawn on refreshToken
//    Interaction   — right-click thread line opens context menu
//                    with delete / rename / color options
// ─────────────────────────────────────────────────────────────

const STRING_SRC     = "systems/red-thread/assets/images/thread-string.svg";
const STRING_HEIGHT  = 6;    // px — matches SVG height
const CATENARY_STEPS = 40;   // segments to approximate the curve
const SAG_FACTOR     = 0.15; // sag as fraction of distance when drawing
const SNAP_MS        = 300;  // tighten animation duration in ms
const HIT_TOLERANCE  = 8;    // px — click detection radius around thread

export class ThreadRenderer {

  /**
   * @param {PIXI.Container} container — threadsContainer from RedThreadLayer
   * @param {Map<string, Pin>} pins    — pin map from RedThreadLayer
   */
  constructor(container, pins) {
    this.container  = container;
    this.pins       = pins;

    /** @type {Map<string, PIXI.Graphics>} threadId → graphics object */
    this.graphics   = new Map();

    /** Drawing state */
    this._drawing        = false;
    this._fromTokenId    = null;
    this._previewGraphic = null;
    this._cursorPos      = { x: 0, y: 0 };

    this._stringTexture = null;
    this._textureReady = this._loadTexture();
  }

  // ── Texture ───────────────────────────────────────────────

  async _loadTexture() {
    try {
      this._stringTexture = await PIXI.Assets.load(STRING_SRC);
      console.log("Red Thread | String texture loaded.");
    } catch(err) {
      console.error("Red Thread | Failed to load string texture:", err);
      this._stringTexture = null;
    }
  }

  // ── Public: full redraw ───────────────────────────────────

  /**
   * Redraw all threads for the current scene.
   * Called on canvasReady and refreshToken.
   */
  redraw() {
    const scene = canvas.scene;
    if (!scene || !isCaseboard(scene)) return;

    const threads = getThreads(scene);

    // Remove graphics for threads that no longer exist
    for (const [id, gfx] of this.graphics) {
      if (!threads.find(t => t.id === id)) {
        gfx.destroy();
        this.graphics.delete(id);
      }
    }

    // Draw or update each thread
    for (const thread of threads) {
      this._drawThread(thread);
    }
  }

  /**
   * Redraw only threads connected to a specific token.
   * Called on refreshToken for performance.
   * @param {string} tokenId
   */
  redrawForToken(tokenId) {
    const scene = canvas.scene;
    if (!scene || !isCaseboard(scene)) return;

    const threads = getThreads(scene).filter(
      t => t.fromTokenId === tokenId || t.toTokenId === tokenId
    );

    for (const thread of threads) {
      this._drawThread(thread);
    }
  }

  // ── Thread drawing ────────────────────────────────────────

  _drawThread(thread, sagAmount = 0) {
    const fromPin = this.pins.get(thread.fromTokenId);
    const toPin   = this.pins.get(thread.toTokenId);

    if (!fromPin || !toPin) return;

    const from  = fromPin.position;
    const to    = toPin.position;
    const color = THREAD_COLORS[thread.color] ?? THREAD_COLORS.red;

    // Get or create graphics object for this thread
    let gfx = this.graphics.get(thread.id);
    if (!gfx) {
      gfx = new PIXI.Graphics();
      gfx.eventMode = "static";
      gfx.cursor    = "pointer";
      gfx.zIndex    = 1;

      // Right-click context menu
      gfx.on("rightclick", (event) => {
        event.stopPropagation();
        this._onThreadRightClick(event, thread);
      });

      // Hit detection — slightly wider invisible stroke
      gfx.on("pointerover", () => gfx.alpha = 0.8);
      gfx.on("pointerout",  () => gfx.alpha = 1.0);

      this.container.addChild(gfx);
      this.graphics.set(thread.id, gfx);
    }

    gfx.clear();
    this._strokeCatenary(gfx, from, to, sagAmount, color);
  }

  /**
   * Stroke a catenary curve between two points.
   * @param {PIXI.Graphics} gfx
   * @param {{x,y}} from
   * @param {{x,y}} to
   * @param {number} sag    — 0 = taut, 1 = maximum sag
   * @param {number} color  — PIXI hex color
   */
  _strokeCatenary(gfx, from, to, sag, color) {
    const points = _catenaryPoints(from, to, sag, CATENARY_STEPS);
    // Skip drawing until texture is ready
    if (!this._stringTexture) return;

    // Draw a slightly thicker invisible hit area first
    gfx.lineStyle(HIT_TOLERANCE * 2, 0xffffff, 0);
    gfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      gfx.lineTo(points[i].x, points[i].y);
    }

    // Draw the visible thread
    gfx.lineStyle({
      width:   STRING_HEIGHT,
      color:   color,
      alpha:   1,
      cap:     PIXI.LINE_CAP.ROUND,
      join:    PIXI.LINE_JOIN.ROUND,
      ...(this._stringTexture ? { texture: this._stringTexture } : {})
    });

    gfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      gfx.lineTo(points[i].x, points[i].y);
    }
  }

  // ── Sag → taut animation ──────────────────────────────────

  /**
   * Animate a thread from sagging to taut over SNAP_MS.
   * @param {object} thread
   */
  _animateSnap(thread) {
    const start = performance.now();
    const initialSag = SAG_FACTOR;

    const tick = (now) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / SNAP_MS, 1);
      // Ease out — fast initial snap, settles at end
      const eased    = 1 - Math.pow(1 - progress, 3);
      const sag      = initialSag * (1 - eased);

      this._drawThread(thread, sag);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  // ── Drawing mode ──────────────────────────────────────────

  /**
   * Start drawing a thread from a pin.
   * Called when a pin is clicked.
   * @param {string} tokenId
   */
  startDrawing(tokenId) {
    this._drawing     = true;
    this._fromTokenId = tokenId;

    if (!this._previewGraphic) {
      this._previewGraphic = new PIXI.Graphics();
      this._previewGraphic.zIndex = 5; // above other threads
      this.container.addChild(this._previewGraphic);
    }

    // Listen for cursor movement to update preview
    this._onMouseMove = this._updatePreview.bind(this);
    canvas.stage.on("mousemove", this._onMouseMove);

    console.log("Red Thread | Drawing thread from token:", tokenId);
  }

  /**
   * Complete the thread by clicking a second pin.
   * @param {string} toTokenId
   */
  async completeDrawing(toTokenId) {
    if (!this._drawing || !this._fromTokenId) return;
    if (toTokenId === this._fromTokenId) {
      this.cancelDrawing();
      return;
    }

    const fromTokenId = this._fromTokenId;
    this._stopPreview();

    const thread = await createThread(
      canvas.scene,
      fromTokenId,
      toTokenId,
      { color: "red" }
    );

    if (thread) {
      // Draw immediately with sag then animate to taut
      this._drawThread(thread, SAG_FACTOR);
      this._animateSnap(thread);
    }
  }

  /**
   * Cancel an in-progress thread draw.
   */
  cancelDrawing() {
    this._stopPreview();
  }

  _stopPreview() {
    this._drawing     = false;
    this._fromTokenId = null;

    if (this._onMouseMove) {
      canvas.stage.off("mousemove", this._onMouseMove);
      this._onMouseMove = null;
    }

    if (this._previewGraphic) {
      this._previewGraphic.clear();
    }
  }

  _updatePreview(event) {
    if (!this._drawing || !this._fromTokenId) return;

    const fromPin = this.pins.get(this._fromTokenId);
    if (!fromPin) return;

    const pos = event.data.getLocalPosition(canvas.stage);
    this._cursorPos = { x: pos.x, y: pos.y };

    const from = fromPin.position;
    const to   = this._cursorPos;

    this._previewGraphic.clear();
    this._strokeCatenary(
      this._previewGraphic,
      from,
      to,
      SAG_FACTOR,
      THREAD_COLORS.red
    );
  }

  // ── Right-click context menu ──────────────────────────────

  _onThreadRightClick(event, thread) {
    const pos = event.data.global;

    // Remove any existing menu
    document.querySelector(".rt-thread-menu")?.remove();

    const menu = document.createElement("div");
    menu.className = "rt-thread-menu";
    menu.style.cssText = `
      position: fixed;
      left: ${pos.x}px;
      top:  ${pos.y}px;
      z-index: 99999;
      background: #2a2018;
      border: 1px solid #8b7355;
      border-radius: 4px;
      padding: 4px 0;
      font-family: "Special Elite", monospace;
      font-size: 13px;
      color: #e7e2d8;
      min-width: 160px;
      box-shadow: 2px 2px 8px rgba(0,0,0,0.6);
    `;

    // ── Color options ──
    const colors = [
      { key: "red",    label: "🔴 Red" },
      { key: "white",  label: "⚪ White" },
      { key: "yellow", label: "🟡 Yellow" },
      { key: "blue",   label: "🔵 Blue" }
    ];

    const colorSection = _menuSection("Thread Color");
    menu.appendChild(colorSection);

    for (const { key, label } of colors) {
      const item = _menuItem(label, async () => {
        await updateThread(canvas.scene, thread.id, { color: key });
        this.redraw();
        menu.remove();
      });
      if (thread.color === key) item.style.fontWeight = "bold";
      menu.appendChild(item);
    }

    // ── Rename ──
    menu.appendChild(_menuDivider());
    menu.appendChild(_menuSection("Label"));
    menu.appendChild(_menuItem(
      thread.label ? `✏️ "${thread.label}"` : "✏️ Add label",
      () => {
        menu.remove();
        this._promptLabel(thread);
      }
    ));

    // ── Delete ──
    menu.appendChild(_menuDivider());
    menu.appendChild(_menuItem("🗑️ Delete thread", async () => {
      await deleteThread(canvas.scene, thread.id);
      const gfx = this.graphics.get(thread.id);
      if (gfx) { gfx.destroy(); this.graphics.delete(thread.id); }
      menu.remove();
    }, "#cc4444"));

    document.body.appendChild(menu);

    // Close on any outside click
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("pointerdown", close);
      }
    };
    setTimeout(() => document.addEventListener("pointerdown", close), 0);
  }

  _promptLabel(thread) {
    const current = thread.label ?? "";
    const input   = document.createElement("input");
    input.type    = "text";
    input.value   = current;
    input.placeholder = "Enter label…";

    // Simple inline prompt — reuse Foundry's dialog
    new foundry.applications.api.DialogV2({
      window: { title: "Thread Label" },
      content: `<input type="text" id="rt-label-input" value="${current}" 
                  placeholder="Enter label…" style="width:100%"/>`,
      buttons: [
        {
          label: "Save",
          action: "save",
          callback: async (event, button, dialog) => {
            const val = dialog.element.querySelector("#rt-label-input")?.value ?? "";
            await updateThread(canvas.scene, thread.id, { label: val });
            this.redraw();
          }
        },
        { label: "Cancel", action: "cancel" }
      ]
    }).render(true);
  }

  // ── Teardown ──────────────────────────────────────────────

  destroy() {
    this._stopPreview();

    if (this._previewGraphic) {
      this._previewGraphic.destroy();
      this._previewGraphic = null;
    }

    for (const gfx of this.graphics.values()) {
      gfx.destroy();
    }
    this.graphics.clear();

    document.querySelector(".rt-thread-menu")?.remove();
  }
}

// ─────────────────────────────────────────────────────────────
//  CATENARY MATH
//  Approximates a hanging chain curve between two points.
//  sag=0 → straight line, sag=1 → deep curve
// ─────────────────────────────────────────────────────────────

function _catenaryPoints(from, to, sag, steps) {
  const points = [];

  const dx   = to.x - from.x;
  const dy   = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Control point sits below the midpoint by (sag * dist)
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  // Perpendicular direction — for a caseboard "down" is always +Y
  const sagX = midX;
  const sagY = midY + sag * dist;

  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const mt = 1 - t;

    // Quadratic bezier: P = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
    const x = mt * mt * from.x + 2 * mt * t * sagX + t * t * to.x;
    const y = mt * mt * from.y + 2 * mt * t * sagY + t * t * to.y;

    points.push({ x, y });
  }

  return points;
}

// ─────────────────────────────────────────────────────────────
//  CONTEXT MENU HELPERS
// ─────────────────────────────────────────────────────────────

function _menuSection(label) {
  const el = document.createElement("div");
  el.style.cssText = `
    padding: 2px 12px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #8b7355;
    pointer-events: none;
  `;
  el.textContent = label;
  return el;
}

function _menuItem(label, onClick, color = "#e7e2d8") {
  const el = document.createElement("div");
  el.style.cssText = `
    padding: 6px 16px;
    cursor: pointer;
    color: ${color};
  `;
  el.textContent = label;
  el.addEventListener("pointerover", () => el.style.background = "#3d2f1f");
  el.addEventListener("pointerout",  () => el.style.background = "");
  el.addEventListener("pointerdown", onClick);
  return el;
}

function _menuDivider() {
  const el = document.createElement("div");
  el.style.cssText = "height: 1px; background: #8b7355; margin: 4px 0; opacity: 0.4;";
  return el;
}

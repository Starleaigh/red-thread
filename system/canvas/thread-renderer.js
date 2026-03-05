/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { isCaseboard } from "../scene/scene-type.js";
import {
  getThreads,
  requestCreateThread,
  requestUpdateThread,
  requestDeleteThread,
  THREAD_COLORS
} from "./thread-store.js";

// ─────────────────────────────────────────────────────────────
//  THREAD RENDERER
//
//  Interaction model:
//    Middle-click any token → start/complete thread drawing
//    Right-click thread line → context menu
//
//  No token ownership required for either interaction.
//  All canvas hit testing done manually at stage level.
// ─────────────────────────────────────────────────────────────

const STRING_SRC     = "systems/red-thread/assets/images/thread-string.svg";
const STRING_HEIGHT  = 6;
const CATENARY_STEPS = 40;
const SAG_FACTOR     = 0.15;
const SNAP_MS        = 300;
const HIT_TOLERANCE  = 10;

export class ThreadRenderer {

  constructor(container, pins) {
    this.container = container;
    this.pins      = pins;

    /** @type {Map<string, {gfx: PIXI.Graphics, points: Array}>} */
    this.threads   = new Map();

    this._drawing        = false;
    this._fromTokenId    = null;
    this._previewGraphic = null;
    this._stringTexture  = null;

    this._onStageMiddleClick = null;
    this._onStageRightClick  = null;
    this._onMouseMove        = null;

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

  // ── Stage event registration ──────────────────────────────

  _registerStageEvents() {
    this._unregisterStageEvents();

    // ── Middle click — start/complete thread ──
    this._onStageMiddleClick = (event) => {
      if (event.button !== 1) return;
      if (!isCaseboard(canvas.scene)) return;

      // Prevent browser middle-click scroll
      event.preventDefault?.();

      const pos     = event.data?.getLocalPosition(canvas.stage);
      if (!pos) return;

      const tokenId = this._hitTestTokens(pos);
      if (!tokenId) return;

      if (!this._drawing) {
        this._startDrawing(tokenId);
      } else {
        this._completeDrawing(tokenId);
      }
    };

    // ── Right click — thread context menu ──
    this._onStageRightClick = (event) => {
      if (!isCaseboard(canvas.scene)) return;

      const pos = event.data?.getLocalPosition(canvas.stage);
      if (!pos) return;

      const hit = this._hitTestThreads(pos);
      if (!hit) return;

      event.stopPropagation();
      const globalPos = event.data.global;
      this._showContextMenu(hit.threadId, { x: globalPos.x, y: globalPos.y });
    };

    canvas.stage.on("pointerdown", this._onStageMiddleClick);
    canvas.stage.on("rightclick",  this._onStageRightClick);

    console.log("Red Thread | Stage events registered.");
  }

  _unregisterStageEvents() {
    if (this._onStageMiddleClick) {
      canvas.stage.off("pointerdown", this._onStageMiddleClick);
      this._onStageMiddleClick = null;
    }
    if (this._onStageRightClick) {
      canvas.stage.off("rightclick", this._onStageRightClick);
      this._onStageRightClick = null;
    }
  }

  // ── Token hit testing ─────────────────────────────────────

  /**
   * Find which token (if any) a canvas position falls within.
   * Tests against token bounds — no ownership check.
   * @param {{x, y}} pos — canvas space position
   * @returns {string|null} token document id or null
   */
  _hitTestTokens(pos) {
    for (const token of canvas.tokens.placeables) {
      const { x, y, w, h } = token;
      if (pos.x >= x && pos.x <= x + w &&
          pos.y >= y && pos.y <= y + h) {
        return token.document.id;
      }
    }
    return null;
  }

  // ── Thread hit testing ────────────────────────────────────

  _hitTestThreads(pos) {
    let nearest     = null;
    let nearestDist = HIT_TOLERANCE;

    for (const [threadId, { points }] of this.threads) {
      for (let i = 0; i < points.length - 1; i++) {
        const dist = _distToSegment(pos, points[i], points[i + 1]);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest     = { threadId };
        }
      }
    }

    return nearest;
  }

  // ── Public: redraw from scene flags ──────────────────────

  async redraw() {
    const scene = canvas.scene;
    if (!scene || !isCaseboard(scene)) return;
    await this._textureReady;
    this._syncThreadGraphics(getThreads(scene));
  }

  // ── Public: redraw from sync packet data ─────────────────

  async redrawFromData(threads) {
    await this._textureReady;
    this._syncThreadGraphics(threads);
  }

  // ── Public: redraw threads touching a token ───────────────

  async redrawForToken(tokenId) {
    const scene = canvas.scene;
    if (!scene || !isCaseboard(scene)) return;
    await this._textureReady;

    const threads = getThreads(scene).filter(
      t => t.fromTokenId === tokenId || t.toTokenId === tokenId
    );
    for (const thread of threads) this._drawThread(thread);
  }

  // ── Internal sync ─────────────────────────────────────────

  _syncThreadGraphics(threads) {
    // Remove graphics for deleted threads
    for (const [id, { gfx }] of this.threads) {
      if (!threads.find(t => t.id === id)) {
        gfx.destroy();
        this.threads.delete(id);
      }
    }
    for (const thread of threads) this._drawThread(thread);
  }

  // ── Thread drawing ────────────────────────────────────────

  _drawThread(thread, sagAmount = 0) {
    if (!this._stringTexture) return;

    const fromPin = this.pins.get(thread.fromTokenId);
    const toPin   = this.pins.get(thread.toTokenId);
    if (!fromPin || !toPin) return;

    const from   = fromPin.position;
    const to     = toPin.position;
    const color  = THREAD_COLORS[thread.color] ?? THREAD_COLORS.red;
    const points = _catenaryPoints(from, to, sagAmount, CATENARY_STEPS);

    let entry = this.threads.get(thread.id);
    if (!entry) {
      const gfx = new PIXI.Graphics();
      gfx.zIndex = 1;
      this.container.addChild(gfx);
      entry = { gfx, points };
      this.threads.set(thread.id, entry);
    }

    entry.points = points;
    entry.gfx.clear();
    this._strokePoints(entry.gfx, points, color);
  }

  _strokePoints(gfx, points, color) {
    if (!points.length || !this._stringTexture) return;

    gfx.lineStyle({
      width:   STRING_HEIGHT,
      color,
      alpha:   1,
      cap:     PIXI.LINE_CAP.ROUND,
      join:    PIXI.LINE_JOIN.ROUND,
      texture: this._stringTexture
    });

    gfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      gfx.lineTo(points[i].x, points[i].y);
    }
  }

  // ── Sag → taut animation ──────────────────────────────────

  _animateSnap(thread) {
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / SNAP_MS, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      const sag      = SAG_FACTOR * (1 - eased);
      this._drawThread(thread, sag);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  // ── Drawing mode ──────────────────────────────────────────

  _startDrawing(tokenId) {
    this._drawing     = true;
    this._fromTokenId = tokenId;

    if (!this._previewGraphic) {
      this._previewGraphic = new PIXI.Graphics();
      this._previewGraphic.zIndex = 5;
      this.container.addChild(this._previewGraphic);
    }

    this._onMouseMove = this._updatePreview.bind(this);
    canvas.stage.on("mousemove", this._onMouseMove);

    console.log("Red Thread | Drawing from token:", tokenId);
    ui.notifications.info("Red Thread | Middle-click another token to connect. Escape to cancel.");
  }

  _completeDrawing(toTokenId) {
    if (!this._drawing || !this._fromTokenId) return;
    if (toTokenId === this._fromTokenId) { this.cancelDrawing(); return; }

    const fromTokenId = this._fromTokenId;
    this._stopPreview();

    // Player passes only token IDs — GM does the rest
    requestCreateThread(canvas.scene, fromTokenId, toTokenId);
  }

  cancelDrawing() {
    this._stopPreview();
    console.log("Red Thread | Drawing cancelled.");
  }

  _stopPreview() {
    this._drawing     = false;
    this._fromTokenId = null;

    if (this._onMouseMove) {
      canvas.stage.off("mousemove", this._onMouseMove);
      this._onMouseMove = null;
    }

    if (this._previewGraphic) this._previewGraphic.clear();
  }

  _updatePreview(event) {
    if (!this._drawing || !this._fromTokenId || !this._stringTexture) return;

    const fromPin = this.pins.get(this._fromTokenId);
    if (!fromPin) return;

    const pos    = event.data.getLocalPosition(canvas.stage);
    const from   = fromPin.position;
    const points = _catenaryPoints(from, pos, SAG_FACTOR, CATENARY_STEPS);

    this._previewGraphic.clear();
    this._strokePoints(this._previewGraphic, points, THREAD_COLORS.red);
  }

  // ── Context menu ──────────────────────────────────────────

  _showContextMenu(threadId, screenPos) {
    const scene  = canvas.scene;
    const thread = getThreads(scene).find(t => t.id === threadId);
    if (!thread) return;

    document.querySelector(".rt-thread-menu")?.remove();

    const menu = document.createElement("div");
    menu.className = "rt-thread-menu";
    menu.style.cssText = `
      position: fixed;
      left: ${screenPos.x}px;
      top:  ${screenPos.y}px;
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

    menu.appendChild(_menuSection("Thread Color"));

    for (const { key, label } of [
      { key: "red",    label: "🔴 Red"    },
      { key: "white",  label: "⚪ White"  },
      { key: "yellow", label: "🟡 Yellow" },
      { key: "blue",   label: "🔵 Blue"   }
    ]) {
      const item = _menuItem(label, () => {
        menu.remove();
        requestUpdateThread(scene, thread.id, { color: key });
      });
      if (thread.color === key) item.style.fontWeight = "bold";
      menu.appendChild(item);
    }

    menu.appendChild(_menuDivider());
    menu.appendChild(_menuSection("Label"));
    menu.appendChild(_menuItem(
      thread.label ? `✏️ "${thread.label}"` : "✏️ Add label",
      () => { menu.remove(); this._promptLabel(thread); }
    ));

    menu.appendChild(_menuDivider());
    menu.appendChild(_menuItem("🗑️ Delete thread", () => {
      menu.remove();
      requestDeleteThread(scene, thread.id);
    }, "#cc4444"));

    document.body.appendChild(menu);

    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("pointerdown", close);
      }
    };
    setTimeout(() => document.addEventListener("pointerdown", close), 0);
  }

  _promptLabel(thread) {
    new foundry.applications.api.DialogV2({
      window: { title: "Thread Label" },
      content: `<input type="text" id="rt-label-input" value="${thread.label ?? ""}"
                  placeholder="Enter label…" style="width:100%; margin-top:8px;"/>`,
      buttons: [
        {
          label: "Save",
          action: "save",
          callback: async (event, button, dialog) => {
            const val = dialog.element.querySelector("#rt-label-input")?.value ?? "";
            requestUpdateThread(canvas.scene, thread.id, { label: val });
          }
        },
        { label: "Cancel", action: "cancel" }
      ]
    }).render(true);
  }

  // ── Teardown ──────────────────────────────────────────────

  destroy() {
    this._stopPreview();
    this._unregisterStageEvents();

    if (this._previewGraphic) {
      this._previewGraphic.destroy();
      this._previewGraphic = null;
    }

    for (const { gfx } of this.threads.values()) gfx.destroy();
    this.threads.clear();

    document.querySelector(".rt-thread-menu")?.remove();
  }
}

// ─────────────────────────────────────────────────────────────
//  MATH
// ─────────────────────────────────────────────────────────────

function _catenaryPoints(from, to, sag, steps) {
  const points = [];
  const midX   = (from.x + to.x) / 2;
  const midY   = (from.y + to.y) / 2;
  const dist   = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
  const sagY   = midY + sag * dist;

  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const mt = 1 - t;
    points.push({
      x: mt * mt * from.x + 2 * mt * t * midX + t * t * to.x,
      y: mt * mt * from.y + 2 * mt * t * sagY  + t * t * to.y
    });
  }

  return points;
}

function _distToSegment(p, a, b) {
  const dx  = b.x - a.x;
  const dy  = b.y - a.y;
  const len = dx * dx + dy * dy;
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// ─────────────────────────────────────────────────────────────
//  CONTEXT MENU HELPERS
// ─────────────────────────────────────────────────────────────

function _menuSection(label) {
  const el = document.createElement("div");
  el.style.cssText = `
    padding: 2px 12px; font-size: 10px; text-transform: uppercase;
    letter-spacing: 1px; color: #8b7355; pointer-events: none;
  `;
  el.textContent = label;
  return el;
}

function _menuItem(label, onClick, color = "#e7e2d8") {
  const el = document.createElement("div");
  el.style.cssText = `padding: 6px 16px; cursor: pointer; color: ${color};`;
  el.textContent = label;
  el.addEventListener("pointerover", () => el.style.background = "#3d2f1f");
  el.addEventListener("pointerout",  () => el.style.background = "");
  el.addEventListener("pointerdown", onClick);
  return el;
}

function _menuDivider() {
  const el = document.createElement("div");
  el.style.cssText = "height:1px; background:#8b7355; margin:4px 0; opacity:0.4;";
  return el;
}

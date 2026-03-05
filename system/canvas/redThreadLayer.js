/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { isCaseboard } from "../scene/scene-type.js";
import { Pin } from "./pin.js";
import { ThreadRenderer } from "./thread-renderer.js";

// ─────────────────────────────────────────────────────────────
//  RED THREAD LAYER
//
//  Owns pins and thread renderer.
//  No token permission dependencies — all interaction via
//  middle-click at stage level.
// ─────────────────────────────────────────────────────────────

export class RedThreadLayer extends foundry.canvas.layers.CanvasLayer {

  constructor() {
    super();
    this.pins     = new Map();
    this._hooks   = [];
    this.renderer = null;
  }

  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: "redThread",
      zIndex: 600
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────

  async _draw(options) {
    this.zIndex = 600;
    this.parent?.sortChildren();

    this.threadsContainer = this.addChild(new PIXI.Container());
    this.threadsContainer.sortableChildren = true;
    this.threadsContainer.zIndex = 1;

    this.pinsContainer = this.addChild(new PIXI.Container());
    this.pinsContainer.sortableChildren = true;
    this.pinsContainer.zIndex = 2;

    if (!isCaseboard(canvas.scene)) {
      console.log("Red Thread | Scene is not a caseboard — layer idle.");
      return;
    }

    console.log("Red Thread | Caseboard scene detected — initializing layer.");

    this.renderer = new ThreadRenderer(this.threadsContainer, this.pins);
    this._registerHooks();
    this._initializePins();

    // Wait for pin sprites then draw threads
    await this._waitForPins();
    await this.renderer.redraw();

    console.log("Red Thread | Initial draw complete.");
  }

  async _tearDown(options) {
    this._unregisterHooks();
    this._clearPins();

    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }

    return super._tearDown(options);
  }

  // ── Wait for pins ─────────────────────────────────────────

  _waitForPins() {
    return new Promise((resolve) => {
      if (this.pins.size === 0) { resolve(); return; }

      const maxWait  = 3000;
      const interval = 50;
      let   elapsed  = 0;

      const check = () => {
        const allReady = [...this.pins.values()].every(p => p.sprite !== null);
        if (allReady || elapsed >= maxWait) {
          if (!allReady) console.warn("Red Thread | Pin wait timed out.");
          resolve();
          return;
        }
        elapsed += interval;
        setTimeout(check, interval);
      };
      check();
    });
  }

  _waitForPin(tokenId) {
    return new Promise((resolve) => {
      const maxWait  = 2000;
      const interval = 50;
      let   elapsed  = 0;

      const check = () => {
        const pin = this.pins.get(tokenId);
        if (!pin || pin.sprite !== null || elapsed >= maxWait) { resolve(); return; }
        elapsed += interval;
        setTimeout(check, interval);
      };
      check();
    });
  }

  // ── Hook registration ─────────────────────────────────────

  _registerHooks() {

    this._hooks.push(["refreshToken",
      Hooks.on("refreshToken", (token) => {
        this.updatePin(token);
        this.renderer?.redrawForToken(token.id);
      })
    ]);

    this._hooks.push(["createToken",
      Hooks.on("createToken", async (tokenDoc) => {
        await new Promise(r => setTimeout(r, 50));
        const placeable = tokenDoc.object;
        if (!placeable) return;
        this.addPin(placeable);
        await this._waitForPin(placeable.id);
      })
    ]);

    this._hooks.push(["deleteToken",
      Hooks.on("deleteToken", (tokenDoc) => {
        this.removePin(tokenDoc.id);
        this.renderer?.redraw();
      })
    ]);

    // Escape key — cancel drawing
    document.addEventListener("keydown", this._onKeyDown = (e) => {
      if (e.key === "Escape" && this.renderer?._drawing) {
        this.renderer.cancelDrawing();
      }
    });
  }

  _unregisterHooks() {
    for (const [hookName, id] of this._hooks) {
      Hooks.off(hookName, id);
    }
    this._hooks = [];

    if (this._onKeyDown) {
      document.removeEventListener("keydown", this._onKeyDown);
      this._onKeyDown = null;
    }
  }

  // ── Pin management ────────────────────────────────────────

  _initializePins() {
    for (const token of canvas.tokens.placeables) {
      this.addPin(token);
    }
    console.log(`Red Thread | Initialized ${this.pins.size} pin(s).`);
  }

  addPin(placeable) {
    if (!placeable?.id) return;
    if (this.pins.has(placeable.id)) return;
    const pin = new Pin(placeable, this.pinsContainer);
    this.pins.set(placeable.id, pin);
  }

  updatePin(placeable) {
    if (!placeable?.id) return;
    const pin = this.pins.get(placeable.id);
    if (!pin) { this.addPin(placeable); return; }
    pin.update();
  }

  removePin(tokenId) {
    const pin = this.pins.get(tokenId);
    if (!pin) return;
    pin.destroy();
    this.pins.delete(tokenId);
  }

  _clearPins() {
    for (const pin of this.pins.values()) pin.destroy();
    this.pins.clear();
  }
}

// ─────────────────────────────────────────────────────────────
//  CANVAS READY
// ─────────────────────────────────────────────────────────────

Hooks.on("canvasReady", () => {
  const layer = canvas.redThread;
  if (!layer) return;

  layer.zIndex = 600;
  layer.parent?.sortChildren();

  if (isCaseboard(canvas.scene)) {
    // Defer stage event registration until fully ready
    setTimeout(() => {
      layer.renderer?._registerStageEvents();
    }, 500);
    console.log("Red Thread | Canvas ready — caseboard active.");
  } else {
    console.log("Red Thread | Canvas ready — non-caseboard scene, layer idle.");
  }
});

/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { isCaseboard } from "../scene/scene-type.js";
import { Pin } from "./pin.js";
import { ThreadRenderer } from "./thread-renderer.js";

// ─────────────────────────────────────────────────────────────
//  RED THREAD LAYER
//
//  Thread drawing flow:
//    1. Right-click token → TokenHUD shows "Connect Thread" button
//    2. Click button → drawing mode starts, HUD closes
//    3. Left-click any token → thread completes
//    4. Escape → cancel drawing mode
//
//  Pin sprites are visual only — interaction goes through
//  Foundry's TokenHUD and Token._onClickLeft intercept.
// ─────────────────────────────────────────────────────────────

export class RedThreadLayer extends foundry.canvas.layers.CanvasLayer {

  constructor() {
    super();
    /** @type {Map<string, Pin>} keyed by token placeable ID */
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
    // Force z-order — layerOptions zIndex isn't always respected on draw
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

    // Draw existing threads after pins finish async _build()
    setTimeout(() => this.renderer.redraw(), 100);
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

  // ── Hook registration ─────────────────────────────────────

  _registerHooks() {

    // Reposition pins and redraw connected threads on token move
    this._hooks.push(["refreshToken",
      Hooks.on("refreshToken", (token) => {
        this.updatePin(token);
        this.renderer?.redrawForToken(token.id);
      })
    ]);

    // Add pin when token is created on scene
    this._hooks.push(["createToken",
      Hooks.on("createToken", (tokenDoc) => {
        setTimeout(() => {
          const placeable = tokenDoc.object;
          if (placeable) this.addPin(placeable);
        }, 50);
      })
    ]);

    // Remove pin when token is deleted
    this._hooks.push(["deleteToken",
      Hooks.on("deleteToken", (tokenDoc) => {
        this.removePin(tokenDoc.id);
        this.renderer?.redraw();
      })
    ]);

    // Redraw threads when scene flags change (remote client sync)
    this._hooks.push(["updateScene",
      Hooks.on("updateScene", (scene, changes) => {
        if (scene.id !== canvas.scene?.id) return;
        if (foundry.utils.hasProperty(changes, "flags.red-thread.threads")) {
          this.renderer?.redraw();
        }
      })
    ]);

    // ── TokenHUD button — start drawing mode ──────────────
    // Injects a "Connect Thread" button into the token HUD
    // only on caseboard scenes
    this._hooks.push(["renderTokenHUD",
      Hooks.on("renderTokenHUD", (hud, html, data) => {
        if (!isCaseboard(canvas.scene)) return;

        const button = document.createElement("div");
        button.classList.add("control-icon", "rt-connect-thread");
        button.title = "Connect Thread";
        button.innerHTML = `<i class="fa-solid fa-timeline"></i>`;

        // Highlight if this token is the current drawing origin
        if (this.renderer?._drawing &&
            this.renderer?._fromTokenId === hud.object?.document?.id) {
          button.classList.add("active");
        }

        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const tokenId = hud.object?.document?.id;
          if (!tokenId) return;

          hud.close();
          this._onHUDConnectClick(tokenId);
        });

        // Append to the right column of the HUD
        const col = html.querySelector(".col.right");
        if (col) col.appendChild(button);
      })
    ]);

    // ── Token left-click intercept — complete drawing ──────
    // Only active when drawing mode is on

    const self = this;
    const TokenProto = foundry.canvas.placeables.Token.prototype;

    if (!TokenProto._rtOriginalPropagateLeftClick) {
      TokenProto._rtOriginalPropagateLeftClick = TokenProto._propagateLeftClick;
    }

    TokenProto._propagateLeftClick = function(event) {
      if (self.renderer?._drawing) {
        self._onPinClick(this.document.id);
        return false;
      }
      return TokenProto._rtOriginalPropagateLeftClick.call(this, event);
    };

    // ── Escape key — cancel drawing mode ──────────────────
    document.addEventListener("keydown", this._onKeyDown = (e) => {
      if (e.key === "Escape" && this.renderer?._drawing) {
        this.renderer.cancelDrawing();
        console.log("Red Thread | Thread drawing cancelled.");
      }
    });
  }

  _unregisterHooks() {
    for (const [hookName, id] of this._hooks) {
      Hooks.off(hookName, id);
    }
    this._hooks = [];

    // Restore original Token click handler
    const TokenProto = foundry.canvas.placeables.Token.prototype;
    if (TokenProto._rtOriginalPropagateLeftClick) {
      TokenProto._propagateLeftClick = TokenProto._rtOriginalPropagateLeftClick;
      delete TokenProto._rtOriginalPropagateLeftClick;
    }

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

  // ── Thread drawing state machine ──────────────────────────

  /**
   * Called when "Connect Thread" HUD button is clicked.
   * Starts or cancels drawing mode.
   */
  _onHUDConnectClick(tokenId) {
    if (!this.renderer) return;

    if (this.renderer._drawing) {
      if (this.renderer._fromTokenId === tokenId) {
        // Clicking same token again cancels
        this.renderer.cancelDrawing();
        console.log("Red Thread | Thread drawing cancelled.");
      } else {
        // Clicking different token via HUD also completes
        this.renderer.completeDrawing(tokenId);
      }
      return;
    }

    this.renderer.startDrawing(tokenId);
    ui.notifications.info(`Red Thread | Click a token to connect the thread. Escape to cancel.`);
  }

  /**
   * Called when a token is left-clicked during drawing mode.
   * Completes the thread to the clicked token.
   */
  _onPinClick(tokenId) {
    if (!this.renderer?._drawing) return;
    this.renderer.completeDrawing(tokenId);
  }
}

// ─────────────────────────────────────────────────────────────
//  HOOK: z-order + logging on canvas ready
// ─────────────────────────────────────────────────────────────

Hooks.on("canvasReady", () => {
  const layer = canvas.redThread;
  if (!layer) return;

  // Re-apply z-index after full canvas init
  layer.zIndex = 600;
  layer.parent?.sortChildren();

  if (isCaseboard(canvas.scene)) {
    console.log("Red Thread | Canvas ready — caseboard active.");
  } else {
    console.log("Red Thread | Canvas ready — non-caseboard scene, layer idle.");
  }
});

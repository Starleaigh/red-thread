/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

// ─────────────────────────────────────────────────────────────
//  RED THREAD BG LAYER
//
//  Owns the PIXI container that holds thread graphics.
//  Lives in the "primary" canvas group so its zIndex can be
//  set either below (~50) or above (~250) the token layer,
//  giving the GM a live toggle for thread rendering order.
//
//  Pins always stay in the "interface" group (RedThreadLayer)
//  so they remain interactive and visible above tokens in both
//  modes.
// ─────────────────────────────────────────────────────────────

export class RedThreadBgLayer extends foundry.canvas.layers.CanvasLayer {

  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: "redThreadBg",
      zIndex: 50
    });
  }

  async _draw(_options) {
    this.threadsContainer = this.addChild(new PIXI.Container());
    this.threadsContainer.sortableChildren = true;
    this.threadsContainer.zIndex = 1;
  }

  async _tearDown(options) {
    this.threadsContainer?.destroy({ children: true });
    this.threadsContainer = null;
    return super._tearDown(options);
  }
}

// ── Layer order helper ────────────────────────────────────────
//
// Called on _draw and on the setting onChange callback.
// Adjusts zIndex within the primary group so threads render
// either below (50) or above (250) the token layer (~200).

export function applyThreadsLayerOrder() {
  const renderer  = canvas?.redThread?.renderer;
  const rtLayer   = canvas?.redThread;
  if (!renderer || !rtLayer) return;

  const below        = game.settings.get("red-thread", "threadsBelow");
  const newContainer = below
    ? (canvas.redThreadBg?.threadsContainer ?? rtLayer.threadsContainerAbove)
    : rtLayer.threadsContainerAbove;

  renderer.switchContainer(newContainer);
}

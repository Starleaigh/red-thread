/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

// ─────────────────────────────────────────────────────────────
//  PIN
//  A PIXI sprite rendered above each actor token on a caseboard.
//  Sits nailed through the top-centre of the token.
//  Color driven by a token flag.
//  onClick callback wired by RedThreadLayer for thread drawing.
// ─────────────────────────────────────────────────────────────

const PIN_SRC  = "systems/red-thread/assets/images/pin-set.svg";
const PIN_SIZE = 40;
const PIN_DEFAULT_COLOR = 0xffffff; // no tint — let SVG colors show

export class Pin {

  /**
   * @param {Token} placeable
   * @param {PIXI.Container} container
   */
  constructor(placeable, container) {
    this.placeable = placeable;
    this.container = container;
    this.sprite    = null;

    /** Set by RedThreadLayer — called with tokenId on left click */
    this.onClick   = null;

    this._build();
  }

  // ── Public position accessor used by thread renderer ─────

  /**
   * World-space position of the pin point (top-centre of token).
   * @returns {{ x: number, y: number }}
   */
  get position() {
    return this._getPinPosition();
  }

  // ── Build ─────────────────────────────────────────────────

  async _build() {
    const texture = await this._loadTexture();
    if (!texture) return;

    this.sprite = new PIXI.Sprite(texture);

    // Anchor at bottom-centre so pin point sits at top of token
    // and head floats above it
    this.sprite.anchor.set(0.5, 1.0);
    this.sprite.width  = PIN_SIZE;
    this.sprite.height = PIN_SIZE;
    this.sprite.zIndex = 10;

    // ── Interactivity ──
    this.sprite.eventMode = "static";
    this.sprite.cursor    = "pointer";

    // Left click — trigger thread drawing state machine
    this.sprite.on("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      if (this.onClick) this.onClick(this.placeable.id);
    });

    // Hover feedback
    this.sprite.on("pointerover", () => { this.sprite.alpha = 0.75; });
    this.sprite.on("pointerout",  () => { this.sprite.alpha = 1.0; });

    // Apply colour tint from token flag if set
    this._applyColor();

    // Position on canvas
    this._setPosition();

    this.container.addChild(this.sprite);
  }

  async _loadTexture() {
    try {
      return await PIXI.Assets.load(PIN_SRC);
    } catch (err) {
      console.error("Red Thread | Failed to load pin texture:", err);
      return null;
    }
  }

  // ── Position ──────────────────────────────────────────────

  _getPinPosition() {
    const t = this.placeable;
    return {
      x: t.x + (t.w / 2),
      y: t.y
    };
  }

  _setPosition() {
    if (!this.sprite) return;
    const pos = this._getPinPosition();
    this.sprite.x = pos.x;
    this.sprite.y = pos.y;
  }

  // ── Color ─────────────────────────────────────────────────

  _applyColor() {
    if (!this.sprite) return;
    const flagColor = this.placeable.document?.getFlag("red-thread", "pinColor");
    // 0xffffff = no tint, let SVG render naturally
    this.sprite.tint = flagColor ?? PIN_DEFAULT_COLOR;
  }

  // ── Update ────────────────────────────────────────────────

  update() {
    if (!this.sprite) return;
    this._setPosition();
    this._applyColor();
  }

  // ── Destroy ───────────────────────────────────────────────

  destroy() {
    if (this.sprite) {
      this.sprite.off("pointerdown");
      this.sprite.off("pointerover");
      this.sprite.off("pointerout");
      this.container.removeChild(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}

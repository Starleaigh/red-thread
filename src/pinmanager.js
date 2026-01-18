
/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

// src/pinManager.js

class Pin {
  constructor(placeable) {
    this.placeable = placeable;
    this.graphics = new PIXI.Graphics();
    canvas.stage.addChild(this.graphics);

    this.visible = true;
    this.color = 0xff0000;
    this.update();
  }

  get position() {
    return this.placeable.center;
  }

  update() {
    if (!this.graphics) return;

    this.graphics.clear();

    if (!this.visible) return;

    this.graphics.beginFill(this.color);
    this.graphics.drawCircle(this.position.x, this.position.y, 6);
    this.graphics.endFill();
  }

  setVisible(isVisible) {
    this.visible = isVisible;
    this.update();
  }
}

export class PinManager {
  static pins = new Map();

  static initializePins() {
    // clear old pins first
    this.pins.clear();

    // all tokens
    for (const token of canvas.tokens.placeables) {
      this.getPin(token);
    }

    // all map notes
    for (const note of canvas.notes.placeables) {
      this.getPin(note);
    }
  }

  static getPin(placeable) {
    if (!placeable?.id) return null;

    if (!this.pins.has(placeable.id)) {
      const pin = new Pin(placeable);
      this.pins.set(placeable.id, pin);
    }

    return this.pins.get(placeable.id);
  }
}
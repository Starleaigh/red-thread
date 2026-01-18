/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { Pin } from "./pin.js";

export class RedThreadLayer extends CanvasLayer {
  constructor() {
    super();
    this.pins = new Map();
  }

  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: "redThreadLayer",
      zIndex: 999
    });
  }

  async _draw() {
    return this;
  }

  clearPins() {
    for (const pin of this.pins.values()) {
      pin.destroy();
    }
    this.pins.clear();
  }

  initializePins() {
    console.log("Initializing pins",
        canvas.tokens.placeables.length,
        canvas.notes.placeables.length
    )
    for (const token of canvas.tokens.placeables) this.addPin(token);
    for (const note of canvas.notes.placeables) this.addPin(note);
  }

  addPin(placeable) {
    if (!placeable?.id) return;
    if (this.pins.has(placeable.id)) return;

    const pin = new Pin(placeable, this);
    this.pins.set(placeable.id, pin);
  }

  activate() {
    super.activate();
    this._addListeners();
  }

  deactivate() {
    super.deactivate();
    this._removeListeners();
  }

  _addListeners() {
    this._onMouseDown = this._onMouseDown.bind(this);
    canvas.stage.on("mousedown", this._onMouseDown);
  }

  _removeListeners() {
    canvas.stage.off("mousedown", this._onMouseDown);
  }

  _onMouseDown(event) {
    const target = event.target;

    if (!target?.document) return;

    if (target.document.documentName === "Token" || target.document.documentName === "Note") {
      this._dragTarget = target;
      this._startDrag(event);
    }
  }

  _startDrag(event) {
    this._dragging = true;

    const pos = event.data.getLocalPosition(canvas.stage);
    this._dragStart = { x: pos.x, y: pos.y };

    this._dragTargetStart = {
      x: this._dragTarget.x,
      y: this._dragTarget.y
    };

    this._moveHandler = this._onMouseMove.bind(this);
    this._upHandler = this._onMouseUp.bind(this);

    canvas.stage.on("mousemove", this._moveHandler);
    canvas.stage.on("mouseup", this._upHandler);
  }

  _onMouseMove(event) {
    if (!this._dragging) return;

    const pos = event.data.getLocalPosition(canvas.stage);
    const dx = pos.x - this._dragStart.x;
    const dy = pos.y - this._dragStart.y;

    this._dragTarget.document.update({
      x: this._dragTargetStart.x + dx,
      y: this._dragTargetStart.y + dy
    });
  }

  _onMouseUp() {
    this._dragging = false;
    canvas.stage.off("mousemove", this._moveHandler);
    canvas.stage.off("mouseup", this._upHandler);
  }
}
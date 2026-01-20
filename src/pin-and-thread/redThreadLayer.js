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
      zIndex: 10000
    });
  }

  //Foundry requires this even if it does nothing
  async _draw() {

    //const notesLayer = canvas.notes;
    this.zIndex = canvas.notes.zIndex + 1;
    
    this.pinsContainer = new PIXI.Container();
    this.pinsContainer.sortableChildren = true;
    this.pinsContainer.zIndex = 1;

    this.addChild(this.pinsContainer);
    //notesLayer.addChild(this.pinsContainer);

    canvas.primary.sortChildren();

    this._setupUpdateLoop();
    return this;
  }

  _setupUpdateLoop() {
     if (this._updateHook) return;
    this._updateHook = Hooks.on("refreshToken", () => this._refreshPins());
    this._updateHookNote = Hooks.on("refreshNote", () => this._refreshPins());
  }

  _refreshPins() {
    for (const pin of this.pins.values()) {
    pin.update();
    }
  }

  clearPins() {
    for (const pin of this.pins.values()) {
      pin.destroy();
    }
    this.pins.clear();
  }

  initializePins() {

    for (const token of canvas.tokens.placeables) this.addPin(token);
    for (const note of canvas.notes.placeables) this.addPin(note);

    console.log("Red Thread | Initializing pins",
        canvas.tokens.placeables.length,
        canvas.notes.placeables.length
    )
  }

  addPin(placeable) {
    if (!placeable?.id) return;
    if (this.pins.has(placeable.id)) return;

    const pin = new Pin(placeable, this.pinsContainer);
    this.pins.set(placeable.id, pin);
  }

  updatePin(placeable) {
    const pin = this.pins.get(placeable.id);

    // If it doesn't exist, create it (handles edge case of late-added placables)
    if (!pin) {
      this.addPin(placeable);
      return;
    }

    pin.update();
  }

  removePin(placeable){
    const pin = this.pins.get(placeable.id);
    if (!pin) return;

    pin.destroy();
    this.pins.delete(placeable.id);
  }

// Listeners

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
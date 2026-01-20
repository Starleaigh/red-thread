/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

export class Pin {
  constructor(placeable, container) {
    this.placeable = placeable;
    this.graphics = new PIXI.Graphics();
    container.addChild(this.graphics);
    this.graphics.zIndex = 1;

    this.visible = true;
    this.color = 0xff0000;
    this.update();
  }

  get position() {
    return this.placeable.center;
  }

  update() {
    this.graphics.clear();
    if (!this.visible) return;

    this.graphics.beginFill(this.color);
    this.graphics.drawCircle(this.position.x, this.position.y, 6);
    this.graphics.endFill();
  }

  destroy() {
    this.graphics.destroy();
  }
}
/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

import { initSheetPin, teardownSheetPin } from "../../canvas/sheet-pin.js";

export class EvidenceSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static PARTS = {
    main:{
      template: "./systems/red-thread/system/actors/templates/evidence-sheet.hbs"
    }
  }

  static DEFAULT_OPTIONS = {
    tag: "div",
    classes: ["red-thread", "evidence-sheet"],
    template: "./systems/red-thread/system/actors/templates/evidence-sheet.hbs",
    submitOnChange: false,
    closeOnSubmit: false,
    resizeable: true,
    actions: {
      edit: function _onEdit(event) {this.unlockSheet()},
      submit: function _onSubmit(event){this.submit()}
    }
  };
  
  typingInterval = null;
  typingTimeout = null;
  lastValues = {};

  // ── Sheet Pin ────────────────────────────────────────────

  async _onRender(context, options) {
    await super._onRender(context, options);
    initSheetPin(this);
  }

  async close(options = {}) {
    teardownSheetPin(this);
    return super.close(options);
  }

  // ─────────────────────────────────────────────────────────
  //  Everything below is unchanged from your original file
  // ─────────────────────────────────────────────────────────

  get lock() {
    return this.actor.system.editLock ?? null;
  }

  get isLocked() {
    return !!this.lock?.userId;
  }

  get isLockOwner() {
    return this.lock?.userId === game.user.id;
  }

  async _prepareContext() {
    return {
      actor: this.actor,
      system: this.actor.system,
      isLocked: this.isLocked,
      isLockOwner: this.isLockOwner,
      lockUser: this.lock?.username ?? null
    };
  }

  async unlockSheet() {
    if (this.isLocked && !this.isLockOwner) return;
    await this.actor.update({
      "system.editLock": {
        userId: game.user.id,
        username: game.user.name,
        timestamp: Date.now()
      }
    });
    return;
  }

  async _readSheetData(event) {
    if (!this.isLockOwner) return;
    if(!(this.element instanceof HTMLElement)) return {};
    const data = {};
    this.element.querySelectorAll("[data-field]").forEach(el => {
      data[el.dataset.field] = el.value;
    });
    return data;
  }

  async _writeSheetData(data) {
    if (!this.isLockOwner) return;
    const update = {};
    for (const [k, v] of Object.entries(data)) {
      update[`system.${k}`] = v;
    }
    return update;
  }

  async submit(event) {
    if (!this.isLockOwner) return;
    const data = await this._readSheetData();
    const update = await this._writeSheetData(data);
    await this.actor.update(update);
    await this.lockSheet();
  }

  async lockSheet() {
    if (!this.isLockOwner) return;
    await this.actor.update({ "system.editLock": null });
    this.render({ force: true });
  }
}

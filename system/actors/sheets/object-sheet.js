/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

import { initSheetPin, teardownSheetPin } from "../../canvas/sheet-pin.js";

export class ObjectSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static PARTS = {
    main:{
      template: "./systems/red-thread/system/actors/templates/object-sheet.hbs"
    }
  }

  static DEFAULT_OPTIONS = {
    tag: "div",
    classes: ["red-thread", "object-sheet"],
    template: "./systems/red-thread/system/actors/templates/object-sheet.hbs",
    submitOnChange: false,
    closeOnSubmit: false,
    resizable: true,
    actions: {
      edit: function _onEdit(_event) {this.unlockSheet()},
      submit: function _onSubmit(_event){this.submit()}
    }
  };
  
  // ── Active tab ────────────────────────────────────────────

  _activeTab = "details";

  _applyTab(tab) {
    this.element.querySelectorAll(".ob-tab").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    this.element.querySelectorAll(".ob-tab-panel").forEach(panel => {
      panel.classList.toggle("ob-tab-panel--hidden", panel.dataset.panel !== tab);
    });
  }

  // ── Sheet Pin ────────────────────────────────────────────

  async _onRender(context, options) {
    await super._onRender(context, options);
    initSheetPin(this);

    // Apply active tab and wire tab buttons
    this._applyTab(this._activeTab);
    this.element.querySelectorAll(".ob-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._activeTab = btn.dataset.tab;
        this._applyTab(this._activeTab);
      });
    });
  }

  async close(options = {}) {
    teardownSheetPin(this);
    return super.close(options);
  }

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
    const sys = this.actor.system;

    // Resolve carriedBy → actor name
    const carrier = sys.carriedBy ? game.actors.get(sys.carriedBy) : null;
    const carriedByName = carrier?.name ?? null;

    // Determine state label/key for badge
    let stateKey, stateLabel;
    if (carriedByName) {
      stateKey   = "carried";
      stateLabel = `Held by ${carriedByName}`;
    } else if (sys.inPartyInventory) {
      stateKey   = "box";
      stateLabel = "Evidence Box";
    } else {
      stateKey   = "field";
      stateLabel = "In the Field";
    }

    // Format chain of custody entries
    const ACTION_LABELS = {
      picked_up:   "Picked up by",
      dropped:     "Dropped by",
      transferred: "Transferred to",
      recovered:   "Recovered by",
    };
    const chainOfCustody = (sys.chainOfCustody ?? []).map(entry => ({
      ...entry,
      actionLabel: ACTION_LABELS[entry.action] ?? entry.action,
      timeLabel:   entry.timestamp
        ? new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
        : "",
    }));

    const CATEGORIES = ["weapon", "clue", "document", "key", "artefact", "other"];
    const categories = CATEGORIES.map(v => ({
      value:    v,
      label:    v.charAt(0).toUpperCase() + v.slice(1),
      selected: sys.category === v,
    }));

    return {
      actor:         this.actor,
      system:        sys,
      isLocked:      this.isLocked,
      isLockOwner:   this.isLockOwner,
      lockUser:      this.lock?.username ?? null,
      isGM:          game.user.isGM,
      carriedByName,
      stateKey,
      stateLabel,
      chainOfCustody,
      categories,
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

  async _readSheetData() {
    if (!this.isLockOwner) return;
    if (!(this.element instanceof HTMLElement)) return {};
    const data = {};
    this.element.querySelectorAll("[data-field]").forEach(el => {
      if (el.type === "checkbox") {
        data[el.dataset.field] = el.checked;
      } else {
        data[el.dataset.field] = el.value;
      }
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

  async submit() {
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

/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class EvidenceBox extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "rt-evidence-box",
    tag: "div",
    classes: ["red-thread", "evidence-box"],
    window: { title: "Evidence Box", icon: "fas fa-box-archive" },
    position: { width: 420, height: 500 },
    resizable: true,
    actions: {
      takeItem:    EvidenceBox._onTakeItem,
      examineItem: EvidenceBox._onExamineItem,
      destroyItem: EvidenceBox._onDestroyItem,
    }
  };

  static PARTS = {
    main: {
      template: "./systems/red-thread/system/actors/templates/evidence-box.hbs"
    }
  };

  // ── Singleton — one instance per session ──────────────────

  static _instance = null;

  static open() {
    if (!EvidenceBox._instance || EvidenceBox._instance._state < 1) {
      EvidenceBox._instance = new EvidenceBox();
    }
    EvidenceBox._instance.render(true);
    return EvidenceBox._instance;
  }

  // ── Context ───────────────────────────────────────────────

  async _prepareContext() {
    const items = (game.actors ?? [])
      .filter(a => a.type === "object" && a.system.inPartyInventory)
      .map(a => ({
        id:       a.id,
        name:     a.name,
        img:      a.img,
        category: a.system.category ?? "other",
      }));

    const myInvestigators = (game.actors ?? [])
      .filter(a => a.type === "investigator" && a.isOwner)
      .map(a => ({ id: a.id, name: a.name }));

    return { items, myInvestigators, isGM: game.user.isGM };
  }

  // ── Actions ───────────────────────────────────────────────

  static async _onTakeItem(_event, target) {
    const objectId       = target.dataset.objectId;
    const select         = target.closest(".eb-row")?.querySelector(".eb-take-select");
    const investigatorId = select?.value;
    if (!objectId || !investigatorId) return;

    const object       = game.actors.get(objectId);
    const investigator = game.actors.get(investigatorId);
    if (!object || !investigator) return;

    if (object.system.carriedBy && object.system.carriedBy !== investigatorId) {
      const carrier = game.actors.get(object.system.carriedBy);
      ui.notifications.warn(`${object.name} is already carried by ${carrier?.name ?? "someone"}.`);
      return;
    }

    const entry = {
      actorId:   investigator.id,
      actorName: investigator.name,
      timestamp: Date.now(),
      action:    "picked_up",
    };

    await object.update({
      "system.carriedBy":        investigator.id,
      "system.inPartyInventory": false,
      "system.chainOfCustody":   [...(object.system.chainOfCustody ?? []), entry],
    });

    this.render();
  }

  static async _onExamineItem(_event, target) {
    const object = game.actors.get(target.dataset.objectId);
    if (!object) return;
    object.sheet.render(true);
  }

  static async _onDestroyItem(_event, target) {
    if (!game.user.isGM) return;
    const object = game.actors.get(target.dataset.objectId);
    if (!object) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Destroy Object" },
      content: `<p>Permanently delete <strong>${object.name}</strong>? This cannot be undone.</p>`,
    });
    if (!confirmed) return;

    await object.delete();
    this.render();
  }
}

/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class LostAndFound extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "rt-lost-and-found",
    tag: "div",
    classes: ["red-thread", "lost-and-found"],
    window: { title: "Lost and Found", icon: "fas fa-question-circle" },
    position: { width: 420, height: 480 },
    resizable: true,
    actions: {
      recoverToBox:          LostAndFound._onRecoverToBox,
      recoverToInvestigator: LostAndFound._onRecoverToInvestigator,
      examineItem:           LostAndFound._onExamineItem,
      destroyItem:           LostAndFound._onDestroyItem,
    }
  };

  static PARTS = {
    main: {
      template: "./systems/red-thread/system/actors/templates/lost-and-found.hbs"
    }
  };

  // ── Singleton ─────────────────────────────────────────────

  static _instance = null;

  static open() {
    if (!LostAndFound._instance || !LostAndFound._instance.rendered) {
      LostAndFound._instance = new LostAndFound();
    }
    LostAndFound._instance.render(true);
    return LostAndFound._instance;
  }

  // ── Context ───────────────────────────────────────────────

  async _prepareContext() {
    const items = (game.actors ?? [])
      .filter(a => a.type === "object" && a.system.inLostAndFound)
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

  /** Move item to Evidence Box (inPartyInventory) */
  static async _onRecoverToBox(_event, target) {
    const object = game.actors.get(target.dataset.objectId);
    if (!object) return;

    const entry = {
      actorId:   game.user.id,
      actorName: game.user.name,
      timestamp: Date.now(),
      action:    "recovered",
    };

    await object.update({
      "system.inLostAndFound":   false,
      "system.inPartyInventory": true,
      "system.carriedBy":        null,
      "system.chainOfCustody":   [...(object.system.chainOfCustody ?? []), entry],
    });

    // Refresh the Evidence Box if open
    const { EvidenceBox } = game.redThread;
    if (EvidenceBox._instance?.rendered) EvidenceBox._instance.render();
    this.render();
  }

  /** Move item directly to an investigator's inventory */
  static async _onRecoverToInvestigator(_event, target) {
    const objectId       = target.dataset.objectId;
    const select         = target.closest(".lf-row")?.querySelector(".lf-inv-select");
    const investigatorId = select?.value;
    if (!objectId || !investigatorId) return;

    const object       = game.actors.get(objectId);
    const investigator = game.actors.get(investigatorId);
    if (!object || !investigator) return;

    const entry = {
      actorId:   investigator.id,
      actorName: investigator.name,
      timestamp: Date.now(),
      action:    "recovered",
    };

    await object.update({
      "system.inLostAndFound":   false,
      "system.inPartyInventory": false,
      "system.carriedBy":        investigator.id,
      "system.chainOfCustody":   [...(object.system.chainOfCustody ?? []), entry],
    });

    const sheet = investigator.sheet;
    if (sheet?.rendered) sheet.render({ parts: ["content"] });
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

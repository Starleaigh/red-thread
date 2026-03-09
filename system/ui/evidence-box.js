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
      takeItem:       EvidenceBox._onTakeItem,
      examineItem:    EvidenceBox._onExamineItem,
      archiveItem:    EvidenceBox._onArchiveItem,
      openLostAndFound: EvidenceBox._onOpenLostAndFound,
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
    if (!EvidenceBox._instance || !EvidenceBox._instance.rendered) {
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

    const lostCount = (game.actors ?? [])
      .filter(a => a.type === "object" && a.system.inLostAndFound).length;

    return { items, myInvestigators, isGM: game.user.isGM, lostCount };
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

    // Re-render the target investigator's sheet if it's open
    const targetSheet = game.actors.get(investigatorId)?.sheet;
    if (targetSheet?.rendered) targetSheet.render({ parts: ["content"] });
    this.render();
  }

  static async _onExamineItem(_event, target) {
    const object = game.actors.get(target.dataset.objectId);
    if (!object) return;
    object.sheet.render(true);
  }

  /** Archive to Lost and Found instead of permanent delete.
   *  True permanent delete is available from the Lost and Found window. */
  static async _onArchiveItem(_event, target) {
    if (!game.user.isGM) return;
    const object = game.actors.get(target.dataset.objectId);
    if (!object) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Remove from Evidence Box" },
      content: `<p>Remove <strong>${object.name}</strong> from the Evidence Box? It will be moved to Lost &amp; Found.</p>`,
    });
    if (!confirmed) return;

    await object.update({
      "system.inPartyInventory": false,
      "system.inLostAndFound":   true,
    });

    // Refresh Lost and Found if open
    const lf = game.redThread?.LostAndFound;
    if (lf?._instance?.rendered) lf._instance.render();
    this.render();
  }

  static _onOpenLostAndFound(_event, _target) {
    game.redThread?.LostAndFound?.open();
  }
}

/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

export class EvidenceSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["red-thread", "sheet", "evidence"],
      template: "systems/red-thread/templates/actors/evidence-sheet.hbs",
      width: 420,
      height: 380
    });
  }

  getData() {
    const context = super.getData();
    context.system = this.actor.system;
    return context;
  }
}

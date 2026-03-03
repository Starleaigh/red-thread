/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { InvestigatorDataModel } from "./actors/models/cthulhu-investigator-data-model.mjs";
import { CthulhuSkillDataModel } from "./items/models/cthulhu-skills-data-model.mjs";

import { EvidenceSheet } from "./actors/sheets/evidence-sheet.js";
import { InvestigatorSheet } from "./actors/sheets/investigator-sheet.js";
import { CthulhuItem } from "./items/cthulhu-items.js";

// Red Thread systems
import "./scene/scene-type.js";
import { RedThreadLayer } from "./canvas/redThreadLayer.js";
import { initThreadSocket } from "./canvas/thread-store.js";

Hooks.once("init", () => {
  console.log("Red Thread | Initializing system");

  // Register Data Models
  CONFIG.Actor.dataModels.investigator = InvestigatorDataModel;
  CONFIG.Item.dataModels.skill = CthulhuSkillDataModel;

  // Register Item Document Class
  CONFIG.Item.documentClass = Item;
  CONFIG.Item.documentClass = CthulhuItem;

  // Register sheets
  foundry.documents.collections.Actors.registerSheet("red-thread", EvidenceSheet, { types: ["evidence"], makeDefault: true });
  foundry.documents.collections.Actors.registerSheet("red-thread", InvestigatorSheet, { types: ["investigator"], makeDefault: true });

  // ── Register the Red Thread canvas layer ──────────────────
  CONFIG.Canvas.layers.redThread = {
    layerClass: RedThreadLayer,
    group: "interface"
  };
});

// ── Initialise socket once the game is ready ──────────────────
// Must be in "ready" not "init" — sockets aren't available until
// all clients have finished loading
Hooks.once("ready", () => {
  initThreadSocket();
});

Hooks.on("preRenderActorSheet", () => console.trace("RENDER TRIGGERED"));

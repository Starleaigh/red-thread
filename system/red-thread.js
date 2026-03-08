/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { InvestigatorDataModel } from "./actors/models/cthulhu-investigator-data-model.mjs";
import { ObjectDataModel } from "./actors/models/object-data-model.mjs";
import { CthulhuSkillDataModel } from "./items/models/cthulhu-skills-data-model.mjs";

import { ObjectSheet } from "./actors/sheets/object-sheet.js";
import { InvestigatorSheet } from "./actors/sheets/investigator-sheet.js";
import { CthulhuItem } from "./items/cthulhu-items.js";

// Red Thread systems
import "./scene/scene-type.js";
import { RedThreadLayer } from "./canvas/redThreadLayer.js";
import { initSocket } from "./canvas/socket.js";
import { initThreadHandlers } from "./canvas/thread-store.js";
import { initTokenMovement } from "./canvas/token-movement.js";

Hooks.once("init", () => {
  console.log("Red Thread | Initializing system");

  // Register Data Models
  CONFIG.Actor.dataModels.investigator = InvestigatorDataModel;
  CONFIG.Actor.dataModels.object = ObjectDataModel;
  CONFIG.Item.dataModels.skill = CthulhuSkillDataModel;

  // Register Item Document Class
  CONFIG.Item.documentClass = CthulhuItem;

  // Register sheets
  foundry.documents.collections.Actors.registerSheet("red-thread", ObjectSheet, { types: ["object"], makeDefault: true });
  foundry.documents.collections.Actors.registerSheet("red-thread", InvestigatorSheet, { types: ["investigator"], makeDefault: true });

  // Register canvas layer
  CONFIG.Canvas.layers.redThread = {
    layerClass: RedThreadLayer,
    group: "interface"
  };
});

Hooks.once("ready", () => {
  // Initialise central socket first — handlers register against it
  initSocket();

  // Register domain handlers
  initThreadHandlers();
  initTokenMovement();
});

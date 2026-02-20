/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { InvestigatorDataModel } from "./actors/models/cthulhu-investigator-data-model.mjs";
import { CthulhuSkillDataModel } from "./items/models/cthulhu-skills-data-model.mjs";

import { EvidenceSheet } from "./actors/sheets/evidence-sheet.js";
import { InvestigatorSheet } from "./actors/sheets/investigator-sheet.js";
import { CthulhuItem } from "./items/cthulhu-items.js";

Hooks.once("init", () => {
  console.log("Red Thread | Initializing system");

    // Register Data Models
  CONFIG.Actor.dataModels.investigator = InvestigatorDataModel;
  CONFIG.Item.dataModels.skill = CthulhuSkillDataModel;

  // ✅ Register Item Document Class
  CONFIG.Item.documentClass = Item;
  CONFIG.Item.documentClass = CthulhuItem;

  // Register sheets
 // foundry.documents.collections.Actors.unregisterSheet("core", ActorSheet);
  foundry.documents.collections.Actors.registerSheet("red-thread", EvidenceSheet, { types: ["evidence"], makeDefault: true });
  foundry.documents.collections.Actors.registerSheet("red-thread", InvestigatorSheet, { types: ["investigator"], makeDefault: true });

 
});


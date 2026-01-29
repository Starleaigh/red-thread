/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />


import { EvidenceSheet } from "./actors/evidence-sheet.js";
import { InvestigatorSheet } from "./actors/investigator-sheet.js";

Hooks.once("init", () => {
  console.log("Red Thread | Initializing system");

  // Register sheets
 // foundry.documents.collections.Actors.unregisterSheet("core", ActorSheet);
  foundry.documents.collections.Actors.registerSheet("red-thread", EvidenceSheet, { types: ["evidence"], makeDefault: true });
  foundry.documents.collections.Actors.registerSheet("red-thread", InvestigatorSheet, { types: ["investigator"], makeDefault: true });
 
});


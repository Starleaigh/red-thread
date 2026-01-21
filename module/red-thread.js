
import { EvidenceSheet } from "./actors/evidence-sheet.js";

Hooks.once("init", () => {
  console.log("Red Thread | Initializing system");

  // Register sheets
  // Actors.unregisterSheet("core", ActorSheet);
 
 foundry.documents.collections.Actors.registerSheet("red-thread", EvidenceSheet, { types: ["evidence"], makeDefault: true });
 // game.actors.registerSheet("red-thread", EvidenceSheet, { types: ["evidence"], makeDefault: true, label: "Evidence Template" });
 
});
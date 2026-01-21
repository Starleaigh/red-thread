
import { RedThreadActor } from "./actors/red-thread-actor.js";
import { EvidenceSheet } from "./actors/evidence-sheet.js";

Hooks.once("init", () => {
  console.log("Red Thread | Initializing system");
/*
  CONFIG.Actor.documentClass = RedThreadActor;
  
  CONFIG.Actor.typeLabels = {
  evidence: "Evidence",
  poi: "Person of Interest",
  casefile: "Casefile",
  investigator: "Investigator"
};
*/
//  CONFIG.Actor.types = ["evidence", "poi", "casefile", "investigator"];


  // Register sheets
  // Actors.unregisterSheet("core", ActorSheet);
 // Actors.registerSheet("red-thread", InvestigatorSheet, { types: ["investigator"], makeDefault: true });
 // Actors.registerSheet("red-thread", PersonsSheet, { types: ["poi"], makeDefault: true });
 foundry.documents.collections.Actors.registerSheet("red-thread", EvidenceSheet, {
  types: ["evidence"],
  MakeDefault: true
 });
 // game.actors.registerSheet("red-thread", EvidenceSheet, { types: ["evidence"], makeDefault: true, label: "Evidence Template" });
 // Actors.registerSheet("red-thread", CasefileSheet, { types: ["casefile"], makeDefault: true });

  // game.system.actorTypes = CONFIG.Actor.types;

  console.log("Red Thread | CONFIG Actor Types: ", CONFIG.Actor.types);
  console.log("Red Thread | CONFIG Actor Labels: ", CONFIG.Actor.typeLabels);
  console.log("Red Thread | CONFIG Actor Metadata ", CONFIG.Actor.documentClass.metadata);
});
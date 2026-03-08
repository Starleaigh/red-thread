/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { InvestigatorDataModel } from "./actors/models/cthulhu-investigator-data-model.mjs";
import { ObjectDataModel } from "./actors/models/object-data-model.mjs";
import { CthulhuSkillDataModel } from "./items/models/cthulhu-skills-data-model.mjs";

import { ObjectSheet } from "./actors/sheets/object-sheet.js";
import { InvestigatorSheet } from "./actors/sheets/investigator-sheet.js";
import { CthulhuItem } from "./items/cthulhu-items.js";
import { EvidenceBox } from "./ui/evidence-box.js";

// Red Thread systems
import "./scene/scene-type.js";
import { isCaseboard } from "./scene/scene-type.js";
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

  // Expose Evidence Box globally so it can be opened from macros
  game.redThread = game.redThread ?? {};
  game.redThread.EvidenceBox = EvidenceBox;
});

// ── Token right-click: "Pick Up" ──────────────────────────
//
// Adds a "Pick Up" option to the token context menu on
// theatre / battlemap scenes. Assigns the Object actor to
// the player's first owned investigator.
//
// NOTE: This works directly for GMs. For players who don't
// own the Object actor, this needs routing through the GM
// relay socket (same pattern as token-movement.js). TODO.

Hooks.on("getTokenContextOptions", (token, options) => {
  if (isCaseboard(canvas.scene)) return;

  const actor = token.document?.actor;
  if (!actor || actor.type !== "object") return;

  options.push({
    name: "Pick Up",
    icon: '<i class="fas fa-hand-paper"></i>',
    condition: () => !actor.system.carriedBy,
    callback: async () => {
      const investigators = (game.actors ?? []).filter(
        a => a.type === "investigator" && a.isOwner
      );

      if (!investigators.length) {
        ui.notifications.warn("You have no investigator to assign this item to.");
        return;
      }

      // If player owns multiple investigators, pick the first for now.
      // TODO: show a picker dialog when multiple investigators exist.
      const investigator = investigators[0];

      const entry = {
        actorId:   investigator.id,
        actorName: investigator.name,
        timestamp: Date.now(),
        action:    "picked_up",
      };

      await actor.update({
        "system.carriedBy":        investigator.id,
        "system.inPartyInventory": false,
        "system.chainOfCustody":   [...(actor.system.chainOfCustody ?? []), entry],
      });

      ui.notifications.info(`${actor.name} picked up by ${investigator.name}.`);
    }
  });
});

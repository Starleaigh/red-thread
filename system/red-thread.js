/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { InvestigatorDataModel } from "./actors/models/cthulhu-investigator-data-model.mjs";
import { ObjectDataModel } from "./actors/models/object-data-model.mjs";
import { CthulhuSkillDataModel } from "./items/models/cthulhu-skills-data-model.mjs";

import { ObjectSheet } from "./actors/sheets/object-sheet.js";
import { InvestigatorSheet } from "./actors/sheets/investigator-sheet.js";
import { CthulhuItem } from "./items/cthulhu-items.js";
import { EvidenceBox } from "./ui/evidence-box.js";
import { LostAndFound } from "./ui/lost-and-found.js";

// Red Thread systems
import "./scene/scene-type.js";
import { isCaseboard } from "./scene/scene-type.js";
import { RedThreadLayer } from "./canvas/redThreadLayer.js";
import { RedThreadBgLayer, applyThreadsLayerOrder } from "./canvas/redThreadBgLayer.js";
import { initSocket } from "./canvas/socket.js";
import { initThreadHandlers } from "./canvas/thread-store.js";
import { initTokenMovement } from "./canvas/token-movement.js";
import { initTokenAppearance } from "./canvas/token-appearance.js";
// ── Object actor: OWNER for all players ──────────────────────
//
// All players need OWNER on Object actors so they can right-click
// for the Token HUD and see the "Pick Up" button.  Dragging is
// blocked separately in token-movement.js (_canDrag patch) so
// ownership level alone does not allow physical movement.
// Blink movement is set so any accidental keyboard-key movement
// teleports rather than animates.

// ── Object token on caseboard: enforce 1×1 max before placement ──
//
// Proportional aspect-ratio correction happens async in createToken
// (token-appearance.js). This synchronous guard prevents any token
// larger than 1×1 from being placed on a caseboard to begin with.

Hooks.on("preCreateToken", (tokenDoc, _data, _options, _userId) => {
  if (!isCaseboard(canvas.scene)) return;
  if (tokenDoc.width <= 1 && tokenDoc.height <= 1) return;
  const scale = Math.max(tokenDoc.width, tokenDoc.height);
  tokenDoc.updateSource({
    width:  Math.round((tokenDoc.width  / scale) * 100) / 100,
    height: Math.round((tokenDoc.height / scale) * 100) / 100,
  });
});

Hooks.on("preCreateActor", (actorDoc, _data, _options, _userId) => {
  if (actorDoc.type !== "object") return;
  actorDoc.updateSource({
    "ownership.default":             CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    "prototypeToken.actorLink":      true,
    "prototypeToken.movementAction": "blink",
  });
});

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

  // Register thread layer setting
  game.settings.register("red-thread", "threadsBelow", {
    name: "Threads below tokens",
    hint: "Draw connecting threads beneath token photos rather than on top of them.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => applyThreadsLayerOrder(),
  });

  // Register canvas layers — bg layer (primary group) holds thread graphics;
  // interface layer holds pins so they remain interactive above tokens in both modes.
  CONFIG.Canvas.layers.redThreadBg = { layerClass: RedThreadBgLayer, group: "primary" };
  CONFIG.Canvas.layers.redThread   = { layerClass: RedThreadLayer,   group: "interface" };
});

Hooks.once("ready", () => {
  // Initialise central socket first — handlers register against it
  initSocket();

  // Register domain handlers
  initThreadHandlers();
  initTokenMovement();
  initTokenAppearance();

  // Expose globals for macro access
  game.redThread = game.redThread ?? {};
  game.redThread.EvidenceBox  = EvidenceBox;
  game.redThread.LostAndFound = LostAndFound;
});

// ── Token HUD: "Pick Up" button ───────────────────────────
//
// In Foundry V13, right-clicking a token opens the Token HUD
// (renderTokenHUD hook) — getTokenContextOptions no longer fires.
// We inject a "Pick Up" control-icon button into the HUD's left
// column when the token is an unclaimed Object actor on a
// theatre or battlemap scene.
//
// All players have OWNER on Object actors so this always uses
// the direct write path.

Hooks.on("renderTokenHUD", (hud, html, _data) => {
  if (isCaseboard(canvas.scene)) return;

  // Use the world actor (not a synthetic token copy) so updates persist
  const actor = game.actors.get(hud.object?.document?.actorId);
  if (!actor || actor.type !== "object") return;
  if (actor.system.carriedBy) return;

  // Players need at least one active investigator to see the Pick Up button
  if (!game.user.isGM) {
    const hasActive = (game.actors ?? []).some(
      a => a.type === "investigator" && a.isOwner && a.system.status === "active"
    );
    if (!hasActive) return;
  }

  const btn = document.createElement("div");
  btn.classList.add("control-icon");

  if (game.user.isGM) {
    btn.setAttribute("title", "Move to Lost and Found");
    btn.innerHTML = '<i class="fas fa-box-archive"></i>';
  } else {
    btn.setAttribute("title", "Pick Up");
    btn.innerHTML = '<i class="fas fa-hand-paper"></i>';
  }

  btn.addEventListener("click", async (event) => {
    event.preventDefault();

    if (game.user.isGM) {
      // GM: move directly to Lost and Found
      const entry = {
        actorId:   "GM",
        actorName: "GM",
        timestamp: Date.now(),
        action:    "recovered",
      };
      await actor.update({
        "system.inLostAndFound":   true,
        "system.inPartyInventory": false,
        "system.chainOfCustody":   [...(actor.system.chainOfCustody ?? []), entry],
      });
      await hud.object.document.delete();
      ui.notifications.info(`${actor.name} moved to Lost and Found.`);

    } else {
      // Player: assign to their active investigator
      const investigators = (game.actors ?? []).filter(
        a => a.type === "investigator" && a.isOwner && a.system.status === "active"
      );
      // TODO: show a picker dialog when multiple active investigators exist
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
        "system.inLostAndFound":   false,
        "system.chainOfCustody":   [...(actor.system.chainOfCustody ?? []), entry],
      });
      await hud.object.document.delete();
      if (investigator.sheet?.rendered) investigator.sheet.render({ parts: ["content"] });
      ui.notifications.info(`${actor.name} picked up by ${investigator.name}.`);
    }
  });

  const col = html.querySelector(".col.left") ?? html[0]?.querySelector(".col.left");
  col?.prepend(btn);
});

// ── Lost and Found: token deletion cleanup ────────────────
//
// When an Object actor's physical token is deleted from a
// non-caseboard scene, check whether the object is now fully
// stranded (no other physical tokens, not carried, not in any
// inventory). If so, move it to Lost and Found.
//
// "Physical token" excludes caseboard tokens, which are
// permanent evidence photos and don't indicate possession.

Hooks.on("deleteToken", (tokenDoc, _options, _userId) => {
  if (!game.user.isGM) return;
  if (isCaseboard(tokenDoc.parent)) return;

  const actor = game.actors.get(tokenDoc.actorId);
  if (!actor || actor.type !== "object") return;
  if (actor.system.carriedBy || actor.system.inPartyInventory || actor.system.inLostAndFound) return;

  // Check for remaining physical tokens on any non-caseboard scene
  const hasPhysicalToken = game.scenes.some(scene =>
    !isCaseboard(scene) &&
    scene.tokens.some(t => t.actorId === actor.id && t.id !== tokenDoc.id)
  );
  if (hasPhysicalToken) return;

  actor.update({ "system.inLostAndFound": true });

  // Refresh Lost and Found window if open
  if (LostAndFound._instance?.rendered) LostAndFound._instance.render();
});

// ── Lost and Found: scene deactivation cleanup ────────────
//
// When a theatre/battlemap scene is deactivated (another scene
// goes active), sweep its remaining Object tokens. Any that are
// unclaimed and have no other physical presence go to Lost and
// Found rather than being abandoned invisibly.

Hooks.on("updateScene", async (scene, changes) => {
  if (!game.user.isGM) return;
  if (!("active" in changes) || changes.active !== false) return;
  if (isCaseboard(scene)) return;

  let anyMoved = false;
  for (const tokenDoc of scene.tokens) {
    const actor = game.actors.get(tokenDoc.actorId);
    if (!actor || actor.type !== "object") continue;
    if (actor.system.carriedBy || actor.system.inPartyInventory || actor.system.inLostAndFound) continue;

    // Check for physical tokens on other scenes
    const hasPhysicalToken = game.scenes.some(s =>
      s.id !== scene.id &&
      !isCaseboard(s) &&
      s.tokens.some(t => t.actorId === actor.id)
    );
    if (hasPhysicalToken) continue;

    await actor.update({ "system.inLostAndFound": true });
    anyMoved = true;
  }

  if (anyMoved && LostAndFound._instance?.rendered) LostAndFound._instance.render();
});

// ── Object actor: live UI sync for all clients ────────────
//
// When an Object actor's inventory state changes (carriedBy,
// inPartyInventory, inLostAndFound), the change is written by
// whoever initiated it but all other clients need their open
// windows updated too.  This hook fires on every client and
// does targeted content-only re-renders — it never triggers
// a full shell re-render so the folder animation is safe.

Hooks.on("updateActor", (actorDoc, changes) => {
  const sys = changes.system ?? {};

  // Investigator status change → update stamp + refresh Evidence Box / L&F lists
  if (actorDoc.type === "investigator" && "status" in sys) {
    actorDoc.sheet?._updateStatusStamp?.();
    if (EvidenceBox._instance?.rendered)  EvidenceBox._instance.render();
    if (LostAndFound._instance?.rendered) LostAndFound._instance.render();
    return;
  }

  // Object inventory/equip change → re-render open investigator sheets + Evidence Box + L&F
  if (actorDoc.type !== "object") return;
  if (!("carriedBy" in sys || "inPartyInventory" in sys || "inLostAndFound" in sys || "equipped" in sys)) return;

  for (const actor of game.actors) {
    if (actor.type === "investigator" && actor.sheet?.rendered) {
      actor.sheet.render({ parts: ["content"] });
    }
  }

  if (EvidenceBox._instance?.rendered)  EvidenceBox._instance.render();
  if (LostAndFound._instance?.rendered) LostAndFound._instance.render();
});

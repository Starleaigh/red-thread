/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { isCaseboard } from "../scene/scene-type.js";
import { request, registerHandler } from "./socket.js";

// ─────────────────────────────────────────────────────────────
//  TOKEN MOVEMENT
//
//  On caseboard scenes, any player can drag any token
//  regardless of ownership. Position updates for unowned
//  tokens are relayed through the GM socket.
//
//  Multi-token drag is handled by splitting the selection:
//    - Owned tokens → normal Foundry update
//    - Unowned tokens → GM relay, one request per token
//
//  Call initTokenMovement() once in Hooks.once("ready").
// ─────────────────────────────────────────────────────────────

export function initTokenMovement() {

  // ── GM handler ────────────────────────────────────────────

  registerHandler("token.move", async (scene, { tokenId, x, y }) => {
    const tokenDoc = scene.tokens.get(tokenId);
    if (!tokenDoc) return null;
    await tokenDoc.update({ x, y });
    // No broadcast needed — Foundry's updateToken hook handles all clients
    return null;
  });

  // ── Patch Token prototype ─────────────────────────────────

  const TokenProto       = foundry.canvas.placeables.Token.prototype;
  const _origCanControl  = TokenProto._canControl;
  const _origCanDrag     = TokenProto._canDrag;
  const _origPrepareDrop = TokenProto._prepareDragLeftDropUpdates;

  // Allow any token to be controlled on caseboards
  TokenProto._canControl = function(user, event) {
    if (isCaseboard(canvas.scene)) {
      if (this.layer._draggedToken) return false;
      if (!this.layer.active || this.isPreview) return false;
      if (canvas.controls.ruler.active) return false;
      if (game.activeTool === "target") return true;
      return true;
    }
    return _origCanControl.call(this, user, event);
  };

  // Allow any token to be dragged on caseboards.
  // Block non-GM players from dragging Object actor tokens on
  // theatre/battlemap scenes — Pick Up via Token HUD is the
  // intended interaction there.
  TokenProto._canDrag = function(user, event) {
    if (isCaseboard(canvas.scene)) {
      if (this.layer._draggedToken) return false;
      if (!this.layer.active || this.isPreview) return false;
      return game.activeTool === "select";
    }
    if (!game.user.isGM) {
      const actor = game.actors.get(this.document?.actorId);
      if (actor?.type === "object") return false;
    }
    return _origCanDrag.call(this, user, event);
  };

  // Handle mixed owned/unowned multi-token drag
  TokenProto._prepareDragLeftDropUpdates = function(event) {
    if (!isCaseboard(canvas.scene)) {
      return _origPrepareDrop.call(this, event);
    }

    const { contexts } = event.interactionData;

    // Always allow preview clone cleanup
    event.interactionData.clearPreviewContainer = true;

    const ownedUpdates  = [];
    const ownedMovement = {};

    for (const [id, context] of Object.entries(contexts)) {
      if (context.foundPath.length <= 1) continue;

      const tokenDoc = canvas.scene.tokens.get(id);
      if (!tokenDoc) continue;

      if (tokenDoc.isOwner) {
        // Owned — include in normal Foundry update
        ownedUpdates.push({ _id: id });
        ownedMovement[id] = {
          waypoints:        context.foundPath.slice(1),
          method:           "dragging",
          constrainOptions: this._getDragConstrainOptions()
        };
      } else {
        // Unowned — relay final position to GM
        const waypoints = context.foundPath;
        const endpoint  = waypoints[waypoints.length - 1];
        let   position  = { x: endpoint.x, y: endpoint.y };

        if (!event.shiftKey) {
          position = canvas.tokens.getSnappedPoint(position);
        }

        request("token.move", canvas.scene.id, {
          tokenId: id,
          x:       position.x,
          y:       position.y
        });
      }
    }

    // No owned tokens in this drag — skip Foundry update entirely
    if (ownedUpdates.length === 0) return null;

    // Return only owned token updates for Foundry to commit
    return [ownedUpdates, { movement: ownedMovement }];
  };

  console.log("Red Thread | Token movement handlers registered.");
}
/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

// ─────────────────────────────────────────────────────────────
//  SCENE TYPE SYSTEM
//  Defines three scene modes: caseboard | theatre | battlemap
//  Stored as a scene flag: "red-thread.sceneType"
//  Injected into the existing Scene Config sheet as a dropdown
// ─────────────────────────────────────────────────────────────

export const SCENE_TYPES = {
  NONE:       "",
  CASEBOARD:  "caseboard",
  THEATRE:    "theatre",
  BATTLEMAP:  "battlemap"
};

export const SCENE_TYPE_LABELS = {
  [SCENE_TYPES.NONE]:      "— Default (Battlemap) —",
  [SCENE_TYPES.CASEBOARD]: "Caseboard",
  [SCENE_TYPES.THEATRE]:   "Theatre",
  [SCENE_TYPES.BATTLEMAP]: "Battlemap"
};

/**
 * Returns the Red Thread scene type for a given scene.
 * @param {Scene} scene
 * @returns {string} One of the SCENE_TYPES values, or "" if unset.
 */
export function getSceneType(scene) {
  return scene?.getFlag("red-thread", "sceneType") ?? SCENE_TYPES.NONE;
}

/**
 * Returns true if the given scene is a caseboard.
 * @param {Scene} scene
 * @returns {boolean}
 */
export function isCaseboard(scene) {
  return getSceneType(scene) === SCENE_TYPES.CASEBOARD;
}

// ─────────────────────────────────────────────────────────────
//  HOOK: Inject dropdown into Scene Config sheet
// ─────────────────────────────────────────────────────────────

Hooks.on("renderSceneConfig", (app, html, data) => {
  const scene = app.document;
  const currentType = getSceneType(scene);

  // Build the dropdown options
  const options = Object.entries(SCENE_TYPE_LABELS)
    .map(([value, label]) => {
      const selected = value === currentType ? "selected" : "";
      return `<option value="${value}" ${selected}>${label}</option>`;
    })
    .join("");

  // Build the injected field block, matching Foundry's scene config form style
  const fieldHTML = `
    <div class="form-group">
      <label>Scene Type <span class="units">(Red Thread)</span></label>
      <div class="form-fields">
        <select name="flags.red-thread.sceneType">
          ${options}
        </select>
      </div>
      <p class="hint">
        Caseboard enables pins and threads. Theatre enables stage features.
        Battlemap disables all Red Thread overlays.
      </p>
    </div>
  `;

  // Inject after the "Scene Name" field in the Basics tab
  // Target the first form-group (name field) and insert after it
  const basicTab = html.querySelector('.tab[data-tab="basics"]');
  if (!basicTab) {
    // Fallback: inject at top of form if tab structure differs
    const firstGroup = html.querySelector(".form-group");
    if (firstGroup) firstGroup.insertAdjacentHTML("afterend", fieldHTML);
    return;
  }

  const firstGroup = basicTab.querySelector(".form-group");
  if (firstGroup) {
    firstGroup.insertAdjacentHTML("afterend", fieldHTML);
  }
});

Hooks.on("canvasReady", () => {
  if (!isCaseboard(canvas.scene)) return;

  // Suppress per-token ruler on caseboard scenes
  const TokenProto = foundry.canvas.placeables.Token.prototype;

  if (!TokenProto._rtOriginalRefreshRuler) {
    TokenProto._rtOriginalRefreshRuler = TokenProto._refreshRuler;
  }

  TokenProto._refreshRuler = function() {
    if (isCaseboard(canvas.scene)) return;
    return TokenProto._rtOriginalRefreshRuler.call(this);
  };
});

// ─────────────────────────────────────────────────────────────
//  Allow all players to drag any token on caseboard scenes
// ─────────────────────────────────────────────────────────────

Hooks.on("init", () => {
  const TokenProto = foundry.canvas.placeables.Token.prototype;
  const _original  = TokenProto._canControl;

  TokenProto._canControl = function(user, event) {
    // On caseboards, allow control for drag purposes regardless of ownership
    if (isCaseboard(canvas.scene)) {
      if (this.layer._draggedToken) return false;
      if (!this.layer.active || this.isPreview) return false;
      if (canvas.controls.ruler.active) return false;
      if (game.activeTool === "target") return true;
      return true; // Allow all tokens to be controlled on caseboards
    }
    return _original.call(this, user, event);
  };

  // _canDrag also checks this.controlled so patch it too
  const _originalCanDrag = TokenProto._canDrag;

  TokenProto._canDrag = function(user, event) {
    if (isCaseboard(canvas.scene)) {
      if (this.layer._draggedToken) return false;
      if (!this.layer.active || this.isPreview) return false;
      return game.activeTool === "select";
    }
    return _originalCanDrag.call(this, user, event);
  };
});
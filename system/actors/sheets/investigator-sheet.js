/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

import { initSheetPin, teardownSheetPin } from "../../canvas/sheet-pin.js";
import { EvidenceBox } from "../../ui/evidence-box.js";
import { isCaseboard } from "../../scene/scene-type.js";

const BASE = "./systems/red-thread/system/actors/templates/investigator-sheet";

export class InvestigatorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  // ── PARTS ─────────────────────────────────────────────────
  //
  // shell  — folder structure, page wrappers, decorative elements.
  //          Rendered once on open. Never re-renders on data change.
  //
  // content — all dynamic data (profile fields, stats, skills, notes).
  //           Re-renders freely. _syncPartState preserves page classes.
  //           _injectPageContent() distributes rendered HTML into the
  //           correct .basePageLayout slots inside the shell.

  static PARTS = {
    shell:   { template: `${BASE}/shell.hbs`   },
    content: { template: `${BASE}/content.hbs` },
  };

  static DEFAULT_OPTIONS = {
    tag: "div",
    classes: ["red-thread", "investigator-sheet"],
    submitOnChange: false,
    closeOnSubmit: false,
    resizable: false,
    actions: {
      nextPage:        InvestigatorSheet._onNextPage,
      prevPage:        InvestigatorSheet._onPrevPage,
      closeFolder:     InvestigatorSheet._onCloseFolder,
      goToPage:        InvestigatorSheet._onGoToPage,
      changePortrait:  InvestigatorSheet.prototype._openPortraitDialog,
      deleteSkill:     InvestigatorSheet._onDeleteSkill,
      dropItem:        InvestigatorSheet._onDropItem,
      toPartyInventory: InvestigatorSheet._onToPartyInventory,
      examineItem:      InvestigatorSheet._onExamineItem,
      openEvidenceBox:  InvestigatorSheet._onOpenEvidenceBox,
    }
  };

  pageIndex    = 0;
  previousPage = 0;
  pageCount    = 9;
  isTurning    = false;

  // ── Render guard ─────────────────────────────────────────
  //
  // Actor._onCreateDescendantDocuments and _onDeleteDescendantDocuments
  // call actor.render() with no parts specified, triggering a full
  // re-render including the shell. We intercept here:
  //
  // - If the call has no parts (full re-render) AND it originates from
  //   a descendant document change (items), we downgrade it to a
  //   content-only render so the shell is never touched.
  //
  // - All other render calls (forced, first render, explicit) pass through.

  render(options = {}, _options = {}) {
    if (!options.force && !options.parts && this.rendered) {
      const stack = new Error().stack;
      if (
        stack.includes("_onCreateDescendantDocuments") ||
        stack.includes("_onDeleteDescendantDocuments") ||
        stack.includes("_onUpdateDescendantDocuments")
      ) {
        // Downgrade to content-only — shell stays untouched
        return super.render({ ...options, parts: ["content"] }, _options);
      }
    }
    return super.render(options, _options);
  }

  // ── Context ───────────────────────────────────────────────

  async _prepareContext() {
    const context = await super._prepareContext();
    const actor   = this.actor.isToken ? this.actor.baseActor : this.actor;
    const system  = actor.system.investigator;

    let portraitSrc = system.portrait;
    if (!portraitSrc) portraitSrc = system.defaultportrait;

    const STATUS_OPTIONS = ["active", "inactive", "deceased", "retired"];
    const statusOptions = STATUS_OPTIONS.map(v => ({
      value:    v,
      label:    v.charAt(0).toUpperCase() + v.slice(1),
      selected: this.actor.system.status === v,
    }));

    const allSkills = this._buildSkillsData().sort((a, b) => a.name.localeCompare(b.name));
    const mid = Math.ceil(allSkills.length / 2);

    return {
      ...context,
      actor:         this.actor,
      system:        this.actor.system,
      portraitSrc,
      skillsFront:   allSkills.slice(0, mid),
      skillsBack:    allSkills.slice(mid),
      inventory:     this._buildInventoryData(),
      weapons:       this._buildWeaponData(),
      statusOptions,
      statusStamp:   this.actor.system.status !== "active" ? this.actor.system.status : null,
    };
  }

  async _preparePartContext(_partId, context) {
    return context;
  }

  _buildSkillsData() {
    return this.actor.items.filter(i => i.type === "skill")
      .map(skill => ({
        id:          skill.id,
        name:        skill.name,
        base:        skill.system.base ?? 0,
        occupation:  skill.system.occupation ?? false,
        improvement: skill.system.improvement ?? false,
        value:       skill.value,
        half:        skill.half,
        fifth:       skill.fifth
      }));
  }

  _buildInventoryData() {
    if (!game.actors) return [];
    return game.actors
      .filter(a => a.type === "object" && a.system.carriedBy === this.actor.id)
      .map(a => ({
        id:       a.id,
        name:     a.name,
        img:      a.img,
        category: a.system.category ?? "other",
        isWeapon: a.system.isWeapon ?? false,
      }));
  }

  _buildWeaponData() {
    if (!game.actors) return [];
    return game.actors
      .filter(a => a.type === "object"
               && a.system.carriedBy === this.actor.id
               && a.system.isWeapon)
      .map(a => ({
        id:          a.id,
        name:        a.name,
        img:         a.img,
        skill:       a.system.weapon?.skill       ?? "",
        damage:      a.system.weapon?.damage      ?? "",
        range:       a.system.weapon?.range       ?? "",
        uses:        a.system.weapon?.uses        ?? "",
        malfunction: a.system.weapon?.malfunction ?? 100,
      }));
  }

  // ── Part state sync ───────────────────────────────────────
  //
  // Called by Foundry when a part re-renders in place.
  // We use it to re-inject content into the shell's page slots
  // after a data-driven re-render of the content part.

  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state);

    if (partId === "content" && priorElement) {
      this._injectPageContent(newElement);
      this._loadDerivedRows();
      this._bindFieldListeners();
    }
  }

  // ── Render ────────────────────────────────────────────────

  async _onRender(context, options) {
    await super._onRender(context, options);

    const isFullRender = !options.parts || options.parts.includes("shell");

    if (isFullRender) {
      this._injectPageContent();

      const folderShell = this.element.querySelector(".folder-shell");
      this._playAnimation(folderShell, "open-folder-trigger", "open-folder-trigger", "close-folder-trigger");
      foundry.audio.AudioHelper.play({
        src: "systems/red-thread/assets/sounds/folderflip.mp3",
        volume: 0.6
      }, true);

      this.element.querySelectorAll(".page").forEach(page => {
        if (!page.classList.contains("initialized")) {
          page.classList.add("initialized");
          page.querySelector(".back")?.classList.add("back-initialized");
        }
      });

      this._updatePageClasses();
      this._bindDragBehaviour();
      this._updateStatusStamp();
    }

    this._bindFieldListeners();
    this._loadDerivedRows();
    initSheetPin(this);
  }

  // ── Content injection ─────────────────────────────────────
  //
  // content.hbs renders <script type="text/x-handlebars-page"> blocks.
  // This method reads those blocks and moves their innerHTML into the
  // matching .basePageLayout slots in the shell.

  _injectPageContent(contentElement = null) {
    const part = contentElement
      ?? this.element.querySelector('[data-application-part="content"]');

    if (!part) return;

    // Blocks live inside .rt-content-store, which may be the part element
    // itself or a child of it depending on how Foundry wraps the part.
    const source = part.classList.contains("rt-content-store")
      ? part
      : (part.querySelector(".rt-content-store") ?? part);

    source.querySelectorAll("script[type='text/x-handlebars-page']").forEach(block => {
      const slot = this.element.querySelector(
        `.page[data-index="${block.dataset.page}"] .rt-page-${block.dataset.face} .basePageLayout`
      );
      if (slot) slot.innerHTML = block.innerHTML;
    });
  }

  // ── Page animation ────────────────────────────────────────

  _constrainPosition(position) {
    return position;
  }

  async _updatePageClasses() {
    this.element.querySelectorAll(".page").forEach(page => {
      if (page.classList.contains("is-turning")) return;
      page.classList.remove("past", "current", "future");
      const idx = Number(page.dataset.index);
      if (idx < this.pageIndex)        page.classList.add("past");
      else if (idx === this.pageIndex)  page.classList.add("current");
      else                              page.classList.add("future");
      if (!page.classList.contains("is-turning")) {
        page.style.zIndex = idx < this.pageIndex ? 10 + idx : 100 - idx;
      }
    });

    this.element.querySelectorAll(".page-tab[data-target-page]").forEach(tab => {
      tab.classList.toggle("active", Number(tab.dataset.targetPage) === this.pageIndex);
    });
  }

  static async _onNextPage(_event, _target) {
    if (this.isTurning) return;
    if (this.pageIndex >= this.pageCount - 1) return;
    const pages   = this.element.querySelectorAll(".page");
    const current = pages[this.pageIndex];
    if (!current) return;
    this.isTurning = true;
    playPageSound();
    this._playAnimation(current, "turn-forward", "turn-forward", "turn-backward");
    current.style.zIndex = 1000;
    setTimeout(() => { this.pageIndex++; this._updatePageClasses(); this.isTurning = false; }, 600);
  }

  static async _onPrevPage(_event, _target) {
    if (this.isTurning) return;
    if (this.pageIndex <= 0) return;
    const pages = this.element.querySelectorAll(".page");
    const prev  = pages[this.pageIndex - 1];
    if (!prev) return;
    this.isTurning = true;
    playPageSound();
    this._playAnimation(prev, "turn-backward", "turn-forward", "turn-backward");
    prev.style.zIndex = 1000;
    setTimeout(() => { this.pageIndex--; this._updatePageClasses(); this.isTurning = false; }, 600);
  }

  static async _onGoToPage(_event, target) {
    if (this.isTurning) return;
    const targetIndex = Number(target.dataset.targetPage);
    if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= this.pageCount) return;
    if (targetIndex === this.pageIndex) return;

    this.isTurning = true;
    const pages = [...this.element.querySelectorAll(".page")];
    const flipDuration = 80;

    let pagesToFlip;
    let animClass;

    if (targetIndex > this.pageIndex) {
      // Forward — flip each page from current toward target
      pagesToFlip = pages.slice(this.pageIndex, targetIndex);
      animClass = "turn-forward";
    } else {
      // Backward — flip pages back from just before current toward target
      pagesToFlip = pages.slice(targetIndex, this.pageIndex).reverse();
      animClass = "turn-backward";
    }

    pagesToFlip.forEach((page, i) => {
      setTimeout(() => {
        playPageSound();
        page.style.zIndex = 1000 + i;
        this._playAnimation(page, animClass, "turn-forward", "turn-backward");
      }, i * flipDuration);
    });

    const totalDuration = (pagesToFlip.length - 1) * flipDuration + 600;
    setTimeout(() => {
      this.pageIndex = targetIndex;
      this._updatePageClasses();
      this.isTurning = false;
    }, totalDuration);
  }

  // ── Drop handling ─────────────────────────────────────────
  //
  // Handles an Actor of type "object" being dropped onto the sheet.
  // Sets carriedBy to this investigator and logs chain of custody.
  // All other drop types fall through to the parent handler.

  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }

    // Resolve the actor from either a sidebar Actor drag or a canvas Token drag
    let object;
    if (data.type === "Actor") {
      object = await fromUuid(data.uuid);
    } else if (data.type === "Token") {
      const tokenDoc = await fromUuid(data.uuid);
      // Use world actor (not synthetic token copy) so updates persist
      object = game.actors.get(tokenDoc?.actorId) ?? tokenDoc?.actor;
    } else {
      return super._onDrop(event);
    }

    if (!object || object.type !== "object") return super._onDrop(event);

    // Prevent claiming something already carried by someone else
    if (object.system.carriedBy && object.system.carriedBy !== this.actor.id) {
      const carrier = game.actors.get(object.system.carriedBy);
      const name = carrier?.name ?? "another investigator";
      ui.notifications.warn(`${object.name} is already carried by ${name}.`);
      return;
    }

    const entry = {
      actorId:   this.actor.id,
      actorName: this.actor.name,
      timestamp: Date.now(),
      action:    "picked_up",
    };

    await object.update({
      "system.carriedBy":        this.actor.id,
      "system.inPartyInventory": false,
      "system.inLostAndFound":   false,
      "system.chainOfCustody":   [...(object.system.chainOfCustody ?? []), entry],
    });

    this.render({ parts: ["content"] });
  }

  // ── Inventory actions ─────────────────────────────────────

  static async _onDropItem(_event, target) {
    // Dropping physical items makes no sense on a caseboard (evidence photo board)
    if (isCaseboard(canvas.scene)) {
      ui.notifications.warn("You can't drop items on a caseboard scene.");
      return;
    }

    const objectId = target.dataset.objectId;
    if (!objectId) return;
    const object = game.actors.get(objectId);
    if (!object) return;

    const entry = {
      actorId:   this.actor.id,
      actorName: this.actor.name,
      timestamp: Date.now(),
      action:    "dropped",
    };

    await object.update({
      "system.carriedBy":      null,
      "system.chainOfCustody": [...(object.system.chainOfCustody ?? []), entry],
    });

    // If we're on a theatre/battlemap scene and the object has no token here,
    // place one at the centre of the viewport so the dropped item appears in the world.
    const scene = canvas.scene;
    if (scene) {
      const alreadyHere = scene.tokens.some(t => t.actorId === objectId);
      if (!alreadyHere) {
        const { x, y } = canvas.scene.dimensions.sceneRect;
        const w = canvas.scene.dimensions.sceneWidth;
        const h = canvas.scene.dimensions.sceneHeight;
        await scene.createEmbeddedDocuments("Token", [{
          actorId: objectId,
          name:    object.name,
          x:       x + w / 2,
          y:       y + h / 2,
          texture: { src: object.img },
        }]);
      }
    }

    if (EvidenceBox._instance?.rendered) EvidenceBox._instance.render();
    this.render({ parts: ["content"] });
  }

  static async _onToPartyInventory(_event, target) {
    const objectId = target.dataset.objectId;
    if (!objectId) return;
    const object = game.actors.get(objectId);
    if (!object) return;

    const entry = {
      actorId:   this.actor.id,
      actorName: this.actor.name,
      timestamp: Date.now(),
      action:    "recovered",
    };

    await object.update({
      "system.carriedBy":        null,
      "system.inPartyInventory": true,
      "system.chainOfCustody":   [...(object.system.chainOfCustody ?? []), entry],
    });

    if (EvidenceBox._instance?.rendered) EvidenceBox._instance.render();
    this.render({ parts: ["content"] });
  }

  static async _onExamineItem(_event, target) {
    const objectId = target.dataset.objectId;
    if (!objectId) return;
    const object = game.actors.get(objectId);
    if (!object) return;
    object.sheet.render(true);
  }

  static _onOpenEvidenceBox(_event, _target) {
    EvidenceBox.open();
  }

  static async _onDeleteSkill(_event, target) {
    const itemId = target.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    // Remove the row from the DOM immediately — no flicker, no wait
    target.closest(".skill")?.remove();

    // Delete from the data model with render suppressed
    await item.delete({ render: false });
  }

  _playAnimation(el, className, rem1, rem2) {
    el.classList.add("no-transition");
    el.classList.remove(rem1, rem2);
    void el.offsetWidth;
    el.classList.remove("no-transition");
    el.classList.add(className);
  }

  // ── Drag behaviour ────────────────────────────────────────

  _bindDragBehaviour() {
    const sheet = this.element;
    const SCALE = 0.2;
    let dragging = false;
    let tinyDrag = false;
    let grabOffset      = { x: 0, y: 0 };
    let transformOrigin = { x: "50%", y: "50%" };

    sheet.addEventListener("contextmenu", e => e.preventDefault());

    sheet.addEventListener("pointerdown", e => {
      if (!e.target.classList.contains("draggable")) return;
      if (e.pointerType !== "mouse") return;
      dragging = true;
      tinyDrag = e.button === 2;
      sheet.setPointerCapture(e.pointerId);
      const rect = sheet.getBoundingClientRect();
      grabOffset.x = e.clientX - rect.left;
      grabOffset.y = e.clientY - rect.top;
      transformOrigin.x = `${(grabOffset.x / rect.width)  * 100}%`;
      transformOrigin.y = `${(grabOffset.y / rect.height) * 100}%`;
      if (tinyDrag) {
        sheet.style.transformOrigin = `${transformOrigin.x} ${transformOrigin.y}`;
        sheet.style.transition      = "transform 0.15s ease";
        sheet.style.transform       = `scale(${SCALE})`;
      } else {
        sheet.style.transition      = "none";
        sheet.style.transform       = "scale(1)";
        sheet.style.transformOrigin = "center center";
      }
    });

    document.addEventListener("pointermove", e => {
      if (!dragging) return;
      const left = e.clientX - grabOffset.x;
      const top  = e.clientY - grabOffset.y;
      sheet.style.left = `${left}px`;
      sheet.style.top  = `${top}px`;
      this.position.left = left;
      this.position.top  = top;
    });

    document.addEventListener("pointerup", e => {
      if (!dragging) return;
      dragging = false;
      sheet.releasePointerCapture(e.pointerId);
      if (tinyDrag) {
        sheet.style.transition = "transform 0.15s ease";
        sheet.style.transform  = "scale(1)";
        sheet.addEventListener("transitionend", function resetOrigin() {
          sheet.style.transformOrigin = "center center";
          sheet.removeEventListener("transitionend", resetOrigin);
        });
      }
    });
  }

  // ── Status stamp ─────────────────────────────────────────
  //
  // Directly updates the stamp DOM element — no re-render needed.
  // Called on full render and from the updateActor hook whenever
  // this investigator's status changes.

  _updateStatusStamp() {
    const stamp = this.element?.querySelector("[data-status-stamp]");
    if (!stamp) return;
    const status  = this.actor.system.status ?? "active";
    const visible = status !== "active";

    stamp.classList.toggle("status-stamp--visible",   visible);
    stamp.classList.toggle("status-stamp--inactive",  visible && status === "inactive");
    stamp.classList.toggle("status-stamp--deceased",  visible && status === "deceased");
    stamp.classList.toggle("status-stamp--retired",   visible && status === "retired");
    stamp.textContent = visible ? status : "";
  }

  // ── Field listeners ───────────────────────────────────────

  _bindFieldListeners() {
    if (!this.element) return;
    this.element.removeEventListener("input", this._delegatedInputHandler);
    this._delegatedInputHandler ??= event => {
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;
      if (el.classList.contains("notes-field")) this._onNotesInput(el);
      else if (el.dataset.itemId)               this._onSkillFieldChange(event);
      else if (el.dataset.field)                this._onFieldChange(event);
    };
    this.element.addEventListener("input", this._delegatedInputHandler);
  }

  // ── Notes overflow ────────────────────────────────────────
  //
  // When a notes textarea overflows its visible height, the excess text
  // is pushed to the next notes field. A "continued →" indicator appears
  // at the bottom of the page when the next field has content.

  _onNotesInput(textarea) {
    const nextField = textarea.dataset.notesNext;

    // Update the indicator regardless of overflow state
    const indicator = textarea.closest(".notes-page")?.querySelector(".notes-continue-indicator");

    if (textarea.scrollHeight > textarea.clientHeight + 2 && nextField) {
      const fullText   = textarea.value;
      const splitPoint = this._findNotesSplitPoint(textarea, fullText);
      const thisText   = fullText.substring(0, splitPoint).trimEnd();
      const overflow   = fullText.substring(splitPoint).trimStart();

      const nextTextarea = this.element.querySelector(`[data-field="${nextField}"]`);
      const nextValue    = overflow + (nextTextarea?.value ? "\n" + nextTextarea.value : "");

      textarea.value = thisText;
      if (nextTextarea) nextTextarea.value = nextValue;

      this.dataActor.update({
        [textarea.dataset.field]: thisText,
        [nextField]:              nextValue,
      }, { render: false });
    } else {
      this.dataActor.update({ [textarea.dataset.field]: textarea.value }, { render: false });
    }

    // Show indicator when next field has content
    if (indicator && nextField) {
      const nextTextarea = this.element.querySelector(`[data-field="${nextField}"]`);
      indicator.classList.toggle("notes-continue-indicator--visible", !!nextTextarea?.value);
    }
  }

  _findNotesSplitPoint(textarea, fullText) {
    const clone = textarea.cloneNode(false);
    clone.style.cssText   = window.getComputedStyle(textarea).cssText;
    clone.style.position  = "absolute";
    clone.style.visibility = "hidden";
    clone.style.pointerEvents = "none";
    document.body.appendChild(clone);

    const maxH = textarea.clientHeight;
    let lo = 0, hi = fullText.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      clone.value = fullText.substring(0, mid);
      if (clone.scrollHeight <= maxH) lo = mid;
      else hi = mid - 1;
    }
    document.body.removeChild(clone);

    // Snap back to last word boundary (within 30 chars)
    const lastSpace = fullText.lastIndexOf(" ", lo);
    return lastSpace > lo - 30 ? lastSpace : lo;
  }

  get dataActor() {
    return this.actor.isToken ? this.actor.baseActor : this.actor;
  }

  _onFieldChange = async event => {
    const el = event.target;
    if (!el.dataset?.field) return;
    const value = el.type === "checkbox"
      ? el.checked
      : (el.type === "number" ? Number(el.value) : el.value);
    await this.dataActor.update({ [el.dataset.field]: value }, { render: false });

    // Status change: update stamp + enforce one-active-per-player for non-GM users
    if (el.dataset.field === "system.status") {
      this._updateStatusStamp();
      if (value === "active" && !game.user.isGM) {
        for (const actor of game.actors) {
          if (actor.id !== this.dataActor.id &&
              actor.type === "investigator" &&
              actor.isOwner &&
              actor.system.status === "active") {
            await actor.update({ "system.status": "inactive" }, { render: false });
            // Explicitly update the stamp on the deactivated sheet after the
            // update resolves — don't rely solely on the hook for local timing
            actor.sheet?._updateStatusStamp?.();
          }
        }
      }
    }

    if (el.type === "number") this._updateDerived(el.closest("[data-derived-row]"), value);
    if ([
      "system.investigator.title",
      "system.investigator.firstname",
      "system.investigator.middlename",
      "system.investigator.lastname"
    ].includes(el.dataset.field)) this._updateActorNameFromSystem(this.actor.system);
  };

  _onSkillFieldChange = async event => {
    const el = event.target;
    if (!el?.dataset?.itemId || !el.dataset?.field) return;
    const value = el.type === "checkbox" ? el.checked : Number(el.value);
    const item  = this.actor.items.get(el.dataset.itemId);
    if (!item) return;
    await item.update({ [el.dataset.field]: value }, { render: false });
    if (el.type === "number") this._updateDerived(el.closest("[data-derived-row]"), value);
  };

  _updateDerived(row, base) {
    if (!row) return;
    const baseValue = Number(base) || 0;
    for (const target of row.querySelectorAll("[data-derived-target]")) {
      const mode = target.dataset.derivedTarget;
      let result = baseValue;
      if (mode === "half")       result = Math.floor(baseValue / 2);
      else if (mode === "fifth") result = Math.floor(baseValue / 5);
      else if (!isNaN(Number(mode)) && Number(mode) !== 0) result = Math.floor(baseValue / Number(mode));
      target.textContent = String(result);
    }
  }

  _loadDerivedRows() {
    if (!this.element) return;
    for (const row of this.element.querySelectorAll("[data-derived-row]")) {
      const src = row.querySelector("[data-derived-source]");
      if (src) this._updateDerived(row, src.value);
    }
  }

  async _updateActorNameFromSystem(system) {
    const name = [
      system.investigator?.title?.trim(),
      system.investigator?.firstname?.trim(),
      system.investigator?.middlename?.trim(),
      system.investigator?.lastname?.trim(),
    ].filter(Boolean).join(" ") || "Investigator";

    if (this.actor.name === name) return;
    await this.actor.update({ name }, { render: false });

    const label = this.element.querySelector(".folder-label");
    if (label) label.textContent = name;
    ui.actors.render();

    for (const scene of game.scenes) {
      const updates = scene.tokens
        .filter(t => t.actorId === this.actor.id && t.actorLink)
        .map(t => ({ _id: t.id, name }));
      if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
    }
  }

  // ── Portrait ──────────────────────────────────────────────

  async _openPortraitDialog(_event, _target) {
    const sheet = this;
    const input = document.createElement("input");
    input.type   = "file";
    input.accept = "image/*";
    input.style.display = "none";

    input.addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;
      const actor      = sheet.actor.isToken ? sheet.actor.baseActor : sheet.actor;
      const ext        = file.name.split(".").pop().toLowerCase();
      const uploadPath = `worlds/${game.world.id}/actors`;
      await ensureDirectory("data", uploadPath);
      const result = await foundry.applications.apps.FilePicker.upload(
        "data", uploadPath, file, { name: `${actor.id}.${ext}` }
      );
      await actor.update({
        "system.investigator.portrait": result.path,
        img:                            result.path,
        "prototypeToken.texture.src":   result.path
      }, { render: false });
      sheet._updatePortrait(result.path);
      await sheet._updateTokens(result.path);
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  _updatePortrait(src) {
    const fallback = this.actor.system.investigator.defaultportrait;
    const img      = this.element.querySelector(".profile-picture");
    if (!img) return;
    img.style.display = "none";
    img.offsetHeight;
    img.src           = `${src || fallback}?v=${Date.now()}`;
    img.style.display = "";
    img.onerror = () => { img.onerror = null; img.src = fallback; };
    ui.actors.render();
  }

  async _updateTokens(src) {
    const finalSrc = src || this.actor.system.investigator.defaultportrait;
    for (const scene of game.scenes) {
      const updates = scene.tokens
        .filter(t => t.actorId === this.actor.id && t.actorLink)
        .map(t => ({ _id: t.id, texture: { src: finalSrc } }));
      if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
    }
  }

  // ── Close folder ──────────────────────────────────────────

  static async _onCloseFolder(_event, _target) {
    if (this.isTurning) return;
    this.isTurning = true;

    const pages     = [...this.element.querySelectorAll(".page")];
    const pastPages = pages.filter(p => Number(p.dataset.index) < this.pageIndex).reverse();
    const flipDuration  = 80;
    const totalDuration = pastPages.length * flipDuration + 400;

    pastPages.forEach((page, i) => {
      setTimeout(() => {
        playPageSound();
        page.style.zIndex = 1000 + i;
        page.classList.add("turn-backward");
      }, i * flipDuration);
    });

    foundry.audio.AudioHelper.play({
      src: "systems/red-thread/assets/sounds/folderflip.mp3",
      volume: 0.6
    }, true);

    setTimeout(() => {
      pages.forEach(p => p.classList.add("no-transition"));
      pages.forEach(p => p.classList.remove(
        "turn-forward", "turn-backward", "is-turning", "past", "current", "future"
      ));
      this.pageIndex    = 0;
      this.previousPage = 0;
      this._updatePageClasses();
      requestAnimationFrame(() => pages.forEach(p => p.classList.remove("no-transition")));
      this.isTurning = false;
      this.close();
    }, totalDuration);
  }

  async close(options = {}) {
    teardownSheetPin(this);
    const folderShell = this.element.querySelector(".folder-shell");
    this._playAnimation(folderShell, "close-folder-trigger", "open-folder-trigger", "close-folder-trigger");
    await Promise.all(folderShell.getAnimations().map(a => a.finished));
    return super.close(options);
  }
}

// ── Page sounds ───────────────────────────────────────────────

const PAGE_SOUNDS = [
  "systems/red-thread/assets/sounds/pageflip1.mp3",
  "systems/red-thread/assets/sounds/pageflip2.mp3",
  "systems/red-thread/assets/sounds/pageflip3.mp3"
];

function playPageSound(volume = 0.6) {
  foundry.audio.AudioHelper.play({
    src: PAGE_SOUNDS[Math.floor(Math.random() * PAGE_SOUNDS.length)],
    volume
  }, true);
}

// ── Directory helper ──────────────────────────────────────────

async function ensureDirectory(source, path) {
  try {
    await foundry.applications.apps.FilePicker.createDirectory(source, path);
  } catch (err) {
    if (!err.message?.includes("EEXIST")) console.error("Failed to create directory:", err);
  }
}
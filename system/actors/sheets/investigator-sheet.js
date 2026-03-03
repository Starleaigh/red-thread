/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

import { initSheetPin, teardownSheetPin } from "../../canvas/sheet-pin.js";

export class InvestigatorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static PARTS = {
    main: {
      template: "./systems/red-thread/system/actors/templates/investigator-sheet/investigator-sheet.hbs"
    }
  };

  static DEFAULT_OPTIONS = {
    tag: "div",
    classes: ["red-thread", "investigator-sheet"],
    submitOnChange: false,
    closeOnSubmit: false,
    resizable: false,

    actions: {
      nextPage: InvestigatorSheet._onNextPage,
      prevPage: InvestigatorSheet._onPrevPage,
      closeFolder: InvestigatorSheet._onCloseFolder,
      changePortrait: InvestigatorSheet.prototype._openPortraitDialog
    }
  };
  
  pageIndex = 0;
  previousPage = 0;
  pageCount = 8;
  isTurning = false;

  async _prepareContext() {
    const context = await super._prepareContext();
    const folderOpen = this.actor.getFlag("red-thread", "folderOpen") ?? false;
    const actor = this.actor.isToken
      ? this.actor.baseActor
      : this.actor; 

    const pagesData = [
      { index: 0, name: "front-folder", title: "Folder Front Cover", type: "folder" },
      { index: 1, name: "cover-page", title: "Cover", type: "paper" },
      { index: 2, name: "profile-page", title: "Profile", type: "paper" },
      { index: 3, name: "stats-page", title: "Stats", type: "paper" },
      { index: 4, name: "skills-page", title: "Skills", type: "paper" },
      { index: 5, name: "inventory-page", title: "Inventory", type: "paper" },
      { index: 6, name: "notes-page", title: "Notes", type: "paper" },
      { index: 7, name: "back-folder", title: "Folder Back Cover", type: "folder" }
    ];

    const skills = this.actor.items.filter(i => i.type === "skill")
      .map(skill => ({
        id: skill.id,
        name: skill.name,
        base: skill.system.base ?? 0,
        occupation: skill.system.occupation ?? false,
        improvement: skill.system.improvement ?? false,
        value: skill.value,
        half: skill.half,
        fifth: skill.fifth
      }));

    const system = actor.system.investigator;
    let portraitSrc = system.portrait;
    if (!portraitSrc) portraitSrc = system.defaultportrait;

    return { 
      ...context,
      actor: this.actor,
      system: this.actor.system,
      portraitSrc,
      folderOpen,
      pagesData,
      skills 
    };
  }

  _constrainPosition(position) {
    return position;
  }

  async _updatePageClasses() {
    const root = this.element;
    const pages = root.querySelectorAll(".page");

    pages.forEach((page) => {
      if (page.classList.contains("is-turning")) return;

      page.classList.remove("past", "current", "future");
      const idx = Number(page.dataset.index);

      if (idx < this.pageIndex) page.classList.add("past");
      else if (idx === this.pageIndex) page.classList.add("current");
      else page.classList.add("future");

      if (!page.classList.contains("is-turning")) {
        page.style.zIndex = idx < this.pageIndex ? 10 + idx : 100 - idx;
      }
    });
  }

  static async _onNextPage(event, target) {
    if (this.isTurning) return;
    if (this.pageIndex >= this.pageCount - 1) return;

    const pages = this.element.querySelectorAll(".page");
    const current = pages[this.pageIndex];
    if (!current) return;

    this.isTurning = true;
    playPageSound();
    
    this._playAnimation(current, "turn-forward", "turn-forward", "turn-backward");
    current.style.zIndex = 1000;
    
    setTimeout(() => {
      this.pageIndex++;
      this._updatePageClasses();
      this.isTurning = false;
    }, 600);
  }

  static async _onPrevPage(event, target) {
    if (this.isTurning) return;
    if (this.pageIndex <= 0) return;

    const pages = this.element.querySelectorAll(".page");
    const prev = pages[this.pageIndex - 1];
    if (!prev) return;

    this.isTurning = true;
    playPageSound();

    this._playAnimation(prev, "turn-backward", "turn-forward", "turn-backward");
    prev.style.zIndex = 1000;

    setTimeout(() => {
      this.pageIndex--;
      this._updatePageClasses();
      this.isTurning = false;
    }, 600);
  }

  _playAnimation(el, className, rem1, rem2) {
    el.classList.add("no-transition");
    el.classList.remove(rem1, rem2);
    void el.offsetWidth;
    el.classList.remove("no-transition");
    el.classList.add(className);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    // ----- DATA HANDLING ------
    this._bindFieldListeners(); 
    this._loadDerivedRows();

    // -------- FOLDER ANIMATION --------
    const folderShell = this.element.querySelector(".folder-shell");
    this._playAnimation(folderShell, "open-folder-trigger", "open-folder-trigger", "close-folder-trigger");
     
    foundry.audio.AudioHelper.play({
      src: "systems/red-thread/assets/sounds/folderflip.mp3",
      volume: 0.6
    }, true);

    // ------------------------------------------------------
    //               START OF DRAG CODE
    // ── FIX: use this.element instead of document.querySelector
    //    so each sheet instance only controls its own element ──
    // ------------------------------------------------------

    const sheet = this.element;  // ← WAS: document.querySelector(".investigator-sheet")
    const SCALE = 0.2;
    let dragging = false;
    let tinyDrag = false;
    let grabOffset = { x: 0, y: 0 };
    let transformOrigin = { x: "50%", y: "50%" };

    sheet.addEventListener("contextmenu", (e) => e.preventDefault());

    sheet.addEventListener("pointerdown", (e) => {
      if (!e.target.classList.contains("draggable")) return;

      if (e.pointerType === "mouse") {
        dragging = true;
        tinyDrag = e.button === 2;
        sheet.setPointerCapture(e.pointerId);

        const rect = sheet.getBoundingClientRect();
        grabOffset.x = e.clientX - rect.left;
        grabOffset.y = e.clientY - rect.top;

        const originX = (grabOffset.x / rect.width) * 100;
        const originY = (grabOffset.y / rect.height) * 100;
        transformOrigin.x = `${originX}%`;
        transformOrigin.y = `${originY}%`;

        if (tinyDrag) {
          sheet.style.transformOrigin = `${transformOrigin.x} ${transformOrigin.y}`;
          sheet.style.transition = "transform 0.15s ease";
          sheet.style.transform = `scale(${SCALE})`;
        } else {
          sheet.style.transition = "none";
          sheet.style.transform = "scale(1)";
          sheet.style.transformOrigin = "center center";
        }
      }
    });

    document.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      sheet.style.left = `${e.clientX - grabOffset.x}px`;
      sheet.style.top = `${e.clientY - grabOffset.y}px`;
    });

    document.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;

      sheet.releasePointerCapture(e.pointerId);
      if (tinyDrag) {
        sheet.style.transition = "transform 0.15s ease";
        sheet.style.transform = `scale(1)`;

        sheet.addEventListener(
          "transitionend",
          function resetOrigin() {
            sheet.style.transformOrigin = "center center";
            sheet.removeEventListener("transitionend", resetOrigin);
          }
        );
      }
    });

    // ---------------------------------------------------------
    //                    END OF DRAG CODE
    // ---------------------------------------------------------

    // -------- INITIALIZE PAGES IN THE DOM ---------------------
    const pages = this.element.querySelectorAll(".page");
    pages.forEach((page) => {
      if (!page.classList.contains("initialized")) {
        page.classList.add("initialized");
        const back = page.querySelector(".back");
        if (back) back.classList.add("back-initialized");
      }
    }); 
    this._updatePageClasses();

    // -------- SHEET PIN --------
    // Must come last so all DOM elements are ready
    initSheetPin(this);
  }

  // --- DATA METHODS ---

  _bindFieldListeners() {
    if (!this.element) return;

    this.element.removeEventListener("input", this._delegatedInputHandler);
    this._delegatedInputHandler = this._delegatedInputHandler ?? ((event) => {
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;

      if (el.dataset.itemId) {
        this._onSkillFieldChange(event);
      } else if (el.dataset.field) {
        this._onFieldChange(event);
      }
    });

    this.element.addEventListener("input", this._delegatedInputHandler);
  }

  get dataActor() {
    return this.actor.isToken ? this.actor.baseActor : this.actor;
  }

  _onFieldChange = async (event) => {
    const el = event.target;
    if (!el.dataset?.field) return;

    const value = el.type === "checkbox"
      ? el.checked
      : (el.type === "number" ? Number(el.value) : el.value);

    await this.dataActor.update({ [el.dataset.field]: value }, { render: false });

    if (el.type === "number") {
      const row = el.closest("[data-derived-row]");
      this._updateDerived(row, value);
    } 

    if (
      el.dataset.field === "system.investigator.title" ||
      el.dataset.field === "system.investigator.firstname" ||
      el.dataset.field === "system.investigator.middlename" ||
      el.dataset.field === "system.investigator.lastname"
    ) {
      this._updateActorNameFromSystem(this.actor.system);
    }
  };

  _onSkillFieldChange = async (event) => {
    const el = event.target;
    if (!el?.dataset?.itemId || !el.dataset?.field) return;

    const value = el.type === "checkbox"
      ? el.checked
      : Number(el.value);

    const item = this.actor.items.get(el.dataset.itemId);
    if (!item) return;

    await item.update({ [el.dataset.field]: value }, { render: false });

    if (el.type === "number") {
      const row = el.closest("[data-derived-row]");
      this._updateDerived(row, value);
    }
  };

  _updateDerived(row, base) {
    if (!row) return;
    const baseValue = Number(base) || 0;

    for (const target of row.querySelectorAll("[data-derived-target]")) {
      const mode = target.dataset.derivedTarget;
      let result = baseValue;

      if (mode === "half") result = Math.floor(baseValue / 2);
      else if (mode === "fifth") result = Math.floor(baseValue / 5);
      else if (!isNaN(Number(mode)) && Number(mode) !== 0) {
        result = Math.floor(baseValue / Number(mode));
      }

      target.textContent = String(result);
    }
  }

  _loadDerivedRows() {
    if (!this.element) return;
    const rows = this.element.querySelectorAll("[data-derived-row]");
    for (const row of rows) {
      const sourceEl = row.querySelector("[data-derived-source]");
      const value = sourceEl.value;
      if (sourceEl) this._updateDerived(row, value);
    }
  }

  async _updateActorNameFromSystem(system) {
    const title = system.investigator?.title?.trim() ?? "";
    const first = system.investigator?.firstname?.trim() ?? "";
    const middle = system.investigator?.middlename?.trim() ?? "";
    const last  = system.investigator?.lastname?.trim() ?? "";

    let name = [title, first, middle, last].filter(Boolean).join(" ");
    if (!name) name = "Investigator";

    if (this.actor.name === name) return;

    await this.actor.update({ name }, { render: false });

    const label = this.element.querySelector(".folder-label");
    if (label) label.textContent = name;

    ui.actors.render();

    for (const scene of game.scenes) {
      const updates = [];
      for (const token of scene.tokens) {
        if (token.actorId === this.actor.id && token.actorLink) {
          updates.push({ _id: token.id, name });
        }
      }
      if (updates.length) {
        await scene.updateEmbeddedDocuments("Token", updates);
      }
    }
  }

  async _openPortraitDialog(event, target) {
    const sheet = this;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";

    input.addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;

      const actor = sheet.actor.isToken
        ? sheet.actor.baseActor
        : sheet.actor;

      const ext = file.name.split(".").pop().toLowerCase();
      const filename = `${actor.id}.${ext}`;
      const uploadPath = `worlds/${game.world.id}/actors`;

      await ensureDirectory("data", uploadPath);

      const result = await foundry.applications.apps.FilePicker.upload(
        "data",
        uploadPath,
        file,
        { name: filename }
      );

      await actor.update({
        "system.investigator.portrait": result.path,
        img: result.path,
        "prototypeToken.texture.src": result.path
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
    const finalSrc = src || fallback;

    const img = this.element.querySelector(".profile-picture");
    if (!img) {
      console.warn("Red Thread | Portrait img not found in DOM: ", this);
      return;
    }

    const bustedSrc = `${finalSrc}?v=${Date.now()}`;

    img.style.display = "none";
    img.offsetHeight;
    img.src = bustedSrc;
    img.style.display = "";

    img.onerror = () => { 
      img.onerror = null;
      img.src = fallback;
    };

    ui.actors.render();
  }

  async _updateTokens(src) {
    const finalSrc = src || this.actor.system.investigator.defaultportrait;

    for (const scene of game.scenes) {
      const updates = [];
      for (const token of scene.tokens) {
        if (token.actorId === this.actor.id && token.actorLink) {
          updates.push({ _id: token.id, texture: { src: finalSrc } });
        }
      }
      if (updates.length) {
        await scene.updateEmbeddedDocuments("Token", updates);
      }
    }
  }

  static async _onCloseFolder(event, target) {
    if (this.isTurning) return;
    this.isTurning = true;

    const root = this.element;
    const pages = [...root.querySelectorAll(".page")];

    const pastPages = pages
      .filter(p => Number(p.dataset.index) < this.pageIndex)
      .reverse();

    const flipDuration = 80;
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
      pages.forEach(p => {
        p.classList.remove("turn-forward", "turn-backward", "is-turning", "past", "current", "future");
      });

      this.pageIndex = 0;
      this.previousPage = 0;
      this._updatePageClasses();

      requestAnimationFrame(() => {
        pages.forEach(p => p.classList.remove("no-transition"));
      });

      this.isTurning = false;
      this.close();
    }, totalDuration);
  }

  async close(options = {}) {
    // ── Teardown sheet pin hook before closing ──
    teardownSheetPin(this);

    const folderShell = this.element.querySelector(".folder-shell");
    this._playAnimation(folderShell, "close-folder-trigger", "open-folder-trigger", "close-folder-trigger");

    await Promise.all(
      folderShell.getAnimations().map(a => a.finished)
    );

    return super.close(options);
  }
}

// ─────────────────────────────────────────────────────────────
//  MODULE-LEVEL HELPERS
// ─────────────────────────────────────────────────────────────

const PAGE_SOUNDS = [
  "systems/red-thread/assets/sounds/pageflip1.mp3",
  "systems/red-thread/assets/sounds/pageflip2.mp3",
  "systems/red-thread/assets/sounds/pageflip3.mp3"
];

function playPageSound(volume = 0.6) {
  const src = PAGE_SOUNDS[Math.floor(Math.random() * PAGE_SOUNDS.length)];
  foundry.audio.AudioHelper.play({ src, volume }, true);
}

async function ensureDirectory(source, path) {
  try {
    await foundry.applications.apps.FilePicker.createDirectory(source, path);
  } catch (err) {
    if (!err.message?.includes("EEXIST")) {
      console.error("Failed to create directory:", err);
    }
  }
}

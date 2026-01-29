/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class InvestigatorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static PARTS = {
    main: {
      template: "./systems/red-thread/templates/actors/investigator-sheet/investigator-sheet.hbs"
    }
  };

  static DEFAULT_OPTIONS = {
    tag: "div",
    classes: ["red-thread", "investigator-sheet"],
    submitOnChange: false,
    closeOnSubmit: false,
    resizable: true,

    actions: {
      nextPage: InvestigatorSheet._onNextPage,
      prevPage: InvestigatorSheet._onPrevPage,
      openFolder: InvestigatorSheet._onOpenFolder,
      closeFolder: InvestigatorSheet._onCloseFolder
    }
  };

  pageIndex = 0;
  previousPage = 0;
  pageCount = 8;
  isTurning = false;

  async _prepareContext() {
    const context = await super._prepareContext();
    const folderOpen = this.actor.getFlag("red-thread", "folderOpen") ?? false;

    // Build pages and compute classes here
    const pages = [

      { index: 0, name: "front-folder", title: "Folder Front Cover" },
      { index: 1, name: "cover-page", title: "Cover" },
      { index: 2, name: "profile-page", title: "Profile" },
      { index: 3, name: "stats-page", title: "Stats" },
      { index: 4, name: "skills-page", title: "Skills" },
      { index: 5, name: "inventory-page", title: "Inventory" },
      { index: 6, name: "notes-page", title: "Notes"},
      { index: 7, name: "back-folder", title: "Folder Back Cover" }

    ].map((_, i) => {
      let state = "future";
      if (i < this.pageIndex) state = "past";
      if (i === this.pageIndex) state = "current";
      return { index: i, title: `Page ${i}`, state };
    });

    return { 
      folderOpen,
      pages };
  }

async _updatePageClasses() {
  const root = this.element;
  const pages = root.querySelectorAll(".page");

  pages.forEach((page) => {
    // Skip pages that are currently flipping
    if (page.classList.contains("is-turning")) return;

    page.classList.remove("past", "current", "future");

    const idx = Number(page.dataset.index);

    if (idx < this.pageIndex) page.classList.add("past");
    else if (idx === this.pageIndex) page.classList.add("current");
    else page.classList.add("future");

    // z-index only for static pages
    if (!page.classList.contains("is-turning")) {
      page.style.zIndex = idx < this.pageIndex ? 10 + idx : 100 - idx;
    }
  });
}

// Next Page
static async _onNextPage(event, target) {
  if (this.isTurning) return;
  if (this.pageIndex >= this.pageCount - 1) return;

  const pages = this.element.querySelectorAll(".page");
  const current = pages[this.pageIndex];
  if (!current) return;

  this.isTurning = true;
  
  this._playAnimation(current, "turn-forward");
  current.style.zIndex = 1000; // Bring to top during animation
  
  setTimeout(() => {
    this.pageIndex++;
    this._updatePageClasses(); // Only update after flip completes
    this.isTurning = false;
  }, 600); // Match CSS transition
}

// Previous Page
static async _onPrevPage(event, target) {
  if (this.isTurning) return;
  if (this.pageIndex <= 0) return;

  const pages = this.element.querySelectorAll(".page");
  const prev = pages[this.pageIndex - 1];
  if (!prev) return;

  this.isTurning = true;

  this._playAnimation(prev, "turn-backward");
    
  prev.style.zIndex = 1000; // Bring to top during animation

  setTimeout(() => {
    this.pageIndex--;
    this._updatePageClasses();
    this.isTurning = false;
  }, 600);
}

_playAnimation(el, className) {

  // Freeze motion
  el.classList.add("no-transition");
  // Remove both animation classes
  el.classList.remove("turn-forward", "turn-backward");
  // Force reflow for browser to forget animation
  void el.offsetWidth;
  // Reenable transitions
  el.classList.remove("no-transition");
  // Apply the new animation
  el.classList.add(className);

}

async _onRender(context, options) {
  await super._onRender(context, options);
  
    const pages = this.element.querySelectorAll(".page");

  pages.forEach((page) => {
    if (!page.classList.contains("initialized")) {
      // Mark as initialized so this only runs once
      page.classList.add("initialized");

      // Add 'back' class to the back element inside the page
      const back = page.querySelector(".back");
      if (back) back.classList.add("back-initialized");
    }
  }); 
  this._updatePageClasses();
}

// --- FOLDER METHODS ---

async getData() {
  const data = await super.getData();

  data.folderOpen =
    this.actor.getFlag("red-thread", "folderOpen") ?? false;

  console.log("folderOpen in getData:", data.folderOpen);
    
  return data;
}


static async _onOpenFolder(event, target) {
  console.log("Red Thread | Folder action fired");
  await this.actor.setFlag("red-thread", "folderOpen", true);
  const flag = this.actor.getFlag("red-thread", "folderOpen");
  console.log("Red Thread | Get Flag: ", flag);
  this.render({ force: true });
  console.log("Red Thread | Render Fired!");
}

static async _onCloseFolder(event, target) {
  await this.actor.setFlag("red-thread", "folderOpen", false);
  this.render({ force: true });
}


}
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
    position: {
      width: 1,
      height: 1
    },
    classes: ["red-thread", "investigator-sheet"],
    submitOnChange: true,
    closeOnSubmit: false,
    resizable: false,

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
    const pagesData = [

      { index: 0, name: "front-folder", title: "Folder Front Cover", type: "folder" },
      { index: 1, name: "cover-page", title: "Cover", type: "paper" },
      { index: 2, name: "profile-page", title: "Profile", type: "paper" },
      { index: 3, name: "stats-page", title: "Stats", type: "paper" },
      { index: 4, name: "skills-page", title: "Skills", type: "paper" },
      { index: 5, name: "inventory-page", title: "Inventory", type: "paper" },
      { index: 6, name: "notes-page", title: "Notes", type: "paper" },
      { index: 7, name: "back-folder", title: "Folder Back Cover", type: "folder" }
    ]

    const pages = pagesData.map((page, i) => {
      let state = "future";
      if (i < this.pageIndex) state = "past";
      if (i === this.pageIndex) state = "current";
      return { ...page, state };
    });

    return { 
      ...context,
      actor: this.actor,
      system: this.actor.system,
      folderOpen,
      pagesData };
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
  
  this._playAnimation(current, "turn-forward", "turn-forward", "turn-backward");
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

  this._playAnimation(prev, "turn-backward", "turn-forward", "turn-backward");
  
  prev.style.zIndex = 1000; // Bring to top during animation

  setTimeout(() => {
    this.pageIndex--;
    this._updatePageClasses();
    this.isTurning = false;
  }, 600);
}

_playAnimation(el, className, rem1, rem2) {

  // Freeze motion
  el.classList.add("no-transition");
  // Remove both animation classes
  el.classList.remove(rem1, rem2);
  // Force reflow for browser to forget animation
  void el.offsetWidth;
  // Reenable transitions
  el.classList.remove("no-transition");
  // Apply the new animation
  el.classList.add(className);

}

async _onRender(context, options) {

  await super._onRender(context, options);
  
  const folderShell = this.element.querySelector(".folder-shell");
 // const draggable = this.element.querySelector(".draggable");

  this._playAnimation(folderShell, "open-folder-trigger", "open-folder-trigger", "close-folder-trigger");
 
  this.element.querySelectorAll(".draggable").forEach(el => {
    new foundry.applications.ux.Draggable(this, el);
  });


  
/*
this._dragHandle = new foundry.applications.ux.Draggable(
  this,
  dragHandle
);

this._dragHandle = new foundry.applications.ux.Draggable(
  this,
  this.element,
  { handle: dragHandle }
);
Notice the difference:

👉 root = whole sheet
👉 handle = drag zone

*/



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


// Input handling

async _onChangeInput(event) {
  await super._onChangeInput(event);

  const first = this.actor.system.investigator.firstname?.trim();
  const last  = this.actor.system.investigator.lastname?.trim();

  if (first || last) {
    const fullName = [first, last].filter(Boolean).join(" ");

    if (fullName && this.actor.name !== fullName) {
      await this.actor.update({ name: fullName });
    }
  }
}






// --- NEW CLOSE FOLDER METHOD --- 

static async _onCloseFolder(event, target) {
 // console.log("Red Thread | CloseFolder fired!");
  if (this.isTurning) return;
 // console.log("Red Thread | isTurning tag = false ");

  this.isTurning = true;

  const root = this.element;
  const pages = [...root.querySelectorAll(".page")];

  // Pages that are currently on the left stack
  const pastPages = pages
    .filter(p => Number(p.dataset.index) < this.pageIndex)
    .reverse();

  const flipDuration = 80; // ms per page
  const totalDuration = pastPages.length * flipDuration + 400;

  // VISUAL FLIP ONLY
  pastPages.forEach((page, i) => {
    setTimeout(() => {
      page.style.zIndex = 1000 + i;
      console.log("Red Thread | Z-index: ", page.style.zIndex);
      page.classList.add("turn-backward");
    }, i * flipDuration);
  });

  // HARD RESET AFTER ANIMATION
  setTimeout(() => {
    // disable transitions FIRST

    pages.forEach(p => p.classList.add("no-transition"));

    // remove ALL animation & state classes
    pages.forEach(p => {
      p.classList.remove(
        "turn-forward",
        "turn-backward",
        "is-turning",
        "past",
        "current",
        "future"
      );
    });

    // reset state
    this.pageIndex = 0;
    this.previousPage = 0;

    // re-apply clean state
    this._updatePageClasses();

    // re-enable transitions next frame
    requestAnimationFrame(() => {
      pages.forEach(p => p.classList.remove("no-transition"));
    });

    this.isTurning = false;

    this.close();

  }, totalDuration);
}

async close(options = {}) {

  const folderShell = this.element.querySelector(".folder-shell");

  this._playAnimation(folderShell, "close-folder-trigger", "open-folder-trigger", "close-folder-trigger");

  await Promise.all(
    folderShell.getAnimations().map(a => a.finished)
  );

  return super.close(options);

}

}
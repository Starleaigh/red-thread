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
    resizable: false,

    actions: {
      nextPage: InvestigatorSheet._onNextPage,
      prevPage: InvestigatorSheet._onPrevPage,
      openFolder: InvestigatorSheet._onOpenFolder,
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
      : this.actor; // Enforce one truth for Actor Data (No Token data as source)

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

    // Portrait Management
    const system = actor.system.investigator;

    let portraitSrc = system.portrait;
    if (!portraitSrc) portraitSrc = system.defaultportrait;
    console.log("Red Thread | portraitSrc: ", portraitSrc);

    return { 
      ...context,
      actor: this.actor,
      system: this.actor.system,
      portraitSrc,
      folderOpen,
      pagesData };
  }

  // In your sheet class
  _constrainPosition(position) {
  // Return the position unchanged, so it can move anywhere
  return position;
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

  // 🔊 PLAY SOUND HERE
  playPageSound();
  
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

  // 🔊 PLAY SOUND HERE
  playPageSound();

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

// ----- CALL DATA HANDLING ------

  this._bindFieldListeners(); 

 // this._updatePortrait(this.actor.system.investigator.portrait);

// ----- PORTRAIT CHANGE HANDLER --------
 // this.element
 //   .querySelector('[data-action="change-portrait"]')
//    ?.addEventListener('click', () => this._openPortraitDialog());


// -------- FOLDER ANIMATION --------

  const folderShell = this.element.querySelector(".folder-shell");

  this._playAnimation(folderShell, "open-folder-trigger", "open-folder-trigger", "close-folder-trigger");
   
  // 🔊 PLAY SOUND HERE
  foundry.audio.AudioHelper.play({
    src: "systems/red-thread/assets/sounds/folderflip.mp3",
    volume: 0.6
  }, true);

// ------------- START OF DRAG CODE ---------------

const sheet = this.element.querySelector(".investigator-sheet");
const content = this.element.querySelector(".window-content");

const SCALE = 0.2;
let dragging = false;

// ------------- POINTER DOWN --------------------

sheet.addEventListener("pointerdown", (e) => {
  if (!e.target.classList.contains("draggable")) return;
  if (e.button !== 0) return;

  dragging = true;
  sheet.setPointerCapture(e.pointerId);

  const contentRect = content.getBoundingClientRect();
/*
  // Snap center of *sheet* to mouse
  sheet.style.transition = "transform 0.15s ease";
  sheet.style.transformOrigin = "center center";
  sheet.style.transform = `scale(${SCALE})`;

  sheet.style.left =
    `${e.clientX - contentRect.left - sheet.offsetWidth / 2}px`;
  sheet.style.top =
    `${e.clientY - contentRect.top - sheet.offsetHeight / 2}px`;
*/
  e.preventDefault();
});

// ----------- POINTER DRAG ----------

document.addEventListener("pointermove", (e) => {
  if (!dragging) return;

  const contentRect = content.getBoundingClientRect();

  // Snap center of *sheet* to mouse
  sheet.style.transition = "transform 0.15s ease";
  sheet.style.transformOrigin = "center center";
  sheet.style.transform = `scale(${SCALE})`;

  sheet.style.left =
    `${e.clientX - contentRect.left - sheet.offsetWidth / 2}px`;
  sheet.style.top =
    `${e.clientY - contentRect.top - sheet.offsetHeight / 2}px`;
});

// -------- POINTER UP ---------

document.addEventListener("pointerup", (e) => {
  if (!dragging) return;

  dragging = false;
  sheet.releasePointerCapture(e.pointerId);

  sheet.style.transition = "transform 0.15s ease";
  sheet.style.transform = "scale(1)";
  sheet.style.transformOrigin = "center center";
});

// ----------- OLD DRAG CODE KEEP FOR POTENTIAL MOPDIFICATION TO THE DRAG LOGIC --------------
/*
const folder = this.element.querySelector(".investigator-sheet");
const SCALE = 0.2;

let dragging = false;

folder.addEventListener("pointerdown", (e) => {
  if (!e.target.classList.contains("draggable")) return;
  if (e.button !== 0) return;

  dragging = true;
  folder.setPointerCapture(e.pointerId);

  const rect = folder.getBoundingClientRect();

  // remove transitions during drag
  folder.style.transition = "none";
  folder.style.transformOrigin = "center center";
  folder.style.transform = `scale(${SCALE})`;


  // immediately center on pointer
  folder.style.left = `${e.clientX - rect.width / 2}px`;
  folder.style.top  = `${e.clientY - rect.height / 2}px`;

  e.preventDefault();
});

document.addEventListener("pointermove", (e) => {
  if (!dragging) return;

  const rect = folder.getBoundingClientRect();

  folder.style.left = `${e.clientX - rect.width / 2}px`;
  folder.style.top  = `${e.clientY - rect.height / 2}px`;
});

document.addEventListener("pointerup", (e) => {
  if (!dragging) return;

  dragging = false;
  folder.releasePointerCapture(e.pointerId);

  // restore scale smoothly
  folder.style.transition = "transform 0.15s ease";
  folder.style.transform = "scale(1)";
});

*/

///// Draggable location on the folder 
/*
const folder = this.element.querySelector(".investigator-sheet");
const SCALE = 0.8;

let dragState = null;

folder.addEventListener("pointerdown", (e) => {
  if (!e.target.classList.contains("draggable")) {
    console.log("Red Thread | Pointer down fired... Not draggable!!!");
    return;
  }
  if (e.button !== 0) return;

  const rect = folder.getBoundingClientRect();

  // Pointer anchor inside the folder
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  // Scale origin relative to folder
  const originX = (offsetX / rect.width) * 100;
  const originY = (offsetY / rect.height) * 100;

  dragState = {
    offsetX,
    offsetY
  };

  folder.setPointerCapture(e.pointerId);

  folder.style.transformOrigin = `${originX}% ${originY}%`;
  folder.style.transition = "transform 0.15s ease";
  folder.style.transform = `scale(${SCALE})`;

  e.preventDefault();
});

document.addEventListener("pointermove", (e) => {
  if (!dragState) return;

  // Absolute placement — no deltas
  const left = e.clientX - dragState.offsetX;
  const top  = e.clientY - dragState.offsetY;

  folder.style.left = `${left}px`;
  folder.style.top  = `${top}px`;
});

document.addEventListener("pointerup", (e) => {
  if (!dragState) return;

  dragState = null;
  folder.releasePointerCapture(e.pointerId);

  // Reset scale
  folder.style.transition = "transform 0.15s ease";
  folder.style.transform = "scale(1)";
  folder.style.transformOrigin = "center center";
*/

/*
  // --- Bounds snap ---
  const playArea = document.querySelector("#board"); // adjust if needed
  if (!playArea) return;

  const playRect = playArea.getBoundingClientRect();
  const folderRect = folder.getBoundingClientRect();

  let finalLeft = folderRect.left;
  let finalTop  = folderRect.top;

  if (folderRect.left < playRect.left)
    finalLeft = playRect.left;

  if (folderRect.top < playRect.top)
    finalTop = playRect.top;

  if (folderRect.right > playRect.right)
    finalLeft = playRect.right - folderRect.width;

  if (folderRect.bottom > playRect.bottom)
    finalTop = playRect.bottom - folderRect.height;

  folder.style.left = `${finalLeft}px`;
  folder.style.top  = `${finalTop}px`;
});
*/

// END OF DRAG CODE


// -------- INITIALIZE PAGES IN THE DOM ---------------------

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

// --- DATA METHODS ---

// Input handling

_bindFieldListeners() {
  if (!this.element) return;

  this.element.addEventListener("input", this._onFieldChange);
  this.element.addEventListener("change", this._onFieldChange);
}

get dataActor() {
  return this.actor.isToken ? this.actor.baseActor : this.actor;
}

// Live updates to sheet

_onFieldChange = async (event) => {
  const el = event.target;
  if (!el?.dataset?.field) return;

  let value;
  if (el.type === "checkbox") {
    value = el.checked;
  } else {
    value = el.value;
  }

  const updateData = {
    [el.dataset.field]: value
  };

  await this.dataActor.update(updateData, { render: false });

  // Only recompute name if relevant fields changed
  if (
    el.dataset.field === "system.investigator.firstname" ||
    el.dataset.field === "system.investigator.lastname"
  ) {
    this._updateActorNameFromSystem(this.actor.system);
  }
};

// Change Actor.name to follow name input fields

_updateActorNameFromSystem(system) {
  const first = system.investigator?.firstname?.trim() ?? "";
  const last  = system.investigator?.lastname?.trim() ?? "";

  let name = [first, last].filter(Boolean).join(" ");
  if (!name) name = "Investigator";

  // Avoid infinite update loops
  if (this.actor.name === name) return;

  return this.actor.update(
    { name },
    { render: false }
  );
}

// ------ PORTRAIT DIALOG BOX LOAD -------------

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

    // ✅ update only the image
    sheet._updatePortrait(result.path);
    sheet._updateTokens(result.path);

  
  });

  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}


_updatePortrait(src) {
  const fallback = this.actor.system.investigator.defaultportrait;
  const finalSrc = src || fallback;

  const img = this.element.querySelector<HTMLImageElement>(".investigator-portrait");
  if (!img) return;

  // 🔥 HARD cache-bust so browser updates immediately
  const bustedSrc = `${finalSrc}?v=${performance.now()}`;

  // Force reflow inside transformed/foldered element
  img.style.display = "none";
  img.offsetHeight; // trigger reflow
  img.src = bustedSrc;
  img.style.display = "";

  img.onerror = () => { 
    img.onerror = null;
    img.src = fallback;
  };
}

_updateTokens(src) {
  const finalSrc = src || this.actor.system.investigator.defaultportrait;

  canvas?.tokens?.placeables
    .filter(t => t.actor?.id === this.actor.id)
    .forEach(token => {
      // Update the token document texture
      token.document.update({ "texture.src": finalSrc }).then(() => {
      //  token.draw(); // Force instant redraw
      });
    });
}





// --- FOLDER METHODS ---

static async _onOpenFolder(event, target) {
//  console.log("Red Thread | Folder action fired");
  await this.actor.setFlag("red-thread", "folderOpen", true);
  const flag = this.actor.getFlag("red-thread", "folderOpen");
  console.log("Red Thread | Get Flag: ", flag);
  this.render({ force: true });
  console.log("Red Thread | Render Fired!");
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
      playPageSound();
      page.style.zIndex = 1000 + i;
      console.log("Red Thread | Z-index: ", page.style.zIndex);
      page.classList.add("turn-backward");
    }, i * flipDuration);
  });
    
  // 🔊 PLAY SOUND HERE
  foundry.audio.AudioHelper.play({
    src: "systems/red-thread/assets/sounds/folderflip.mp3",
    volume: 0.6
  }, true);

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

  // PAGE SOUND FUNCTION

const PAGE_SOUNDS = [
  "systems/red-thread/assets/sounds/pageflip1.mp3",
  "systems/red-thread/assets/sounds/pageflip2.mp3",
  "systems/red-thread/assets/sounds/pageflip3.mp3"
];

function playPageSound(volume = 0.6) {
  const src = PAGE_SOUNDS[Math.floor(Math.random() * PAGE_SOUNDS.length)];
  foundry.audio.AudioHelper.play({ src, volume }, true);
}

// CREATE FOLDER FUNCTION

// --------- FOLDER DIRECTORY CREATION -----------------

async function ensureDirectory(source, path) {
  try {
    await foundry.applications.apps.FilePicker.createDirectory(source, path);
  } catch (err) {
    // Folder already exists → safe to ignore
    if (!err.message?.includes("EEXIST")) {
      console.error("Failed to create directory:", err);
    }
  }
}
/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class EvidenceSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  
  /* -------------------------------------------- */
  /* Template Parts                               */
  /* -------------------------------------------- */

  static PARTS = {
    main:{
      template: "systems/red-thread/templates/actors/evidence-sheet.hbs"
    }
  }

  static DEFAULT_OPTIONS = {
    tag: "div",
    // id: "red-thread",
    classes: ["red-thread", "evidence-sheet"],
    submitOnChange: false,
    closeOnSubmit: false,
    resizeable: true,
    actions: {
      edit: EvidenceSheet.prototype._onEdit,
      submit: EvidenceSheet.prototype._onSubmit
    //  submit: this._onSubmit,
    }
     // evidenceAction: EvidenceSheet.doSomething();
  };
  
typingInterval = null;
typingTimeout = null;
lastValues = {};

//---------------------------------------------------------
// Locking State
//---------------------------------------------------------

get lock() {
  return this.actor.system.editLock ?? null;
}

get isLocked() {
  return !!this.lock?.userId;
}

get isLockOwner() {
  return this.lock?.userId === game.user.id;
}

//---------------------------------------------------------
// Context
//---------------------------------------------------------

  async _prepareContext() {
    
    return {
      actor: this.actor,
      system: this.actor.system,
      // system: this.actor?.system ?? {},
      isLocked: this.isLocked,
      isLockOwner: this.isLockOwner,
      // canEdit: this.isLockOwner, (redundant)
     
      lockUser: this.lock?.username ?? null
    };
  }

//---------------------------------------------------------
// Lock Functions
//---------------------------------------------------------

async unlockSheet() {
  if (this.isLocked && !this.isLockOwner) return;

  await this.actor.update({
    "system.editLock": {
      userId: game.user.id,
      username: game.user.name,
      timestamp: Date.now()
    }
  });
  /*
  this.isEditing = true;
  this.render({ force: true });
  */
}

async lockSheet() {
  if (!this.isLockOwner) return;

// FLush any remaining edits
  if (Object.keys(this.lastValues).length) {
    const update = {};
    for (const [k, v] of Object.entries(this.lastValues)) {
      update[`system.${k}`] = v;
    }
    await this.actor.update(update);
  }

  this._stopTypingUpdate();

  await this.actor.update({
    "system.editLock": null
  });

  /*
  this.isEditing = false;
  this.render({ force: true });
  */
}

//---------------------------------------------------------
// Live Updates (Typing)
//---------------------------------------------------------

  _startTypingUpdate() {
    if (!this.isLockOwner) return;
    if (this.typingInterval) return;

    this.typingInterval = setInterval(() => {
      if (!Object.keys(this.lastValues).length) return;

      const update = {};
      for (const [k, v] of Object.entries(this.lastValues)) {
        update[`system.${k}`] = v;
      }
      this.actor.update(update);
    }, 100);
  }

  _stopTypingUpdate() {
    clearInterval(this.typingInterval);
    this.typingInterval = null;
    this.lastValues = {};
  }

  _onEdit(){
    console.log("edit clicked");
    this.unlockSheet();
  }


  _onSubmit(){
    console.log("submit clicked");
    this.lockSheet();
  }


}








//---------------------------------------------------------
// Render on Update
//---------------------------------------------------------
/*
  _onActorUpdate(changed, options, userId) {
  if (foundry.utils.getProperty(changed, "system.editLock") !== undefined ) {
    this.render({ force: true });
  }
  console.log("Red Thread | ", this.actor.apps, this.actor._source.system.editLock, this.actor.system.editLock);
}
*/
//---------------------------------------------------------
// Listeners
//---------------------------------------------------------
/*
activateListeners(html) {
  super.activateListeners(html);

  console.log("Red Thread | activateListeners called", html);

  // -------------------------------------------- 
  // Lock / Unlock Buttons                        
  // -------------------------------------------- 

  html.querySelector("[data-action='submit']")?.addEventListener("click", async () => {
    console.log("submit clicked");
    await this.lockSheet();
  });

  html.querySelector("[data-action='edit']")?.addEventListener("click", async () => {
    console.log("edit clicked");
    await this.unlockSheet();
  });
*/
  /*
  const editBtn = html.querySelector("[data-action='edit']");
  const submitBtn = html.querySelector("[data-action='submit']");

  if (editBtn) editBtn.addEventListener("click", () => this.unlockSheet());
  if (submitBtn) submitBtn.addEventListener("click", () => this.lockSheet());
*/
/*
  html.find("[data-action='submit']").on("click", async () =>{
    console.log("Red Thread | Submitted by :", game.user.name);
    await this.lockSheet(); // When you submit you release your control and lock the sheet
    
  });

  html.find("[data-action='edit']").on("click", async () => {
    console.log("Red Thread | Claimed by :", game.user.name);
    await this.unlockSheet(); // Click edit to unlock the sheet and make changes
    
  });
*/
/*
// In case we want to handle actions centrally
  html.querySelectorAll("[data-action]").forEach(btn => {
  btn.addEventListener("click", this._handleAction.bind(this));
});
*/
  /* -------------------------------------------- */
  /* Live Autosave (Optimistic)                   */
  /* -------------------------------------------- */
/*
  //html.find("[data-field]").on("input", async (event) => {
    // Only allow the lock owner to edit
  html.querySelectorAll("[data-field]").forEach((el) => {
    el.addEventListener("input", (event) => {
    if (!this.isLockOwner) return;
    
    const target = event.currentTarget;
    this.lastValues[target.dataset.field] = target.value;
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this._stopTypingUpdate(), 300);
    this._startTypingUpdate();
    });
  });  
*/
    /*
    // Persist immediately
    await this.actor.update({
      [`system.${field}`]: value
    });
    */
  

//---------------------------------------------------------
// Block browser Form Submit
//---------------------------------------------------------
/*
  _onSubmit(event) {
    // Block ALL automatic submission
    event.preventDefault();
    event.stopPropagation();
  }
*/



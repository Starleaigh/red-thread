/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class EvidenceSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  
  /* -------------------------------------------- */
  /* Template Parts                               */
  /* -------------------------------------------- */

  static PARTS = {
    main:{
      template: "./systems/red-thread/templates/actors/evidence-sheet.hbs"
    }
  }

  static DEFAULT_OPTIONS = {
    tag: "div",
    // id: "red-thread",
    classes: ["red-thread", "evidence-sheet"],
    template: "./systems/red-thread/templates/actors/evidence-sheet.hbs",
    submitOnChange: false,
    closeOnSubmit: false,
    resizeable: true,
    actions: {
      edit: function _onEdit(event) {this.unlockSheet()},
      submit: function _onSubmit(event){this.submit()}
    }
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
      isLocked: this.isLocked,
      isLockOwner: this.isLockOwner,
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
  
  return;
}

  async _readSheetData(event) {

    if (!this.isLockOwner) return;
    console.log("Red Thread | Read Sheet Fires ");
    if(!(this.element instanceof HTMLElement)) return {};
      
    const data = {};
  
    this.element.querySelectorAll("[data-field]").forEach(el => {
    data[el.dataset.field] = el.value;

    });

    return data;

  }

async _writeSheetData(data) {

    if (!this.isLockOwner) return;

    const update = {};
    for (const [k, v] of Object.entries(data)) {
      update[`system.${k}`] = v;
    }

    console.log("Red Thread | Actor Update Payload: ", update);
    return update;
}

  async submit(event) {
    if (!this.isLockOwner) return;

    console.log("Red Thread | Element is HTMLElement: ", this.element instanceof HTMLElement);

    const data = await this._readSheetData();
    console.log("Red Thread | Read Data: ", data);
    
    const update = await this._writeSheetData(data);
    await this.actor.update(update);
  
    await this.lockSheet();
  }

async lockSheet() {
  if (!this.isLockOwner) return;

  console.log("Red Thread | lockSheet Fires!");
  await this.actor.update({
    "system.editLock": null
  });
  this.render({ force: true });
}
}
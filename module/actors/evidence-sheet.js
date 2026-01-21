/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class EvidenceSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  
  static PARTS = {
    form:{
      template: "systems/red-thread/templates/actors/evidence-sheet.hbs"
    }
  };

  static DEFAULT_OPTIONS = {
    tag: "form",
    submitOnChange: true,
    closeOnSubmit: false,
    //classes: ["red-thread", "evidence-sheet"],
    actions: {
      // define clickhandlers here.
     // evidenceAction: EvidenceSheet.doSomething();
    }
  };

  async _prepareContext() {
    return {
      actor: this.actor,
      system: this.system
    }
  };

/*
  static doSomething(event, target) {
    // Logic for a button with data-action="doSomething"
  }
}
  */
}

/*
    // Prepares the data object for the Handlebars template
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.document.system;
    context.config = CONFIG.red-thread;
    // Add custom display logic here
    return context;
  }

    // Native JS event listeners (replaces activateListeners)
  _onRender(context, options) {
    // Standard listeners or DOM manipulation here
  }
*/
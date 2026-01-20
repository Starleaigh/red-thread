/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

export class RedThreadActor extends Actor {
  /*
    static metadata = {
    name: "Actor",
    collection: "actors",
    label: "Actor",
    isEmbedded: false,
    types: ["evidence", "poi", "casefile", "investigator"]
  };
  
  static get schema() {
    return foundry.utils.mergeObject(super.schema, {
      // Your custom fields
      description: { type: String, default: "" }
    });
  }*/
    prepareData() {
        super.prepareData();
        if (this.type === "evidence") {
        // evidence logic
    }
  }
}
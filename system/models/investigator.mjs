// import { foundry } from "../../foundry.js";
/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

export class InvestigatorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { fields } = foundry.data;

    return {
      investigator: new fields.SchemaField({
        defaultportrait: new fields.StringField({ initial: "./systems/red-thread/assets/images/default-profile.jpg" }),
        portrait: new fields.StringField({ initial: "" }),
        firstname: new fields.StringField({ initial: "" }),
        lastname: new fields.StringField({ initial: "" }),
        age: new fields.StringField({ initial: "" }),
        sex: new fields.StringField({ initial: "" }),
        occupation: new fields.StringField({ initial: "" }),
        residence: new fields.StringField({ initial: "" }),
        birthplace: new fields.StringField({ initial: "" }),
        appearance: new fields.StringField({ initial: "" }),
        ideology: new fields.StringField({ initial: "" }),
        disorders: new fields.StringField({ initial: "" }),
        significant: new fields.StringField({ initial: "" }),
        encounters: new fields.StringField({ initial: "" }),
        backstory: new fields.StringField({ initial: "" })        

      })
    };
  }
}

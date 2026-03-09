// import { foundry } from "../../foundry.js";
/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

export class InvestigatorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { fields } = foundry.data;

    return {
      investigator: new fields.SchemaField({
        defaultportrait: new fields.StringField({ initial: "./systems/red-thread/assets/images/default-profile.jpg" }),
        portrait: new fields.StringField({ initial: "" }),

        title: new fields.StringField({ initial: "" }),
        firstname: new fields.StringField({ initial: "" }),
        middlename: new fields.StringField({ initial: "" }),
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
        backstory: new fields.StringField({ initial: "" }),
        
        str: new fields.NumberField({ initial: 0 }),
        con: new fields.NumberField({ initial: 0 }),
        dex: new fields.NumberField({ initial: 0 }),
        int: new fields.NumberField({ initial: 0 }),
        edu: new fields.NumberField({ initial: 0 }),
        app: new fields.NumberField({ initial: 0 }),
        pow: new fields.NumberField({ initial: 0 }),
        siz: new fields.NumberField({ initial: 0 }),

        hp: new fields.NumberField({ initial: 0 }),
        hp_max: new fields.NumberField({ initial: 0 }),
        mp: new fields.NumberField({ initial: 0 }),
        mp_max: new fields.NumberField({ initial: 0 }),
        luck: new fields.NumberField({ initial: 0 }),
        luck_start: new fields.NumberField({ initial: 0 }),
        san: new fields.NumberField({ initial: 0 }),
        san_start: new fields.NumberField({ initial: 0 }),
        san_max: new fields.NumberField({ initial: 0 }),
        insane: new fields.NumberField({ initial: 0 }),

        move: new fields.NumberField({ initial: 0 }),
        build: new fields.NumberField({ initial: 0 }),
        dodge: new fields.NumberField({ initial: 0 }),
        dmg_bonus: new fields.NumberField({ initial: 0 }),

        temp_insanity_bool: new fields.BooleanField({  initial: false }),
        indef_insanity_bool: new fields.BooleanField({  initial: false }),
        major_wound_bool: new fields.BooleanField({  initial: false }),
        unconscious_bool: new fields.BooleanField({  initial: false }),
        dying_bool: new fields.BooleanField({  initial: false }),

      }),

      // ── Notes pages ───────────────────────────────────────
      notes_a: new fields.StringField({ initial: "" }),
      notes_b: new fields.StringField({ initial: "" }),
      notes_c: new fields.StringField({ initial: "" }),
      notes_d: new fields.StringField({ initial: "" }),
    };
  }
}

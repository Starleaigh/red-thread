/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

const fields = foundry.data.fields;

export class CthulhuSkillDataModel extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            base: new fields.NumberField({ initial: 0 }),
            occupation: new fields.BooleanField({ initial: false }),
            improvement: new fields.BooleanField({ initial: false }),
            specialization: new fields.StringField({ initial: "" })
        };
    }
} 
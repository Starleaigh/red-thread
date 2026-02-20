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

        accounting: new fields.NumberField({  initial: 5 }),
        accounting_bool: new fields.BooleanField({  initial: false }),

        anthropology: new fields.NumberField({  initial: 1 }),
        anthropology_bool: new fields.BooleanField({  initial: false }),

        appraise: new fields.NumberField({  initial: 5 }),
        appraise_bool: new fields.BooleanField({  initial: false }),

        archaeology: new fields.NumberField({  initial: 1 }),
        archaeology_bool: new fields.BooleanField({  initial: false }),

        art_craft_cust1: new fields.StringField({ initial: "" }),
        art_craft_custnumb1: new fields.NumberField({  initial: 5 }),
        art_craft_cust1_bool: new fields.BooleanField({  initial: false }),
        
        art_craft_cust2: new fields.StringField({ initial: "" }),
        art_craft_custnumb2: new fields.NumberField({  initial: 5 }),
        art_craft_cust2_bool: new fields.BooleanField({  initial: false }),

        charm: new fields.NumberField({  initial: 15 }),
        charm_bool: new fields.BooleanField({  initial: false }),

        climb: new fields.NumberField({  initial: 20 }),
        climb_bool: new fields.BooleanField({  initial: false }),

        credit_rating: new fields.NumberField({  initial: 0 }),
        credit_rating_bool: new fields.BooleanField({  initial: false }),

        cthulhu_mythos: new fields.NumberField({  initial: 0 }),
        cthulhu_mythos_bool: new fields.BooleanField({  initial: false }),

        disguise: new fields.NumberField({  initial: 5 }),
        disguise_bool: new fields.BooleanField({  initial: false }),

        dodge: new fields.NumberField({  initial: 0 }),
        dodge_bool: new fields.BooleanField({  initial: false }),

        drive_auto: new fields.NumberField({  initial: 20 }),
        drive_auto_bool: new fields.BooleanField({  initial: false }),

        elec_repair: new fields.NumberField({  initial: 10 }),
        elec_repair_bool: new fields.BooleanField({  initial: false }),

        fast_talk: new fields.NumberField({  initial: 5 }),
        fast_talk_bool: new fields.BooleanField({  initial: false }),

        fight_brawl: new fields.NumberField({  initial: 25 }),
        fight_brawl_bool: new fields.BooleanField({  initial: false }),

        fight_cust1: new fields.StringField({ initial: "" }),
        fight_custnumb1: new fields.NumberField({  initial: 0 }),
        fight_cust1_bool: new fields.BooleanField({  initial: false }),

        fight_cust2: new fields.StringField({ initial: "" }),
        fight_custnumb2: new fields.NumberField({  initial: 0 }),
        fight_cust2_bool: new fields.BooleanField({  initial: false }),

        firearms_handgun: new fields.NumberField({  initial: 20 }),
        firearms_handgun_bool: new fields.BooleanField({  initial: false }),

        firearms_rifles_shotgun: new fields.NumberField({  initial: 25 }),
        firearms_rifles_shotgun_bool: new fields.BooleanField({  initial: false }),
        
        firearm_cust1: new fields.StringField({ initial: "" }),
        firearm_custnumb1: new fields.NumberField({  initial: 0 }),
        firearm_cust1_bool: new fields.BooleanField({  initial: false }),

        first_aid: new fields.NumberField({  initial: 30 }),
        first_aid_bool: new fields.BooleanField({  initial: false }),

        history: new fields.NumberField({  initial: 5 }),
        history_bool: new fields.BooleanField({  initial: false }),

        intimidate: new fields.NumberField({  initial: 15 }),
        intimidate_bool: new fields.BooleanField({  initial: false }),

        jump: new fields.NumberField({  initial: 5 }),
        jump_bool: new fields.BooleanField({  initial: false }),

        language_own: new fields.NumberField({  initial: 0 }),
        language_own_bool: new fields.BooleanField({  initial: false }),
        
        language_cust1: new fields.StringField({ initial: "" }),
        languasge_custnumb1: new fields.NumberField({  initial: 1 }),
        language_cust1_bool: new fields.BooleanField({  initial: false }),

        language_cust2: new fields.StringField({ initial: "" }),
        languasge_custnumb2: new fields.NumberField({  initial: 1 }),
        language_cust2_bool: new fields.BooleanField({  initial: false }),

        language_cust3: new fields.StringField({ initial: "" }),
        languasge_custnumb3: new fields.NumberField({  initial: 1 }),
        language_cust3_bool: new fields.BooleanField({  initial: false }),

        law: new fields.NumberField({  initial: 5 }),
        law_bool: new fields.BooleanField({  initial: false }),

        library_use: new fields.NumberField({  initial: 20 }),
        library_use_bool: new fields.BooleanField({  initial: false }),

        listen: new fields.NumberField({  initial: 20 }),
        listen_bool: new fields.BooleanField({  initial: false }),

        locksmith: new fields.NumberField({  initial: 1 }),
        locksmith_bool: new fields.BooleanField({  initial: false }),

        mech_repair: new fields.NumberField({  initial: 10 }),
        mech_repair_bool: new fields.BooleanField({  initial: false }),

        medicine: new fields.NumberField({  initial: 1 }),
        medicine_bool: new fields.BooleanField({  initial: false }),

        natural_world: new fields.NumberField({  initial: 10 }),
        natural_world_bool: new fields.BooleanField({  initial: false }),

        navigate: new fields.NumberField({  initial: 10 }),
        navigate_bool: new fields.BooleanField({  initial: false }),

        occult: new fields.NumberField({  initial: 5 }),
        occult_bool: new fields.BooleanField({  initial: false }),

        persuade: new fields.NumberField({  initial: 10 }),
        persuade_bool: new fields.BooleanField({  initial: false }),

        pilot: new fields.NumberField({  initial: 1 }),
        pilot_bool: new fields.BooleanField({  initial: false }),

        psychoanalysis: new fields.NumberField({  initial: 1 }),
        psychoanalysis_bool: new fields.BooleanField({  initial: false }),

        psychology: new fields.NumberField({  initial: 10 }),
        psychology_bool: new fields.BooleanField({  initial: false }),

        ride: new fields.NumberField({  initial: 5 }),
        ride_bool: new fields.BooleanField({  initial: false }),

        science_biology: new fields.NumberField({  initial: 1 }),
        science_biology_bool: new fields.BooleanField({  initial: false }),

        science_chemistry: new fields.NumberField({  initial: 1 }),
        science_chemistry_bool: new fields.BooleanField({  initial: false }),

        science_physics: new fields.NumberField({  initial: 1 }),
        science_physics_bool: new fields.BooleanField({  initial: false }),

        slight_of_hand: new fields.NumberField({  initial: 10 }),
        slight_of_hand_bool: new fields.BooleanField({  initial: false }),

        spot_hidden: new fields.NumberField({  initial: 25 }),
        spot_hidden_bool: new fields.BooleanField({  initial: false }),

        stealth: new fields.NumberField({  initial: 20 }),
        stealth_bool: new fields.BooleanField({  initial: false }),

        survival: new fields.NumberField({  initial: 10 }),
        survival_bool: new fields.BooleanField({  initial: false }),

        swim: new fields.NumberField({  initial: 20 }),
        swim_bool: new fields.BooleanField({  initial: false }),

        throw: new fields.NumberField({  initial: 20 }),
        throw_bool: new fields.BooleanField({  initial: false }),

        track: new fields.NumberField({  initial: 10 }),
        track_bool: new fields.BooleanField({  initial: false }),

        custom1: new fields.StringField({ initial: "" }),
        custom_numb1: new fields.NumberField({  initial: 0 }),
        custom1_bool: new fields.BooleanField({  initial: false }),

        custom2: new fields.StringField({ initial: "" }),
        custom_numb2: new fields.NumberField({  initial: 0 }),
        custom2_bool: new fields.BooleanField({  initial: false }),

        custom3: new fields.StringField({ initial: "" }),
        custom_numb3: new fields.NumberField({  initial: 0 }),
        custom3_bool: new fields.BooleanField({  initial: false }),

        custom4: new fields.StringField({ initial: "" }),
        custom_numb4: new fields.NumberField({  initial: 0 }),
        custom4_bool: new fields.BooleanField({  initial: false }),


      })
    };
  }
}

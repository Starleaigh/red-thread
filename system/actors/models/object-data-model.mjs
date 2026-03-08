/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

export class ObjectDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { fields } = foundry.data;

    return {
      // ── Core description ──────────────────────────────────
      description: new fields.StringField({ initial: "" }),

      // ── Category ──────────────────────────────────────────
      // Used to tag items in inventory and filter attack actions.
      // Values: "weapon" | "clue" | "document" | "key" | "artefact" | "other"
      category: new fields.StringField({ initial: "other" }),

      // ── GM-only investigation data ────────────────────────
      // Hidden from players until revealed
      caseSignificance: new fields.StringField({ initial: "" }),

      // ── State: where is this object right now? ────────────
      // These are not mutually exclusive — an object can be
      // pinned on the caseboard AND carried simultaneously.
      carriedBy: new fields.StringField({ initial: "", nullable: true }),
      inPartyInventory: new fields.BooleanField({ initial: false }),

      // ── Chain of custody ──────────────────────────────────
      // Array of { actorId, actorName, timestamp, action }
      // action: "picked_up" | "dropped" | "transferred" | "recovered"
      chainOfCustody: new fields.ArrayField(
        new fields.SchemaField({
          actorId:   new fields.StringField({ initial: "" }),
          actorName: new fields.StringField({ initial: "" }),
          timestamp: new fields.NumberField({ initial: 0, integer: true }),
          action:    new fields.StringField({ initial: "picked_up" }),
        }),
        { initial: [] }
      ),

      // ── Weapon stats (optional) ───────────────────────────
      // Only relevant if this object is a weapon.
      // Populates the attack actions page on carrier's sheet.
      isWeapon: new fields.BooleanField({ initial: false }),
      weapon: new fields.SchemaField({
        skill:      new fields.StringField({ initial: "" }),   // skill name used to attack
        damage:     new fields.StringField({ initial: "" }),   // e.g. "1d6+db"
        range:      new fields.StringField({ initial: "" }),   // e.g. "Touch", "20m"
        uses:       new fields.StringField({ initial: "" }),   // e.g. "1 shot", "unlimited"
        malfunction: new fields.NumberField({ initial: 100 }), // jam/misfire threshold
      }),

      // ── Edit lock (collaborative editing) ────────────────
      // Mirrors the pattern from the original evidence sheet.
      // Null when unlocked; set to lock owner when editing.
      editLock: new fields.SchemaField({
        userId:    new fields.StringField({ initial: "" }),
        username:  new fields.StringField({ initial: "" }),
        timestamp: new fields.NumberField({ initial: 0, integer: true }),
      }, { nullable: true, initial: null }),
    };
  }
}
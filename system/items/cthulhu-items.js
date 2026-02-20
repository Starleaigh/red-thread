/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

export class CthulhuItem extends Item {
    get isSkill() {
        return this.type === "skill";
    }

    get value() {
        if (!this.isSkill) return null;

        const base = this.system.base ?? 0;
        const occupation = this.system.occupation ? 20 : 0;
        return base + occupation;
    }

    get half() {
        if (!this.isSkill) return null;
        return Math.floor(this.value / 2);
    }

    get fifth() {
        if (!this.isSkill) return null;
        return Math.floor(this.value / 5);
  }
}

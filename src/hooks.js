
/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

// hooks.js

import { drawThread, redrawThread } from "./threads.js";
import { PinManager } from "./pinmanager.js";

export function registerHooks() {
    Hooks.on("canvasReady", () => {
        console.log("Red Thread | Canvas ready");
        PinManager.initializePins();
    });

    Hooks.on("canvasDestroyed", () => {
        PinManager.clearPins();
    });

    Hooks.on("refreshToken", (token, changes) => {
        const pin = PinManager.getPin(token);
        pin?.update();
        redrawThread();
    });

    Hooks.on("refreshNote", (note, changes) => {
        const pin = PinManager.getPin(note);
        pin?.update();
    });


}
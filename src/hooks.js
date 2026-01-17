
// hooks.js

/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

export function registerHooks() {
    Hooks.on("canvasReady", () => {
        console.log("Red Thread | Canvas ready");
    });
}

// module.js

import { registerHooks } from "./hooks.js";
import { drawThread, redrawThread } from "./threads.js";

// Notifies when the module is initialized
Hooks.once("init", () => {
  console.log("Red Thread | Casefile initialized");
});

// Notifies when the module is ready
Hooks.once("ready", () =>{
  console.log("Red Thread | Casefile Ready")
  registerHooks();
});

Hooks.on("canvasReady", () => {
  console.log("Red Thread | Canvas Ready (Module.js)");

  // TEMP grab first two tokens on the canvas
  const tokens = canvas.tokens.placeables;

  if (tokens.length >= 2) {
    drawThread(tokens[0], tokens[1]);
  }
});

Hooks.on("updateToken", () => {
  redrawThread();
});
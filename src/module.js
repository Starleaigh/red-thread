/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

// module.js

import { RedThreadLayer } from "./redThreadLayer.js";

// Notifies when the module is initialized
Hooks.once("init", () => {
  console.log("Red Thread | Casefile initialized!");

    CONFIG.Canvas.layers.redThreadLayer = {
    layerClass: RedThreadLayer,
    group: "primary"
    };
});

Hooks.on("canvasReady", () => {
  console.log("Red Thread | Casefile Ready!");

  const layer = canvas.redThreadLayer;
  layer?.initializePins();
})


/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

// module.js

import { RedThreadLayer } from "./redThreadLayer.js";

// Register canvas earlier than init
Hooks.once("setup", () => {

    CONFIG.Canvas.layers.redThreadLayer = {
    layerClass: RedThreadLayer,
    group: "interface",
    };

    console.log("Red Thread | Setup Casefile! Layers:", Object.keys(CONFIG.Canvas.layers));

  });

// Notifies when the module is initialized
Hooks.once("init", () => {
  console.log("Red Thread | Casefile initialized!");
});

Hooks.on("canvasReady", () => {

  console.log("Red Thread | Layer Keys: ", Object.keys(canvas.layers));
  console.log("Red Thread | Layers: ", canvas.layers);

  //works for primary layer
 const layer = canvas.layers.find(l => l instanceof RedThreadLayer);

  if (!layer) {
    console.warn("Red Thread | Red Thread layer not found!");
    return;

  }

  layer?.clearPins();
  layer?.initializePins();

console.log(canvas.primary.children.map(c => `${c.constructor.name} (${c.zIndex})`));
console.log("Red Thread | Casefile Ready!");

})
/*
Hooks.on("refreshToken", token => {
  canvas.layers.redThreadLayer?.updatePin(token);
});

Hooks.on("refreshNote", note => {
  canvas.layers.redThreadLayer?.updatePin(note);
});

Hooks.on("updateToken", (token) => {
  canvas.layers.redThreadLayer?.updatePin(token);
});

Hooks.on("updateNote", (note) => {
  canvas.layers.redThreadLayer?.updatePin(note);
});

Hooks.on("createToken", (token) => {
  canvas.layers.redThreadLayer?.updatePin(token);
});

Hooks.on("createNote", (note) => {
  canvas.layers.redThreadLayer?.updatePin(note);
});

Hooks.on("deleteToken", (token) => {
  canvas.layers.redThreadLayer?.removePin(token);
});

Hooks.on("deleteNote", (note) => {
  canvas.layers.redThreadLayer?.removePin(note);
});
*/
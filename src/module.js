
// module.js

import { registerHooks } from "./hooks.js";

// Notifies when the module is initialized
Hooks.once("init", () => {
  console.log("Red Thread | Casefile initialized");
});

// Notifies when the module is ready
Hooks.once("ready", () =>{
  console.log("Red Thread | Casefile Ready")
  registerHooks();
});
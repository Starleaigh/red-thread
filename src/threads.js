
/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

//  threads.js

console.log("Red Thread | Threads Loaded!");

let threadGraphics = null;
let tokenA = null;
let tokenB = null;

/**
 * Draw a red thread between two tokens
 */
export function drawThread(a, b){
    tokenA = a;
    tokenB = b;

    if (!threadGraphics) {
        threadGraphics = new PIXI.Graphics();
        canvas.stage.addChild(threadGraphics);
    }

    redrawThread();
}

/**
 * Redraw the thread based upon token positions
 */
export function redrawThread() {
    if (!tokenA || !tokenB || !threadGraphics) return;

    const aPos = tokenA.center;
    const bPos = tokenB.center;

    threadGraphics.clear();
    threadGraphics.lineStyle(3, 0xff0000, 1);
    threadGraphics.moveTo(aPos.x, aPos.y);
    threadGraphics.lineTo(bPos.x, bPos.y);

}
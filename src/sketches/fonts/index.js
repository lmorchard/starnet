import * as PIXI from "pixi.js";
import { SmoothGraphics as Graphics } from "@pixi/graphics-smooth";
import {
  defineSystem,
  addEntity,
  addComponent,
  pipe,
  removeComponent,
} from "bitecs";
import * as Stats from "../../lib/stats.js";
import * as World from "../../lib/world.js";
import * as Viewport from "../../lib/viewport/pixi.js";
import {
  RenderableShape,
  RenderableShapes,
  Renderable,
} from "../../lib/viewport/index.js";
import { Position, Velocity } from "../../lib/positionMotion.js";
import { setupTwiddles } from "../twiddles.js";

import FontFutural from "../../fonts/futural.json";
import FontFuturam from "../../fonts/futuram.json";
import FontScripts from "../../fonts/scripts.json";
import FontScriptc from "../../fonts/scriptc.json";
import FontRowmant from "../../fonts/rowmant.json";

const fonts = [FontFutural, FontFuturam, FontScripts, FontScriptc, FontRowmant];

async function main() {
  const stats = Stats.init();
  const viewport = Viewport.init();
  const world = World.init();

  const gMessage = new Graphics();
  gMessage.zIndex = 1000;
  viewport.stage.addChild(gMessage);

  const message =
    "Hello, world! Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor";

  const xStart = -600;
  const lineHeight = 45;

  let yPos = -100;
  for (const font of fonts) {
    let xPos = xStart;
    const cache = {};
    for (const char of message) {
      const glyph = font.glyphs[char];
      if (!glyph) continue;

      let g;
      if (cache[char]) {
        g = cache[char].clone();
      } else {
        g = cache[char] = renderGlyph(glyph);
      }
      if (!g) continue;

      viewport.stage.addChild(g);
      g.x = xPos - glyph.left;
      g.y = yPos;

      xPos += glyph.width;
    }
    yPos += lineHeight;
  }

  const pane = setupTwiddles(world, viewport);
  const pipeline = pipe(() => pane.refresh());
  world.run(pipeline, viewport, stats);

  console.log("READY.");
}

function renderGlyph(glyph) {
  const g = new Graphics();
  g.lineStyle(2, 0xffaa33, 1);
  for (const line of glyph.lines) {
    if (line.length === 0) continue;
    g.moveTo(line[0][0], line[0][1]);
    for (let lineIdx = 1; lineIdx < line.length; lineIdx++) {
      g.lineTo(line[lineIdx][0], line[lineIdx][1]);
    }
  }

  return g;
}

main().catch(console.error);

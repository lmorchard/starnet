import * as PIXI from "../../vendor/pkg/pixijs.r-KJT4iPjz5B.js";
import { SmoothGraphics as Graphics } from "../../vendor/pkg/@pixi/graphics-smooth.NsV85ncQhaZu.js";
import {
  defineSystem,
  addEntity,
  addComponent,
  pipe,
  removeComponent,
} from "../../vendor/pkg/bitecs.X3qmdHz1R-IJ.js";
import * as Stats from "../../lib/stats.OV0McSz3wFid.js";
import * as World from "../../lib/world.bhzOOQ20lZSu.js";
import * as Viewport from "../../lib/viewport/pixi.XSEFIUy8GAN6.js";
import {
  RenderableShape,
  RenderableShapes,
  Renderable,
} from "../../lib/viewport/index.igwHgqGqcndw.js";
import { Position, Velocity } from "../../lib/positionMotion.giEPfFZ5syz2.js";
import { setupTwiddles } from "../twiddles.4SEh7Ls-hShU.js";

import FontFutural from "../../fonts/futural.json.proxy.js";

async function main() {
  const stats = Stats.init();
  const viewport = Viewport.init();
  const world = World.init();

  const gMessage = new Graphics();
  gMessage.zIndex = 1000;
  viewport.stage.addChild(gMessage);

  const message =
    "Hello, world! Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor";

  const cache = {};
  let xPos = -550;
  for (const char of message) {
    const glyph = FontFutural.glyphs[char];
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
    
    xPos += glyph.width;
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

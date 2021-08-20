import {
  createWorld,
  Types,
  defineComponent,
  defineQuery,
  addEntity,
  addComponent,
  defineSystem,
  pipe,
} from "bitecs";
import * as PIXI from "pixi.js";
import { AdvancedBloomFilter, GlitchFilter } from "pixi-filters";
import * as MainLoop from "mainloop.js";
import Stats from "stats.js";

async function main() {
  const drawStats = new Stats();
  drawStats.setMode(0);
  drawStats.domElement.style.position = "absolute";
  drawStats.domElement.style.left = "0px";
  drawStats.domElement.style.top = "0px";
  document.body.appendChild(drawStats.domElement);

  const tickStats = new Stats();
  tickStats.setMode(0);
  tickStats.domElement.style.position = "absolute";
  tickStats.domElement.style.left = "0px";
  tickStats.domElement.style.top = "55px";
  document.body.appendChild(tickStats.domElement);

  let pixiApp = new PIXI.Application({ width: 1000, height: 1000 });
  document.body.appendChild(pixiApp.view);

  const pixiGraphics = new PIXI.Graphics();
  pixiApp.stage.addChild(pixiGraphics);

  pixiGraphics.filters = [new AdvancedBloomFilter({
    kernelSize: 15,
    blur: 3,
    quality: 8,
  })];

  const Vector3 = { x: Types.f32, y: Types.f32, z: Types.f32 };
  const Position = defineComponent(Vector3);
  const Velocity = defineComponent(Vector3);

  const movementQuery = defineQuery([Position, Velocity]);

  const movementSystem = defineSystem((world) => {
    const {
      time: { deltaSec },
    } = world;
    const ents = movementQuery(world);
    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];
      Position.x[eid] += Velocity.x[eid] * deltaSec;
      Position.y[eid] += Velocity.y[eid] * deltaSec;
      Position.z[eid] += Velocity.z[eid] * deltaSec;
    }
  });

  const pipeline = pipe(movementSystem);

  const world = createWorld();
  world.time = { delta: 0, elapsed: 0 };

  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Velocity, eid);

  Position.x[eid] = 0;
  Position.y[eid] = 0;
  Velocity.x[eid] = 100;
  Velocity.y[eid] = 50;

  Object.assign(window, { world, Position, Velocity });

  MainLoop.setUpdate((delta) => {
    tickStats.begin();
    world.time.delta = delta;
    world.time.deltaSec = delta / 1000;
    world.time.elapsed += delta;
    pipeline(world);
    tickStats.end();
  })
    .setDraw((interpolationPercentage) => {
      drawStats.begin();
      draw(world, pixiApp, pixiGraphics, movementQuery, Position);
      drawStats.end();
    })
    .setEnd((fps, panic) => {})
    .start();

  console.log("READY.");
}

function draw(world, app, g, movementQuery, Position) {
  g.clear();

  const ents = movementQuery(world);
  for (const eid of ents) {
    g.beginFill(0x8888ff);
    g.drawRect(Position.x[eid], Position.y[eid], 50, 50);
    g.endFill();
  }

  /*
  // Rectangle
  g.beginFill(0xde3249);
  g.drawRect(50, 50, 100, 100);
  g.endFill();

  // Rectangle + line style 1
  g.lineStyle(2, 0xfeeb77, 1);
  g.beginFill(0x650a5a);
  g.drawRect(200, 50, 100, 100);
  g.endFill();

  // Rectangle + line style 2
  g.lineStyle(10, 0xffbd01, 1);
  g.beginFill(0xc34288);
  g.drawRect(350, 50, 100, 100);
  g.endFill();

  // Rectangle 2
  g.lineStyle(2, 0xffffff, 1);
  g.beginFill(0xaa4f08);
  g.drawRect(530, 50, 140, 100);
  g.endFill();

  // Circle
  g.lineStyle(0); // draw a circle, set the lineStyle to zero so the circle doesn't have an outline
  g.beginFill(0xde3249, 1);
  g.drawCircle(100, 250, 50);
  g.endFill();

  // Circle + line style 1
  g.lineStyle(2, 0xfeeb77, 1);
  g.beginFill(0x650a5a, 1);
  g.drawCircle(250, 250, 50);
  g.endFill();

  // Circle + line style 2
  g.lineStyle(10, 0xffbd01, 1);
  g.beginFill(0xc34288, 1);
  g.drawCircle(400, 250, 50);
  g.endFill();

  // Ellipse + line style 2
  g.lineStyle(2, 0xffffff, 1);
  g.beginFill(0xaa4f08, 1);
  g.drawEllipse(600, 250, 80, 50);
  g.endFill();

  // draw a shape
  g.beginFill(0xff3300);
  g.lineStyle(4, 0xffd900, 1);
  g.moveTo(50, 350);
  g.lineTo(250, 350);
  g.lineTo(100, 400);
  g.lineTo(50, 350);
  g.closePath();
  g.endFill();

  // draw a rounded rectangle
  g.lineStyle(2, 0xff00ff, 1);
  g.beginFill(0x650a5a, 0.25);
  g.drawRoundedRect(50, 440, 100, 100, 16);
  g.endFill();

  */
  // draw polygon
  const path = [600, 370, 700, 460, 780, 420, 730, 570, 590, 520];

  g.lineStyle(0);
  g.beginFill(0x3500fa, 1);
  g.drawPolygon(path);
  g.endFill();
}

main().catch(console.error);

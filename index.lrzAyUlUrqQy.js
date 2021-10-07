import { addEntity, addComponent, pipe } from "./vendor/pkg/bitecs.Cb7ZI4NlcLCA.js";
import { Pane } from "./vendor/pkg/tweakpane.1FDvvucfevJ0.js";
import { rngIntRange } from "./lib/randoms.X9VRh4IgloX1.js";
import * as Stats from "./lib/stats.OV0McSz3wFid.js";
import * as World from "./lib/world.ZS8GZskyr35N.js";
import * as Viewport from "./lib/viewport/pixi.KWw1fbaMt1oT.js";
import { Renderable } from "./lib/viewport/index.TVdOLd-6oyqv.js";
import {
  Position,
  Velocity,
  movementSystem,
  bouncerSystem,
} from "./lib/positionMotion.Y1d0skLDuuy2.js";

async function main() {
  const stats = Stats.init();
  const world = World.init();
  const viewport = Viewport.init();

  const spawnThingy = () => {
    const eid = addEntity(world);

    addComponent(world, Renderable, eid);
    addComponent(world, Position, eid);
    addComponent(world, Velocity, eid);

    Position.x[eid] = rngIntRange(-300, 300);
    Position.y[eid] = rngIntRange(-300, 300);
    Position.z[eid] = rngIntRange(1, 6);
    Velocity.x[eid] = rngIntRange(-100, 100);
    Velocity.y[eid] = rngIntRange(-100, 100);
    Velocity.z[eid] = rngIntRange(-12, 12);

    return eid;
  };

  for (let idx = 0; idx < 200; idx++) {
    spawnThingy();
  }

  Object.assign(window, { world, viewport, Position, Velocity, Renderable });

  const pane = new Pane();
  const f1 = pane.addFolder({ title: "Twiddles"/*, expanded: false*/ });
  f1.addMonitor(world, "fps" /*, { view: "graph", min: 0, max: 75 }*/);

  f1.addInput(viewport, "zoom", { min: 0.1, max: 3.0 });
  f1.addInput(viewport, "camera", {
    x: { min: -1000, max: 1000 },
    y: { min: -1000, max: 1000 },
  });

  const grid1 = f1.addFolder({ title: "Grid", expanded: false });
  grid1.addInput(viewport, "gridEnabled");
  grid1.addInput(viewport, "gridSize", { min: 10, max: 1000 });
  grid1.addInput(viewport, "gridLineColor", { view: "color" });
  grid1.addInput(viewport, "gridLineAlpha", { min: 0.0, max: 1.0 });
  grid1.addInput(viewport, "gridLineWidth", { min: 0.5, max: 5.0 });

  f1.addSeparator();
  f1.addButton({ title: "Spawn" }).on("click", spawnThingy);
  f1.addButton({ title: "Stop" }).on("click", () => world.loop.stop());
  f1.addButton({ title: "Start" }).on("click", () => world.loop.start());

  const pipeline = pipe(
    movementSystem,
    bouncerSystem,
    () => pane.refresh(),
  );

  world.run(pipeline, viewport, stats);

  console.log("READY.");
}

main().catch(console.error);

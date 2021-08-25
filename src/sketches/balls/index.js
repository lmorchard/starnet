import { addEntity, addComponent, pipe } from "bitecs";
import { rngIntRange } from "../../lib/randoms.js";
import * as Stats from "../../lib/stats.js";
import * as World from "../../lib/world.js";
import * as Viewport from "../../lib/viewport/pixi.js";
import { Renderable } from "../../lib/viewport/index.js";
import {
  Position,
  Velocity,
  movementSystem,
  bouncerSystem,
} from "../../lib/positionMotion.js";
import { setupTwiddles } from "../twiddles.js";

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

  const pane = setupTwiddles(world, viewport);
  pane.addButton({ title: "Spawn" }).on("click", spawnThingy);

  const pipeline = pipe(
    movementSystem,
    bouncerSystem,
    () => pane.refresh(),
  );

  world.run(pipeline, viewport, stats);

  console.log("READY.");
}

main().catch(console.error);

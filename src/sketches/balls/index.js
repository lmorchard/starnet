import { addEntity, addComponent, pipe } from "bitecs";
import { rand } from "../../lib/utils.js";
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

async function main() {
  const stats = Stats.init();
  const world = World.init();
  const viewport = Viewport.init();

  const pipeline = pipe(movementSystem, bouncerSystem);

  const spawnThingy = () => {
    const eid = addEntity(world);
    
    addComponent(world, Renderable, eid);
    addComponent(world, Position, eid);
    addComponent(world, Velocity, eid);

    Position.x[eid] = rand(-300, 300);
    Position.y[eid] = rand(-300, 300);
    Position.z[eid] = rand(1, 6);
    Velocity.x[eid] = rand(-100, 100);
    Velocity.y[eid] = rand(-100, 100);
    Velocity.z[eid] = rand(-12, 12);

    return eid;
  };

  for (let idx = 0; idx < 100; idx++) {
    spawnThingy();
  }

  Object.assign(window, { world, viewport, Position, Velocity, Renderable });

  world.run(pipeline, viewport, stats);

  console.log("READY.");
}

main().catch(console.error);

import {
  defineQuery,
  addEntity,
  addComponent,
  defineSystem,
  pipe,
} from "bitecs";

import * as Stats from "./lib/stats.js";
import * as Viewport from "./lib/viewportPixi.js";

import * as World from "./lib/world.js";
import { Position, Velocity, Renderable } from "./lib/components.js";

import { rand } from "./lib/utils.js";

async function main() {
  const stats = Stats.init();
  const world = World.init();
  const viewport = Viewport.init();

  const movementQuery = defineQuery([Position, Velocity]);

  const movementSystem = defineSystem((world) => {
    const {
      time: { deltaSec },
    } = world;
    for (const eid of movementQuery(world)) {
      Position.x[eid] += Velocity.x[eid] * deltaSec;
      Position.y[eid] += Velocity.y[eid] * deltaSec;
      Position.z[eid] += Velocity.z[eid] * deltaSec;
    }
  });

  const bouncerSystem = defineSystem((world) => {
    const ents = movementQuery(world);
    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i];
      if (Position.x[eid] > 400 || Position.x[eid] < -400) {
        Velocity.x[eid] = 0 - Velocity.x[eid];
      }
      if (Position.y[eid] > 400 || Position.y[eid] < -400) {
        Velocity.y[eid] = 0 - Velocity.y[eid];
      }
    }
  });

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

  for (let idx = 0; idx < 200; idx++) {
    spawnThingy();
  }

  Object.assign(window, { world, viewport, Position, Velocity, Renderable });

  world.run(pipeline, viewport, stats);

  console.log("READY.");
}

main().catch(console.error);

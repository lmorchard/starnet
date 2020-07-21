import { System } from "https://unpkg.com/ecsy@0.2.1/build/ecsy.module.js";

export function init(world) {
  world.registerSystem(MotionSystem);
}

export class Position {
  constructor() {
    this.x = this.y = 0;
  }
}

export class Motion {
  constructor() {
    this.dx = this.dy = 0;
  }
}

export class MotionSystem extends System {
  execute(delta) {
    for (let entity of this.queries.motion.results) {
      var motion = entity.getComponent(Motion);
      var position = entity.getMutableComponent(Position);
      position.x += motion.dx * delta;
      position.y += motion.dy * delta;
    }
  }
}

// Define a query of entities that have "Velocity" and "Position" components
MotionSystem.queries = {
  motion: {
    components: [Motion, Position]
  }
};

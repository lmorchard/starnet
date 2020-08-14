import { System, Component, Types } from "./index.js";

export function init(world) {
  world.registerComponent(Position);
  world.registerComponent(Motion);
  world.registerSystem(MotionSystem);
}

export class Position extends Component {}
Position.schema = {
  x: { type: Types.Number, default: 0 },
  y: { type: Types.Number, default: 0 },
};

export class Motion extends Component {}
Motion.schema = {
  dx: { type: Types.Number, default: 0 },
  dy: { type: Types.Number, default: 0 },
};

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
    components: [Motion, Position],
  },
};

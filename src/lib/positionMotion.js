import { Types, defineComponent, defineQuery, defineSystem } from "bitecs";

export const Vector3 = { x: Types.f32, y: Types.f32, z: Types.f32 };

export const Position = defineComponent(Vector3);

export const Velocity = defineComponent(Vector3);

export const movementQuery = defineQuery([Position, Velocity]);

export const movementSystem = defineSystem((world) => {
  const {
    time: { deltaSec },
  } = world;
  for (const eid of movementQuery(world)) {
    Position.x[eid] += Velocity.x[eid] * deltaSec;
    Position.y[eid] += Velocity.y[eid] * deltaSec;
    Position.z[eid] += Velocity.z[eid] * deltaSec;
  }
});

export const bouncerSystem = defineSystem((world) => {
  for (const eid of movementQuery(world)) {
    if (Position.x[eid] > 400 || Position.x[eid] < -400) {
      Velocity.x[eid] = 0 - Velocity.x[eid];
    }
    if (Position.y[eid] > 400 || Position.y[eid] < -400) {
      Velocity.y[eid] = 0 - Velocity.y[eid];
    }
  }
});

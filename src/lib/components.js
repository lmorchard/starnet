import {
  Types,
  defineComponent,
} from "bitecs";

export const Vector3 = { x: Types.f32, y: Types.f32, z: Types.f32 };

export const Position = defineComponent(Vector3);

export const Velocity = defineComponent(Vector3);

export const Renderable = defineComponent({
  mouseOver: Types.i8,
  mouseDown: Types.i8,
  mouseClicked: Types.i8,
  mouseClickedSeen: Types.i8,
});

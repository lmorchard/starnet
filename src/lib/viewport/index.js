import { Types, defineComponent } from "bitecs";

export const Renderable = defineComponent({
  shape: Types.i8,
  mouseOver: Types.i8,
  mouseDown: Types.i8,
  mouseClicked: Types.i8,
  mouseClickedSeen: Types.i8,
});

export const RenderableShapes = [
  "Default",
  "Node",
  "GatewayNode",
  "FirewallNode",
];

export const RenderableShape = RenderableShapes.reduce(
  (acc, name, idx) => ({
    ...acc,
    [name]: idx,
  }),
  {}
);

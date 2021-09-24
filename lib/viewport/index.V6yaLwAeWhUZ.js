import { Types, defineComponent, defineQuery } from "../../vendor/pkg/bitecs.uBk-LJ8s6O3X.js";
import { Position } from "../positionMotion.Rf-6EmSjJMue.js";

export const Renderable = defineComponent({
  visible: Types.i8,
  shape: Types.i8,
  mouseOver: Types.i8,
  mouseDown: Types.i8,
  mouseClicked: Types.i8,
  mouseClickedSeen: Types.i8,
});

export const renderQuery = defineQuery([Position, Renderable]);

export const CameraFocus = defineComponent();

export const cameraFocusQuery = defineQuery([Position, CameraFocus]);

export const RenderableShapes = [
  "Default",
  "Node",
  "GatewayNode",
  "StorageNode",
  "FirewallNode",
  "HubNode",
  "TerminalNode",
  "WalletNode",
  "ICENode",
];

export const RenderableShape = RenderableShapes.reduce(
  (acc, name, idx) => ({
    ...acc,
    [name]: idx,
  }),
  {}
);
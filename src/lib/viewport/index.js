import { Types, defineComponent } from "bitecs";

export const Renderable = defineComponent({
  mouseOver: Types.i8,
  mouseDown: Types.i8,
  mouseClicked: Types.i8,
  mouseClickedSeen: Types.i8,
});

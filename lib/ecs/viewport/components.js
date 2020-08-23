import { Component, Types, TagComponent } from "../index.js";

export class CursorTarget extends TagComponent {}

export class Renderable extends TagComponent {}

export class ViewportFocus extends TagComponent {}

export class Shape extends Component {}
Shape.schema = {
  primitive: { type: Types.String, default: "box" },
  width: { type: Types.Number, default: 50 },
  height: { type: Types.Number, default: 50 },
};

export class MouseInputState extends Component {}
MouseInputState.schema = {
  clientX: { type: Types.Number, default: 0},
  clientY: { type: Types.Number, default: 0},
  cursorX: { type: Types.Number, default: 0},
  cursorY: { type: Types.Number, default: 0},
  buttonDown: { type: Types.Boolean, default: false},
  buttonDownLastAt: { type: Types.Number, default: -1},
  buttonClicked: { type: Types.Boolean, default: false},
  overEntity: { type: Types.String, default: ''},
  clickedEntity: { type: Types.String, default: ''},
};

export class Camera extends Component {}
Camera.schema = {
  followedEntityId: { type: Types.String, default: null },
  cameraX: { type: Types.Number, default: 0 },
  cameraY: { type: Types.Number, default: 0 },
  rotation: { type: Types.Number, default: 0.0 },
  zoom: { type: Types.Number, default: 1.0 },
  zoomMin: { type: Types.Number, default: 0.1 },
  zoomMax: { type: Types.Number, default: 10.0 },
  zoomWheelFactor: { type: Types.Number, default: 0.1 },
};

export class RendererState extends Component {}
RendererState.schema = {
  renderableEntities: { type: Types.JSON, default: {}},

  viewportWidth: { type: Types.Number, default: 0 },
  viewportHeight: { type: Types.Number, default: 0 },

  visibleWidth: { type: Types.Number, default: 0 },
  visibleHeight: { type: Types.Number, default: 0 },
  visibleLeft: { type: Types.Number, default: 0 },
  visibleTop: { type: Types.Number, default: 0 },
  visibleRight: { type: Types.Number, default: 0 },
  visibleBottom: { type: Types.Number, default: 0 },

  gridSize: { type: Types.Number, default: 100 },
  gridColor: { type: Types.String, default: "rgba(70,30,115,0.5)" },
  gridLineWidth: { type: Types.Number, default: 1.5 },
};

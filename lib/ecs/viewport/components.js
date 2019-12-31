import { TagComponent } from "https://ecsy.io/build/ecsy.module.js";
import { Lerp } from "../../lerp.js";

export class CursorTarget extends TagComponent {}

export class Renderable extends TagComponent {}

export class ViewportFocus extends TagComponent {}

export class Shape {
  constructor() {
    this.primitive = "box";
    this.width = 50;
    this.height = 50;
  }
}

export class MouseInputState {
  constructor() {
    Object.assign(this, {
      clientX: 0,
      clientY: 0,
      cursorX: 0,
      cursorY: 0,
      buttonDown: false,
      buttonDownLastAt: -1,
      buttonClicked: false,
      overEntity: null,
      clickedEntity: null
    });
  }
}

export class Camera {
  constructor() {
    Object.assign(this, {
      followedEntityId: null,
      position: Lerp.create({
        speed: 0.004,
        items: {
          x: { start: 0, end: 0 },
          y: { start: 0, end: 0 }
        }
      }),
      moving: false,
      speed: 0.004,
      progress: 1.0,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      currentX: 0,
      currentY: 0
    });
  }
}

export class RendererState {
  constructor() {
    Object.assign(this, {
      renderableEntities: {},
      zoom: 1.0,
      zoomMin: 0.1,
      zoomMax: 10.0,
      zoomWheelFactor: 0.1,
      visibleWidth: 0,
      visibleHeight: 0,
      visibleLeft: 0,
      visibleTop: 0,
      visibleRight: 0,
      visibleBottom: 0,
      gridSize: 100,
      gridColor: "rgba(70,30,115,0.5)",
      gridLineWidth: 1.5
    });
  }
}

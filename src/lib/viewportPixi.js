import * as PIXI from "pixi.js";
import { AdvancedBloomFilter, CRTFilter, RGBSplitFilter } from "pixi-filters";
import { defineQuery } from "bitecs";
import { Position, Renderable } from "./components.js";

export function init(...args) {
  return new ViewportPixi(...args);
}

function createRenderable(viewport, eid) {
  const g = viewport.createGraphics(eid);

  if (Math.random() < 0.5) {
    g.lineStyle(2, 0xfeeb77, 1);
    g.beginFill(0x3333ff);
    g.drawRect(-10, -10, 20, 20);
    g.endFill();
  } else {
    g.lineStyle(2, 0xfeeb77, 1);
    g.beginFill(0x650a5a, 1);
    g.drawCircle(0, 0, 10);
    g.endFill();
  }

  return g;
}

class ViewportPixi {
  constructor(parentId = "main") {
    const parentNode = document.getElementById(parentId);
    const { clientWidth, clientHeight } = parentNode;

    const renderer = new PIXI.Renderer({
      width: clientWidth,
      height: clientHeight,
    });
    parentNode.appendChild(renderer.view);

    const stage = new PIXI.Container();

    stage.filters = [
      new AdvancedBloomFilter({
        kernelSize: 11,
        blur: 3,
        quality: 8,
      }),
    ];

    const renderQuery = defineQuery([Position, Renderable]);

    Object.assign(this, { renderer, stage, renderQuery, renderables: {} });
  }

  createGraphics(eid) {
    const g = new PIXI.Graphics();

    g.pivot.x = 0;
    g.pivot.y = 0;
    g.interactive = true;

    g.on("click", () => (Renderable.mouseClicked[eid] = true));
    g.on("pointerdown", () => (Renderable.mouseDown[eid] = true));
    g.on("pointerup", () => (Renderable.mouseDown[eid] = false));
    g.on("pointerover", () => (Renderable.mouseOver[eid] = true));
    g.on("pointerout", () => {
      Renderable.mouseOver[eid] = false;
      Renderable.mouseDown[eid] = false;
    });

    return g;
  }

  draw(world, interpolationPercentage) {
    const { renderer, stage, renderables } = this;
    this.updateViewportBounds(world);

    const entityIds = this.renderQuery(world);

    for (const eid of entityIds) {
      if (!renderables[eid]) {
        const r = createRenderable(this, eid);
        renderables[eid] = r;
        stage.addChild(r);
      }
    }

    for (const eid in renderables) {
      const r = renderables[eid];
      if (entityIds.includes(parseInt(eid))) {
        this.updateRenderable(eid, r);
      } else {
        this.destroyRenderable(eid, r);
      }
    }

    renderer.render(stage);
  }

  destroyRenderable(eid, r) {
    delete renderables[eid];
    stage.removeChild(r);
  }

  updateRenderable(eid, r) {
    r.x = Position.x[eid];
    r.y = Position.y[eid];
    r.rotation = Position.z[eid];
    r.scale.x = 1.0;
    r.scale.y = 1.0;

    if (Renderable.mouseDown[eid]) {
      r.scale.x *= 1.5;
      r.scale.y *= 1.5;
    }
    if (Renderable.mouseClicked[eid]) {
      Renderable.mouseClickedSeen[eid] = true;
    }
    if (Renderable.mouseClickedSeen[eid]) {
      Renderable.mouseClicked[eid] = false;
      Renderable.mouseClickedSeen[eid] = false;
    }
  }

  updateViewportBounds(world) {
    const { renderer, stage } = this;
    const { clientWidth, clientHeight } = renderer.view.parentNode;
    const { width, height } = renderer;

    if (clientWidth !== width || clientHeight !== height) {
      renderer.resize(clientWidth, clientHeight);
    }

    const centerX = clientWidth / 2;
    const centerY = clientHeight / 2;
    stage.x = centerX;
    stage.y = centerY;

    if (!world.viewport) world.viewport = {};
    world.viewport.clientWidth = clientWidth;
    world.viewport.clientHeight = clientHeight;
  }
}

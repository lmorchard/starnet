import * as PIXI from "pixi.js";
import { AdvancedBloomFilter, CRTFilter, RGBSplitFilter } from "pixi-filters";
import { defineQuery } from "bitecs";
import { Renderable } from "./index.js";
import { Position } from "../positionMotion.js";

export function init(...args) {
  return new ViewportPixi(...args);
}

function createRenderable(viewport, eid) {
  const g = viewport.createRenderableGraphics(eid);

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
    stage.sortableChildren = true;
    stage.filters = [
      new AdvancedBloomFilter({
        kernelSize: 11,
        blur: 3,
        quality: 8,
      }),
    ];

    const bgGraphics = new PIXI.Graphics();
    bgGraphics.zIndex = -1000;
    stage.addChild(bgGraphics);

    const renderQuery = defineQuery([Position, Renderable]);

    Object.assign(this, {
      renderables: {},
      renderer,
      stage,
      bgGraphics,
      renderQuery,
      camera: { x: 0, y: 0 },
      cameraX: 0,
      cameraY: 0,
      zoom: 1.0,
      gridEnabled: true,
      gridSize: 250,
      gridLineWidth: 2.0,
      gridLineColor: 0xffffff,
      gridLineAlpha: 0.125,
    });
  }

  createRenderableGraphics(eid) {
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
    this.updateBackdrop(world);

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

    // Let the mouse stay clicked for a frame, then clear the state.
    if (Renderable.mouseClicked[eid]) {
      Renderable.mouseClickedSeen[eid] = true;
    }
    if (Renderable.mouseClickedSeen[eid]) {
      Renderable.mouseClicked[eid] = false;
      Renderable.mouseClickedSeen[eid] = false;
    }
  }

  updateViewportBounds(world) {
    const { renderer, stage, camera, zoom } = this;
    const { clientWidth, clientHeight } = renderer.view.parentNode;
    const { width, height } = renderer;

    if (clientWidth !== width || clientHeight !== height) {
      renderer.resize(clientWidth, clientHeight);
    }

    let centerX = clientWidth / 2 - camera.x * zoom;
    let centerY = clientHeight / 2 - camera.y * zoom;

    stage.x = centerX;
    stage.y = centerY;
    stage.scale.x = zoom;
    stage.scale.y = zoom;

    if (!world.viewport) world.viewport = {};
    world.viewport.clientWidth = clientWidth;
    world.viewport.clientHeight = clientHeight;
  }

  updateBackdrop(world) {
    this.bgGraphics.clear();
    if (!this.gridEnabled) return;

    const {
      zoom,
      camera,
      gridSize,
      gridLineWidth,
      gridLineColor,
      gridLineAlpha,
      bgGraphics: g,
    } = this;

    const {
      viewport: { clientWidth, clientHeight },
    } = world;

    // FIXME: This math seems to get real squirrely at 0.25 zoom and below
    const visibleWidth = Math.floor(clientWidth / zoom);
    const visibleHeight = Math.floor(clientHeight / zoom);
    const visibleLeft = 0 - visibleWidth / 2 + camera.x;
    const visibleTop = 0 - visibleHeight / 2 + camera.y;
    const gridOffsetX = visibleLeft % gridSize;
    const gridOffsetY = visibleTop % gridSize;

    g.lineStyle(gridLineWidth, gridLineColor, gridLineAlpha);
    const xStart = visibleLeft - gridOffsetX;
    const xEnd = visibleWidth + gridOffsetX + gridSize * 2;
    for (let x = xStart; x < xEnd; x += gridSize) {
      g.moveTo(x, visibleTop);
      g.lineTo(x, visibleTop + visibleHeight);
    }
    const yStart = visibleTop - gridOffsetY;
    const yEnd = visibleHeight + gridOffsetY + gridSize * 2;
    for (let y = yStart; y < yEnd; y += gridSize) {
      g.moveTo(visibleLeft, y);
      g.lineTo(visibleLeft + visibleWidth, y);
    }
  }
}

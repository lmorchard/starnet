import * as PIXI from "pixi.js";
import { SmoothGraphics as Graphics } from "@pixi/graphics-smooth";
import { AdvancedBloomFilter, CRTFilter, RGBSplitFilter } from "pixi-filters";
import {
  cameraFocusQuery,
  Renderable,
  RenderableShape,
  RenderableShapes,
  renderQuery,
} from "./index.js";
import { Position } from "../positionMotion.js";
import { GraphLayoutEdge, graphLayoutEdgeQuery } from "../graphLayout";

export function init(...args) {
  return new ViewportPixi(...args);
}

class ViewportPixi {
  constructor(parentId = "main") {
    const parentNode = document.getElementById(parentId);
    const { clientWidth, clientHeight } = parentNode;

    const renderer = new PIXI.Renderer({
      width: clientWidth,
      height: clientHeight,
      //antialias: true,
      //autoDensity: true,
    });
    parentNode.appendChild(renderer.view);

    const stage = new PIXI.Container();
    stage.sortableChildren = true;
    stage.filters = [
      new AdvancedBloomFilter({
        threshold: 0.4,
        bloomScale: 1.5,
        brightness: 1.25,
        quality: 8,
      }),
      new PIXI.filters.FXAAFilter(),
    ];

    const edgeGraphics = new Graphics();
    edgeGraphics.zIndex = -500;
    stage.addChild(edgeGraphics);

    const bgGraphics = new Graphics();
    bgGraphics.zIndex = -1000;
    stage.addChild(bgGraphics);

    Object.assign(this, {
      renderables: {},
      renderer,
      stage,
      bgGraphics,
      edgeGraphics,
      camera: { x: 0, y: 0 },
      zoom: 1.0,
      gridEnabled: true,
      gridSize: 100,
      gridLineWidth: 2.0,
      gridLineColor: 0xffffff,
      gridLineAlpha: 0.125,
    });
  }

  draw(world, interpolationPercentage) {
    const { renderer, stage, renderables } = this;

    this.updateCameraFocus(world);
    this.updateViewportBounds(world);
    this.updateBackdrop(world);
    this.updateEdges(world);

    const entityIds = renderQuery(world);

    for (const eid of entityIds) {
      if (!renderables[eid]) {
        this.createRenderable(eid);
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

  updateCameraFocus(world) {
    for (const eid of cameraFocusQuery(world)) {
      // TODO: More smoothly transition this with LERP for a chase-cam effect
      this.camera.x = Position.x[eid];
      this.camera.y = Position.y[eid];
    }
  }

  createRenderable(eid) {
    const { stage, renderables } = this;

    const g = new Graphics();

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

    renderables[eid] = g;
    stage.addChild(g);

    this.drawShape(g, Renderable.shape[eid]);

    return g;
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

  destroyRenderable(eid, r) {
    delete renderables[eid];
    stage.removeChild(r);
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

  updateEdges(world) {
    const { edgeGraphics: g } = this;

    g.clear();

    // TODO: unless / until there are one-way edges, de-dupe edges with
    // the same but reversed from/to coords
    for (const eid of graphLayoutEdgeQuery(world)) {
      const fromX = GraphLayoutEdge.fromX[eid];
      const fromY = GraphLayoutEdge.fromY[eid];
      const toX = GraphLayoutEdge.toX[eid];
      const toY = GraphLayoutEdge.toY[eid];

      g.lineStyle(2, 0x33ff33, 1.0);
      g.moveTo(fromX, fromY);
      g.lineTo(toX, toY);
    }
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

    const visibleWidth = Math.floor(clientWidth / zoom);
    const visibleHeight = Math.floor(clientHeight / zoom);
    const visibleLeft = 0 - visibleWidth / 2 + camera.x;
    const visibleTop = 0 - visibleHeight / 2 + camera.y;

    const gridOffsetX = Math.abs(visibleLeft % gridSize);
    const gridOffsetY = Math.abs(visibleTop % gridSize);

    const xStart = visibleLeft + gridOffsetX;
    const xEnd = xStart + visibleWidth + gridOffsetX;
    const yStart = visibleTop + gridOffsetY;
    const yEnd = yStart + visibleHeight + gridOffsetY;

    g.lineStyle(gridLineWidth, gridLineColor, gridLineAlpha);
    for (let x = xStart; x < xEnd; x += gridSize) {
      g.moveTo(x, visibleTop);
      g.lineTo(x, visibleTop + visibleHeight);
    }
    for (let y = yStart; y < yEnd; y += gridSize) {
      g.moveTo(visibleLeft, y);
      g.lineTo(visibleLeft + visibleWidth, y);
    }
  }

  drawShape(g, shape) {
    switch (shape) {
      case RenderableShape.GatewayNode: {
        g.lineStyle(2, 0xfeeb77, 1);
        g.beginFill(0x650a5a, 1);
        g.drawCircle(0, 0, 10);
        g.endFill();
        break;
      }
      case RenderableShape.FirewallNode: {
        g.lineStyle(2, 0xfeeb77, 1);
        g.beginFill(0x650a5a, 1);
        g.drawCircle(0, 0, 10);
        g.endFill();
        break;
      }
      default: {
        g.lineStyle(2, 0xfeeb77, 1);
        g.beginFill(0x3333ff);
        g.drawRect(-10, -10, 20, 20);
        g.endFill();
      }
    }
  }
}

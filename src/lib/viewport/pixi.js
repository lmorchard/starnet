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
import Easings from "../easings.js";
import { transition } from "../transitions.js";
import { Position } from "../positionMotion.js";
import { GraphLayoutNode, graphLayoutNodeQuery } from "../graphLayout.js";
import { hasComponent } from "bitecs";

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

    const filterStage = new PIXI.Container();

    this.bloom = new AdvancedBloomFilter({
      threshold: 0.2,
      bloomScale: 1.5,
      brightness: 1.0,
      blur: 1.5,
      quality: 5,
    });

    filterStage.filters = [new PIXI.filters.FXAAFilter(), this.bloom];

    const stage = new PIXI.Container();
    stage.sortableChildren = true;
    filterStage.addChild(stage);

    const edgeGraphics = new Graphics();
    edgeGraphics.zIndex = -500;
    stage.addChild(edgeGraphics);

    const bgGraphics = new Graphics();
    bgGraphics.zIndex = -1000;
    stage.addChild(bgGraphics);

    Object.assign(this, {
      renderables: {},
      renderer,
      filterStage,
      stage,
      bgGraphics,
      edgeGraphics,
      camera: { x: 0, y: 0 },
      cameraFocusEid: null,
      cameraEase: Easings.easeOutBack,
      cameraEaseDuration: 400,
      cameraTarget: {
        fromX: 0,
        fromY: 0,
        toX: 0,
        toY: 0,
        duration: 0,
        elapsed: 0,
        active: false,
      },
      zoom: 1.0,
      zoomLast: 1.0,
      shouldRedrawRenderables: false,
      gridEnabled: true,
      gridSize: 100,
      gridLineWidth: 2.0,
      gridLineColor: 0xffffff,
      gridLineAlpha: 0.1,
    });
  }

  draw(world, interpolationPercentage) {
    const { renderer, filterStage, stage, renderables } = this;

    this.updateCameraFocus(world);
    this.updateCameraTarget(world);
    this.updateViewportBounds(world);
    this.drawBackdrop(world);
    this.drawEdges(world);

    const entityIds = renderQuery(world);

    if (this.zoom !== this.lastZoom) {
      // zoom change affects line width of renderables
      this.shouldRedrawRenderables = true;
    }

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

    this.shouldRedrawRenderables = false;
    this.lastZoom = this.zoom;

    renderer.render(filterStage);
  }

  setCameraTarget(toX, toY, duration) {
    Object.assign(this.cameraTarget, {
      fromX: this.camera.x,
      fromY: this.camera.y,
      toX,
      toY,
      duration: duration || this.cameraEaseDuration,
      elapsed: 0,
      active: true,
    });
  }

  updateCameraFocus(world) {
    const focusEid = cameraFocusQuery(world)[0];
    if (!focusEid) return;

    const focusX = Position.x[focusEid];
    const focusY = Position.y[focusEid];
    if (focusEid === this.cameraFocusEid) {
      if (!this.cameraTarget.active) {
        this.camera.x = focusX;
        this.camera.y = focusY;
      }
    } else {
      this.cameraFocusEid = focusEid;
      this.setCameraTarget(focusX, focusY);
    }
  }

  updateCameraTarget(world) {
    if (!this.cameraTarget.active) return;

    const { camera, cameraEase, cameraTarget, cameraFocusEid } = this;
    const { fromX, fromY, duration, elapsed } = cameraTarget;

    let toX, toY;
    if (!cameraFocusEid) {
      ({ toX, toY } = cameraTarget);
    } else {
      toX = Position.x[cameraFocusEid];
      toY = Position.y[cameraFocusEid];
    }

    camera.x = transition(fromX, toX, duration, elapsed, cameraEase);
    camera.y = transition(fromY, toY, duration, elapsed, cameraEase);

    cameraTarget.elapsed += world.time.delta;
    if (cameraTarget.elapsed >= duration) {
      cameraTarget.active = false;
    }
  }

  createRenderable(eid) {
    const { stage, renderables } = this;

    const g = new Graphics();

    g.pivot.x = 0;
    g.pivot.y = 0;
    g.interactive = true;
    g.hitArea = new PIXI.Rectangle(-50, -50, 100, 100);

    g.on("click", () => (Renderable.mouseClicked[eid] = true));
    g.on("tap", () => (Renderable.mouseClicked[eid] = true));
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
    if (this.shouldRedrawRenderables) {
      this.drawShape(this.renderables[eid], Renderable.shape[eid]);
    }

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
    const { stage, renderables } = this;
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

  drawBackdrop(world) {
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

    const lineWidth = 2 * (1 / zoom);

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

    g.lineStyle(lineWidth, gridLineColor, gridLineAlpha);
    for (let x = xStart; x < xEnd; x += gridSize) {
      g.moveTo(x, visibleTop);
      g.lineTo(x, visibleTop + visibleHeight);
    }
    for (let y = yStart; y < yEnd; y += gridSize) {
      g.moveTo(visibleLeft, y);
      g.lineTo(visibleLeft + visibleWidth, y);
    }
  }

  drawEdges(world) {
    const { edgeGraphics: g, zoom } = this;

    const lineWidth = 2 * (1 / zoom);

    g.clear();
    g.lineStyle(lineWidth, 0xaaaaff, 0.25);

    const seen = new Set();
    for (const fromEid of graphLayoutNodeQuery(world)) {
      if (!hasComponent(world, Position, fromEid)) continue;
      const connections = GraphLayoutNode.connections[fromEid];

      for (const toEid of connections) {
        if (!hasComponent(world, Position, toEid)) continue;

        const seenKey = [fromEid, toEid].sort().join(":");
        if (seen.has(seenKey)) continue;
        seen.add(seenKey);

        g.moveTo(Position.x[fromEid], Position.y[fromEid]);
        g.lineTo(Position.x[toEid], Position.y[toEid]);
      }
    }
  }

  drawShape(g, shape) {
    const { zoom } = this;
    const lineWidth = 2 * (1 / zoom);

    const P = [];
    for (let p = -50; p <= 50; p += 50 / 4) {
      P.push(p);
    }

    g.clear();

    switch (shape) {
      case RenderableShape.GatewayNode: {
        g.lineStyle(lineWidth, 0x33ff33, 1);
        g.drawPolygon([P[0], P[3], P[0], P[5], P[8], P[5], P[8], P[3]]);
        g.drawPolygon([P[4], P[0], P[4], P[8]]);
        g.drawPolygon([P[2], P[2], P[4], P[0], P[6], P[2]]);
        g.drawPolygon([P[2], P[6], P[4], P[8], P[6], P[6]]);
        break;
      }
      case RenderableShape.StorageNode: {
        g.lineStyle(lineWidth, 0x3333ff, 1);
        g.drawPolygon([
          P[0],
          P[1],
          P[1],
          P[0],
          P[7],
          P[0],
          P[8],
          P[1],
          P[8],
          P[7],
          P[7],
          P[8],
          P[1],
          P[8],
          P[0],
          P[7],
        ]);
        g.moveTo(P[0], P[1]);
        g.lineTo(P[1], P[2]);
        g.lineTo(P[7], P[2]);
        g.lineTo(P[8], P[1]);
        break;
      }
      case RenderableShape.FirewallNode: {
        g.lineStyle(lineWidth, 0xff0000, 1);
        g.drawPolygon([-50, 50, -50, -50, 50, -50, 50, 50]);

        g.moveTo(P[0], P[2]);
        g.lineTo(P[8], P[2]);
        g.moveTo(P[0], P[4]);
        g.lineTo(P[8], P[4]);
        g.moveTo(P[0], P[6]);
        g.lineTo(P[8], P[6]);

        g.moveTo(P[2], P[0]);
        g.lineTo(P[2], P[2]);
        g.moveTo(P[6], P[0]);
        g.lineTo(P[6], P[2]);

        g.moveTo(P[4], P[2]);
        g.lineTo(P[4], P[4]);

        g.moveTo(P[2], P[4]);
        g.lineTo(P[2], P[6]);
        g.moveTo(P[6], P[4]);
        g.lineTo(P[6], P[6]);

        g.moveTo(P[4], P[6]);
        g.lineTo(P[4], P[8]);

        break;
      }
      case RenderableShape.HubNode: {
        g.lineStyle(lineWidth, 0xff33ff, 1);
        g.drawPolygon([
          P[0],
          P[3],
          P[0],
          P[5],
          P[3],
          P[8],
          P[5],
          P[8],
          P[8],
          P[5],
          P[8],
          P[3],
          P[5],
          P[0],
          P[3],
          P[0],
        ]);
        g.moveTo(P[0], P[3]);
        g.lineTo(P[8], P[3]);
        g.moveTo(P[0], P[5]);
        g.lineTo(P[8], P[5]);
        g.moveTo(P[3], P[0]);
        g.lineTo(P[3], P[8]);
        g.moveTo(P[5], P[0]);
        g.lineTo(P[5], P[8]);
        break;
      }
      case RenderableShape.TerminalNode: {
        g.lineStyle(lineWidth, 0x8888ff, 1);
        g.drawPolygon([P[1], P[0], P[7], P[0], P[7], P[5], P[1], P[5]]);
        g.drawPolygon([P[1], P[5], P[0], P[8], P[8], P[8], P[7], P[5]]);
        g.moveTo(P[3], P[7]);
        g.lineTo(P[5], P[7]);
        break;
      }
      case RenderableShape.WalletNode: {
        g.lineStyle(lineWidth, 0x44ff66, 1);
        g.drawPolygon([
          P[0],
          P[2],
          P[1],
          P[1],
          P[7],
          P[1],
          P[8],
          P[2],
          P[8],
          P[6],
          P[7],
          P[7],
          P[1],
          P[7],
          P[0],
          P[6],
        ]);
        g.drawPolygon([P[8], P[3], P[8], P[5], P[3], P[5], P[3], P[3]]);
        break;
      }
      case RenderableShape.ICENode: {
        g.lineStyle(lineWidth, 0x8888ff, 1);
        g.drawPolygon([
          P[3],
          P[0],
          P[2],
          P[1],
          P[2],
          P[3],
          P[3],
          P[4],
          P[3],
          P[5],
          P[5],
          P[5],
          P[5],
          P[4],
          P[6],
          P[3],
          P[6],
          P[1],
          P[5],
          P[0],
        ]);
        g.moveTo(P[3], P[1]);
        g.lineTo(P[5], P[3]);
        g.moveTo(P[3], P[3]);
        g.lineTo(P[5], P[1]);

        g.moveTo(P[4], P[4]);
        g.lineTo(P[4], P[5]);
        g.moveTo(P[0], P[5]);
        g.lineTo(P[8], P[8]);
        g.moveTo(P[0], P[8]);
        g.lineTo(P[8], P[5]);
        break;
      }
      default: {
        g.lineStyle(lineWidth, 0xff8888, 1);
        g.drawPolygon([-50, 50, -50, -50, 50, -50, 50, 50]);
        g.moveTo(0, -12.5);
        g.lineTo(0, 12.5);
        g.moveTo(-12.5, 0);
        g.lineTo(12.5, 0);
      }
    }
  }
}

import { System, Component, Types, ResourcesState } from "../../index.js";
import { GraphLayoutState } from "../../graph.js";
import { RendererState, Camera, Renderable, Shape } from "../components.js";
import { Position } from "../../positionMotion.js";

import WebGLDraw from "../../../../wgl6100/index.js";
import { heroShapes } from "./shapes.js";

const BACKDROP_SCENE_ID = "000000_backdrop";
const GRAPH_EDGES_SCENE_ID = "000001_graph_edges";

export class WebGLContext extends Component {}
WebGLContext.schema = {
  webglDraw: { type: Types.Ref, default: null },
};

export class WebGLDrawParameters extends Component {}
WebGLDrawParameters.schema = {
  lineWidth: { type: Types.Number, default: 2.0 },
  bloomStrength: { type: Types.Number, default: 1.0 },
  bloomRadius: { type: Types.Number, default: 0.5 },
  jitter: { type: Types.Number, default: 0.0 },
};

export async function init(world) {
  world.registerComponent(WebGLContext);
  world.registerComponent(WebGLDrawParameters);
  world.registerSystem(WebGLCanvasSystem);
}

export async function initState(worldState, { containerSelector }) {
  const webglDraw = new WebGLDraw({
    containerSelector,
    layers: ["hud", "world", "backdrop"],
  });
  await webglDraw.init();
  worldState.addComponent(WebGLContext, { webglDraw });
  worldState.addComponent(WebGLDrawParameters);
}

const drawProps = {
  hud: {
    zoom: 1.0,
    rotation: 0.0,
    cameraX: 0.0,
    cameraY: 0.0,
    lineWidth: 2.0,
    bloomStrength: 1.0,
    bloomRadius: 0.5,
    jitter: 0.0,
  },
  world: {},
  backdrop: {
    lineWidth: 1.0,
    bloomStrength: 0.2,
    bloomRadius: 0.25,
  },
};

export function draw(worldState, interpolationPercentage) {
  const camera = worldState.getMutableComponent(Camera);
  const webglDrawParameters = worldState.getMutableComponent(
    WebGLDrawParameters
  );
  Object.assign(drawProps.world, camera, webglDrawParameters);
  Object.assign(drawProps.backdrop, camera);
  worldState.getMutableComponent(WebGLContext).webglDraw.draw(drawProps);
}

export class WebGLCanvasSystem extends System {
  execute(delta, time) {
    const worldState = this.queries.worldState.results[0];
    const camera = worldState.getMutableComponent(Camera);
    const rendererState = worldState.getMutableComponent(RendererState);
    const { webglDraw } = worldState.getMutableComponent(WebGLContext);
    const { width, height } = webglDraw.canvas;

    rendererState.viewportWidth = width;
    rendererState.viewportHeight = height;

    this.updateBackdrop(delta, worldState, webglDraw, camera);
    this.updateGraphEdges(delta, worldState, webglDraw);
    this.updateHUDSpritesData(delta, worldState, webglDraw);
    this.updateSpritesData(delta, worldState, webglDraw);
  }

  updateHUDSpritesData(delta, worldState, webglDraw) {
    this.temporaryTextRenderingExperiment(worldState, webglDraw.sprites.hud);
  }

  updateSpritesData(delta, worldState, webglDraw) {
    const sprites = webglDraw.sprites.world;
    let entity;
    const renderablesQuery = this.queries.renderables;
    for (entity of renderablesQuery.added) {
      this.updateSpritesForEntity(entity, sprites);
    }
    for (entity of renderablesQuery.changed) {
      this.updateSpritesForEntity(entity, sprites);
    }
    for (entity of renderablesQuery.removed) {
      delete sprites[entity.id];
    }
  }

  temporaryTextRenderingExperiment(worldState, hudSprites) {
    const { webglDraw } = worldState.getMutableComponent(WebGLContext);
    const { fonts } = webglDraw;
    const { cameraX, cameraY } = worldState.getMutableComponent(Camera);

    const now = Date.now();
    const rand = ("" + Math.floor(Math.random() * 1000000)).padStart(8, "0");
    const message = `
        Hello, world! ${now} ${rand}

        ${Math.floor(cameraX)} x ${Math.floor(cameraY)}

        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do 
        eiusmod tempor incididunt ut labore et dolore magna aliqua. Vitae 
        turpis massa sed elementum tempus egestas sed. Aliquam sem fringilla
        ut morbi tincidunt augue. Ut lectus arcu bibendum at varius vel. 
        Congue quisque egestas diam in arcu cursus euismod quis viverra. 
        Justo nec ultrices dui sapien.
              
        Semper auctor neque vitae tempus 
        quam pellentesque nec nam. Fermentum et sollicitudin ac orci 6
        phasellus egestas tellus. Nunc sed augue lacus viverra vitae 
        congue eu consequat ac. Aliquam faucibus purus in massa. At 
        erat pellentesque adipiscing commodo.
      `;

    const shapes = fonts.futural.layoutText(message, 700);

    hudSprites["_fontplay"] = {
      position: [-300, -300],
      visible: true,
      rotation: Math.PI / 2,
      scale: 1.0,
      color: [1.0, 0.2, 0.2, 1.0],
      shapes,
    };
  }

  updateSpritesForEntity(entity, scene) {
    const { x, y } = entity.getComponent(Position);
    // const { primitive } = entity.getComponent(Shape);
    // const { node } = entity.getComponent(Node);

    if (!scene[entity.id]) {
      scene[entity.id] = {
        position: [0, 0],
        shapes: [],
        visible: false,
        rotation: 0.0,
        scale: 100.0,
        color: [1.0, 1.0, 1.0, 1.0],
      };
    }

    const sceneItem = scene[entity.id];
    sceneItem.position[0] = x;
    sceneItem.position[1] = y;
    sceneItem.shapes = heroShapes;
    sceneItem.visible = entity.alive;
    sceneItem.rotation = 0.0;
    sceneItem.scale = 100.0;
    sceneItem.color[0] = 0.4;
    sceneItem.color[1] = 0.8;
    sceneItem.color[2] = 0.4;
    sceneItem.color[3] = 1.0;
  }

  updateGraphEdges(delta, worldState, webglDraw) {
    const sprites = webglDraw.sprites.world;
    const { edges } = worldState.getComponent(GraphLayoutState);

    if (!sprites[GRAPH_EDGES_SCENE_ID]) {
      sprites[GRAPH_EDGES_SCENE_ID] = {
        visible: true,
        position: [0.0, 0.0],
        color: [0.3, 0.3, 0.6, 1.0],
        scale: 1,
        rotation: Math.PI / 2,
        shapes: [],
      };
    }
    const sceneSprite = sprites[GRAPH_EDGES_SCENE_ID];
    sceneSprite.shapes.length = 0;

    for (let [x1, y1, x2, y2] of edges) {
      sceneSprite.shapes.push([
        [x1, y1],
        [x2, y2],
      ]);
    }
  }

  updateBackdrop(delta, worldState, webglDraw, camera) {
    const sprites = webglDraw.sprites.backdrop;
    const {
      visibleLeft,
      visibleTop,
      visibleWidth,
      visibleHeight,
      gridSize,
      gridColor,
    } = worldState.getMutableComponent(RendererState);

    if (!sprites[BACKDROP_SCENE_ID]) {
      sprites[BACKDROP_SCENE_ID] = {
        visible: true,
        position: [0.0, 0.0],
        color: [0.1, 0.1, 0.1, 0.1],
        scale: 1,
        rotation: Math.PI / 2,
        shapes: [],
      };
    }
    const sceneSprite = sprites[BACKDROP_SCENE_ID];

    const gridOffsetX = visibleLeft % gridSize;
    const gridOffsetY = visibleTop % gridSize;

    sceneSprite.position[0] = visibleLeft;
    sceneSprite.position[1] = visibleTop;
    sceneSprite.shapes.length = 0;

    for (let x = -gridOffsetX; x < visibleWidth; x += gridSize) {
      sceneSprite.shapes.push([
        [x, 0],
        [x, visibleHeight + gridSize],
      ]);
    }
    for (let y = -gridOffsetY; y < visibleHeight; y += gridSize) {
      sceneSprite.shapes.push([
        [0, y],
        [visibleWidth + gridSize, y],
      ]);
    }
  }
}

WebGLCanvasSystem.queries = {
  worldState: {
    components: [WebGLContext, RendererState],
  },
  renderables: {
    components: [Renderable, Shape, Position],
    listen: {
      added: true,
      removed: true,
      changed: true,
    },
  },
};

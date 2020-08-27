import { System, Component, Types, ResourcesState } from "../../index.js";
import { GraphLayoutState } from "../../graph.js";
import { RendererState, Camera, Renderable, Shape } from "../components.js";
import { Position } from "../../positionMotion.js";

import * as WebGLDraw from "./draw.js";
import { heroShapes } from "./shapes.js";
import Font from "../../../fonts.js";

const BACKDROP_SCENE_ID = "000000_backdrop";
const GRAPH_EDGES_SCENE_ID = "000001_graph_edges";

export class WebGLContext extends Component {}
WebGLContext.schema = {
  container: { type: Types.Ref, default: null },
  canvas: { type: Types.Ref, default: null },
  lineWidth: { type: Types.Number, default: 2.0 },
  gl: { type: Types.Ref, default: null },
  scene: { type: Types.Ref, default: {} },
  programs: { type: Types.Ref, default: {} },
  buffers: { type: Types.Ref, default: {} },
  textures: { type: Types.Ref, default: [] },
  framebuffers: { type: Types.Ref, default: [] },

  bloomStrength: { type: Types.Number, default: 1.0 },
  bloomRadius: { type: Types.Number, default: 0.5 },
  jitter: { type: Types.Number, default: 0.0 },
};

export async function init(world) {
  world.registerComponent(WebGLContext);
  world.registerSystem(WebGLCanvasSystem);
}

export async function initState(worldState, { containerSelector }) {
  const contextProps = await WebGLDraw.init(containerSelector);
  worldState.addComponent(WebGLContext, contextProps);
}

export function draw(worldState, interpolationPercentage) {
  WebGLDraw.draw({
    interpolationPercentage,
    ...worldState.getMutableComponent(WebGLContext),
    ...worldState.getMutableComponent(Camera),
  });
}

export class WebGLCanvasSystem extends System {
  execute(delta, time) {
    const worldState = this.queries.worldState.results[0];
    const camera = worldState.getMutableComponent(Camera);
    const rendererState = worldState.getMutableComponent(RendererState);
    const canvasContext = worldState.getMutableComponent(WebGLContext);

    const {
      canvas: { width, height },
    } = canvasContext;
    rendererState.viewportWidth = width;
    rendererState.viewportHeight = height;

    this.updateBackdrop(delta, worldState, canvasContext, camera);
    this.updateGraphEdges(delta, worldState, canvasContext);
    this.updateSceneData(delta, worldState, canvasContext);
  }

  updateSceneData(delta, worldState, canvasContext) {
    const { scene } = worldState.getMutableComponent(WebGLContext);
    const { fonts } = worldState.getComponent(ResourcesState);

    const message = `
      Hello, world! ${Date.now()} ${('' + Math.floor(Math.random() * 1000000)).padStart(8, "0") }

      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do 
      eiusmod tempor incididunt ut labore et dolore magna aliqua. Vitae 
      turpis massa sed elementum tempus egestas sed. Aliquam sem fringilla
      ut morbi tincidunt augue. Ut lectus arcu bibendum at varius vel. 
      Congue quisque egestas diam in arcu cursus euismod quis viverra. 
      Justo nec ultrices dui sapien.
       
      Semper auctor neque vitae tempus 
      quam pellentesque nec nam. Fermentum et sollicitudin ac orci 
      phasellus egestas tellus. Nunc sed augue lacus viverra vitae 
      congue eu consequat ac. Aliquam faucibus purus in massa. At 
      erat pellentesque adipiscing commodo.
      
      Faucibus purus in massa 
      tempor nec feugiat nisl pretium. Duis ut diam quam nulla 
      porttitor massa id neque aliquam. Odio tempor orci dapibus 
      ultrices in iaculis nunc sed. In ante metus dictum at. 
    `;

    const font = fonts.futural;
    const maxWidth = 700;

    const lines = message.trim().split(/\n/g).map(line => line.trim());
    const paragraphs = [""];
    for (const line of lines) {
      if (line === "") {
        paragraphs.push(line);
      } else {
        paragraphs[paragraphs.length - 1] += line + " ";
      }
    }

    const spaceGlyph = font.stringToGlyphs(" ")[0];
    const glyphLines = [[]];
    for (const paragraph of paragraphs) {
      const words = paragraph.trim().split(/\s+/g);
      const wordGlyphs = words.map((word) => {
        const glyphs = font.stringToGlyphs(word);
        const wordWidth = glyphs.reduce((total, glyph) => total + glyph.width, 0);
        return [glyphs, wordWidth];
      });
  
      let currWidth = 0;
      for (const [glyphs, wordWidth] of wordGlyphs) {
        currWidth += wordWidth;
        if (currWidth >= maxWidth) {
          currWidth = 0;
          glyphLines.push([]);
        }
        currWidth += spaceGlyph.width;
        glyphLines[glyphLines.length - 1].push(...glyphs, spaceGlyph);
      }  
      glyphLines.push([spaceGlyph]);
      glyphLines.push([]);
    }
    glyphLines.pop();
    glyphLines.pop();

    const glyphShapes = [];
    let xCursor = 0;
    let yCursor = 0;

    const incX = (width) => (xCursor += width);
    const incY = (lineHeightFactor = 1.0) => {
      xCursor = 0;
      yCursor += font.lineHeight * lineHeightFactor;
    };

    for (const glyphs of glyphLines) {
      for (const glyph of glyphs) {
        const { left, right } = glyph;
        incX(0 - left);
        glyphShapes.push([]);
        for (const point of glyph.points) {
          if (!point) {
            glyphShapes.push([]);
          } else {
            const [x, y] = point;
            glyphShapes[glyphShapes.length - 1].push([
              x + xCursor,
              y + yCursor,
            ]);
          }
        }
        incX(right);
      }
      incY();
    }

    scene['_fontplay'] = {
      position: [-1000, -700],
      visible: true,
      rotation: Math.PI / 2,
      scale: 1.0,
      color: [1.0, 0.2, 0.2, 1.0],
      shapes: glyphShapes.filter((shape) => shape.length > 0),
    };

    let entity;
    const renderablesQuery = this.queries.renderables;
    for (entity of renderablesQuery.added) {
      scene[entity.id] = this.getRenderableDataForEntity(entity);
    }
    for (entity of renderablesQuery.changed) {
      Object.assign(scene[entity.id], this.getRenderableDataForEntity(entity));
    }
    for (entity of renderablesQuery.removed) {
      delete scene[entity.id];
    }
  }

  getRenderableDataForEntity(entity) {
    const { x, y } = entity.getComponent(Position);
    // const { primitive } = entity.getComponent(Shape);
    // const { node } = entity.getComponent(Node);

    return {
      position: [x, y],
      shapes: heroShapes,
      visible: entity.alive,
      rotation: 0.0,
      scale: 100.0,
      color: [0.4, 0.8, 0.4, 1.0],
      //color: [Math.random(), Math.random(), Math.random(), 1.0],
    };
  }

  updateGraphEdges(delta, worldState, canvasContext) {
    const { scene } = worldState.getMutableComponent(WebGLContext);
    const { edges } = worldState.getComponent(GraphLayoutState);

    if (!scene[GRAPH_EDGES_SCENE_ID]) {
      scene[GRAPH_EDGES_SCENE_ID] = {
        visible: true,
        position: [0.0, 0.0],
        color: [0.3, 0.3, 0.6, 1.0],
        scale: 1,
        rotation: Math.PI / 2,
        shapes: [],
      };
    }
    const sceneSprite = scene[GRAPH_EDGES_SCENE_ID];
    sceneSprite.shapes.length = 0;

    for (let [x1, y1, x2, y2] of edges) {
      sceneSprite.shapes.push([
        [x1, y1],
        [x2, y2],
      ]);
    }
  }

  updateBackdrop(delta, worldState, canvasContext, camera) {
    const { scene } = canvasContext;
    const {
      visibleLeft,
      visibleTop,
      visibleWidth,
      visibleHeight,
      gridSize,
      gridColor,
    } = worldState.getMutableComponent(RendererState);

    if (!scene[BACKDROP_SCENE_ID]) {
      scene[BACKDROP_SCENE_ID] = {
        visible: true,
        position: [0.0, 0.0],
        color: [0.1, 0.1, 0.1, 0.1],
        scale: 1,
        rotation: Math.PI / 2,
        shapes: [],
      };
    }
    const sceneSprite = scene[BACKDROP_SCENE_ID];

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

import { Node } from "../../node.js";
import { Position } from "../../positionMotion.js";
import { PlayerState } from "../../player.js";
import { Shape, MouseInputState, Camera, RendererState } from "../components.js";
import { CanvasContext } from '../index.js';
import { HudState } from "../../hud.js";

const PI2 = Math.PI * 2.0;

export function drawShape(ctx, entity, worldState, interpolationPercentage) {
  const { primitive } = entity.getComponent(Shape);
  let drawFn;
  switch (primitive) {
    case "box":
      drawFn = drawBox;
      break;
    case "node":
      drawFn = drawNode;
      break;
    default:
      drawFn = drawCircle;
      break;
  }
  if (drawFn) {
    drawFn(ctx, entity, worldState, interpolationPercentage);
  }
}

const SHAPE_SIZE = 50;
const SHAPE_HALF_SIZE = SHAPE_SIZE / 2;

function drawNode(ctx, entity, worldState, interpolationPercentage) {
  const { x, y } = entity.getComponent(Position);
  const { node } = entity.getComponent(Node);
  const { currentNode } = worldState.getComponent(PlayerState);
  const { overEntity } = worldState.getComponent(MouseInputState);

  let color;
  /*
  if (overEntity !== null && overEntity.id == entity.id) {
    document.body.style.cursor = "pointer";
    color = "rgba(0, 0, 255, 0.5)";
  } else 
  */
  if (currentNode && node.addr === currentNode.addr) {
    color = "rgba(0, 255, 0, 0.5)";
  } else {
    color = "rgba(255, 0, 0, 0.5)";
  }

  ctx.beginPath();
  ctx.arc(x, y, SHAPE_HALF_SIZE, 0, 2 * Math.PI, false);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0b845b";

  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${node.type}`, x, y - SHAPE_HALF_SIZE * 1.33);

  ctx.stroke();
}

function drawCircle(ctx, entity, worldState, interpolationPercentage) {
  const { x, y } = entity.getComponent(Position);

  /*
  const x = item.last.x + (item.x - item.last.x) * interpolationPercentage;
  const y = 0 - item.last.y + (item.y - item.last.y) * interpolationPercentage;
  */

  ctx.beginPath();
  ctx.arc(x, y, SHAPE_HALF_SIZE, 0, 2 * Math.PI, false);
  ctx.fillStyle = "#39c495";
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "#0b845b";
  ctx.stroke();
}

function drawBox(ctx, entity, worldState, interpolationPercentage) {
  const { x, y } = entity.getComponent(Position);

  ctx.beginPath();
  ctx.rect(x - SHAPE_HALF_SIZE, y - SHAPE_HALF_SIZE, SHAPE_SIZE, SHAPE_SIZE);
  ctx.fillStyle = "#e2736e";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#b74843";
  ctx.stroke();
}

export function drawEdge(ctx, x1, y1, x2, y2, interpolationPercentage) {
  ctx.beginPath();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawBackdrop(worldState) {
  const { ctx } = worldState.getMutableComponent(CanvasContext);
  const { zoom } = worldState.getMutableComponent(Camera);
  const {
    visibleLeft,
    visibleTop,
    visibleRight,
    visibleBottom,
    gridSize,
    gridColor,
    gridLineWidth
  } = worldState.getMutableComponent(RendererState);

  const gridOffsetX = visibleLeft % gridSize;
  const gridOffsetY = visibleTop % gridSize;

  ctx.save();
  ctx.beginPath();

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = gridLineWidth / zoom;

  for (let x = visibleLeft - gridOffsetX; x < visibleRight; x += gridSize) {
    ctx.moveTo(x, visibleTop);
    ctx.lineTo(x, visibleBottom);
  }

  for (let y = visibleTop - gridOffsetY; y < visibleBottom; y += gridSize) {
    ctx.moveTo(visibleLeft, y);
    ctx.lineTo(visibleRight, y);
  }

  ctx.stroke();
  ctx.restore();
}

const HUD_NAV_DISTANCE = 275;
const HUD_NAV_SIZE = 25;

export function drawHud(ctx, worldState, interpolationPercentage) {
  const { currentNode, connectionNodes } = worldState.getComponent(HudState);
  const { x: currX, y: currY } = currentNode;
  const {
    position: {
      items: {
        x: { current: cameraX },
        y: { current: cameraY }
      }
    }
  } = worldState.getMutableComponent(Camera);

  ctx.lineWidth = 3.0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';

  ctx.moveTo(0, 0);
  ctx.beginPath();
  ctx.arc(0, 0, HUD_NAV_DISTANCE + HUD_NAV_SIZE + 3, 0, PI2, false);
  ctx.stroke();

  ctx.moveTo(0, 0);
  ctx.beginPath();
  ctx.arc(0, 0, HUD_NAV_DISTANCE - HUD_NAV_SIZE - 3, 0, PI2, false);
  ctx.stroke();

  for (const addr in connectionNodes) {
    const { node, navAngle, navX, navY, mouseOver } = connectionNodes[addr];

    if (mouseOver) {
      document.body.style.cursor = "pointer";
    }

    const color = mouseOver ? 'rgba(0, 0, 255, 0.3)' : 'rgba(0, 255, 0, 0.3)';

    ctx.save();

    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    ctx.translate(navX, navY);
    ctx.rotate(navAngle + Math.PI / 2);
    ctx.beginPath();

    const hs = HUD_NAV_SIZE;
    ctx.moveTo(0, 0 - hs);
    ctx.lineTo(0 - hs * 1.0, hs);
    ctx.lineTo(hs * 1.0, hs);
    ctx.lineTo(0, 0 - hs);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

import { GraphEdge } from "../../graph.js";
import { Node } from "../../node.js";
import { Position } from "../../positionMotion.js";
import { PlayerState } from "../../player.js";
import { Shape, MouseInputState } from "../components.js";

export function drawShape(ctx, entity, worldState, interpolationPercentage) {
  const { primitive } = entity.getComponent(Shape);
  let drawFn;
  switch (primitive) {
    case "box":
      drawFn = drawBox;
      break;
    case "edge":
      drawFn = drawEdge;
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

function drawEdge(ctx, entity, worldState, ip) {
  const { x: x1, y: y1 } = entity.getComponent(Position);
  const {
    endPosition: { x: x2, y: y2 }
  } = entity.getComponent(GraphEdge);

  ctx.beginPath();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawNode(ctx, entity, worldState, interpolationPercentage) {
  const { x, y } = entity.getComponent(Position);
  const { node } = entity.getComponent(Node);
  const { currentNode } = worldState.getComponent(PlayerState);
  const { overEntity } = worldState.getComponent(MouseInputState);

  let color;
  if (overEntity !== null && overEntity.id == entity.id) {
    color = "rgba(0, 0, 255, 0.5)";
  } else if (currentNode && node.addr === currentNode.addr) {
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

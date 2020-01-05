import { System } from "https://ecsy.io/build/ecsy.module.js";
import { PlayerState } from "./player.js";
import { Node } from "./node.js";
import { Position } from "./positionMotion.js";
import {
  Camera,
  RendererState,
  MouseInputState
} from "./viewport/components.js";

const HUD_NAV_DISTANCE = 275;
const HUD_NAV_SIZE = 25;

export function init(world) {
  world.registerSystem(HudSystem);
}

export function initState(worldState) {
  worldState.addComponent(HudState);
}

export class HudState {
  constructor() {
    this.currentNode = {};
    this.connectionNodes = {};
    this.clickedNavNode = null;
  }
}

export class HudSystem extends System {
  execute(delta) {
    const worldState = this.queries.worldState.results[0];
    const playerState = worldState.getComponent(PlayerState);
    const camera = worldState.getComponent(Camera);
    const mouseInputState = worldState.getComponent(MouseInputState);
    const hudState = worldState.getMutableComponent(HudState);

    const { connectionNodes } = hudState;
    const { currentNode } = playerState;
    const { clientX, clientY } = mouseInputState;
    const {
      position: {
        items: {
          x: { current: cameraX },
          y: { current: cameraY }
        }
      }
    } = camera;

    if (!currentNode) {
      return;
    }

    Object.keys(connectionNodes).map(key => delete connectionNodes[key]);

    for (let entity of this.queries.nodes.results) {
      const { node } = entity.getComponent(Node);
      const position = entity.getComponent(Position);
      if (
        node.addr === currentNode.addr &&
        hudState.currentNode !== currentNode.addr
      ) {
        hudState.currentNode = { entity, node, ...position };
      } else if (
        node.childAddrs.includes(currentNode.addr) ||
        currentNode.childAddrs.includes(node.addr)
      ) {
        const navAngle = Math.atan2(position.y - cameraY, position.x - cameraX);
        const navX = Math.cos(navAngle) * HUD_NAV_DISTANCE;
        const navY = Math.sin(navAngle) * HUD_NAV_DISTANCE;

        const hs = HUD_NAV_SIZE;
        const left = navX - hs;
        const right = navX + hs;
        const top = navY - hs;
        const bottom = navY + hs;

        const mouseOver =
          clientX >= left &&
          clientX <= right &&
          clientY >= top &&
          clientY <= bottom;

        hudState.connectionNodes[node.addr] = {
          entity,
          node,
          navAngle,
          navX,
          navY,
          mouseOver,
          clicked: mouseOver && mouseInputState.buttonClicked
        };

        if (mouseOver && mouseInputState.buttonClicked) {
          hudState.clickedNavNode = node;
        }
      }
    }
  }
}

HudSystem.queries = {
  worldState: {
    components: [HudState]
  },
  nodes: {
    components: [Node, Position]
  }
};

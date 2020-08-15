import { System, Component, Types } from "./index.js";
import { PlayerFocus } from "./player.js";
import { Node } from "./node.js";
import { Position } from "./positionMotion.js";
import {
  Camera,
  RendererState,
  MouseInputState,
} from "./viewport/components.js";

const HUD_NAV_DISTANCE = 275;
const HUD_NAV_SIZE = 25;

export function init(world) {
  world.registerComponent(HudState);
  world.registerSystem(HudSystem);
}

export function initState(worldState) {
  worldState.addComponent(HudState);
}

export class HudState extends Component {}
HudState.schema = {
  connectionNodes: { type: Types.Ref, default: {} },
  clickedNavNode: { type: Types.Ref, default: null },
};

export class HudSystem extends System {
  execute(delta) {
    const worldState = this.queries.worldState.results[0];
    const camera = worldState.getComponent(Camera);
    const mouseInputState = worldState.getComponent(MouseInputState);
    const hudState = worldState.getMutableComponent(HudState);

    const { connectionNodes } = hudState;
    const { clientX, clientY } = mouseInputState;
    const { cameraX, cameraY } = camera;

    hudState.clickedNavNode = null;
    for (const key of Object.keys(connectionNodes)) {
      delete connectionNodes[key];
    }

    const playerFocus = this.queries.playerFocus.results[0];
    if (!playerFocus) { return; }

    const { node: currentNode } = playerFocus.getComponent(Node);

    const angles = [];
    for (let entity of this.queries.nodes.results) {
      const { node } = entity.getComponent(Node);
      if (!currentNode.connections[node.id]) { continue; }

      const position = entity.getComponent(Position);
      if (position.y === cameraY && position.x === cameraX) {
        // HACK: prevent a small glitch when transitioning from one node to the next.
        // The arrow to the previous node briefly flashes at angle 0 until a frame later.
        continue;
      }

      const navAngle = Math.atan2(position.y - cameraY, position.x - cameraX);
      const navX = Math.cos(navAngle) * HUD_NAV_DISTANCE;
      const navY = Math.sin(navAngle) * HUD_NAV_DISTANCE;

      angles.push(navAngle);

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

      hudState.connectionNodes[node.id] = {
        entity,
        node,
        navAngle,
        navX,
        navY,
        mouseOver,
        clicked: mouseOver && mouseInputState.buttonClicked,
      };

      if (mouseOver && mouseInputState.buttonClicked) {
        hudState.clickedNavNode = node;
      }
    }
  }
}

HudSystem.queries = {
  worldState: {
    components: [HudState],
  },
  playerFocus: {
    components: [PlayerFocus, Node],
  },
  nodes: {
    components: [Node, Position],
  },
};

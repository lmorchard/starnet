import { System, Component, TagComponent, Types } from "./index.js";
import { Node } from "./node.js";
import { MouseInputState } from "./viewport/components.js";
import { Motion, Position } from "./positionMotion.js";
import { GraphGroup } from "./graph.js";
import { HudState } from "./hud.js";
import {
  Renderable,
  ViewportFocus,
  Shape,
  CursorTarget,
} from "./viewport/components.js";

export function init(world) {
  world.registerComponent(PlayerState);
  world.registerComponent(PlayerFocus);
  world.registerSystem(PlayerStateSystem);
}

export function initState(worldState) {
  worldState.addComponent(PlayerState);
}

export class PlayerFocus extends TagComponent {}

export class PlayerState extends Component {}
PlayerState.schema = {
  currentNode: { type: Types.Ref, default: null },
};

export class PlayerStateSystem extends System {
  execute(delta, time) {
    this.updatePlayerFocusOnNavigation();
    this.updateViewportFocusToPlayerFocus();
  }

  updatePlayerFocusOnNavigation() {
    const worldState = this.queries.worldState.results[0];
    const { clickedEntity } = worldState.getComponent(MouseInputState);
    const playerState = worldState.getMutableComponent(PlayerState);
    const { clickedNavNode } = worldState.getComponent(HudState);

    let pendingCurrent = null;

    if (clickedEntity) {
      const cNode = clickedEntity.getComponent(Node);
      if (cNode) {
        pendingCurrent = cNode.node;
      }
    }

    if (clickedNavNode) {
      pendingCurrent = clickedNavNode;
    }

    if (!pendingCurrent) {
      return;
    }

    for (let entity of this.queries.nodes.results) {
      const { node } = entity.getComponent(Node);
      const isFocus = node.id === pendingCurrent.id;
      entity[isFocus ? "addComponent" : "removeComponent"](PlayerFocus);
    }
  }

  updateViewportFocusToPlayerFocus() {
    const playerFocus = this.queries.playerFocus.results[0];
    if (!playerFocus) {
      return;
    }

    const playerFocusNode = playerFocus.getComponent(Node).node;

    const cameraFocus = this.queries.cameraFocus.results[0];
    if (cameraFocus) {
      const cameraFocusNode = cameraFocus.getComponent(Node).node;
      if (cameraFocusNode.id !== playerFocusNode.id) {
        cameraFocus.removeComponent(ViewportFocus);
      }
    }

    const playerViewportFocus = playerFocus.getComponent(ViewportFocus);
    if (!playerViewportFocus) {
      playerFocus.addComponent(ViewportFocus);
    }
  }
}

PlayerStateSystem.queries = {
  worldState: {
    components: [MouseInputState, PlayerState],
  },
  cameraFocus: {
    components: [ViewportFocus, Node],
  },
  playerFocus: {
    components: [PlayerFocus, Node],
  },
  nodes: {
    components: [Node],
  },
};

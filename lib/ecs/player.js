import { System } from "https://unpkg.com/ecsy@0.2.1/build/ecsy.module.js";
import { Node } from "./node.js";
import { MouseInputState } from "./viewport/components.js";
import { Motion, Position } from "./positionMotion.js";
import { GraphGroup } from "./graph.js";
import { HudState } from "./hud.js";
import {
  Renderable,
  ViewportFocus,
  Shape,
  CursorTarget
} from "./viewport/components.js";

export function init(world) {
  world.registerSystem(PlayerStateSystem);
}

export function initState(worldState, { walkContextNode }) {
  worldState.addComponent(PlayerState, { walkContextNode });
}

export class PlayerState {
  constructor() {
    Object.assign(this, {
      currentNode: null,
      pendingCurrentNode: null,
      contextNode: null,
      originNode: null,
      currentScene: [],
      walkContextNode: () => []
    });
  }
}

export class PlayerStateSystem extends System {
  execute(delta, time) {
    const worldState = this.queries.worldState.results[0];
    const { clickedEntity } = worldState.getComponent(MouseInputState);
    const playerState = worldState.getMutableComponent(PlayerState);
    const { clickedNavNode } = worldState.getComponent(HudState);

    if (clickedEntity) {
      const cNode = clickedEntity.getComponent(Node);
      if (cNode) {
        playerState.pendingCurrentNode = cNode.node;
      }
    }

    if (clickedNavNode) {
      playerState.pendingCurrentNode = clickedNavNode;
    }

    if (playerState.pendingCurrentNode) {
      const pendingContextNode = playerState.pendingCurrentNode.parent();
      if (
        !playerState.contextNode ||
        pendingContextNode.addr !== playerState.contextNode.addr
      ) {
        return this.updateSceneForContextNode(playerState, pendingContextNode);
      }

      for (let entity of this.queries.nodes.results) {
        const { node } = entity.getComponent(Node);
        if (
          playerState.currentNode &&
          node.addr === playerState.currentNode.addr
        ) {
          entity.removeComponent(ViewportFocus);
        }
        if (
          playerState.pendingCurrentNode &&
          node.addr === playerState.pendingCurrentNode.addr
        ) {
          entity.addComponent(ViewportFocus);
        }
      }

      playerState.currentNode = playerState.pendingCurrentNode;
      playerState.pendingCurrentNode = null;
    }
  }

  updateSceneForContextNode(playerState, pendingContextNode) {
    const { currentScene, walkContextNode } = playerState;

    if (currentScene.length > 0) {
      for (let entity of currentScene) {
        entity.remove();
      }
      currentScene.length = 0;
      return;
    }

    const contextNode = (playerState.contextNode = pendingContextNode);

    const sceneNodes = walkContextNode(contextNode);

    const spawnNode = node => {
      const entity = this.world
        .createEntity()
        .addComponent(Renderable)
        //.addComponent(CursorTarget)
        .addComponent(Node, { node })
        .addComponent(GraphGroup, { groupId: contextNode.addr })
        .addComponent(Shape, { primitive: "node", width: 50, height: 50 })
        .addComponent(Motion, { dx: 0, dy: 0 })
        .addComponent(Position, { x: 0, y: 0 });

      currentScene.push(entity);
    };

    for (let { node } of sceneNodes) {
      spawnNode(node);
    }
  }
}

PlayerStateSystem.queries = {
  worldState: {
    components: [MouseInputState, PlayerState]
  },
  nodes: {
    components: [Node]
  }
};

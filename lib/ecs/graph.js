4444; /* global Springy */
import { System } from "https://ecsy.io/build/ecsy.module.js";
import { Node } from "./node.js";
import { Motion, Position } from "./positionMotion.js";
import { Renderable, Shape } from "./viewport/components.js";
import { Lerp } from "../lerp.js";
import Easings from "../easings.js";

import { mkrng } from "../utils.js";

export function init(world) {
  world.registerSystem(GraphLayoutSystem);
}

export function initState(worldState) {
  worldState.addComponent(GraphLayoutState);
}

export class GraphGroup {
  constructor() {
    this.groupId = null;
  }
}

export class GraphLayoutState {
  constructor() {
    this.layoutRatio = Lerp.create({
      speed: 0.002,
      items: {
        ratio: { start: 1, end: 75 }
      }
    });
    this.layouts = {};
  }
}

export class GraphEdge {
  constructor() {
    this.id = null;
    this.groupId = null;
    this.edgeId = null;
    this.parentEntityId = null;
    this.endPosition = { x: 0, y: 0 };
  }
}

export class GraphLayoutSystem extends System {
  execute(delta) {
    const worldState = this.queries.worldState.results[0];
    const graphLayoutState = worldState.getMutableComponent(GraphLayoutState);

    if (this.queries.groups.added.length) {
      this.handleAddedNodes(graphLayoutState);
      this.spawnMissingEdges(graphLayoutState);
    }
    if (this.queries.groups.removed.length) {
      this.handleRemovedNodes(graphLayoutState, worldState);
    }
    Lerp.update(graphLayoutState.layoutRatio, delta, Easings.easeInOutExpo);
    this.updateFromLayouts(
      graphLayoutState,
      delta,
      graphLayoutState.layoutRatio
    );
  }

  getLayout(layouts, groupId) {
    if (!layouts[groupId]) {
      const graph = new Springy.Graph();
      // HACK: redefine vector randomizer to use consistent seed for group
      graph.rng = mkrng(groupId);
      const layout = new Springy.Layout.ForceDirected(
        graph,
        250.0, // Spring stiffness
        300.0, // Node repulsion
        0.66, // Damping
        0.005 // minEnergyThreshold
      );
      layout._update = true;
      layouts[groupId] = layout;
    }
    return layouts[groupId];
  }

  handleAddedNodes({ layouts, layoutRatio }) {
    const added = [];

    /*
    Lerp.reset(layoutRatio, {
      ratio: { start: 0, end: 50 }
    });
    */

    for (const entity of this.queries.groups.added) {
      const { groupId } = entity.getComponent(GraphGroup);
      const { node } = entity.getComponent(Node);
      const { addr } = node;
      const layout = this.getLayout(layouts, groupId);
      const { graph } = layout;
      layout._update = true;

      // HACK: redefine vector randomizer to use consistent seed for group
      Springy.Vector.random = function() {
        return new Springy.Vector(
          3.0 * (graph.rng() - 0.5),
          3.0 * (graph.rng() - 0.5)
        );
      };

      if (!graph.nodeSet[addr]) {
        graph.addNode(
          new Springy.Node(addr, {
            entityId: entity.id,
            label: node.type
          })
        );
      }

      const nodeData = { groupId, addr, entity, node };
      added.push(nodeData);
    }
  }

  spawnMissingEdges({ layouts }) {
    for (const entity of this.queries.groups.results) {
      const { groupId } = entity.getComponent(GraphGroup);
      const { node } = entity.getComponent(Node);
      const { addr: fromAddr } = node;
      const { graph } = this.getLayout(layouts, groupId);

      for (const toAddr of node.childAddrs) {
        const edgeId = `${fromAddr} -> ${toAddr}`;
        const edgeExists = graph.edges.some(edge => edge.id === edgeId);
        if (edgeExists) {
          continue;
        }
        const fromNode = graph.nodeSet[fromAddr];
        const toNode = graph.nodeSet[toAddr];
        if (!fromNode || !toNode) {
          continue;
        }
        graph.addEdge(
          new Springy.Edge(edgeId, fromNode, toNode, { entityId: entity.id })
        );
        this.world
          .createEntity()
          .addComponent(Renderable)
          .addComponent(Shape, { primitive: "edge" })
          .addComponent(Position)
          .addComponent(GraphEdge, {
            groupId,
            edgeId,
            parentEntityId: entity.id
          });
      }
    }
  }

  handleRemovedNodes({ layouts }) {
    // HACK: The removed nodes query doesn't seem to produce the right IDs,
    // so let's work out what was removed from what's missing in existing nodes
    const existingIds = this.queries.groups.results.map(({ id }) => id);
    const removedIds = [];

    for (const groupId in layouts) {
      const layout = layouts[groupId];
      for (const addr in layout.graph.nodeSet) {
        const node = layout.graph.nodeSet[addr];
        if (!existingIds.includes(node.data.entityId)) {
          removedIds.push(node.data.entityId);
        }
        layout.graph.removeNode(node);
        if (layout.graph.nodes.length === 0) {
          delete layouts[groupId];
        }
      }
    }

    this.queries.edges.results
      .filter(entity => {
        const { parentEntityId } = entity.getComponent(GraphEdge);
        return removedIds.includes(parentEntityId);
      })
      .forEach(entity => entity.remove());
  }

  updateFromLayouts({ layouts }, delta, layoutRatio) {
    const ratio = layoutRatio.items.ratio.current;
    const layoutInfo = {};

    for (const id in layouts) {
      const layout = layouts[id];
      if (layout._update) {
        layout.tick(delta / 1000.0);
        if (layout.totalEnergy() < layout.minEnergyThreshold) {
          layout._update = false;
        }
      }

      const {
        bottomleft: { x: xLeft, y: yBottom },
        topright: { x: xRight, y: yTop }
      } = layout.getBoundingBox();

      const layoutWidth = Math.abs(xLeft - xRight);
      const layoutHeight = Math.abs(yTop - yBottom);

      const xOffset = layoutWidth / 2 + xLeft;
      const yOffset = layoutHeight / 2 + yBottom;

      layoutInfo[id] = { xOffset, yOffset };
    }

    for (const entity of this.queries.groups.results) {
      const { groupId } = entity.getComponent(GraphGroup);
      const { xOffset, yOffset } = layoutInfo[groupId];
      const {
        node: { addr }
      } = entity.getComponent(Node);
      const layout = this.getLayout(layouts, groupId);
      const position = entity.getMutableComponent(Position);
      const graphNode = layout.graph.nodeSet[addr];
      const point = layout.point(graphNode);

      position.x = (point.p.x - xOffset) * ratio;
      position.y = (point.p.y - yOffset) * ratio;
    }

    for (const entity of this.queries.edges.results) {
      const { groupId } = entity.getComponent(GraphEdge);
      const { xOffset, yOffset } = layoutInfo[groupId];
      const layout = this.getLayout(layouts, groupId);
      const position = entity.getMutableComponent(Position);
      const graphEdgeComponent = entity.getMutableComponent(GraphEdge);
      const graphEdge = layout.graph.edges.find(
        edge => edge.id === graphEdgeComponent.edgeId
      );
      const spring = layout.spring(graphEdge);

      position.x = (spring.point1.p.x - xOffset) * ratio;
      position.y = (spring.point1.p.y - yOffset) * ratio;
      graphEdgeComponent.endPosition.x = (spring.point2.p.x - xOffset) * ratio;
      graphEdgeComponent.endPosition.y = (spring.point2.p.y - yOffset) * ratio;
    }
  }
}

GraphLayoutSystem.queries = {
  worldState: {
    components: [GraphLayoutState]
  },
  groups: {
    components: [GraphGroup, Node, Motion, Position],
    listen: {
      added: true,
      removed: true
    }
  },
  edges: {
    components: [GraphEdge, Renderable, Shape, Position]
  }
};

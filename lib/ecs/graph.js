/* global Springy */
import { System, Component, Types } from "./index.js";
import { Node } from "./node.js";
import { Motion, Position } from "./positionMotion.js";

import { mkrng } from "../randoms.js";

const PI2 = Math.PI * 2.0;

export function init(world) {
  [GraphLayoutState, GraphGroup, Node].forEach((component) =>
    world.registerComponent(component)
  );
  world.registerSystem(GraphLayoutSystem);
}

export function initState(worldState) {
  worldState.addComponent(GraphLayoutState);
}

export class GraphGroup extends Component {}
GraphGroup.schema = {
  groupId: { type: Types.String, default: null },
};

export class GraphLayoutState extends Component {}
GraphLayoutState.schema = {
  layoutRatio: { type: Types.Number, default: 100 },
  layouts: { type: Types.Ref, default: {} },
  edges: { type: Types.Ref, default: [] },
};

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
        200.0, // Spring stiffness
        1000.0, // Node repulsion
        0.6, // Damping
        0.01 // minEnergyThreshold
      );
      layout._update = true;
      layouts[groupId] = layout;
    }

    // HACK: redefine vector randomizer to use consistent seed for group
    const rng = layouts[groupId].graph.rng;
    const unit = 5.0;
    Springy.Vector.random = function () {
      const a = PI2 * rng();
      return new Springy.Vector(unit * Math.cos(a), unit * Math.sin(a));
    };

    return layouts[groupId];
  }

  handleAddedNodes({ layouts, layoutRatio }) {
    const added = [];

    for (const entity of this.queries.groups.added) {
      const { groupId } = entity.getComponent(GraphGroup);
      const { node } = entity.getComponent(Node);
      const { id: nodeId } = node;
      const layout = this.getLayout(layouts, groupId);
      const { graph } = layout;
      layout._update = true;

      if (!graph.nodeSet[nodeId]) {
        graph.addNode(
          new Springy.Node(nodeId, {
            entityId: entity.id,
            label: node.type,
          })
        );
      }

      const nodeData = { groupId, nodeId, entity, node };
      added.push(nodeData);
    }
  }

  spawnMissingEdges({ layouts }) {
    for (const entity of this.queries.groups.results) {
      const { groupId } = entity.getComponent(GraphGroup);
      const { node } = entity.getComponent(Node);
      const { graph } = this.getLayout(layouts, groupId);

      for (const [connectedId, childNode] of Object.entries(node.connections)) {
        const edgeId = [node.id, connectedId].sort().join("|");
        const edgeExists = graph.edges.some((edge) => edge.id === edgeId);
        const fromNode = graph.nodeSet[node.id];
        const toNode = graph.nodeSet[connectedId];
        if (edgeExists || !fromNode || !toNode) {
          continue;
        }
        graph.addEdge(
          new Springy.Edge(edgeId, fromNode, toNode, { entityId: entity.id })
        );
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
      for (const nodeId in layout.graph.nodeSet) {
        const node = layout.graph.nodeSet[nodeId];
        if (!existingIds.includes(node.data.entityId)) {
          removedIds.push(node.data.entityId);
        }
        layout.graph.removeNode(node);
        if (layout.graph.nodes.length === 0) {
          delete layouts[groupId];
        }
      }
    }
  }

  updateFromLayouts({ layouts, edges }, delta, layoutRatio) {
    const ratio = layoutRatio;
    const layoutInfo = {};
    edges.length = 0;

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
        topright: { x: xRight, y: yTop },
      } = layout.getBoundingBox();

      const layoutWidth = Math.abs(xLeft - xRight);
      const layoutHeight = Math.abs(yTop - yBottom);

      const xOffset = layoutWidth / 2 + xLeft;
      const yOffset = layoutHeight / 2 + yBottom;

      layoutInfo[id] = { xOffset, yOffset };

      for (const edge of layout.graph.edges) {
        const spring = layout.spring(edge);
        edges.push([
          (spring.point1.p.x - xOffset) * ratio,
          (spring.point1.p.y - yOffset) * ratio,
          (spring.point2.p.x - xOffset) * ratio,
          (spring.point2.p.y - yOffset) * ratio,
        ]);
      }
    }

    for (const entity of this.queries.groups.results) {
      const { groupId } = entity.getComponent(GraphGroup);
      const { xOffset, yOffset } = layoutInfo[groupId];
      const { node } = entity.getComponent(Node);
      const layout = this.getLayout(layouts, groupId);
      const position = entity.getMutableComponent(Position);
      const graphNode = layout.graph.nodeSet[node.id];
      const point = layout.point(graphNode);

      position.x = (point.p.x - xOffset) * ratio;
      position.y = (point.p.y - yOffset) * ratio;
    }
  }
}

GraphLayoutSystem.queries = {
  worldState: {
    components: [GraphLayoutState],
  },
  groups: {
    components: [GraphGroup, Node, Motion, Position],
    listen: {
      added: true,
      removed: true,
    },
  },
};

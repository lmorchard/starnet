/* global Springy */
import { System, TagComponent } from "https://ecsy.io/build/ecsy.module.js";

import { Node } from "./node.js";
import { Motion, Position } from "./positionMotion.js";
import { Renderable, Shape } from './viewportCanvas.js';

import { mkrng } from "../utils.js";

export function init(world) {
  world.registerSystem(GraphLayoutSystem);
}

export function initState(worldState) {
  worldState.addComponent(GraphLayoutState);
}

export class GraphGroup {
  constructor() {
    this.id = null;
  }
}

export class GraphLayoutState {
  constructor() {
    this.graphs = {};
    this.layouts = {};
    this.edges = {};
  }
}

export class GraphEdge {
  constructor() {
    this.id = null;
    this.endPosition = { x: 0, y: 0 };
  }
}

export class GraphLayoutSystem extends System {
  execute(delta) {
    const worldState = this.queries.worldState.results[0];
    const graphLayoutState = worldState.getMutableComponent(GraphLayoutState);
    const groupsQuery = this.queries.groups;
    if (groupsQuery.added) {
      this.handleAddedNodes(graphLayoutState);
    }
    if (groupsQuery.removed) {
      this.handleRemovedNodes(graphLayoutState);
    }
    this.updateLayouts(graphLayoutState, delta);
  }

  handleAddedNodes({ graphs, edges }) {
    const toAdd = this.indexQuery(this.queries.groups.added);

    for (let groupId in toAdd) {
      // HACK: redefine vector randomizer to use consistent seed for group
      const vectorRng = mkrng(groupId);
      Springy.Vector.random = function() {
        return new Springy.Vector(
          10.0 * (vectorRng() - 0.5),
          10.0 * (vectorRng() - 0.5)
        );
      };

      if (!graphs[groupId]) {
        graphs[groupId] = new Springy.Graph();
      }
      const graph = graphs[groupId];

      for (let addr in toAdd[groupId]) {
        const entity = toAdd[groupId][addr];
        const { node } = entity.getComponent(Node);
        if (!graph.nodeSet[addr]) {
          graph.addNode(new Springy.Node(addr, { label: node.type }));
        }
      }

      for (let fromAddr in toAdd[groupId]) {
        const entity = toAdd[groupId][fromAddr];
        const { node } = entity.getComponent(Node);
        for (let toAddr of node.childAddrs) {
          const edgeId = `${fromAddr} -> ${toAddr}`;
          const fromNode = graph.nodeSet[fromAddr];
          const toNode = graph.nodeSet[toAddr];
          if (fromNode && toNode) {
            const edge = new Springy.Edge(edgeId, fromNode, toNode);
            graph.addEdge(edge);
            this.createGraphEdge(edge, edges);
          }
        }
      }
    }
  }

  createGraphEdge(edge, edges) {
    const entity = this.world
      .createEntity()
      .addComponent(Renderable)
      .addComponent(Shape, { primitive: 'edge'})
      .addComponent(Position)
      .addComponent(GraphEdge);
    edges[edge.id] = entity;
  }

  updateGraphEdge(edge, spring, edges, ratio, xOffset, yOffset) {
    const entity = edges[edge.id];

    const position = entity.getMutableComponent(Position);
    position.x = (spring.point1.p.x - xOffset) * ratio;
    position.y = (spring.point1.p.y - yOffset) * ratio;

    const graphEdge = entity.getMutableComponent(GraphEdge);
    graphEdge.endPosition.x = (spring.point2.p.x - xOffset) * ratio;
    graphEdge.endPosition.y = (spring.point2.p.y - yOffset) * ratio;
  }

  removeGraphEdge(edge, edges) {
    const entity = edges[edge.id];
    entity.remove();
    delete edges[edge.id];
  }

  handleRemovedNodes({ graphs, layouts, edges }) {
    const toRemove = this.indexQuery(this.queries.groups.removed);

    for (let groupId in toRemove) {
      const graph = graphs[groupId];

      for (let addr in toRemove[groupId]) {
        const graphNode = graph.nodeSet[addr];
        if (graphNode) {
          graph.removeNode(graphNode);
        }
      }

      if (graph.nodes.length === 0) {
        delete graphs[groupId];
        delete layouts[groupId];
      }
    }
  }

  updateLayouts({ graphs, layouts, edges }, delta) {
    const groupsQuery = this.queries.groups;

    const entitiesByAddr = {};
    for (let entity of groupsQuery.results) {
      const { node } = entity.getComponent(Node);
      entitiesByAddr[node.addr] = entity;
    }

    for (let groupId in graphs) {
      const graph = graphs[groupId];
      if (!layouts[groupId]) {
        layouts[groupId] = new Springy.Layout.ForceDirected(
          graph,
          1000.0, // Spring stiffness
          500.0, // Node repulsion
          0.66, // Damping
          0.25 // minEnergyThreshold
        );
      }
      const layout = layouts[groupId];

      layout.tick(delta / 1000.0);

      if (layout.totalEnergy() < layout.minEnergyThreshold) {
        continue;
      }

      const {
        bottomleft: { x: xLeft, y: yBottom },
        topright: { x: xRight, y: yTop }
      } = layout.getBoundingBox();

      const layoutWidth = Math.abs(xLeft - xRight);
      const layoutHeight = Math.abs(yTop - yBottom);

      const xOffset = layoutWidth / 2 + xLeft;
      const yOffset = layoutHeight / 2 + yBottom;

      const ratio = 75;

      layout.eachNode((node, point) => {
        const entity = entitiesByAddr[node.id];
        const position = entity.getMutableComponent(Position);

        position.x = (point.p.x - xOffset) * ratio;
        position.y = (point.p.y - yOffset) * ratio;
      });

      layout.eachEdge((edge, spring) => {
        this.updateGraphEdge(edge, spring, edges, ratio, xOffset, yOffset);
      });
    }
  }

  indexQuery(query) {
    const indexed = {};
    for (let entity of query) {
      const { id: groupId } = entity.getComponent(GraphGroup);
      if (!indexed[groupId]) {
        indexed[groupId] = {};
      }
      const { node } = entity.getComponent(Node);
      indexed[groupId][node.addr] = entity;
    }
    return indexed;
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
    components: [GraphEdge, Position],
  }
};

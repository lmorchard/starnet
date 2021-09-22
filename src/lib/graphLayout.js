import {
  Types,
  defineComponent,
  defineQuery,
  defineSystem,
  enterQuery,
  exitQuery,
  addEntity,
  addComponent,
} from "bitecs";

import { addNetworkNodeRef } from "./networks.js";

import { mkrng } from "./randoms.js";

import { Position } from "./positionMotion.js";
import { Renderable, RenderableShape } from "./viewport/index.js";

import Springy from "./springy.js";

export function init(world) {
  world.graphLayouts = {};
  world.sceneIdToEid = {};
}

export function spawnSceneForNetwork(world, network) {
  const sceneEid = spawnGraphLayoutScene(world, network.id);
  world.sceneIdToEid[network.id] = sceneEid;

  // First pass to add all nodes in the scene
  for (const nodeId in network.children) {
    const node = network.children[nodeId];
    spawnNode(world, node);
  }

  // Second pass to add edges using eids of nodes from first pass
  for (const nodeId in network.children) {
    const node = network.children[nodeId];
    for (const toNodeId in node.connections) {
      spawnNodeEdge(
        world,
        network.id,
        world.nodeIdToEntityId[node.id],
        world.nodeIdToEntityId[toNodeId]
      );
    }
  }
}

export function spawnNode(world, node) {
  const eid = addEntity(world);

  addNetworkNodeRef(world, eid, node);

  addComponent(world, GraphLayoutNode, eid);
  GraphLayoutNode.sceneId[eid] = node.networkId;
  GraphLayoutNode.nodeId[eid] = node.id;

  addComponent(world, Renderable, eid);
  Renderable.shape[eid] = RenderableShape[node.type] || RenderableShape.Node;

  addComponent(world, Position, eid);
  Position.x[eid] = 0;
  Position.y[eid] = 0;

  return eid;
}

export function spawnNodeEdge(world, sceneId, fromEid, toEid) {
  const eid = addEntity(world);
  addComponent(world, GraphLayoutEdge, eid);
  GraphLayoutEdge.sceneId[eid] = sceneId;
  GraphLayoutEdge.from[eid] = fromEid;
  GraphLayoutEdge.to[eid] = toEid;
}

export const GraphLayoutScene = defineComponent({
  sceneId: Types.i32,
  active: Types.i8, // boolean
  ratio: Types.f32,
  // TODO: Add a pivot point for the overall graph layout scene?
});

export const graphLayoutSceneQuery = defineQuery([GraphLayoutScene]);
export const enterGraphLayoutSceneQuery = enterQuery(graphLayoutSceneQuery);
export const exitGraphLayoutSceneQuery = exitQuery(graphLayoutSceneQuery);

export function spawnGraphLayoutScene(world, sceneId, initialRatio = 30.0) {
  const eid = addEntity(world);
  addComponent(world, GraphLayoutScene, eid);
  GraphLayoutScene.active[eid] = true;
  GraphLayoutScene.sceneId[eid] = sceneId;
  GraphLayoutScene.ratio[eid] = initialRatio;
  return eid;
}

export const GraphLayoutEdge = defineComponent({
  sceneId: Types.i32,
  from: Types.eid,
  fromX: Types.f32,
  fromY: Types.f32,
  to: Types.eid,
  toX: Types.f32,
  toY: Types.f32,
});

export const graphLayoutEdgeQuery = defineQuery([GraphLayoutEdge]);
export const enterGraphLayoutEdgeQuery = enterQuery(graphLayoutEdgeQuery);
export const exitGraphLayoutEdgeQuery = exitQuery(graphLayoutEdgeQuery);

export const GraphLayoutNode = defineComponent({
  sceneId: Types.i32,
  nodeId: Types.i32,
});

export const graphLayoutNodeQuery = defineQuery([GraphLayoutNode, Position]);
export const enterGraphLayoutNodeQuery = enterQuery(graphLayoutNodeQuery);
export const exitGraphLayoutNodeQuery = exitQuery(graphLayoutNodeQuery);

export const graphLayoutSystem = defineSystem((world) => {
  const {
    time: { deltaSec },
  } = world;

  for (let eid of enterGraphLayoutSceneQuery(world)) {
    createLayout(world, eid);
  }

  for (let eid of exitGraphLayoutNodeQuery(world)) {
    destroyLayout(world, eid);
  }

  for (let eid of enterGraphLayoutNodeQuery(world)) {
    addNodeToLayout(world, eid);
  }

  for (let eid of enterGraphLayoutEdgeQuery(world)) {
    addEdgeToLayout(world, eid);
  }

  const exitedEdgeEIDs = exitGraphLayoutEdgeQuery(world);
  const exitedNodeEIDs = exitGraphLayoutNodeQuery(world);

  for (let layoutId in world.graphLayouts) {
    const layout = world.graphLayouts[layoutId];
    const graph = layout.graph;

    // TODO: transition this ratio to make the graph bloom
    const ratio = GraphLayoutScene.ratio[layoutId];

    if (exitedNodeEIDs.length) {
      layout._update = true;
      graph.filterNodes((node) => !exitedNodeEIDs.includes(node.id));
    }

    if (exitedEdgeEIDs.length) {
      layout._update = true;
      graph.filterEdges((edge) => !exitedEdgeEIDs.includes(edge.data.eid));
    }

    if (layout._update) {
      layout.tick(deltaSec);
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

    for (const eid in graph.nodeSet) {
      const graphNode = graph.nodeSet[eid];
      const point = layout.point(graphNode);

      Position.x[eid] = (point.p.x - xOffset) * ratio;
      Position.y[eid] = (point.p.y - yOffset) * ratio;
    }

    for (const edge of graph.edges) {
      const eid = edge.data.eid;
      const spring = layout.spring(edge);
      GraphLayoutEdge.fromX[eid] = (spring.point1.p.x - xOffset) * ratio;
      GraphLayoutEdge.fromY[eid] = (spring.point1.p.y - yOffset) * ratio;
      GraphLayoutEdge.toX[eid] = (spring.point2.p.x - xOffset) * ratio;
      GraphLayoutEdge.toY[eid] = (spring.point2.p.y - yOffset) * ratio;
    }
  }
});

function createLayout(world, eid) {
  const graph = new Springy.Graph();

  // HACK: redefine vector randomizer to use consistent seed for group
  graph.rng = mkrng(eid);

  const layout = new Springy.Layout.ForceDirected(
    graph,
    200.0, // Spring stiffness
    7000.0, // Node repulsion
    0.5, // Damping
    0.01 // minEnergyThreshold
  );
  layout._update = true;

  // HACK: redefine vector randomizer to use consistent seed for group
  const rng = graph.rng;
  const unit = 200.0;
  Springy.Vector.random = function () {
    const a = Math.PI * 2 * rng();
    return new Springy.Vector(unit * Math.cos(a), unit * Math.sin(a));
  };

  world.graphLayouts[eid] = layout;
  world.sceneIdToEid[GraphLayoutScene.sceneId[eid]] = eid;
}

function destroyLayout(world, deletedEid) {
  delete world.graphLayouts[deletedEid];
  const result = Object.entries(world.sceneIdToEid).find(
    ([sceneId, eid]) => eid === deletedEid
  );
  if (result) {
    const [sceneId] = result;
    delete world.sceneIdToEid[sceneId];
  }
}

function addNodeToLayout(world, eid) {
  const sceneEID = GraphLayoutNode.sceneId[eid];
  const layout = world.graphLayouts[sceneEID];
  if (!layout) return;

  layout._update = true;
  const graph = layout.graph;
  graph.addNode(new Springy.Node(eid));
}

function addEdgeToLayout(world, eid) {
  const sceneEID = world.sceneIdToEid[GraphLayoutEdge.sceneId[eid]];
  const layout = world.graphLayouts[sceneEID];
  if (!layout) return;

  layout._update = true;
  const graph = layout.graph;

  const fromEid = GraphLayoutEdge.from[eid];
  const toEid = GraphLayoutEdge.to[eid];
  const edgeId = `${fromEid}:${toEid}`;

  const edgeExists = graph.edges.some((edge) => edge.id === edgeId);
  if (edgeExists) return;

  const fromNode = graph.nodeSet[fromEid];
  const toNode = graph.nodeSet[toEid];

  graph.addEdge(new Springy.Edge(edgeId, fromNode, toNode, { eid }));
}

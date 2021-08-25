import {
  Types,
  defineComponent,
  defineQuery,
  defineSystem,
  enterQuery,
  exitQuery,
} from "bitecs";

import { Position } from "./positionMotion.js";

import Springy from "./springy.js";

export const GraphLayoutScene = defineComponent({
  sceneId: Types.i32,
  active: Types.i8, // boolean
  ratio: Types.f32,
  // TODO: Add a pivot point for the overall graph layout scene?
});

export const graphLayoutSceneQuery = defineQuery([GraphLayoutScene]);
export const enterGraphLayoutSceneQuery = enterQuery(graphLayoutSceneQuery);
export const exitGraphLayoutSceneQuery = exitQuery(graphLayoutSceneQuery);

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
  // graph.rng = mkrng(groupId);
  const layout = new Springy.Layout.ForceDirected(
    graph,
    200.0, // Spring stiffness
    1000.0, // Node repulsion
    0.6, // Damping
    0.01 // minEnergyThreshold
  );
  layout._update = true;
  /*
    // HACK: redefine vector randomizer to use consistent seed for group
    const rng = layouts[groupId].graph.rng;
    const unit = 5.0;
    Springy.Vector.random = function () {
      const a = PI2 * rng();
      return new Springy.Vector(unit * Math.cos(a), unit * Math.sin(a));
    };
  */
  if (!world.graphLayouts) world.graphLayouts = {};
  world.graphLayouts[eid] = layout;
}

function destroyLayout(world, eid) {
  delete world.graphLayouts[eid];
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
  const sceneEID = GraphLayoutEdge.sceneId[eid];
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

import {
  defineComponent,
  defineQuery,
  defineSystem,
  Types,
  addEntity,
  addComponent,
  pipe,
} from "bitecs";
import { rand, genid } from "../../lib/utils.js";
import * as Stats from "../../lib/stats.js";
import * as World from "../../lib/world.js";
import * as Viewport from "../../lib/viewport/pixi.js";
import {
  Renderable,
  RenderableShape,
  CameraFocus,
} from "../../lib/viewport/index.js";
import { setupTwiddles } from "../twiddles.js";
import {
  Position,
  Velocity,
  movementSystem,
  bouncerSystem,
} from "../../lib/positionMotion.js";
import {
  GraphLayoutScene,
  GraphLayoutNode,
  graphLayoutSystem,
  GraphLayoutEdge,
} from "../../lib/graphLayout.js";
import {
  NetworkNodeRef,
  Network,
  GatewayNode,
  StorageNode,
  FirewallNode,
  HubNode,
  TerminalNode,
  WalletNode,
  ICENode,
} from "../../lib/networks.js";

async function main() {
  const stats = Stats.init();
  const world = World.init();
  const viewport = Viewport.init();

  const network = world.addNetwork(new Network());
  const [
    gateway,
    firewall,
    storageHub,
    storage1,
    storage2,
    storage3,
    wallet1,
    terminalHub,
    terminal1,
    terminal2,
    terminal3,
    ice1,
  ] = network.add(
    new GatewayNode(),
    new FirewallNode(),
    new HubNode(),
    new StorageNode(),
    new StorageNode(),
    new StorageNode(),
    new WalletNode(),
    new HubNode(),
    new TerminalNode(),
    new TerminalNode(),
    new TerminalNode(),
    new ICENode()
  );

  gateway.connect(firewall);
  firewall.connect(storageHub, terminalHub, ice1);
  storageHub.connect(storage1, storage2, storage3, wallet1);
  terminalHub.connect(terminal1, terminal2, terminal3);

  let eid;
  eid = addEntity(world);
  addComponent(world, GraphLayoutScene, eid);
  GraphLayoutScene.active[eid] = true;
  GraphLayoutScene.sceneId[eid] = network.id;
  GraphLayoutScene.ratio[eid] = 30.0;

  const eidToNid = {};
  const nidToEid = {};

  for (const nodeId in network.children) {
    const node = network.children[nodeId];
    const eid = spawnNode(world, node);

    if (node === gateway) {
      addComponent(world, CameraFocus, eid);
    }

    eidToNid[eid] = node.id;
    nidToEid[node.id] = eid;
  }

  for (const nodeId in network.children) {
    const node = network.children[nodeId];
    for (const toNodeId in node.connections) {
      spawnNodeEdge(world, nidToEid[node.id], nidToEid[toNodeId]);
    }
  }

  const spawnNewNode = () => {
    const [ node ] = network.add(new TerminalNode());
    node.connect(terminalHub);

    const eid = spawnNode(world, node);
    eidToNid[eid] = node.id;
    nidToEid[node.id] = eid;

    for (const toNodeId in node.connections) {
      spawnNodeEdge(world, nidToEid[node.id], nidToEid[toNodeId]);
    }
  };

  const pane = setupTwiddles(world, viewport);
  pane.addButton({ title: "Spawn" }).on("click", spawnNewNode);
  
  const pipeline = pipe(graphLayoutSystem, movementSystem, bouncerSystem, () =>
    pane.refresh()
  );
  world.run(pipeline, viewport, stats);

  Object.assign(window, {
    world,
    Position,
    GraphLayoutEdge,
    GraphLayoutNode,
    GraphLayoutEdge,
  });

  console.log("READY.");
}

function spawnNodeEdge(world, fromEid, toEid) {
  const eid = addEntity(world);

  addComponent(world, GraphLayoutEdge, eid);
  GraphLayoutEdge.from[eid] = fromEid;
  GraphLayoutEdge.to[eid] = toEid;
}

function spawnNode(world, node) {
  const eid = addEntity(world);

  addComponent(world, NetworkNodeRef, eid);
  NetworkNodeRef.networkId[eid] = node.network.id;
  NetworkNodeRef.nodeId[eid] = node.id;

  addComponent(world, GraphLayoutNode, eid);
  GraphLayoutNode.sceneId[eid] = node.networkId;
  GraphLayoutNode.nodeId[eid] = node.id;

  // TODO: set up the graph edges

  addComponent(world, Renderable, eid);
  Renderable.shape[eid] = RenderableShape[node.type] || RenderableShape.Node;

  addComponent(world, Position, eid);
  Position.x[eid] = rand(-300, 300);
  Position.y[eid] = rand(-300, 300);
  Position.z[eid] = rand(1, 6);

  return eid;
}

main().catch(console.error);

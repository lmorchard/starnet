import {
  defineComponent,
  defineQuery,
  defineSystem,
  Types,
  addEntity,
  addComponent,
  pipe,
} from "bitecs";
import { Pane } from "tweakpane";
import { rand, genid } from "../../lib/utils.js";
import * as Stats from "../../lib/stats.js";
import * as World from "../../lib/world.js";
import * as Viewport from "../../lib/viewport/pixi.js";
import { Renderable, RenderableShape } from "../../lib/viewport/index.js";
import {
  Position,
  Velocity,
  movementSystem,
  bouncerSystem,
} from "../../lib/positionMotion.js";
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

  for (const nodeId in network.children) {
    const node = network.children[nodeId];
    // TODO: set up the graph edges
    spawnNode(world, node);
  }

  const pane = setupTwiddles(world, viewport);
  const pipeline = pipe(movementSystem, bouncerSystem, () => pane.refresh());
  world.run(pipeline, viewport, stats);

  console.log("READY.");
}

function spawnNode(world, node) {
  const eid = addEntity(world);

  addComponent(world, NetworkNodeRef, eid);
  NetworkNodeRef.networkId[eid] = node.network.id;
  NetworkNodeRef.nodeId[eid] = node.id;

  addComponent(world, Renderable, eid);
  Renderable.shape[eid] = RenderableShape[node.type] || RenderableShape.Node;

  addComponent(world, Position, eid);
  Position.x[eid] = rand(-300, 300);
  Position.y[eid] = rand(-300, 300);
  Position.z[eid] = rand(1, 6);

  return eid;
}

function setupTwiddles(world, viewport) {
  const pane = new Pane();
  const f1 = pane.addFolder({ title: "Twiddles" /*, expanded: false*/ });
  f1.addMonitor(world, "fps" /*, { view: "graph", min: 0, max: 75 }*/);

  f1.addInput(viewport, "zoom", { min: 0.1, max: 3.0 });
  f1.addInput(viewport, "camera", {
    x: { min: -1000, max: 1000 },
    y: { min: -1000, max: 1000 },
  });

  const grid1 = f1.addFolder({ title: "Grid", expanded: false });
  grid1.addInput(viewport, "gridEnabled");
  grid1.addInput(viewport, "gridSize", { min: 10, max: 1000 });
  grid1.addInput(viewport, "gridLineColor", { view: "color" });
  grid1.addInput(viewport, "gridLineAlpha", { min: 0.0, max: 1.0 });
  grid1.addInput(viewport, "gridLineWidth", { min: 0.5, max: 5.0 });

  f1.addSeparator();
  f1.addButton({ title: "Stop" }).on("click", () => world.loop.stop());
  f1.addButton({ title: "Start" }).on("click", () => world.loop.start());

  return pane;
}

main().catch(console.error);

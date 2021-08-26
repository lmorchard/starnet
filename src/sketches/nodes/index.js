import { defineSystem, addComponent, pipe, removeComponent } from "bitecs";
import * as Stats from "../../lib/stats.js";
import * as World from "../../lib/world.js";
import * as Viewport from "../../lib/viewport/pixi.js";
import {
  CameraFocus,
  Renderable,
  renderQuery,
  cameraFocusQuery,
} from "../../lib/viewport/index.js";
import { movementSystem, bouncerSystem } from "../../lib/positionMotion.js";
import {
  init as initGraphLayout,
  graphLayoutSystem,
  spawnSceneForNetwork,
  spawnNode,
  spawnNodeEdge,
} from "../../lib/graphLayout.js";
import {
  init as initNetworks,
  networkNodeRefSystem,
  Network,
  GatewayNode,
  StorageNode,
  FirewallNode,
  HubNode,
  TerminalNode,
  WalletNode,
  ICENode,
} from "../../lib/networks.js";
import { setGlobalRng, mkrng, rngIntRange, genHex } from "../../lib/randoms.js";
import { setupTwiddles } from "../twiddles.js";

async function main() {
  setGlobalRng(mkrng("hello"));

  const stats = Stats.init();
  const viewport = Viewport.init();
  const world = World.init();

  initNetworks(world);
  initGraphLayout(world);

  const network = new Network();
  const nodes = network.add(
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
  ] = nodes;

  gateway.connect(firewall);
  firewall.connect(storageHub, terminalHub, ice1);
  storageHub.connect(storage1, storage2, storage3, wallet1);
  terminalHub.connect(terminal1, terminal2, terminal3);

  for (const node of nodes) {
    console.log(node.id.toString(16).padStart(8, "0"), node);
  }

  spawnSceneForNetwork(world, network);
  // TODO: despawn scene for transition

  addComponent(world, CameraFocus, world.nodeIdToEntityId[gateway.id]);

  const focusSelectionSystem = defineSystem((world) => {
    const clickedEid = renderQuery(world).find(
      (eid) => Renderable.mouseClicked[eid]
    );
    if (clickedEid) {
      const cameraFocusEid = cameraFocusQuery(world)[0];
      if (cameraFocusEid) {
        removeComponent(world, CameraFocus, cameraFocusEid);
      }
      addComponent(world, CameraFocus, clickedEid);
    }
  });

  const spawnNewNode = () => {
    const [node] = network.add(new TerminalNode());
    node.connect(terminalHub);
    spawnNode(world, node);
    for (const toNodeId in node.connections) {
      spawnNodeEdge(
        world,
        network.id,
        world.nodeIdToEntityId[node.id],
        world.nodeIdToEntityId[toNodeId]
      );
    }
  };

  const pane = setupTwiddles(world, viewport);
  pane.addButton({ title: "Spawn" }).on("click", spawnNewNode);

  const pipeline = pipe(
    networkNodeRefSystem,
    graphLayoutSystem,
    movementSystem,
    bouncerSystem,
    focusSelectionSystem,
    () => pane.refresh()
  );
  world.run(pipeline, viewport, stats);

  console.log("READY.");
}

main().catch(console.error);

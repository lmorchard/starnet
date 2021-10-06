import {
  defineSystem,
  addComponent,
  pipe,
  removeComponent,
  hasComponent,
} from "bitecs";
import * as Stats from "../../lib/stats.js";
import * as World from "../../lib/world.js";
import * as Viewport from "../../lib/viewport/pixi.js";
import {
  CameraFocus,
  Renderable,
  renderQuery,
  cameraFocusQuery,
} from "../../lib/viewport/index.js";
import { movementSystem } from "../../lib/positionMotion.js";
import {
  init as initGraphLayout,
  graphLayoutSystem,
  GraphLayoutNode,
} from "../../lib/graphLayout.js";
import {
  init as initNetworks,
  spawnEntitiesForNetwork,
  networkGraphLayoutSystem,
  Network,
  GatewayNode,
  StorageNode,
  FirewallNode,
  HubNode,
  TerminalNode,
  WalletNode,
  ICENode,
  NetworkNodeState,
  NetworkState,
} from "../../lib/networks.js";
import { setGlobalRng, mkrng, rngIntRange, genHex } from "../../lib/randoms.js";
import { setupTwiddles } from "../twiddles.js";

async function main() {
  setGlobalRng(mkrng("hello"));

  const stats = Stats.init();
  const viewport = Viewport.init();
  const world = World.init();

  Object.assign(window, {
    world,
    NetworkState,
    NetworkNodeState,
    GraphLayoutNode,
  });

  initNetworks(world);
  initGraphLayout(world);

  const network1 = new Network();
  const nodes = network1.add(
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
    terminal4,
    ice1,
  ] = nodes;

  gateway.connect(firewall);
  firewall.connect(storageHub, terminalHub, ice1);
  storageHub.connect(storage1, storage2, storage3, wallet1);
  terminalHub.connect(terminal1, terminal2, terminal3, terminal4);

  const networkEid = spawnEntitiesForNetwork(world, network1);
  NetworkState.active[networkEid] = true;

  const gatewayEid = world.nodeIdToEntityId[gateway.id];
  NetworkNodeState.visible[gatewayEid] = true;

  // TODO: despawn scene for transition

  addComponent(world, CameraFocus, world.nodeIdToEntityId[gateway.id]);

  const focusSelectionSystem = defineSystem((world) => {
    const renderables = renderQuery(world);
    const clickedEid = renderables.find((eid) => Renderable.mouseClicked[eid]);
    if (clickedEid) {
      const cameraFocusEid = cameraFocusQuery(world)[0];
      if (cameraFocusEid && cameraFocusEid !== clickedEid) {
        removeComponent(world, CameraFocus, cameraFocusEid);
      }
      addComponent(world, CameraFocus, clickedEid);

      const networkId = NetworkNodeState.networkId[clickedEid];
      const network = world.networks[networkId];
      const nodeId = NetworkNodeState.nodeId[clickedEid];
      const node = network.children[nodeId];
      for (const connectedId in node.connections) {
        const connectedEid = world.nodeIdToEntityId[connectedId];
        if (
          connectedEid &&
          hasComponent(world, NetworkNodeState, connectedEid)
        ) {
          NetworkNodeState.visible[connectedEid] = true;
        }
      }
    }
  });

  const pane = setupTwiddles(world, viewport);
  // setupBloomTwiddles(pane, viewport);
  //pane.addButton({ title: "Spawn" }).on("click", spawnNewNode);

  const pipeline = pipe(
    networkGraphLayoutSystem,
    graphLayoutSystem,
    movementSystem,
    focusSelectionSystem,
    () => pane.refresh()
  );
  world.run(pipeline, viewport, stats);

  console.log("READY.");
}

main().catch(console.error);

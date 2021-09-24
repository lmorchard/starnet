import { defineSystem, addComponent, pipe, removeComponent } from "../../vendor/pkg/bitecs.uBk-LJ8s6O3X.js";
import * as Stats from "../../lib/stats.OV0McSz3wFid.js";
import * as World from "../../lib/world.TEy0JkQcCExn.js";
import * as Viewport from "../../lib/viewport/pixi.iYECRZU2iNU-.js";
import {
  CameraFocus,
  Renderable,
  renderQuery,
  cameraFocusQuery,
} from "../../lib/viewport/index.V6yaLwAeWhUZ.js";
import {
  movementSystem,
  bouncerSystem,
  Position,
} from "../../lib/positionMotion.Rf-6EmSjJMue.js";
import {
  init as initGraphLayout,
  graphLayoutSystem,
  spawnSceneForNetwork,
  spawnNode,
  spawnNodeEdge,
} from "../../lib/graphLayout.HRKflItO5Wh9.js";
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
} from "../../lib/networks.AfQ6JuuqdXzR.js";
import { setGlobalRng, mkrng, rngIntRange, genHex } from "../../lib/randoms.X9VRh4IgloX1.js";
import { setupTwiddles } from "../twiddles.Vi43hBdm0vpV.js";

async function main() {
  setGlobalRng(mkrng("hello"));

  const stats = Stats.init();
  const viewport = Viewport.init();
  const world = World.init();

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

  spawnSceneForNetwork(world, network1);
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
    }
  });

  const spawnNewNode = () => {
    const [node] = network1.add(new TerminalNode());
    node.connect(terminalHub);
    spawnNode(world, node);
    for (const toNodeId in node.connections) {
      spawnNodeEdge(
        world,
        network1.id,
        world.nodeIdToEntityId[node.id],
        world.nodeIdToEntityId[toNodeId]
      );
    }
  };

  const pane = setupTwiddles(world, viewport);
  viewport.zoom = 0.75;
  pane.addButton({ title: "Spawn" }).on("click", spawnNewNode);

  const bloomTwiddles = pane.addFolder({ title: "Bloom" });
  bloomTwiddles.addInput(viewport.bloom, "threshold", {
    min: 0.1,
    max: 2.0,
    step: 0.1,
  });
  bloomTwiddles.addInput(viewport.bloom, "bloomScale", {
    min: 0.1,
    max: 2.0,
    step: 0.1,
  });
  bloomTwiddles.addInput(viewport.bloom, "brightness", {
    min: 0.1,
    max: 2.0,
    step: 0.1,
  });
  bloomTwiddles.addInput(viewport.bloom, "blur", {
    min: 0.5,
    max: 8.0,
    step: 0.1,
  });
  bloomTwiddles.addInput(viewport.bloom, "quality", {
    min: 1,
    max: 16,
    step: 1,
  });

  const pipeline = pipe(
    networkNodeRefSystem,
    graphLayoutSystem,
    movementSystem,
    focusSelectionSystem,
    () => pane.refresh()
  );
  world.run(pipeline, viewport, stats);

  console.log("READY.");
}

main().catch(console.error);

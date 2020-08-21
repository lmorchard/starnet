import { mkrng, setGlobalRngClass, setGlobalRng } from "./lib/randoms.js";
setGlobalRngClass(Math.seedrandom);

import { initGame, startMainLoop } from "./lib/index.js";
import { Position, Motion } from "./lib/ecs/positionMotion.js";
import {
  Renderable,
  Shape,
  CursorTarget,
} from "./lib/ecs/viewport/components.js";
import { GraphGroup } from "./lib/ecs/graph.js";
import { Node } from "./lib/ecs/node.js";
import { PlayerFocus } from "./lib/ecs/player.js";

import {
  GatewayNode,
  FirewallNode,
  RouterNode,
  StorageNode,
  AuditLogNode,
  SecurityMonitorNode,
} from "./lib/networkNodes.js";

async function init() {
  console.log("READY.");

  setGlobalRng(mkrng("hello"));

  const { world, worldState, drawStats, gui } = initGame({
    debug: true,
    containerSelector: "#main",
  });

  const gateway = new GatewayNode({});
  const firewall = gateway.createChild(FirewallNode);
  const audit = gateway.createChild(AuditLogNode);
  const security = gateway.createChild(SecurityMonitorNode);
  const storage = gateway.createChild(StorageNode);
  const router = gateway.createChild(RouterNode);

  gateway.connectTo(firewall);
  router.connectTo(firewall);
  audit.connectTo(router);
  security.connectTo(router);
  storage.connectTo(router);

  // console.log(JSON.stringify(gateway.toJSON(), null, "  "));

  const spawnNode = (node, groupId) => {
    const entity = world
      .createEntity()
      .addComponent(Renderable)
      .addComponent(CursorTarget)
      .addComponent(Node, { node })
      .addComponent(GraphGroup, { groupId })
      .addComponent(Shape, { primitive: "node", width: 50, height: 50 })
      .addComponent(Motion, { dx: 0, dy: 0 })
      .addComponent(Position, { x: 0, y: 0 });
    return entity;
  };

  const rootNode = gateway;
  const rootEntity = spawnNode(rootNode, rootNode.id);
  rootEntity.addComponent(PlayerFocus);

  for (const node of Object.values(rootNode.children)) {
    spawnNode(node, rootNode.id);
  }

  startMainLoop(world, worldState, drawStats);
}

init()
  .then()
  .catch((err) => console.error(err));

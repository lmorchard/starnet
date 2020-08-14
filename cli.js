import {
  mkrng,
  setGlobalRngClass,
  setGlobalRng,
} from "./lib/randoms.js";

import seedrandom from "seedrandom";
setGlobalRngClass(seedrandom);

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

  const gateway = new GatewayNode({});
  const firewall = gateway.createChild(FirewallNode);
  const audit = gateway.createChild(AuditLogNode);
  const security = gateway.createChild(GatewayNode);
  const storage = gateway.createChild(StorageNode);
  const router = gateway.createChild(RouterNode);

  gateway.connectTo(firewall);
  router.connectTo(firewall);
  audit.connectTo(router);
  security.connectTo(router);
  storage.connectTo(router);

  console.log(JSON.stringify(gateway.toJSON(), null, "  "));
}

init()
  .then()
  .catch((err) => console.error(err));

// Static hand-crafted network for initial prototype
// Nodes represent a small corporate LAN dungeon

export const NETWORK = {
  nodes: [
    {
      id: "gateway",
      type: "gateway",
      label: "INET-GW-01",
      grade: "D",
      x: 400,
      y: 50,
    },
    {
      id: "router-a",
      type: "router",
      label: "RTR-A",
      grade: "C",
      x: 200,
      y: 180,
    },
    {
      id: "router-b",
      type: "router",
      label: "RTR-B",
      grade: "C",
      x: 600,
      y: 180,
    },
    {
      id: "firewall",
      type: "firewall",
      label: "FW-CORE",
      grade: "A",
      x: 400,
      y: 180,
    },
    {
      id: "workstation-a",
      type: "workstation",
      label: "WS-ALPHA",
      grade: "F",
      x: 100,
      y: 320,
    },
    {
      id: "workstation-b",
      type: "workstation",
      label: "WS-BETA",
      grade: "F",
      x: 300,
      y: 320,
    },
    {
      id: "ids",
      type: "ids",
      label: "IDS-01",
      grade: "B",
      x: 560,
      y: 320,
    },
    {
      id: "fileserver",
      type: "fileserver",
      label: "FS-VAULT",
      grade: "B",
      x: 200,
      y: 460,
      // Staged: exploit path-traversal first to reveal the deeper kernel escalation path
      stagedVulnerabilities: [
        {
          id: "kernel-exploit",
          name: "Kernel Privilege Escalation",
          description: "Use-after-free in kernel scheduler enables local privilege elevation to ring 0.",
          rarity: "uncommon",
          unlockedBy: "path-traversal",
        },
      ],
    },
    {
      id: "cryptovault",
      type: "cryptovault",
      label: "CRYPT-X9",
      grade: "S",
      x: 400,
      y: 500,
      // Staged: exploit the timing side-channel first to expose the hardware backdoor
      stagedVulnerabilities: [
        {
          id: "hardware-backdoor",
          name: "Hardware Backdoor",
          description: "Undocumented maintenance interface hardwired into silicon; bypasses all software auth.",
          rarity: "rare",
          unlockedBy: "side-channel",
        },
      ],
    },
    {
      id: "security-monitor",
      type: "security-monitor",
      label: "SEC-MON",
      grade: "A",
      x: 680,
      y: 460,
    },
  ],

  edges: [
    { source: "gateway", target: "router-a" },
    { source: "gateway", target: "firewall" },
    { source: "gateway", target: "router-b" },
    { source: "router-a", target: "workstation-a" },
    { source: "router-a", target: "workstation-b" },
    { source: "router-a", target: "fileserver" },
    { source: "firewall", target: "fileserver" },
    { source: "firewall", target: "cryptovault" },
    { source: "router-b", target: "ids" },
    { source: "ids", target: "security-monitor" },
    { source: "workstation-b", target: "cryptovault" },
  ],

  startNode: "gateway",
};

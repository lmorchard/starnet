import { NETWORK } from "../data/network.js";
import { initGraph, updateNodeStyle } from "./graph.js";

// Minimal bootstrap for Phase 1 — just render the graph and log clicks.
// State management, panels, and game logic come in later phases.

function init() {
  // Make the gateway accessible so it renders fully; all others hidden
  const nodeClasses = {};
  NETWORK.nodes.forEach((n) => {
    nodeClasses[n.id] = {
      visibility: n.id === NETWORK.startNode ? "accessible" : "hidden",
      accessLevel: "locked",
      alertState: "green",
    };
  });

  const cy = initGraph(NETWORK, (nodeId) => {
    console.log("[click]", nodeId, nodeClasses[nodeId]);
    document.getElementById("sidebar").innerHTML =
      `<div class="sidebar-placeholder">NODE: ${nodeId}<br>Type: ${
        NETWORK.nodes.find((n) => n.id === nodeId)?.type ?? "?"
      }<br>(detail panel coming in Phase 3)</div>`;
  });

  // Apply initial styles
  NETWORK.nodes.forEach((n) => {
    updateNodeStyle(n.id, nodeClasses[n.id]);
  });

  // Reveal nodes connected to the gateway so the player can see what's adjacent
  NETWORK.edges
    .filter((e) => e.source === NETWORK.startNode || e.target === NETWORK.startNode)
    .forEach((e) => {
      const neighborId = e.source === NETWORK.startNode ? e.target : e.source;
      if (nodeClasses[neighborId].visibility === "hidden") {
        nodeClasses[neighborId].visibility = "revealed";
        updateNodeStyle(neighborId, nodeClasses[neighborId]);
      }
    });

  cy.fit(cy.nodes('.accessible, .revealed'), 40);
}

document.addEventListener("DOMContentLoaded", init);

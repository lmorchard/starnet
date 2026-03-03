// Vendor bundle entry point.
// Imports Cytoscape.js and all layout extensions, registers them, then
// exposes window.cytoscape so the game code can use it as before.

import cytoscape from "cytoscape";
import cola from "cytoscape-cola";
import dagre from "cytoscape-dagre";
import euler from "cytoscape-euler";
import klay from "cytoscape-klay";
import spread from "cytoscape-spread";
import coseBilkent from "cytoscape-cose-bilkent";
import fcose from "cytoscape-fcose";

cytoscape.use(cola);
cytoscape.use(dagre);
cytoscape.use(euler);
cytoscape.use(klay);
cytoscape.use(spread);
cytoscape.use(coseBilkent);
cytoscape.use(fcose);

window.cytoscape = cytoscape;

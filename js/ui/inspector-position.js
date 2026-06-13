// @ts-check
// Pure geometry for placing the node inspector popup relative to its anchor node.
// No DOM/Cytoscape access — caller supplies measured rects. Tested in isolation.

// Distance from the node edge to the popup. Generous so the inspector clearly
// detaches from the node it describes (it's a panel, not a tight tooltip).
const GAP = 40;
const MARGIN = 4;

/**
 * @param {{ node: {x:number,y:number,r:number}, popup: {w:number,h:number}, container: {w:number,h:number} }} args
 * @returns {{ left:number, top:number, onRight:boolean }}
 */
export function computeInspectorPosition({ node, popup, container }) {
  // Horizontal: prefer right of node, flip left if clipped.
  const onRight = node.x + node.r + GAP + popup.w <= container.w;
  const left = onRight
    ? node.x + node.r + GAP
    : node.x - node.r - GAP - popup.w;

  // Vertical: anchor the header top near the node's top edge, then clamp so the
  // top never rises above MARGIN. When the popup is taller than the container the
  // min() goes negative and the max() pins it to MARGIN — header + actions stay
  // on-screen, an overlong footer runs off the bottom (no-scroll decision).
  const topRaw = node.y - node.r;
  const top = Math.max(MARGIN, Math.min(topRaw, container.h - popup.h - MARGIN));

  return { left, top, onRight };
}

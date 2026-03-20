// @ts-check
// Level select dialog — bridge between HUD button and <starnet-level-select> component.

/** Read current URL params (if any) for default values. */
function currentParams() {
  const p = new URLSearchParams(location.search);
  return {
    network: p.get("network") ?? "corporate-foothold",
    seed:    p.get("seed") ?? "",
    threat:  p.get("threat")?.toUpperCase() ?? "C",
    wealth:  p.get("wealth")?.toUpperCase() ?? "B",
    complexity: p.get("complexity")?.toUpperCase() ?? "C",
    depth:   p.get("depth")?.toUpperCase() ?? "C",
  };
}

/** Open the level select dialog. */
export function openLevelSelect() {
  const el = /** @type {any} */ (document.getElementById("level-select"));
  if (!el || el.open) return;

  el.defaults = currentParams();
  el.open = true;

  /** @param {CustomEvent} evt */
  function onStart(evt) {
    location.href = evt.detail.url;
  }

  function onClose() {
    el.open = false;
    el.removeEventListener("start", onStart);
    el.removeEventListener("close", onClose);
  }

  el.addEventListener("start", onStart);
  el.addEventListener("close", onClose);
}

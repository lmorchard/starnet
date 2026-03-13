// @ts-check
// Level select dialog — lets the player pick a network type, seed, and
// difficulty parameters, then reload the page with URL parameters.

const GRADES = ["F", "D", "C", "B", "A", "S"];

const NETWORK_OPTIONS = [
  { value: "corporate-foothold", label: "Corporate Foothold", desc: "Tutorial. No ICE." },
  { value: "research-station", label: "Research Station", desc: "Circuit puzzles. No ICE." },
  { value: "corporate-exchange", label: "Corporate Exchange", desc: "Aggressive ICE." },
  { value: "generated", label: "// GENERATED //", desc: "Procedural network." },
];

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

function gradeOptions(selected) {
  return GRADES.map(g =>
    `<option value="${g}" ${g === selected ? "selected" : ""}>${g}</option>`
  ).join("");
}

function networkOptions(selected) {
  return NETWORK_OPTIONS.map(n =>
    `<option value="${n.value}" ${n.value === selected ? "selected" : ""}>${n.label}</option>`
  ).join("");
}

/** Open the level select dialog. */
export function openLevelSelect() {
  if (document.getElementById("level-select-modal")) return;

  const cur = currentParams();
  const defaultSeed = cur.seed || "run-" + Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0");
  const isGenerated = cur.network === "generated";

  const modal = document.createElement("div");
  modal.id = "level-select-modal";
  modal.innerHTML = `
    <div class="level-select-box">
      <div class="level-select-header">// NEW RUN</div>
      <div class="level-select-form">
        <label class="level-select-label">
          NETWORK
          <select id="ls-network" class="level-select-select">${networkOptions(cur.network)}</select>
        </label>
        <label class="level-select-label">
          SEED
          <input type="text" id="ls-seed" class="level-select-input" value="${defaultSeed}" />
        </label>
        <div id="ls-budget-fields" style="${isGenerated ? "" : "display:none"}">
          <label class="level-select-label">
            THREAT
            <select id="ls-threat" class="level-select-select">${gradeOptions(cur.threat)}</select>
            <span class="level-select-hint">Security, ICE, pressure</span>
          </label>
          <label class="level-select-label">
            WEALTH
            <select id="ls-wealth" class="level-select-select">${gradeOptions(cur.wealth)}</select>
            <span class="level-select-hint">Loot density, cash rewards</span>
          </label>
          <label class="level-select-label">
            COMPLEXITY
            <select id="ls-complexity" class="level-select-select">${gradeOptions(cur.complexity)}</select>
            <span class="level-select-hint">Puzzles, gates</span>
          </label>
          <label class="level-select-label">
            DEPTH
            <select id="ls-depth" class="level-select-select">${gradeOptions(cur.depth)}</select>
            <span class="level-select-hint">Hops from gateway to deepest node</span>
          </label>
        </div>
      </div>
      <div class="level-select-actions">
        <button id="ls-random-btn" class="level-select-btn">[ RANDOM SEED ]</button>
        <button id="ls-go-btn" class="level-select-btn level-select-go">[ JACK IN ]</button>
        <button id="ls-cancel-btn" class="level-select-btn">[ CANCEL ]</button>
      </div>
    </div>
  `;

  function close() { modal.remove(); }

  function go() {
    const network = /** @type {HTMLSelectElement} */ (document.getElementById("ls-network")).value;
    const seed    = /** @type {HTMLInputElement} */ (document.getElementById("ls-seed")).value.trim();
    if (!seed) return;

    const url = new URL(location.href);
    url.searchParams.set("network", network);
    url.searchParams.set("seed", seed);

    if (network === "generated") {
      url.searchParams.set("threat",     /** @type {HTMLSelectElement} */ (document.getElementById("ls-threat")).value);
      url.searchParams.set("wealth",     /** @type {HTMLSelectElement} */ (document.getElementById("ls-wealth")).value);
      url.searchParams.set("complexity", /** @type {HTMLSelectElement} */ (document.getElementById("ls-complexity")).value);
      url.searchParams.set("depth",      /** @type {HTMLSelectElement} */ (document.getElementById("ls-depth")).value);
      // Remove legacy params
      url.searchParams.delete("time");
      url.searchParams.delete("money");
    } else {
      // Remove generated params
      url.searchParams.delete("threat");
      url.searchParams.delete("wealth");
      url.searchParams.delete("complexity");
      url.searchParams.delete("depth");
    }

    location.href = url.toString();
  }

  function randomSeed() {
    const input = /** @type {HTMLInputElement} */ (document.getElementById("ls-seed"));
    input.value = "run-" + Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0");
  }

  function toggleBudgetFields() {
    const network = /** @type {HTMLSelectElement} */ (document.getElementById("ls-network")).value;
    const fields = document.getElementById("ls-budget-fields");
    if (fields) fields.style.display = (network === "generated") ? "" : "none";
  }

  // Wire events after adding to DOM
  document.getElementById("graph-container")?.appendChild(modal);

  document.getElementById("ls-go-btn")?.addEventListener("click", go);
  document.getElementById("ls-cancel-btn")?.addEventListener("click", close);
  document.getElementById("ls-random-btn")?.addEventListener("click", randomSeed);
  document.getElementById("ls-network")?.addEventListener("change", toggleBudgetFields);

  // Enter key submits
  document.getElementById("ls-seed")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });

  // Backdrop click closes
  modal.addEventListener("click", (e) => {
    if (!/** @type {Element} */ (e.target).closest(".level-select-box")) close();
  });
}

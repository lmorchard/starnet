// @ts-check
// Level select dialog — lets the player pick seed, timeCost, moneyCost
// and reload the page with the appropriate URL parameters.

const GRADES = ["F", "D", "C", "B", "A", "S"];

/** Read current URL params (if any) for default values. */
function currentParams() {
  const p = new URLSearchParams(location.search);
  return {
    seed:  p.get("seed") ?? "",
    time:  p.get("time")?.toUpperCase() ?? "C",
    money: p.get("money")?.toUpperCase() ?? "C",
  };
}

function gradeOptions(selected) {
  return GRADES.map(g =>
    `<option value="${g}" ${g === selected ? "selected" : ""}>${g}</option>`
  ).join("");
}

/** Open the level select dialog. */
export function openLevelSelect() {
  if (document.getElementById("level-select-modal")) return;

  const cur = currentParams();
  const defaultSeed = cur.seed || "run-" + Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0");

  const modal = document.createElement("div");
  modal.id = "level-select-modal";
  modal.innerHTML = `
    <div class="level-select-box">
      <div class="level-select-header">// NEW RUN</div>
      <div class="level-select-form">
        <label class="level-select-label">
          SEED
          <input type="text" id="ls-seed" class="level-select-input" value="${defaultSeed}" />
        </label>
        <label class="level-select-label">
          TIME COST
          <select id="ls-time" class="level-select-select">${gradeOptions(cur.time)}</select>
          <span class="level-select-hint">ICE grade, depth, gates</span>
        </label>
        <label class="level-select-label">
          MONEY COST
          <select id="ls-money" class="level-select-select">${gradeOptions(cur.money)}</select>
          <span class="level-select-hint">Node grades, path length</span>
        </label>
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
    const seed  = /** @type {HTMLInputElement} */ (document.getElementById("ls-seed")).value.trim();
    const time  = /** @type {HTMLSelectElement} */ (document.getElementById("ls-time")).value;
    const money = /** @type {HTMLSelectElement} */ (document.getElementById("ls-money")).value;
    if (!seed) return;
    const url = new URL(location.href);
    url.searchParams.set("seed", seed);
    url.searchParams.set("time", time);
    url.searchParams.set("money", money);
    location.href = url.toString();
  }

  function randomSeed() {
    const input = /** @type {HTMLInputElement} */ (document.getElementById("ls-seed"));
    input.value = "run-" + Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0");
  }

  // Wire events after adding to DOM
  document.getElementById("graph-container")?.appendChild(modal);

  document.getElementById("ls-go-btn")?.addEventListener("click", go);
  document.getElementById("ls-cancel-btn")?.addEventListener("click", close);
  document.getElementById("ls-random-btn")?.addEventListener("click", randomSeed);

  // Enter key submits
  document.getElementById("ls-seed")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });

  // Backdrop click closes
  modal.addEventListener("click", (e) => {
    if (!/** @type {Element} */ (e.target).closest(".level-select-box")) close();
  });
}

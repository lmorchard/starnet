// @ts-nocheck
import { createSfx } from "./engine.js";
import { CUES, CUE_IDS } from "./defs.js";
import { DRONES, DRONE_IDS } from "./drones.js";

const sfx = createSfx();
window._sfx = sfx;   // diagnostics handle

const status = document.getElementById("status");
let unlocked = false;
async function ensure() {
  if (unlocked) return;
  await sfx.unlock();
  unlocked = true;
  status.textContent = "ready";
}

// One-shot cues — click to fire.
const grid = document.getElementById("cues");
for (const id of CUE_IDS) {
  const b = document.createElement("button");
  b.className = "cue";
  b.textContent = id;
  b.onclick = async () => { await ensure(); sfx.play(CUES[id]); };
  grid.appendChild(b);
}

// Sustained drones — toggle play/stop; drag the slider to audition progress 0→1.
const droneGrid = document.getElementById("drones");
for (const id of DRONE_IDS) {
  const row = document.createElement("div");
  row.className = "drone-row";

  const toggle = document.createElement("button");
  toggle.className = "cue";
  toggle.textContent = `▶ ${id}`;

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0"; slider.max = "1"; slider.step = "0.01"; slider.value = "0";
  slider.disabled = true;

  let handle = null;
  toggle.onclick = async () => {
    await ensure();
    if (handle) {
      handle.stop(); handle = null;
      toggle.textContent = `▶ ${id}`;
      slider.disabled = true; slider.value = "0";
    } else {
      handle = sfx.startDrone(DRONES[id]);
      handle.setProgress(Number(slider.value));
      toggle.textContent = `■ ${id}`;
      slider.disabled = false;
    }
  };
  slider.oninput = () => handle?.setProgress(Number(slider.value));

  row.appendChild(toggle);
  row.appendChild(slider);
  droneGrid.appendChild(row);
}

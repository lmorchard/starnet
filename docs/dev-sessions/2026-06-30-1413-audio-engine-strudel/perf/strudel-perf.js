// Strudel engine perf-gate measurement (issue #254 Phase 1).
//
// A browser-console / Playwright snippet — paste into the page console (or run via
// page.evaluate) with the Strudel engine selected and booted (localStorage
// "starnet:audio-engine"="strudel", reload, click once to resume the AudioContext).
//
// It measures main-thread frame pacing (requestAnimationFrame interval) under a dense audio
// load: the 8-voice reactive music + ~9 one-shot SFX/sec + 4 rolling action drones. This is a
// PROXY: audio synthesis runs on the AudioWorklet thread, so what this catches is whether
// Strudel's main-thread scheduling/pattern-query janks the render loop. Audible dropouts/crackle
// are a separate, human judgment (listen at PR review).
//
// Results recorded in notes.md. Re-run after any change to the engine's scheduling or score density.

window.strudelPerf = async function strudelPerf({ loadMs = 10000, idleMs = 5000 } = {}) {
  const eng = window.strudelEngine;
  if (!eng?.drones) throw new Error("Strudel engine not booted (select it, reload, click once)");
  const ctx = eng.rt.ctx;
  const cmd = window.starnet.cmd;

  const measureFPS = async (ms) => {
    const iv = []; let last = performance.now(); const s0 = performance.now();
    await new Promise((res) => {
      function tick(now) { const dt = now - last; last = now; if (now - s0 > 300) iv.push(dt); if (now - s0 < ms) requestAnimationFrame(tick); else res(); }
      requestAnimationFrame(tick);
    });
    iv.sort((a, b) => a - b);
    return {
      medianFPS: +(1000 / iv[Math.floor(iv.length / 2)]).toFixed(1),
      p95FrameMs: +iv[Math.floor(iv.length * 0.95)].toFixed(1),
      maxFrameMs: +iv[iv.length - 1].toFixed(1),
      samples: iv.length,
    };
  };

  cmd("music off");
  await new Promise((r) => setTimeout(r, 2500));
  const idle = await measureFPS(idleMs);

  cmd("music on");
  const droneIds = Object.keys(eng.DRONES);
  const cueIds = ["reveal", "access", "xploit.ok", "ice.detected", "alert.up"];
  const live = []; const timers = [];
  timers.push(setInterval(() => eng.sfx.playCue(cueIds[(Math.random() * cueIds.length) | 0]), 110));
  timers.push(setInterval(() => {
    if (live.length >= 4) live.shift().stop();
    live.push(eng.createDroneVoice(ctx, eng.DRONES[droneIds[(Math.random() * droneIds.length) | 0]]));
  }, 600));
  await new Promise((r) => setTimeout(r, 1500));
  const load = await measureFPS(loadMs);
  timers.forEach(clearInterval); live.forEach((v) => v.stop()); cmd("music off");

  return { idle, load };
};

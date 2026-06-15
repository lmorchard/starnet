// @ts-check
// Sound-effect cue catalog — pure data. Each cue is a spec interpreted by engine.js into a
// synthesized one-shot. Families: info, success, reward, failure, danger, glitch, relief.
//
// Aesthetic: "cold machine telemetry" — dry, low-register, technical. No cheerful arpeggios;
// detuned/minor intervals over major triads; danger leans into low FM growl. Reverb is opt-in
// per cue (`reverb:true`), default dry. Starter values; tuned by ear later in the harness.

export const CUES = {
  // info / neutral — dry filtered ticks, minimal pitch bounce
  probe:        { kind:"blip",  note:"A3", osc:"square",   decay:0.05, detune:-8, volume:-17 },
  navigate:     { kind:"blip",  note:"E3", osc:"square",   decay:0.03, volume:-24 },
  // reveal — a brighter "discovery rush" blip; renderer pitches it by node grade and steps it up
  // per reveal in a burst (ascending cascade). Single = bright; mass reveal = a rising run.
  reveal:       { kind:"blip",  note:"E5", osc:"triangle", decay:0.07, volume:-17 },
  dump:         { kind:"sweep", from:380, to:160, dur:0.20, osc:"square", detune:-6, volume:-19 },
  "mine.miss":  { kind:"noise", dur:0.08, cutoff:1400, volume:-21 },
  "ice.move":   { kind:"blip",  note:"D3", osc:"square",   decay:0.04, volume:-25 },
  decay:        { kind:"blip",  note:"A2", osc:"square",   decay:0.05, detune:-14, volume:-22 },
  // node-alert — subtle per-node alert tick; renderer pitches up at red. Low + deduped.
  "node.alert": { kind:"blip",  note:"D3", osc:"square",   decay:0.04, detune:-6, volume:-25 },
  // exploit wear — dry chirp; renderer drops pitch as the card wears down
  burn:         { kind:"blip",  note:"C4", osc:"square",   decay:0.05, volume:-21 },
  // success — terse, detuned. access escalates by level: open = 2 hits, owned = 3 hits + fuller.
  "xploit.ok":  { kind:"chord", notes:["A3","C4"], decay:0.14, osc:"square", detune:-6, volume:-14 },
  "access.open":  { kind:"chord", notes:["A3","E4"], decay:0.15, osc:"square", detune:-4, hits:2, hitGap:0.09, volume:-14 },
  "access.owned": { kind:"chord", notes:["A3","E4","A4"], decay:0.17, osc:"sawtooth", detune:-4, hits:3, hitGap:0.085, volume:-13 },
  "ice.down":   { kind:"sweep", from:900, to:90, dur:0.45, osc:"sawtooth", volume:-13 },
  // reward — low data-bursts / sober resolved tones, NOT chimes. mine escalates by rarity.
  fetch:        { kind:"noise", dur:0.16, cutoff:2200, hp:true, volume:-15 },
  "fetch.big":  { kind:"chord", notes:["A2","E3"], decay:0.26, osc:"sawtooth", detune:-5, hits:2, hitGap:0.1, volume:-12, reverb:true },
  "mine.common":   { kind:"blip",  note:"E3", osc:"square", decay:0.07, detune:-4, volume:-15 },
  "mine.uncommon": { kind:"chord", notes:["E3","B3"], decay:0.16, osc:"square", detune:-4, volume:-14 },
  "mine.rare":     { kind:"chord", notes:["E3","B3","E4"], strum:0.05, decay:0.22, osc:"sawtooth", detune:-3, volume:-12 },
  mission:      { kind:"chord", notes:["A2","E3","A3"], decay:0.4, osc:"sawtooth", detune:-6, volume:-12, reverb:true },
  // failure — sub-thuds / low FM
  "xploit.fail":{ kind:"noise", dur:0.20, cutoff:600, volume:-12 },
  "mine.trap":  { kind:"fm",    note:"A1", harmonicity:1.5, modIndex:20, decay:0.32, volume:-11 },
  "fetch.trap": { kind:"fm",    note:"C2", harmonicity:2, modIndex:16, decay:0.28, volume:-12 },
  "hurt.health":{ kind:"noise", dur:0.24, cutoff:340, volume:-9 },
  "ice.ejected":{ kind:"sweep", from:600, to:80, dur:0.3, osc:"sawtooth", volume:-12 },
  // danger — low growl / dissonant clusters
  "alert.up":   { kind:"fm",    note:"D2", harmonicity:1.5, modIndex:14, decay:0.3, volume:-13 },
  "trace.start":{ kind:"fm",    note:"A1", harmonicity:1.25, modIndex:24, decay:0.7, volume:-9, reverb:true },
  "ice.pending":{ kind:"sweep", from:300, to:520, dur:0.4, osc:"square", detune:-10, volume:-15 },
  "ice.locked": { kind:"fm",    note:"D2", harmonicity:1.5, modIndex:26, decay:0.5, volume:-9 },
  // glitch — metallic FM
  corrupt:      { kind:"fm",    note:"G2", harmonicity:3.5, modIndex:18, decay:0.24, volume:-13 },
  "hurt.deck":  { kind:"fm",    note:"D2", harmonicity:4.5, modIndex:22, decay:0.3, volume:-11 },
  // relief / resolution — settled descending, no major chord
  "alert.down": { kind:"sweep", from:420, to:200, dur:0.32, osc:"triangle", detune:-4, volume:-17 },
  "trace.cancel":{ kind:"sweep", from:520, to:180, dur:0.4, osc:"sawtooth", detune:-6, volume:-14 },
  "ice.reboot": { kind:"blip",  note:"E3", osc:"sine", decay:0.14, detune:-4, volume:-17 },
  // run lifecycle
  "run.start":  { kind:"sweep", from:70, to:340, dur:0.55, osc:"sawtooth", detune:-8, volume:-12 },
  "run.success":{ kind:"chord", notes:["A2","E3","A3"], decay:0.6, osc:"sawtooth", detune:-5, volume:-11, reverb:true },
  "run.caught": { kind:"fm",    note:"A1", harmonicity:1, modIndex:26, decay:0.9, volume:-9, reverb:true },
  "run.burned": { kind:"noise", dur:0.7, cutoff:380, volume:-9 },
  "run.bricked":{ kind:"fm",    note:"C1", harmonicity:5, modIndex:26, decay:0.9, volume:-9, reverb:true },
};

export const CUE_IDS = Object.freeze(Object.keys(CUES));

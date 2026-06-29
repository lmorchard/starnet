// Headless Strudel validator. Reads a JSON array of code strings from stdin; writes one
// sentinel-prefixed JSON-array line of {ok, events, error} results to stdout. No audio —
// transpile + query a single cycle, which is enough to catch hallucinated functions / syntax.
//
// Proven incantation (de-risk, session 2026-06-29): evalScope(core, mini) registers the pattern
// vocabulary; evaluate(code, transpiler) turns mini-notation string literals into a Pattern;
// queryArc(0,1) realizes one cycle of events. Pinned to @strudel/* 1.2.5 (1.2.6 pulls
// @kabelsalat/web, which fails to load under node ESM).
//
// Output is collected and emitted as ONE sentinel line because importing @strudel/core prints
// banner noise ("🌀 @strudel/core loaded 🌀", "cannot use window") to the console — the sentinel
// lets the Python caller find our payload regardless of that noise.
import { evalScope } from '@strudel/core';
import { transpiler, evaluate } from '@strudel/transpiler';

const SENTINEL = '__VALIDATOR_RESULT__';

await evalScope(import('@strudel/core'), import('@strudel/mini'));

async function check(code) {
  try {
    const { pattern } = await evaluate(code, transpiler);
    if (!pattern || typeof pattern.queryArc !== 'function')
      return { ok: false, events: 0, error: 'no pattern produced' };
    const haps = pattern.queryArc(0, 1);
    return { ok: Array.isArray(haps), events: haps.length, error: null };
  } catch (e) {
    return { ok: false, events: 0, error: String((e && e.message) || e) };
  }
}

let input = '';
for await (const chunk of process.stdin) input += chunk;

let codes;
try {
  codes = JSON.parse(input || '[]');
  if (!Array.isArray(codes)) throw new Error('input is not an array');
} catch (e) {
  process.stdout.write(`${SENTINEL}{"error":${JSON.stringify(String(e.message || e))}}\n`);
  process.exit(0);
}

const results = [];
for (const code of codes) results.push(await check(typeof code === 'string' ? code : ''));
process.stdout.write(SENTINEL + JSON.stringify(results) + '\n');

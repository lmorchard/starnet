# Starnet Playtest Report — Seed: "playtest-326"

## Summary
- **Outcome:** SUCCESS (Win — Mission Complete + Jacked Out)
- **Final Cash:** ¥6,324
- **Final Alert Level:** GREEN (Trace cancelled via `sec/monitor`)
- **Health / Deck:** 100/100 · 100/100
- **Network Stats:** 6 accessible · 6 owned · Mission Target: Encrypted Research Dossier (Collected)
- **Run Duration:** ~350 virtual ticks (~35s real-time equivalent)

---

## Findings & Evaluation

### 1. Legibility & Console Symmetry
- **Timed Action Command Collisions:** When issuing `xploit` or `dump` immediately after initiating `probe` without advancing time with `tick <N>`, the CLI rejects the command (`xploit: not available`). While technically correct state gating, adding an inline hint in `actions` or error output (e.g. `[PROBE] in progress (20 ticks remaining) — run tick to advance`) would prevent confusion.
- **Signal Line Traversal Labels:** Selecting unrevealed neighbor nodes uses `target sig-N`. The `actions` command displays `traverse: sig-1, sig-2...` cleanly, but the target label only reveals the node name (e.g. `router-1`) after `target sig-1` is dispatched.

### 2. Fairness & System Signals
- **Set-piece Sensor Attribution:** Probing `sec/ids` tripped the hidden `alarm/sensor` connected to `router-1`, triggering `alarm/alarm-latch` and immediately jumping global alert from `GREEN` directly to `TRACE` (60s countdown).
- **Log Feedback:** The log output stated `[ALERT] Global: green → TRACE` and `ALERT: Access threshold exceeded — trace initiated`. However, it did not identify *which* sensor or node tripped the alarm. Adding sensor node attribution to the log would make hidden set-piece traps more legible and less arbitrary.
- **Subversion Counterplay:** Owning `sec/monitor` exposed `exec cancel-trace` and `exec scrub-logs`. Executing `exec cancel-trace` successfully aborted the active 60s trace countdown and restored global alert to GREEN after log scrubbing. This subversion mechanism works cleanly as intended per `MANUAL.md`.

### 3. Tedium & Action Flow
- The core verb chain (`probe → tick → xploit → tick → dump → tick → fetch → tick`) is logical and predictable.
- `--json "actions"` is extremely effective for LLM decision-making, as it exposes valid commands alongside card match and hoard state.

---

## Action Transcript & Reproduction

1. `reset --seed "playtest-326"`
2. `target gateway`
3. `probe`
4. `tick 20`
5. `xploit`
6. `tick 20` (gateway owned)
7. `target sig-1` (router-1 traced)
8. `probe`
9. `tick 30`
10. `xploit`
11. `tick 30` (router-1 owned)
12. `target sig-2` (sec/ids traced)
13. `probe`
14. `tick 30` (tripped alarm/sensor → TRACE 60s initiated)
15. `target sig-7` (sec/monitor traced)
16. `probe`
17. `tick 30`
18. `xploit`
19. `tick 30` (sec/monitor owned)
20. `exec cancel-trace` (TRACE cancelled!)
21. `exec scrub-logs` (global alert reset to GREEN)
22. `target sec/ids`
23. `xploit`
24. `tick 30` (sec/ids owned)
25. `exec corrupt` (corrupted IDS event forwarding)
26. `target sig-6` (office/fileserver traced)
27. `probe`
28. `tick 30`
29. `xploit`
30. `tick 30` (office/fileserver owned)
31. `dump`
32. `tick 20` (found mission target: Encrypted Research Dossier)
33. `fetch`
34. `tick 20` (collected mission target + ¥5,324 cash)
35. `jackout` → `[RUN] SUCCESS`

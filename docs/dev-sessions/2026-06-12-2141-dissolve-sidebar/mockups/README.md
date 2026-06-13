# Brainstorming lab mockups

Visual companion screens used while designing this session's node inspector, preserved
here as a record of the design iteration. They are self-contained HTML built in the game's
dark-vector aesthetic (cyan/green/magenta on `#0a0a0f`, monospace, scanline). Open either
file directly in a browser to view.

> Note: the `onclick="toggleSelect(this)"` handlers were provided by the brainstorming
> companion server at authoring time; opening the files standalone renders correctly but the
> click-to-select interaction is inert. They're snapshots, not live tools.

- **`01-inspector-variants.html`** — first exploration. Four variants of how much sidebar
  node-detail to fold into the graph-anchored action popup: (1) current = actions-only popup +
  sidebar info, (2) identity header only, (3) identity + vulnerabilities, (4) full inspector
  (no sidebar). Surfaced the height/positioning tradeoff.

- **`02-inspector-header-actions-footer.html`** — the converged structure, stress-tested across
  three node states (unprobed / owned / contested-with-ICE). Fixed-height header → pinned
  actions → footer (timers → vulnerabilities → contents) that grows downward, so action buttons
  sit at a predictable offset regardless of how much info a node carries. This is the structure
  the implementation follows.

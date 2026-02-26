.PHONY: serve lint test check

# Start local dev server (open http://localhost:3000)
serve:
	npx serve .

# Run JSDoc/TypeScript type checker (no build step, annotations only)
# Excludes graph.js (@ts-nocheck — Cytoscape has no bundled types)
# Excludes main.js (@ts-nocheck — CustomEvent.detail typing noise)
lint:
	npx tsc --noEmit --allowJs --checkJs --target ES2020 --moduleResolution bundler --module ES2020 \
		js/types.js js/events.js js/state.js js/exploits.js js/combat.js js/loot.js \
		js/alert.js js/timers.js js/ice.js js/log.js js/log-renderer.js js/visual-renderer.js js/console.js js/cheats.js \
		js/node-types.js js/node-lifecycle.js

# Run unit + integration tests
test:
	node --test tests/*.test.js

# Full check: lint + test
check: lint test

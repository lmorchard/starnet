.PHONY: serve lint test check census bot-census

# Start local dev server (open http://localhost:3000)
serve:
	npx serve .

# Run JSDoc/TypeScript type checker (no build step, annotations only)
# Excludes graph.js (@ts-nocheck — Cytoscape has no bundled types)
# Excludes main.js (@ts-nocheck — CustomEvent.detail typing noise)
lint:
	npx tsc --noEmit --allowJs --checkJs --target ES2020 --moduleResolution bundler --module ES2020 \
		js/core/types.js js/core/events.js js/core/state.js \
		js/core/state/index.js js/core/state/node.js js/core/state/ice.js js/core/state/alert.js js/core/state/player.js js/core/state/game.js \
		js/core/exploits.js js/core/combat.js js/core/loot.js \
		js/core/alert.js js/core/timers.js js/core/ice.js js/core/log.js js/core/cheats.js \
		js/core/node-lifecycle.js js/core/rng.js js/core/navigation.js \
		js/core/node-orchestration.js js/core/store-logic.js js/core/grades.js js/core/tab-complete.js \
		js/core/actions/node-types.js js/core/actions/node-actions.js js/core/actions/global-actions.js \
		js/core/actions/action-context.js js/core/actions/probe-exec.js js/core/actions/read-exec.js \
		js/core/actions/loot-exec.js js/core/actions/exploit-exec.js \
		js/ui/log-renderer.js js/ui/visual-renderer.js js/ui/store.js js/ui/console.js js/ui/save-load.js

# Run unit + integration tests
test:
	node --test $(shell find tests js scripts -name '*.test.js' ! -path '*/fixtures/*')

# Full check: lint + test
check: lint test

# Run network census report across all difficulty combos
census:
	node scripts/network-census.js

# Run bot simulation at B/B (override with: make bot-census TC=S MC=S SEEDS=50)
TC ?= B
MC ?= B
SEEDS ?= 100
bot-census:
	node scripts/bot-census.js --time $(TC) --money $(MC) --seeds $(SEEDS)

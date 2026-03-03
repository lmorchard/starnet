.PHONY: serve lint test check bundle-vendor census bot-census ng-playtest

# Start local dev server (open http://localhost:3000)
serve:
	npx serve .

# Run JSDoc/TypeScript type checker (no build step, annotations only)
# Discovers all js/**/*.js automatically; excludes:
#   graph.js and main.js  (@ts-nocheck — Cytoscape/CustomEvent typing noise)
#   *.test.js             (test files, not type-checked here)
#   fixtures/             (test fixture data)
lint:
	npx tsc --noEmit --allowJs --checkJs --target ES2020 --moduleResolution bundler --module ES2020 \
		$(shell find js -name '*.js' ! -name '*.test.js' ! -path '*/fixtures/*' ! -name 'graph.js' ! -name 'main.js' ! -name 'vendor.js')

# Run unit + integration tests
test:
	node --test $(shell find tests js scripts -name '*.test.js' ! -path '*/fixtures/*')

# Full check: lint + test
check: lint test

# Bundle vendor dependencies (Cytoscape + layout extensions) into dist/vendor.js
bundle-vendor:
	npx esbuild js/vendor.js --bundle --outfile=dist/vendor.js --format=iife --platform=browser --minify

# Run network census report across all difficulty combos
census:
	node scripts/network-census.js

# Run bot simulation at B/B (override with: make bot-census TC=S MC=S SEEDS=50)
TC ?= B
MC ?= B
SEEDS ?= 100
bot-census:
	node scripts/bot-census.js --time $(TC) --money $(MC) --seeds $(SEEDS)

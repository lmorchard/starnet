.PHONY: all serve lint test check bundle-vendor census bot-run generate gen-bot gen-json

# Install dependencies and build vendor bundle
all: node_modules dist/vendor.js

node_modules: package.json
	npm install

dist/vendor.js: js/vendor.js node_modules
	npx esbuild js/vendor.js --bundle --outfile=dist/vendor.js --format=iife --platform=browser --minify

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
	node --test $(shell find tests js data -name '*.test.js' ! -path '*/fixtures/*' ! -name 'bot-player.test.js')

# Full check: lint + test
check: lint test

# Bundle vendor dependencies (Cytoscape + layout extensions) into dist/vendor.js
bundle-vendor:
	npx esbuild js/vendor.js --bundle --outfile=dist/vendor.js --format=iife --platform=browser --minify

# Run network census report across all difficulty combos
census:
	node scripts/network-census.js

# Run bot player against a network (override with: make bot-run NET=research-station SEED=test-1)
NET ?= corporate-foothold
SEED ?= ""
bot-run:
	node scripts/bot/cli.js --network $(NET) $(if $(filter-out "",$(SEED)),--seed $(SEED))

# Generate a network and play it with the bot
THREAT ?= C
WEALTH ?= B
COMPLEXITY ?= C
DEPTH ?= C
gen-bot:
	node scripts/bot/cli.js --generated --threat $(THREAT) --wealth $(WEALTH) --complexity $(COMPLEXITY) --depth $(DEPTH) $(if $(filter-out "",$(SEED)),--seed $(SEED))

# Generate a network and start a playtest session
generate:
	node scripts/playtest.js --generated --threat $(THREAT) --wealth $(WEALTH) --complexity $(COMPLEXITY) --depth $(DEPTH) $(if $(filter-out "",$(SEED)),--seed $(SEED)) reset

# Generate a network and output JSON (use OPTS for extra flags like --pretty --summary --meta-only)
OPTS ?=
gen-json:
	node scripts/generate-network.js --threat $(THREAT) --wealth $(WEALTH) --complexity $(COMPLEXITY) --depth $(DEPTH) $(if $(filter-out "",$(SEED)),--seed $(SEED)) $(OPTS)

.PHONY: all serve dev lint lint-imports test check bundle-vendor census bot-run generate gen-bot gen-json

# Install dependencies and build vendor bundles
all: node_modules dist/vendor.js dist/lit.js dist/tone.js

node_modules: package.json
	npm install

dist/vendor.js: js/vendor.js node_modules
	npx esbuild js/vendor.js --bundle --outfile=dist/vendor.js --format=iife --platform=browser --minify

dist/lit.js: js/lit-vendor.js node_modules
	npx esbuild js/lit-vendor.js --bundle --outfile=dist/lit.js --format=esm --platform=browser --minify

dist/tone.js: js/tone-vendor.js node_modules
	npx esbuild js/tone-vendor.js --bundle --outfile=dist/tone.js --format=esm --platform=browser --minify

# Start local dev server (open http://localhost:3000)
serve:
	npx serve .

# Install deps, build vendor bundles (if stale), then start the dev server
dev: all serve

# Run JSDoc/TypeScript type checker (no build step, annotations only)
# Discovers all js/**/*.js automatically; excludes:
#   graph.js              (@ts-nocheck — Cytoscape.js has no bundled types)
#   *.test.js             (test files, not type-checked here)
#   fixtures/             (test fixture data)
lint:
	npx tsc --noEmit --allowJs --checkJs --target ES2020 --moduleResolution bundler --module ES2020 \
		$(shell find js -name '*.js' ! -name '*.test.js' ! -path '*/fixtures/*' ! -name 'graph.js' ! -name 'vendor.js' ! -name 'lit-vendor.js' ! -name 'tone-vendor.js')

# Guard against absolute "/dist/..." paths in js/ and HTML. They resolve to the
# domain root and 404 under a deploy subpath (e.g. GitHub Pages /starnet/), where
# the 404 page's text/html MIME blocks the module. Use a relative "./dist/..."
# path or the page import map instead. (See PR #243.)
lint-imports:
	@if grep -rn '"/dist/' js *.html; then \
		echo 'ERROR: absolute "/dist/..." path(s) above — use a relative "./dist/..." path or the import map (breaks under a deploy subpath; see PR #243).'; \
		exit 1; \
	else \
		echo 'lint-imports: no absolute "/dist/" paths'; \
	fi

# Run unit + integration tests
test:
	node --test $(shell find tests js data -name '*.test.js' ! -path '*/fixtures/*' ! -name 'bot-player.test.js')

# Full check: imports guard + lint + test
check: lint-imports lint test

# Bundle vendor dependencies (Cytoscape + layout extensions, Lit, Tone)
bundle-vendor:
	npx esbuild js/vendor.js --bundle --outfile=dist/vendor.js --format=iife --platform=browser --minify
	npx esbuild js/lit-vendor.js --bundle --outfile=dist/lit.js --format=esm --platform=browser --minify
	npx esbuild js/tone-vendor.js --bundle --outfile=dist/tone.js --format=esm --platform=browser --minify

# Shared grade defaults for bot/census/generate targets
THREAT ?= C
WEALTH ?= B
COMPLEXITY ?= C
DEPTH ?= C
SEEDS ?= 50

# Run bot census — aggregate stats across many seeds (override: make census SEEDS=100 THREAT=B)
census:
	@node scripts/bot/census.js --seeds $(SEEDS) --threat $(THREAT) --wealth $(WEALTH) --complexity $(COMPLEXITY) --depth $(DEPTH)

# Run bot player against a network (override with: make bot-run NET=research-station SEED=test-1)
NET ?= corporate-foothold
SEED ?= ""
bot-run:
	node scripts/bot/cli.js --network $(NET) $(if $(filter-out "",$(SEED)),--seed $(SEED))

# Generate a network and play it with the bot
gen-bot:
	node scripts/bot/cli.js --generated --threat $(THREAT) --wealth $(WEALTH) --complexity $(COMPLEXITY) --depth $(DEPTH) $(if $(filter-out "",$(SEED)),--seed $(SEED))

# Generate a network and start a playtest session
generate:
	node scripts/playtest.js --generated --threat $(THREAT) --wealth $(WEALTH) --complexity $(COMPLEXITY) --depth $(DEPTH) $(if $(filter-out "",$(SEED)),--seed $(SEED)) reset

# Generate a network and output JSON (use OPTS for extra flags like --pretty --summary --meta-only)
OPTS ?=
gen-json:
	node scripts/generate-network.js --threat $(THREAT) --wealth $(WEALTH) --complexity $(COMPLEXITY) --depth $(DEPTH) $(if $(filter-out "",$(SEED)),--seed $(SEED)) $(OPTS)

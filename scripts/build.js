#!/usr/bin/env node
const esbuild = require("esbuild");

const { options, copyAssets } = require("../lib/build-common");

async function main() {
  await copyAssets();
  await esbuild.build(options);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

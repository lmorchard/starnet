#!/usr/bin/env node
const esbuild = require("esbuild");
const chokidar = require("chokidar");

const { options, copyAssets } = require("../lib/build-common");
const { HOST = "0.0.0.0", PORT = 8001 } = process.env;

async function main() {
  await copyAssets();

  chokidar
    .watch("src", {
      ignoreInitial: true,
      ignored: "**/*.js",
    })
    .on("all", (event, path) => {
      console.log(`Watch ${event} ${path}`);
      copyAssets();
    });

  const { port, host } = await esbuild.serve(
    {
      servedir: "dist",
      host: HOST,
      port: PORT,
      onRequest: ({ method, path, status, timeInMS }) => {
        console.log(`${method} ${status} ${timeInMS} ${path}`);
      },
    },
    options
  );

  console.log(`Server up ${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

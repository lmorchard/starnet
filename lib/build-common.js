const copy = require("recursive-copy");

const options = {
  logLevel: "debug",
  logLimit: 0,
  entryPoints: ["src/index.js"],
  bundle: true,
  write: true,
  outdir: "dist",
};

async function copyAssets() {
  const results = await copy("src", "dist", {
    overwrite: true,
    filter: "index.{html,css}",
  });
  console.log("Copied assets");
  for (const { src, dest } of results) {
    console.log(`\t${src} -> ${dest}`);
  }
}

module.exports = {
  copyAssets,
  options,
};

// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration
const path = require("path");
const fs = require("fs");

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  root: "src",
  mount: {},
  plugins: [
    [
      '@snowpack/plugin-run-script',
      {
        cmd: "node ../scripts/fonts-to-json.js",
        watch: "onchange -i './fonts/*jhf' -- node ../scripts/fonts-to-json.js",
      }
    ],
    [
      "snowpack-plugin-ejs",
      {
        renderOptions: {
          async: true,
        },
        renderData: ({ filePath }) => {
          const dirpath = path.dirname(filePath);
          const dirname = path.basename(dirpath);
          const paths = fs
            .readdirSync(dirpath)
            .filter((subpath) =>
              fs.statSync(path.join(dirpath, subpath)).isDirectory()
            );
          return { dirname, paths };
        },
      },
    ],
    // TODO https://www.npmjs.com/package/snowpack-plugin-assets
    // ["snowpack-plugin-assets", { assets: { from: [], to: "" } }],
    ["snowpack-plugin-hash"],
  ],
  packageOptions: {
    polyfillNode: true,
  },
  devOptions: {
    open: "none",
  },
  buildOptions: {
    out: "build",
    metaUrlPath: "vendor",
  },
};

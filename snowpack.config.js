// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  root: "src",
  mount: {},
  plugins: [
    ["snowpack-plugin-hash"],
    // TODO https://www.npmjs.com/package/snowpack-plugin-assets
    // ["snowpack-plugin-assets", { assets: { from: [], to: "" } }],
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

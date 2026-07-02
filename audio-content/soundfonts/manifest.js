// @ts-check
/** @typedef {{ prefix: string, authoringPath: string, deployPath: string, license: string, host?: string, allow: string[] }} SoundfontEntry */

/** The game's soundfonts. Each is a distinct, NON-FUNGIBLE set under its own prefix — never aliased
 *  across sets. The loader prefers `deployPath` (culled, committed) and falls back to `authoringPath`
 *  (full, local/gitignored). The cull build-step reads this to know what to prune and where to write.
 *  @type {SoundfontEntry[]} */
export const SOUNDFONTS = [
  {
    prefix: "gus_",
    authoringPath: "audio-content/soundfonts/GeneralUser-GS.sf2",
    deployPath: "audio-content/soundfonts/GeneralUser-GS.deploy.sf2",
    license: "audio-content/soundfonts/GeneralUser-GS.LICENSE.txt",
    host: "https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/GeneralUser-GS.sf2",
    allow: [],
  },
];

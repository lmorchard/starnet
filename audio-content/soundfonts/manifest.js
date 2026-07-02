// @ts-check
/**
 * @typedef {{
 *   prefix: string,
 *   authoringPath: string,
 *   deployPath?: string,
 *   license: string,
 *   host?: string,
 *   allow: string[],
 *   authoringOnly?: boolean
 * }} SoundfontEntry
 */

/** The game's soundfonts. Each is a distinct, NON-FUNGIBLE set under its own prefix — never aliased
 *  across sets. ONE prefix ↔ ONE file.
 *
 *  - Fonts with `deployPath`: the loader prefers the culled deploy file and falls back to the full
 *    authoring file. The cull build-step reads this to know what to prune and where to write.
 *  - Fonts with `authoringOnly: true`: available in strudel.cc (via the prebake) but NOT loaded
 *    in-game. These are shipped whole (no deploy cull). When a song starts using sounds from one of
 *    these sets, remove `authoringOnly` so the game loads that whole topical file.
 *
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

  // ── MuseScore topical sets ────────────────────────────────────────────────────────────────────
  // Split from the monolithic MuseScore_General.sf2 into one file per instrument family.
  // Each set is shipped whole (no per-preset deploy cull — they're small).
  // `authoringOnly: true` — available in strudel.cc (via the prebake) so composers can use these
  // sounds while authoring, but NOT loaded in-game until a song actually adopts a set.
  // To adopt: remove `authoringOnly` from the entry; the game will then load that whole topical file.
  // ONE prefix ↔ ONE file.
  {
    prefix: "msgpad_",
    authoringPath: "audio-content/soundfonts/MuseScore-Pad.sf2",
    host: "https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/MuseScore-Pad.sf2",
    license: "audio-content/soundfonts/MuseScore_General.LICENSE.txt",
    authoringOnly: true,
    allow: [],
  },
  {
    prefix: "msglead_",
    authoringPath: "audio-content/soundfonts/MuseScore-Lead.sf2",
    host: "https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/MuseScore-Lead.sf2",
    license: "audio-content/soundfonts/MuseScore_General.LICENSE.txt",
    authoringOnly: true,
    allow: [],
  },
  {
    prefix: "msgfx_",
    authoringPath: "audio-content/soundfonts/MuseScore-FX.sf2",
    host: "https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/MuseScore-FX.sf2",
    license: "audio-content/soundfonts/MuseScore_General.LICENSE.txt",
    authoringOnly: true,
    allow: [],
  },
  {
    prefix: "msgbass_",
    authoringPath: "audio-content/soundfonts/MuseScore-Bass.sf2",
    host: "https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/MuseScore-Bass.sf2",
    license: "audio-content/soundfonts/MuseScore_General.LICENSE.txt",
    authoringOnly: true,
    allow: [],
  },
  {
    prefix: "msgkeys_",
    authoringPath: "audio-content/soundfonts/MuseScore-Keys.sf2",
    host: "https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/MuseScore-Keys.sf2",
    license: "audio-content/soundfonts/MuseScore_General.LICENSE.txt",
    authoringOnly: true,
    allow: [],
  },
  {
    prefix: "msgorg_",
    authoringPath: "audio-content/soundfonts/MuseScore-Organ.sf2",
    host: "https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/MuseScore-Organ.sf2",
    license: "audio-content/soundfonts/MuseScore_General.LICENSE.txt",
    authoringOnly: true,
    allow: [],
  },
  {
    prefix: "msggtr_",
    authoringPath: "audio-content/soundfonts/MuseScore-Guitar.sf2",
    host: "https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/MuseScore-Guitar.sf2",
    license: "audio-content/soundfonts/MuseScore_General.LICENSE.txt",
    authoringOnly: true,
    allow: [],
  },
  {
    prefix: "msgdrum_",
    authoringPath: "audio-content/soundfonts/MuseScore-Drums.sf2",
    host: "https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/MuseScore-Drums.sf2",
    license: "audio-content/soundfonts/MuseScore_General.LICENSE.txt",
    authoringOnly: true,
    allow: [],
  },
];

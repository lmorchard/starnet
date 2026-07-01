// @ts-check
// Song manifest. Each song is a STANDALONE .strudel file under audio-content/songs/ — raw
// strudel.cc-dialect content, openable/saveable/pasteable in strudel.cc, and fetched + evaluated by
// the engine (the "wad" content boundary). To add a song: drop a .strudel file here + a manifest
// entry. (Authoring parity — loading the game's gus_* + gameProgress/gameThreat in strudel.cc — is #265.)

// Resolved relative to THIS module (not the document), so the manifest loads whether the page is
// the game at the site root or a preview harness under /preview/. import.meta.url anchors it.
const BASE = new URL("../../../../audio-content/songs/", import.meta.url);
export const HUB_ID = "hub";

/** @typedef {{ id: string, name: string, file: string }} SongEntry */
/** @type {SongEntry[]} */
export const SONG_MANIFEST = [
  { id: "hub",             name: "Hub Ambient",        file: "hub.strudel" },
  { id: "corporate-dread", name: "Corporate — Dread",  file: "corporate-dread.strudel" },
  { id: "corporate-neon",  name: "Corporate — Neon",   file: "corporate-neon.strudel" },
  { id: "corporate-glitch",name: "Corporate — Glitch", file: "corporate-glitch.strudel" },
  { id: "corporate-cold",  name: "Corporate — Cold",   file: "corporate-cold.strudel" },
  { id: "corporate-noir",  name: "Corporate — Noir",   file: "corporate-noir.strudel" },
];

/** Fetch one song's code. @param {SongEntry} entry @returns {Promise<string>} */
export async function fetchSongCode(entry) {
  const res = await fetch(new URL(entry.file, BASE));
  if (!res.ok) throw new Error(`song fetch failed: ${entry.file} (${res.status})`);
  return res.text();
}

/** Load all manifest songs. @returns {Promise<{id:string,name:string,code:string}[]>} */
export async function loadSongs() {
  return Promise.all(SONG_MANIFEST.map(async (e) => ({ id: e.id, name: e.name, code: await fetchSongCode(e) })));
}

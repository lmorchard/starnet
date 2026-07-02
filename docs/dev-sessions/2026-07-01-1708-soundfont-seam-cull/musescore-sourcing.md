# MuseScore_General — Sourcing & Licensing Investigation (Task 0.6)

De-risking investigation gating Phase 5 vendoring work. Findings verified via live
fetches on 2026-07-01. **No code written; nothing committed.**

## Verdict

**VENDORABLE.** License is **MIT** (confirmed, not assumed) with an attribution condition
we can satisfy. A stable, official host exists (OSUOSL, MuseScore's own mirror) serving
both the uncompressed `.sf2` (~206 MB) and compressed `.sf3` (~38 MB), both verified as
valid soundfonts. Recommended: fetch the **`.sf2` directly** in the Node build step — no
conversion needed. One caveat for the browser authoring path: no CORS-open host was found
for the full file (see CORS notes).

---

## License

- **Name:** MIT License.
- **Confirmed via:** the soundfont's own bundled license file, fetched live from MuseScore's
  official mirror:
  <https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General_License.md>
  (also mirrored in the MuseScore app repo:
  <https://github.com/musescore/MuseScore/blob/master/share/sound/MS%20Basic_License.md>).
- **This is not an assumption.** The license file states verbatim:
  *"MuseScore_General.sf2 is shared under the MIT license as described in COPYING, as was
  FluidR3Mono and FluidR3 before it."*

### Attribution condition (MUST include)

The license file contains an explicit condition beyond stock MIT:

> *"The acknowledgements and copyright notices above must be included in any derivative work."*

So when we vendor it, ship the following copyright block (verbatim from the license file)
alongside the soundfont — e.g. in a `THIRD-PARTY-LICENSES` / `NOTICE` file or the content
"wad" manifest:

```
MuseScore_General.sf2 — MIT License

FluidR3 (original version) by Frank Wen               Copyright (c) 2000-02
Mono conversion (FluidR3Mono) by Michael Cowgill      Copyright (c) 2014-17
Adaptation for MuseScore_General.sf2 by
    S. Christian Collins                              Copyright (c) 2018-19
Temple Blocks instrument by Ethan Winer               Copyright (c) 2002
Drumline Cymbals by Michael Schorsch                  Copyright (c) 2016

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in the
Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

- **AGPL compatibility:** MIT is permissive and fully compatible with our AGPL-3.0 engine.
  Because we keep soundfonts as separately-licensed runtime content (the Doom-wad model),
  the MIT attribution simply rides along with the content bundle. No conflict.
- **Version fetched:** `VERSION` file reports `0.2.0`; the license/readme header says
  "Current version: 0.2, 13th May 2020." This soundfont has been stable/unchanged on the
  mirror since **2020-07-10** — a settled, non-moving target.

---

## Recommended source (Node build step)

Fetch the **uncompressed `.sf2` directly** — our runtime parser reads `.sf2`, not `.sf3`,
so this avoids the convert step entirely.

| Field | Value |
|---|---|
| **URL** | `https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General.sf2` |
| **Format** | `.sf2` (uncompressed PCM) |
| **Size** | 215,614,036 bytes (~206 MiB / 215.6 MB) — from live `Content-Length` |
| **Host** | OSUOSL (Oregon State University Open Source Lab) — MuseScore's **official** mirror |
| **Conversion needed?** | **No.** Directly parseable. |
| **Verified** | `RIFF....sfbk` magic bytes confirmed via ranged fetch — genuine SF2. |
| **Range support** | `Accept-Ranges: bytes` (resumable downloads OK) |

Companion files at the same directory (grab for the attribution/provenance bundle):
- `MuseScore_General_License.md` (3.3 KB)
- `MuseScore_General_Readme.md` (5.0 KB)
- `MuseScore_General_Changelog.md` (15 KB)
- `MuseScore_General_Sample_Sources.csv` (13 KB) — per-preset sample attribution
- `VERSION` (`0.2.0`)

Directory listing: <https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/>

> **Build hygiene note:** pin/verify a checksum after first download so a silent upstream
> change (unlikely — stable since 2020) can't slip in unnoticed. Compute the sha256 on the
> first vendored copy and assert it in the build script.

---

## Alternatives / fallbacks

1. **OSUOSL `.sf3` (compressed) + `sf3convert -y`** — if we ever want the smaller artifact
   in the repo/build and convert locally:
   - URL: `https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General.sf3`
   - Size: 39,900,972 bytes (~38 MB). Also verified `RIFF....sfbk`.
   - Convert to sf2 with `sf3convert -y MuseScore_General.sf3 MuseScore_General.sf2`
     (the `-y` = decompress direction; `-z` = compress).
   - `sf3convert` ships in MuseScore's `sftools` (<https://github.com/musescore/sftools>) and
     is packaged as a standalone `sf3convert` on Debian/Ubuntu
     (e.g. `apt install sf3convert` — <https://launchpad.net/ubuntu/jammy/+package/sf3convert>).
     Requires Qt5, libsndfile, libogg, libvorbis if built from source.
   - **Recommendation:** prefer the direct `.sf2` fetch (option above) — converting adds a
     native-toolchain dependency to the build for no real benefit, since OSUOSL already
     serves the uncompressed file.

2. **MuseScore application repo (GitHub):**
   `https://github.com/musescore/MuseScore` — `share/sound/` holds the bundled soundfont and
   its `MS Basic_License.md`. The file the app ships is the same MuseScore_General lineage.
   Usable as a provenance cross-check, but the OSUOSL mirror is the cleaner direct-download.

3. **schristiancollins.com** (the adapter's own site) — a viable upstream-author reference,
   BUT the guessed direct path (`/soundfonts/MuseScore_General.sf3`) returned an HTML page
   (`text/html`, 3872 bytes), i.e. a landing/listing page, **not** a direct file. Don't hardcode
   a download URL here without first confirming the real asset link from the page. Treat as
   secondary.

---

## CORS notes (browser authoring path — strudel.cc)

CORS matters only for browser-side authoring (fetching the sf2 client-side in strudel.cc);
it is irrelevant to the Node build step.

| URL | CORS `access-control-allow-origin`? |
|---|---|
| OSUOSL `.sf2` / `.sf3` (`ftp.osuosl.org/...`) | **No** — no ACAO header. Not usable from a browser fetch. |
| jsDelivr `gh/LibreScore/sf3@master` | ACAO `*` **but 403** — repo exceeds jsDelivr's 50 MB package limit, so the full soundfont won't serve. Not usable. |
| jsDelivr `gh/musescore/MuseScore@master/share/sound/...` | ACAO `*` but the guessed path 404'd; MuseScore repo is also very large (likely also over jsDelivr limits). Not a reliable CORS host. |

**Conclusion for the browser path:** no ready-made CORS-open host for the full ~206 MB
soundfont was found. If browser-side authoring in strudel.cc needs it, we'll likely have to
**self-host the vendored copy** (our own domain / GH Pages / a CDN we control, with an
`Access-Control-Allow-Origin` header) rather than hot-linking a third party. Since we're
vendoring the file into our build artifacts anyway, serving it from our own origin with CORS
enabled is the straightforward answer. **Flag for the human:** if the Phase-5 authoring UX
depends on browser-fetching this soundfont, budget for hosting it ourselves.

---

## Open risks (for the human)

1. **CORS for browser authoring is unsolved by any third-party host** — we must self-host if
   strudel.cc-side fetching is required. Node build is unaffected. *(Needs a decision only if
   the browser authoring path is in scope for Phase 5.)*
2. **File size** — 206 MB uncompressed is large to vendor. Options: (a) fetch at build time
   from OSUOSL (don't commit to git); (b) commit the 38 MB `.sf3` and convert in the build;
   (c) Git LFS. Recommend (a) — build-time fetch with a pinned sha256 — to keep the repo lean.
   *(This is a build-architecture choice for the plan, not a blocker.)*
3. **Single official mirror** — OSUOSL is *the* MuseScore mirror, stable since 2020, but it is
   one host. Mitigate with a checksum + a documented fallback (the `.sf3` on the same mirror,
   or the MuseScore GitHub repo). Low risk.
4. **Attribution obligation is slightly more than stock MIT** — the license explicitly requires
   the acknowledgements/copyright block in derivative works. Cheap to satisfy (ship the
   NOTICE block above), but must not be forgotten in the content-wad packaging.

---

## Sources

- License file (authoritative, MuseScore official mirror): <https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General_License.md>
- Soundfont directory listing (sizes, files): <https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/>
- MuseScore app repo license mirror: <https://github.com/musescore/MuseScore/blob/master/share/sound/MS%20Basic_License.md>
- MuseScore soundfonts handbook: <https://musescore.org/en/handbook/4/soundfonts>
- `sftools` / `sf3convert` source: <https://github.com/musescore/sftools>
- `sf3convert` Debian/Ubuntu package: <https://launchpad.net/ubuntu/jammy/+package/sf3convert>
- LibreScore/sf3 (mirror repo, over jsDelivr size limit): <https://github.com/LibreScore/sf3>
- S. Christian Collins (adapter): <https://schristiancollins.com/generaluser.php>

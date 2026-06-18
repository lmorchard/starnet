"""Pure: merge measured MIR facts + LLM interpretation into a Markdown doc."""


def _mmss(seconds: float) -> str:
    m, s = divmod(int(round(seconds)), 60)
    return f"{m}:{s:02d}"


def _measured_lines(mir: dict) -> list:
    """The 'Measured facts (MIR ground truth)' block as a list of markdown lines."""
    lines = ["## Measured facts (MIR ground truth)", ""]
    lines.append(f"- **Tempo:** {mir['bpm']:.0f} BPM")
    lines.append(f"- **Key:** {mir['key']} {mir['mode']} (confidence {mir['key_confidence']:.2f})")
    lines.append(f"- **Duration:** {_mmss(mir['duration_sec'])}")
    lines.append(f"- **Sections: {len(mir['sections'])}** "
                 f"(boundaries at {', '.join(_mmss(s['start']) for s in mir['sections'])})")
    b = mir["brightness"]
    lines.append(f"- **Brightness (spectral centroid):** mean {b['mean_hz']:.0f} Hz "
                 f"(range {b['min_hz']:.0f}–{b['max_hz']:.0f} Hz)")
    d = mir["dynamics"]
    lines.append(f"- **Dynamics:** RMS mean {d['rms_mean']:.3f}, range {d['rms_range_db']:.1f} dB")
    tb = mir.get("timbre")
    if tb:
        lines.append(f"- **Timbre:** rolloff {tb['rolloff_hz']:.0f} Hz, flatness {tb['flatness']:.2f}, "
                     f"contrast {tb['contrast']:.1f}, ZCR {tb['zcr']:.3f}, "
                     f"harmonic ratio {tb['harmonic_ratio']:.2f}")
    if mir.get("midi_path"):
        lines.append(f"- **MIDI transcription:** `{mir['midi_path']}`")
    lines.append("")
    return lines


def _track_table(tracks: list) -> list:
    """A Track | Instrument | Pattern | Notes table as markdown lines."""
    lines = ["| Track | Instrument | Pattern | Notes |", "|---|---|---|---|"]
    for t in tracks:
        lines.append(f"| {t.get('name','')} | {t.get('instrument','')} | "
                     f"{t.get('pattern','')} | {t.get('description','')} |")
    lines.append("")
    return lines


def render_stems_markdown(meta: dict, mir_global: dict, stem_results: list) -> str:
    """Markdown for stems mode: global measured facts + a section per analyzed stem."""
    lines = [f"# {meta['artist']} — {meta['title']}", "",
             f"*Source: `{meta['source_file']}` · Model: {meta['model']} · stem-separated*", ""]
    lines += _measured_lines(mir_global)
    for sr in stem_results:
        interp = sr.get("interpretation", {})
        lines.append(f"## {sr['stem']}")
        lines.append("")
        if interp.get("summary"):
            lines.append(f"> {interp['summary']}")
            lines.append("")
        lines += _track_table(interp.get("tracks", []))
    return "\n".join(lines)


def render_markdown(meta: dict, mir: dict, llm: dict) -> str:
    v = llm["vocabulary"]
    lines: list[str] = []
    lines.append(f"# {meta['artist']} — {meta['title']}")
    lines.append("")
    lines.append(f"> {llm['summary']}")
    lines.append("")
    lines.append(f"*Source: `{meta['source_file']}` · Model: {meta['model']}*")
    lines.append("")

    # --- Measured (MIR ground truth) ---
    lines.append("## Measured facts (MIR ground truth)")
    lines.append("")
    lines.append(f"- **Tempo:** {mir['bpm']:.0f} BPM")
    lines.append(f"- **Key:** {mir['key']} {mir['mode']} "
                 f"(confidence {mir['key_confidence']:.2f})")
    lines.append(f"- **Duration:** {_mmss(mir['duration_sec'])}")
    lines.append(f"- **Sections: {len(mir['sections'])}** "
                 f"(boundaries at {', '.join(_mmss(s['start']) for s in mir['sections'])})")
    b = mir["brightness"]
    lines.append(f"- **Brightness (spectral centroid):** mean {b['mean_hz']:.0f} Hz "
                 f"(range {b['min_hz']:.0f}–{b['max_hz']:.0f} Hz)")
    d = mir["dynamics"]
    lines.append(f"- **Dynamics:** RMS mean {d['rms_mean']:.3f}, "
                 f"range {d['rms_range_db']:.1f} dB")
    if mir.get("midi_path"):
        lines.append(f"- **MIDI transcription:** `{mir['midi_path']}`")
    lines.append("")

    # --- Vocabulary grid (interpretation) ---
    lines.append("## Vocabulary grid (model interpretation)")
    lines.append("")
    lines.append("| Dimension | Reading |")
    lines.append("|---|---|")
    lines.append(f"| Timbre | {v['timbre']} |")
    lines.append(f"| Brightness | {v['brightness']} |")
    lines.append(f"| Envelope | {v['envelope']} |")
    lines.append(f"| Register/density | {v['register_density']} |")
    lines.append(f"| Harmony/mode | {v['harmony_mode']} |")
    lines.append(f"| Groove | {v['groove']} |")
    lines.append(f"| Space/grit | {v['space_grit']} |")
    lines.append("")

    # --- Track breakdown (interpretation): instrument + pattern per track ---
    lines.append("## Tracks (model interpretation)")
    lines.append("")
    lines.append("*Each track is one instrument driven by one pattern. Track names are "
                 "the model's, invented to fit this piece; instruments are Tone.js sources "
                 "(or a custom-synthesis note).*")
    lines.append("")
    lines.append("| Track | Instrument | Pattern | Notes |")
    lines.append("|---|---|---|---|")
    for t in llm["tracks"]:
        lines.append(f"| {t['name']} | {t['instrument']} | {t['pattern']} | {t['description']} |")
    lines.append("")

    # --- Score draft (speculative) ---
    lines.append("## Score-draft starter (speculative)")
    lines.append("")
    lines.append("> Model-guessed synth parameters — speculative, tune by ear.")
    lines.append("")
    lines.append(llm["score_draft"])
    lines.append("")

    return "\n".join(lines)

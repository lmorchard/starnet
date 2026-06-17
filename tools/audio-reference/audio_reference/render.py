"""Pure: merge measured MIR facts + LLM interpretation into a Markdown doc."""


def _mmss(seconds: float) -> str:
    m, s = divmod(int(round(seconds)), 60)
    return f"{m}:{s:02d}"


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

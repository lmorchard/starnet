"""Validate generated Strudel code headlessly by shelling out to the node validator.

The pipeline calls `validate_strudel` after each Gemini interpretation to catch hallucinated
functions / syntax before writing a sidecar. It NEVER raises into the pipeline — any failure
(node missing, validator not installed, timeout, garbled output) returns an `ok=False` result
per input, so a validation hiccup degrades to a warning rather than aborting an analysis run.
"""
import json
import os
import shutil
import subprocess

_VALIDATOR_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "validator"))
_SENTINEL = "__VALIDATOR_RESULT__"


def validate_strudel(codes, *, validator_dir: str | None = None, timeout: float = 60.0) -> list[dict]:
    """Return [{ok: bool, events: int, error: str | None}], one per input code string.

    `ok` means the code transpiled and produced a (possibly empty) cycle of events without
    throwing. `events == 0` is technically valid (silence) but usually worth a caller warning.
    """
    codes = list(codes)
    if not codes:
        return []
    vdir = validator_dir or _VALIDATOR_DIR
    script = os.path.join(vdir, "validate.mjs")

    def _fail(msg: str) -> list[dict]:
        return [{"ok": False, "events": 0, "error": msg} for _ in codes]

    node = shutil.which("node")
    if node is None:
        return _fail("node not found on PATH")
    if not os.path.isfile(script) or not os.path.isdir(os.path.join(vdir, "node_modules")):
        return _fail("validator not installed (run `npm install` in validator/)")
    try:
        proc = subprocess.run(
            [node, "validate.mjs"], input=json.dumps(codes),
            capture_output=True, text=True, cwd=vdir, timeout=timeout,
        )
    except (subprocess.SubprocessError, OSError) as e:
        return _fail(f"validator subprocess failed: {e}")

    for line in proc.stdout.splitlines():
        if line.startswith(_SENTINEL):
            try:
                payload = json.loads(line[len(_SENTINEL):])
            except ValueError:
                continue
            if isinstance(payload, list) and len(payload) == len(codes):
                return payload
            if isinstance(payload, dict) and payload.get("error"):
                return _fail(f"validator input error: {payload['error']}")
    return _fail(f"no validator result (exit {proc.returncode}): {proc.stderr.strip()[:200]}")

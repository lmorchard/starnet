"""Pure helpers for the player's save-back endpoint (tweaked score_spec -> sidecar)."""
import re

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def safe_slug(slug: str) -> bool:
    """True for a plain kebab slug — no slashes, dots, or traversal (path-safety guard)."""
    return bool(_SLUG_RE.match(slug or ""))


def apply_score_spec(sidecar: dict, score_spec: dict) -> dict:
    """Return the sidecar with its score_spec replaced; meta/mir/interpretation preserved."""
    out = dict(sidecar)
    out["score_spec"] = score_spec
    return out

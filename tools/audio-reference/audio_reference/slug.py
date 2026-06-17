"""Pure: artist + title → a filesystem-safe slug."""
import re


def slugify(artist: str, title: str) -> str:
    raw = f"{artist} {title}".lower()
    # Drop punctuation entirely so intra-word marks vanish ("TR/ST" -> "trst"),
    # then collapse whitespace runs into single hyphen separators.
    s = re.sub(r"[^a-z0-9\s]+", "", raw)
    s = re.sub(r"\s+", "-", s)
    return s.strip("-")

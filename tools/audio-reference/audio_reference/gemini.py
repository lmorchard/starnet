"""I/O boundary: call Gemini on Vertex (ADC) with audio + prompt + response schema → dict."""
import json
import time
from typing import Optional

from google import genai
from google.genai import types, errors

# Retry transient failures seen in batch runs: 5xx ServerError, 429 rate limits, and
# truncated/malformed JSON (long responses near the token cap). Exponential backoff.
MAX_ATTEMPTS = 4
BASE_DELAY_SEC = 2.0
# gemini-2.5-pro supports a large output; cap high so long track breakdowns don't truncate
# into invalid JSON (we saw a JSONDecodeError mid-batch).
MAX_OUTPUT_TOKENS = 65536


def is_transient(exc: Exception) -> bool:
    """True if a failure is worth retrying (server hiccup, rate limit, or a truncated body)."""
    if isinstance(exc, json.JSONDecodeError):
        return True
    if isinstance(exc, errors.ServerError):
        return True
    if isinstance(exc, errors.ClientError) and getattr(exc, "code", None) == 429:
        return True
    return False


def analyze_audio(
    audio_bytes: bytes,
    mime_type: str,
    prompt: str,
    response_schema: dict,
    model: str,
    project: Optional[str],
    location: Optional[str],
) -> dict:
    """Returns the parsed JSON interpretation. Auth via ADC (no key).

    Retries transient Gemini failures (5xx / 429 / truncated JSON) with exponential backoff.
    """
    client = genai.Client(vertexai=True, project=project, location=location)
    for attempt in range(MAX_ATTEMPTS):
        try:
            resp = client.models.generate_content(
                model=model,
                contents=[
                    types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=response_schema,
                    max_output_tokens=MAX_OUTPUT_TOKENS,
                ),
            )
            return json.loads(resp.text)
        except Exception as exc:  # noqa: BLE001 — re-raised below unless transient
            if not is_transient(exc) or attempt == MAX_ATTEMPTS - 1:
                raise
            time.sleep(BASE_DELAY_SEC * (2 ** attempt))
    raise AssertionError("unreachable: loop returns or raises")  # pragma: no cover

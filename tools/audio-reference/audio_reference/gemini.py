"""I/O boundary: call Gemini on Vertex (ADC) with audio + prompt + response schema → dict."""
import json
from typing import Optional

from google import genai
from google.genai import types


def analyze_audio(
    audio_bytes: bytes,
    mime_type: str,
    prompt: str,
    response_schema: dict,
    model: str,
    project: Optional[str],
    location: Optional[str],
) -> dict:
    """Returns the parsed JSON interpretation. Auth via ADC (no key)."""
    client = genai.Client(vertexai=True, project=project, location=location)
    resp = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            prompt,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
        ),
    )
    return json.loads(resp.text)

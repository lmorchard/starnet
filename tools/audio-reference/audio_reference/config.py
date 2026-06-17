"""Pure: resolve a Vertex setting from CLI flag → environment.

(gcloud-config fallback happens implicitly inside the google-genai client when both
flag and env are None, so it is not modeled here.)
"""
from typing import Optional, Mapping


def resolve_setting(flag: Optional[str], env: Mapping[str, str], env_key: str) -> Optional[str]:
    if flag:
        return flag
    return env.get(env_key)

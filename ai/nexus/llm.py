from typing import Optional

from ai.nexus.config import NexusSettings


def complete(settings: NexusSettings, system: str, user: str) -> Optional[str]:
    """Return LLM-generated text, or None when disabled/unavailable.

    The LLM is used ONLY to produce interpretation/narrative TEXT. Financial values
    are never derived from it (D5). All network access goes through this single seam,
    so tests can monkeypatch it. litellm is imported lazily to keep ai/ dependency-light.
    """
    if not settings.llm_enabled:
        return None
    try:
        from litellm import completion
    except Exception:
        return None
    kwargs = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "api_key": settings.llm_api_key,
    }
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
    if settings.llm_reasoning_effort:
        kwargs["extra_body"] = {"reasoning_effort": settings.llm_reasoning_effort}
    resp = completion(**kwargs)
    return resp.choices[0].message.content

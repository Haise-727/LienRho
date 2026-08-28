from typing import Optional

from ai.agentic_framework.config import AgenticFrameworkSettings


def complete(settings: AgenticFrameworkSettings, system: str, user: str) -> Optional[str]:
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
    resp = completion(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )
    return resp.choices[0].message.content

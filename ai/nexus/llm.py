from typing import Optional

from ai.nexus.config import NexusSettings


def complete(settings: NexusSettings, system: str, user: str) -> Optional[str]:
    """Return LLM-generated narrative text, or None when disabled/unavailable.

    Generic provider routing through litellm: the ``llm_model`` string selects the
    backend (openai/..., gemini/..., anthropic/..., nvidia_nim/..., or any
    OpenAI-compatible model when ``llm_base_url`` is set). All values come from
    settings (env) -- nothing is hardcoded.

    The LLM is used ONLY for narrative text. Financial figures are never derived
    from it (brief D5). All calls go through this single seam so tests can
    monkeypatch it.
    """
    if not settings.llm_enabled:
        return None
    if not settings.llm_model:
        return None
    try:
        from litellm import completion
    except Exception:
        return None
    try:
        kwargs: dict = {
            "model": settings.llm_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": settings.llm_temperature,
            "max_tokens": settings.llm_max_tokens,
        }
        if settings.llm_api_key:
            kwargs["api_key"] = settings.llm_api_key
        if settings.llm_base_url:
            kwargs["api_base"] = settings.llm_base_url
        resp = completion(**kwargs)
        text = resp.choices[0].message.content
        return text.strip() if text else None
    except Exception:
        return None
"""Optional Langfuse tracing for the NexusX agents.

Langfuse is open-source / self-hostable observability. It integrates with LangGraph
through the standard LangChain CallbackHandler, which our functional-API @entrypoint /
@task runtime emits. Everything here is lazy: importing this module never imports
langfuse, and with langfuse_enabled=False get_langfuse_handler() returns None so the
agents run with zero overhead and no network calls.
"""
from __future__ import annotations

from ai.nexus.config import NexusSettings


def get_langfuse_handler(settings: NexusSettings | None = None):
    """Return a Langfuse CallbackHandler when enabled and configured, else None."""
    settings = settings or NexusSettings()
    if not settings.langfuse_enabled:
        return None
    pub = settings.langfuse_public_key.get_secret_value() if settings.langfuse_public_key else None
    sec = settings.langfuse_secret_key.get_secret_value() if settings.langfuse_secret_key else None
    if not pub or not sec:
        # Enabled but unconfigured: skip rather than crash the agent.
        return None
    try:
        from langfuse.callback import CallbackHandler  # type: ignore
    except Exception:
        try:
            from langfuse import CallbackHandler  # type: ignore  # v3 path
        except Exception:
            return None
    return CallbackHandler(public_key=pub, secret_key=sec, host=settings.langfuse_host)

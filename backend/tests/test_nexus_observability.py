"""Langfuse observability is off by default and never imports the SDK unless enabled."""
from ai.nexus.config import NexusSettings
from ai.nexus.observability import get_langfuse_handler


def test_handler_is_none_when_disabled():
    assert get_langfuse_handler(NexusSettings()) is None


def test_handler_is_none_when_enabled_without_keys():
    settings = NexusSettings(langfuse_enabled=True)
    assert get_langfuse_handler(settings) is None

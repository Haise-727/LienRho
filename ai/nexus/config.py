from pydantic_settings import BaseSettings, SettingsConfigDict


class NexusSettings(BaseSettings):
    """Configuration for the NexusX AI layer.

    Deliberately isolated from the backend's app config so the ai/ package stays
    independent. All keys are NEXUS_-prefixed env vars (e.g. NEXUS_LLM_ENABLED=true).
    """

    model_config = SettingsConfigDict(env_prefix="NEXUS_", env_file=".env", extra="ignore")

    llm_enabled: bool = False
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str | None = None
    llm_api_key: str | None = None

    matching_mode: str = "mock"  # "mock" | "http"
    matching_url: str | None = None
    matching_timeout: float = 5.0
    matching_api_key: str | None = None


def get_settings() -> NexusSettings:
    return NexusSettings()

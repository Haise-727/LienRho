from pydantic_settings import BaseSettings, SettingsConfigDict


class NexusSettings(BaseSettings):
    """Configuration for the NexusX AI layer.

    Deliberately isolated from the backend's app config so the ai/ package stays
    independent. All keys are NEXUS_-prefixed env vars (e.g. NEXUS_LLM_ENABLED=true).
    """

    model_config = SettingsConfigDict(env_prefix="NEXUS_", env_file=".env", extra="ignore")

    # ---- Generic LLM narrator (via litellm) ----
    # Enable to let an LLM write the spoken explanation the voice agent reads.
    # The clearing MATH stays deterministic in ai/nexus (brief D5: no LLM computes figures).
    llm_enabled: bool = False
    # Model string selects the backend -- nothing is hardcoded to a vendor, e.g.
    #   "openai/gpt-4o-mini"
    #   "gemini/gemini-1.5-flash"
    #   "anthropic/claude-3-5-haiku-latest"
    #   "nvidia_nim/meta/llama-3.1-8b-instruct"
    #   or any OpenAI-compatible model when NEXUS_LLM_BASE_URL is set
    llm_model: str = ""
    llm_api_key: str | None = None
    llm_base_url: str | None = None  # optional: self-hosted / OpenAI-compatible endpoint
    llm_temperature: float = 0.3
    llm_max_tokens: int = 300

    # ---- Provider panel (config-driven registry) ----
    # Path to the JSON funder panel consumed by load_providers(). Relative paths are
    # resolved by load_providers() against the CWD then the repo root.
    providers_path: str = "ai/nexus/providers.json"

    # ---- (legacy) matching service ----
    matching_mode: str = "mock"  # "mock" | "http"
    matching_url: str | None = None
    matching_timeout: float = 5.0
    matching_api_key: str | None = None


def get_settings() -> NexusSettings:
    return NexusSettings()
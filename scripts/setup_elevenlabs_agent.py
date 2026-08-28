"""Create or update the LienRho / NexusX ElevenLabs Conversational AI voice agent.

What it does (in order):
  1. Reads XI_API_KEY from the environment (never hard-coded).
  2. Resolves the public webhook URL via CLI arg (--webhook-url), the
     ELEVENLABS_WEBHOOK_URL env var, or an auto-started ngrok tunnel.
  3. Substitutes that URL into elevenlabs_agent_config.json in memory, replacing
     the <NGROK_URL> placeholder (the file on disk keeps the placeholder so the
     script stays idempotent across runs).
  4. Creates the agent, or updates it when a stored agent id exists
     (idempotent via the .elevenlabs_agent_id state file).
  5. Prefers the `elevenlabs` SDK when it is importable (detected first in the
     project venv at backend/.venv); otherwise falls back to plain REST via httpx.

Run:
    $env:XI_API_KEY = "sk_..."
    python scripts/setup_elevenlabs_agent.py [--webhook-url https://abc.ngrok.io]

This script only prepares and registers the agent; it does not start the local
API server.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "elevenlabs_agent_config.json"
AGENT_ID_FILE = ROOT / ".elevenlabs_agent_id"
VENV_PY = ROOT / "backend" / ".venv" / "Scripts" / "python.exe"
PLACEHOLDER = "<NGROK_URL>"
ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1"


def _log(msg: str) -> None:
    print(f"[voice-setup] {msg}")


# --------------------------------------------------------------------------- #
# Webhook URL resolution
# --------------------------------------------------------------------------- #
def resolve_webhook_url(cli_url: Optional[str]) -> Optional[str]:
    if cli_url:
        return cli_url.strip().rstrip("/")
    env_url = os.getenv("ELEVENLABS_WEBHOOK_URL")
    if env_url:
        return env_url.strip().rstrip("/")
    return _start_ngrok()


def _start_ngrok() -> Optional[str]:
    ngrok = shutil.which("ngrok")
    if not ngrok:
        _log("No --webhook-url, no ELEVENLABS_WEBHOOK_URL, and ngrok not found on PATH.")
        _log("Provide the public URL via CLI arg or env to configure the agent's tool.")
        return None
    args = [ngrok, "http", "8000"]
    token = os.getenv("NGROK_AUTHTOKEN")
    if token:
        args += ["--authtoken", token]
    subprocess.Popen(args)
    _log("started ngrok, waiting for tunnel...")
    import urllib.request

    for _ in range(40):
        try:
            with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=1) as r:
                data = json.load(r)
                for t in data.get("tunnels", []):
                    if t.get("proto") == "https":
                        url = t["public_url"].rstrip("/")
                        _log(f"ngrok tunnel: {url}")
                        return url
        except Exception:
            time.sleep(0.5)
    _log("WARNING: could not read ngrok tunnel URL")
    return None


# --------------------------------------------------------------------------- #
# Config loading / substitution
# --------------------------------------------------------------------------- #
def load_config() -> dict:
    with CONFIG.open(encoding="utf-8") as fh:
        return json.load(fh)


def inject_webhook_url(config: dict, webhook_url: str) -> dict:
    """Replace the <NGROK_URL> placeholder with the live public base URL."""
    raw = json.dumps(config)
    if PLACEHOLDER in raw:
        config = json.loads(raw.replace(PLACEHOLDER, webhook_url))
    else:
        # Fallback: set the url directly on any webhook tool.
        for t in (
            config.get("conversation_config", {})
            .get("agent", {})
            .get("prompt", {})
            .get("tools", [])
        ):
            if t.get("type") == "webhook":
                t.setdefault("api_schema", {})["url"] = f"{webhook_url}/api/voice/clearing"
    return config


# --------------------------------------------------------------------------- #
# Agent client abstraction (SDK preferred, REST fallback)
# --------------------------------------------------------------------------- #
class AgentClient:
    def upsert(self, name: str, conversation_config: dict) -> str:
        raise NotImplementedError


class SdkClient(AgentClient):
    def __init__(self, api_key: str) -> None:
        from elevenlabs import ElevenLabs

        self._client = ElevenLabs(api_key=api_key)

    def upsert(self, name: str, conversation_config: dict) -> str:
        agents = self._client.conversational_ai.agents
        if AGENT_ID_FILE.exists():
            aid = AGENT_ID_FILE.read_text(encoding="utf-8").strip()
            agents.update(agent_id=aid, name=name, conversation_config=conversation_config)
            _log(f"updated agent {aid}")
            return aid
        resp = agents.create(name=name, conversation_config=conversation_config)
        aid = resp.agent_id
        AGENT_ID_FILE.write_text(aid, encoding="utf-8")
        _log(f"created agent {aid}")
        return aid


class RestClient(AgentClient):
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def upsert(self, name: str, conversation_config: dict) -> str:
        import httpx

        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
        }
        if AGENT_ID_FILE.exists():
            aid = AGENT_ID_FILE.read_text(encoding="utf-8").strip()
            resp = httpx.patch(
                f"{ELEVENLABS_API_BASE}/convai/agents/{aid}",
                headers=headers,
                json={"name": name, "conversation_config": conversation_config},
                timeout=30,
            )
            resp.raise_for_status()
            _log(f"updated agent {aid}")
            return aid
        resp = httpx.post(
            f"{ELEVENLABS_API_BASE}/convai/agents",
            headers=headers,
            json={"name": name, "conversation_config": conversation_config},
            timeout=30,
        )
        resp.raise_for_status()
        aid = resp.json()["agent_id"]
        AGENT_ID_FILE.write_text(aid, encoding="utf-8")
        _log(f"created agent {aid}")
        return aid


def _sdk_available() -> bool:
    # Prefer the project venv's site-packages when present.
    if VENV_PY.exists():
        site_packages = VENV_PY.parent.parent / "Lib" / "site-packages"
        if site_packages.exists() and str(site_packages) not in sys.path:
            sys.path.insert(0, str(site_packages))
    try:
        import elevenlabs  # noqa: F401

        return True
    except ImportError:
        return False


def build_client(api_key: str) -> AgentClient:
    if _sdk_available():
        _log("Using elevenlabs SDK.")
        return SdkClient(api_key)
    _log("elevenlabs SDK not available; using REST via httpx.")
    return RestClient(api_key)


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create or update the LienRho ElevenLabs voice agent."
    )
    parser.add_argument(
        "--webhook-url",
        default=None,
        help="Public webhook base URL, e.g. https://abc.ngrok.io",
    )
    args = parser.parse_args()

    api_key = os.getenv("XI_API_KEY")
    if not api_key:
        _log("XI_API_KEY is not set; refusing to proceed (no secret may be hard-coded).")
        return 1

    webhook_url = resolve_webhook_url(args.webhook_url)
    if not webhook_url:
        _log("No webhook URL available; cannot configure the agent's tool endpoint.")
        return 1

    config = load_config()
    config = inject_webhook_url(config, webhook_url)
    _log(f"webhook target: {webhook_url}/api/voice/clearing")

    name = config.get("agent_name", "NexusX CFO Voice")
    conversation_config = config["conversation_config"]

    client = build_client(api_key)
    aid = client.upsert(name, conversation_config)
    _log(f"Agent ready: https://elevenlabs.io/app/conversational-ai/{aid}/playground")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

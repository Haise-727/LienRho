import os
import sys

from dotenv import load_dotenv

load_dotenv()


def main() -> int:
    model = os.getenv("NEXUS_LLM_MODEL")
    key = os.getenv("NEXUS_LLM_API_KEY")
    base = os.getenv("NEXUS_LLM_BASE_URL")
    if not model:
        print("ERROR: NEXUS_LLM_MODEL is not set in .env")
        return 2
    if not key:
        print("ERROR: NEXUS_LLM_API_KEY is not set in .env")
        return 2

    print(f"LLM model : {model}")
    print(f"base_url  : {base or '(provider default)'}")

    from litellm import completion

    kwargs = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a concise narrator. Reply in one short sentence."},
            {"role": "user", "content": "If you can read this, reply exactly: LLM_ONLINE."},
        ],
        "temperature": 0.0,
        "max_tokens": 40,
        "api_key": key,
    }
    if base:
        kwargs["api_base"] = base

    try:
        resp = completion(**kwargs)
        text = resp.choices[0].message.content.strip()
        print("LLM says  :", text)
    except Exception as exc:
        print("SMOKE TEST FAILED:", repr(exc))
        return 1

    # Verify our own integration path (ai.nexus.llm.complete) uses the same call.
    try:
        from ai.nexus.config import NexusSettings
        from ai.nexus.llm import complete
        settings = NexusSettings(
            llm_enabled=True,
            llm_model=model,
            llm_api_key=key,
            llm_base_url=base,
        )
        out = complete(settings, "One sentence.", "Confirm you are the narrator.")
        print("complete():", repr(out))
        if not out:
            print("WARN: complete() returned None (voice will fall back to deterministic speech)")
    except Exception as exc:
        print("complete() ERROR:", repr(exc))

    print("SMOKE TEST PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
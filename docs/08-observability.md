# Observability & Visualization for the NexusX LangGraph Agents

## Decision: Langfuse (open-source) + LangGraph Studio (visualizer)
- **Langfuse** = tracing + UI, self-hostable or free cloud, OpenTelemetry-native. Integrates with
  LangGraph through the standard LangChain CallbackHandler emitted by our functional-API
  @entrypoint / @task runtime. Covers "see the agent run" with no vendor lock-in.
- **LangGraph Studio** = interactive visual graph UI. `langgraph dev` starts a local Agent Server
  and opens Studio at https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024.

## Important: Studio needs a FREE LangSmith key for login only
LangGraph Studio's UI is hosted and requires a free LangSmith API key to open -- but set
LANGSMITH_TRACING=false so **no run data ever leaves your machine**. Studio is only the
visualizer; your traces go to Langfuse. (Fully key-free alternatives exist -- langhost /
langrove open-source Agent Servers -- but the official langgraph dev path is simplest.)

## How to wire
- ai/nexus/config.py adds langfuse_enabled, langfuse_host, langfuse_public_key, langfuse_secret_key
  (all off/empty by default; keys are SecretStr).
- ai/nexus/observability.py -> get_langfuse_handler() returns a CallbackHandler when enabled and
  configured, else None (no-op). Imports are lazy so the SDK is never required.
- market_clearing_agent.py passes config={"callbacks":[handler]} to the entrypoint invoke.
- langgraph.json at repo root points graphs.nexus_clearing at clearing_workflow (the @entrypoint
  returns a Pregel, which Studio can load directly).
- langfuse>=2 added to ai/requirements.txt; Studio CLI installed separately.

## Run it
1. Studio (visualizer): pip install "langgraph-cli[inmem]", then langgraph dev from repo root.
   Open the printed Studio URL. Provide a free LANGSMITH_API_KEY (set LANGSMITH_TRACING=false).
2. Langfuse (traces): sign up for free Langfuse cloud OR docker compose up the official stack
   (UI http://localhost:3000). Set NEXUS_LANGFUSE_ENABLED=true + the three keys, run any agent.
3. With NEXUS_LLM_ENABLED=false + Mock matching, traces show the deterministic steps
   (supplier_task -> 3x lender_task -> match). Flip those on for real prompts/tokens.

# NexusX Clearing API

FastAPI service wrapping `ai/nexus` (the NexusX agent layer). It is the single
integration point for both the Next.js frontend and the ElevenLabs voice agent.

## Run (local, no keys needed)
```powershell
$env:PYTHONPATH = "C:\DevLearning\LienRho"
.\backend\.venv\Scripts\python.exe -m uvicorn nexus_api.main:app --port 8000
```
OpenAPI docs: http://localhost:8000/docs

## Seamless ElevenLabs voice setup (Part B)
1. Copy `.env.example` -> `.env` and fill `XI_API_KEY`.
2. (Optional) set `NEXUS_WEBHOOK_URL` to your public URL, or install ngrok + set `NGROK_AUTHTOKEN`.
3. One command:
   ```powershell
   .\backend\.venv\Scripts\python.exe scripts/setup_elevenlabs_agent.py
   ```
   It starts the API, exposes it (ngrok), creates/updates the ElevenLabs agent
   that calls `/api/voice/clearing`, and prints a playground link. Ctrl-C stops all.
4. Open the printed ElevenLabs playground link and talk.

## Endpoints
- GET  /health
- POST /api/nexus/clear                 -> ClearingResult (auto-generates bids if empty)
- POST /api/nexus/supplier/interpret    -> UrgencyVerdict
- POST /api/nexus/lender/bid?providerId=L1&urgencyFactor=0.3 -> LenderBid
- POST /api/voice/clearing             -> {result, winner, rankedBids, thesisNote, matched}
        ElevenLabs webhook target (accepts args nested in `parameters`).

## Safety
The LLM never computes financial figures. All numbers come from the deterministic
clearing engine; the voice payload only relays them.
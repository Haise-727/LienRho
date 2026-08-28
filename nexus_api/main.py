from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from nexus_api.routers import voice

app = FastAPI(title="LienRho", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(voice.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
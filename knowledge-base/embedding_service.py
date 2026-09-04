#!/usr/bin/env python3
"""
KINDIX KB -- Embedding Service
==============================

WHY THIS EXISTS:
Retrieval needs the *query* embedded in the same vector space as the stored
chunks. The NestJS backend has no Python / BGE-M3, so this tiny FastAPI app
exposes the model over HTTP. The backend POSTs a query string here and gets
back a 1024-dim vector to feed into the pgvector similarity search.

The model (~2 GB) is loaded ONCE at startup and reused for every request.
Settings must match embed_and_store.py exactly -- BAAI/bge-m3 with
normalize_embeddings=True -- or query vectors will not be comparable to the
chunk vectors already in the database.

API:
    POST /embed   {"text": "how do parents log in?"}
              ->  {"embedding": [0.0123, -0.045, ...]}   # length 1024

USAGE:
    pip install fastapi "uvicorn[standard]" sentence-transformers
    python embedding_service.py          # serves on http://localhost:8001

This is a standalone dev/retrieval helper, not part of the NestJS app.
"""

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-m3"
HOST = "127.0.0.1"
PORT = 8001

print(f"loading {MODEL_NAME} (first run downloads ~2 GB) ...")
model = SentenceTransformer(MODEL_NAME)
print("model ready")

app = FastAPI(title="KINDIX Embedding Service")


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: list[float]


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    vector = model.encode(req.text, normalize_embeddings=True)
    return EmbedResponse(embedding=vector.tolist())


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)

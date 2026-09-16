# KINDIX embedding service -- serves BGE-M3 over HTTP for the backend's
# query-time embedding calls (see embedding_service.py's docstring).
#
# The model itself (~2 GB) is NOT baked into this image -- it downloads from
# HuggingFace on first container start into a cache volume (wired up in
# infra/docker-compose.yml) so it only downloads once, not on every rebuild.
# First boot is therefore slow; that's expected.
FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi "uvicorn[standard]" sentence-transformers
COPY embedding_service.py .
EXPOSE 8001
CMD ["python", "embedding_service.py"]

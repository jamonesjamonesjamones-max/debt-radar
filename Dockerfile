FROM python:3.11-slim

WORKDIR /app

COPY backend/ /app/backend/
COPY pyproject.toml /app/

RUN pip install --no-cache-dir -e .

ENTRYPOINT ["debtradar", "scan"]
CMD [".", "--output", "json"]

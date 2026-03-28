FROM python:3.11-slim

WORKDIR /app

# All dependencies ship binary wheels on linux/amd64 — no gcc/libpq-dev needed
COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# ReflectAI — Privacy-First Mental Health Journaling

> An enterprise-grade emotional wellness platform that uses local AI to understand your emotional patterns — without ever sending your private thoughts to the cloud.

---

## What is ReflectAI?

ReflectAI is a full-stack mental health journaling application built around one core principle: **your journal entries never leave your device unencrypted, and raw text is never sent to any AI model.**

Instead of uploading your writing, ReflectAI runs emotion and sentiment analysis locally using HuggingFace transformer models on the server. When AI insights are generated, only anonymised statistical summaries (emotion percentages, average mood scores, themes) are used — never the actual content of what you wrote.

Built as a portfolio project for the **UCD Human-AI Interaction PhD programme**, ReflectAI demonstrates how AI can be genuinely useful in sensitive personal domains while respecting user privacy by design.

---

## Key Features

### Journaling & Emotion Analysis
- End-to-end encrypted journal entries (Fernet symmetric encryption, per-user salt)
- Automatic emotion detection via local HuggingFace models — joy, sadness, anger, fear, disgust, surprise, neutral
- Sentiment analysis (positive / neutral / negative)
- Zero-shot theme classification — anxiety, relationships, work, health, and more
- Semantic "Similar Entries" — find related past entries using sentence embeddings
- Voice-to-text journaling via browser Web Speech API (free, no API key needed)
- Emotion correction — override the AI's detected emotion with one click

### Mood Check-ins
- Daily structured check-ins: mood, energy, sleep quality, stress level (1–5 scale)
- Mood calendar heatmap — visualise your entire month at a glance
- Week-over-week comparison widget on dashboard and calendar
- Automated daily check-in reminder emails

### AI Insights
- Daily, weekly, monthly, and yearly AI-generated emotional pattern summaries
- Smart backfill — clicking Generate catches up on all missed periods automatically
- Upsert logic — re-running within the same period refreshes, never duplicates
- Privacy-safe: only anonymised stats sent to LLM, never raw journal content
- Local inference via Ollama (free) → OpenAI → Anthropic fallback chain
- Manual generation + scheduled Celery Beat jobs (runs at end of each period)
- Thumbs up / down feedback on every insight
- Full history page with tab filters: All, Daily, Weekly, Monthly, Yearly

### Analytics (100% local — zero external API calls)
- Wellness score (0–100) with trend indicator
- Pearson correlation analysis: how sleep, energy, and stress affect mood
- Day-of-week mood pattern bar chart
- Mood trend over time (area chart by month)
- Best and worst day-of-week identification

### Platform & UX
- Command palette (Ctrl+K) for instant keyboard-driven navigation
- Framer Motion animations throughout — stagger, spring, AnimatePresence
- Skeleton loading states on every data-heavy component
- Sonner toast notifications for all user feedback
- JWT authentication with httpOnly cookie refresh token rotation
- Rate limiting, CORS protection, and security headers
- Admin dashboard for user management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS, custom brand palette |
| Animation | Framer Motion |
| Charts | Recharts (AreaChart, BarChart, RadialBarChart) |
| Command Palette | cmdk |
| Backend | FastAPI (fully async), Python 3.11+ |
| Database | PostgreSQL + SQLAlchemy (async) + Alembic migrations |
| Task Queue | Celery + Celery Beat, Redis |
| ML Inference | HuggingFace Transformers (runs locally on server) |
| LLM | Ollama (local) → OpenAI → Anthropic (priority fallback chain) |
| Similarity | sentence-transformers (all-MiniLM-L6-v2) |
| Auth | JWT (httpOnly cookies, automatic refresh token rotation) |
| Encryption | Fernet symmetric encryption (per-user key derived from password salt) |
| Email | SMTP via Celery tasks (Mailtrap for dev, any SMTP for prod) |
| Validation | Pydantic v2, react-hook-form + zod |

---

## AI Models (all run locally on the server)

| Model | Purpose | Size |
|-------|---------|------|
| `j-hartmann/emotion-english-distilroberta-base` | 7-class emotion detection | ~320 MB |
| `cardiffnlp/twitter-roberta-base-sentiment-latest` | Sentiment analysis (pos/neu/neg) | ~480 MB |
| `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli` | Zero-shot theme classification | ~450 MB |
| `sentence-transformers/all-MiniLM-L6-v2` | Semantic similarity for Similar Entries | ~80 MB |

> Models are downloaded automatically from HuggingFace on first startup (~1.3 GB total). Subsequent startups load from cache.

---

## Privacy Architecture

```
Your journal entry (plain text)
         │
         ▼
  Fernet encrypt ──────────────► Stored in PostgreSQL (encrypted bytes only)
         │
         ▼
  Local ML analysis (never leaves the server, never hits any external API)
  ├── Emotion: joy 64%, sadness 20%, neutral 16%
  ├── Sentiment: positive
  └── Themes: work, achievement
         │
         ▼
  Anonymised stats only (no raw text) sent to LLM:
  "EMOTION DISTRIBUTION: joy 64%, sadness 20%
   AVERAGE MOOD: 3.8/5
   THEMES: work, achievement"
         │
         ▼
  AI generates a compassionate insight from the stats alone
```

---

## Running Locally

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| PostgreSQL | 15+ | [postgresql.org](https://postgresql.org) |
| Redis | 7+ | [redis.io](https://redis.io) |
| Docker *(optional)* | any | [docker.com](https://docker.com) |

---

### Option A — Docker (easiest, one command)

Docker starts PostgreSQL, Redis, the FastAPI backend, Celery worker, Celery Beat, and the Next.js frontend all at once.

**1. Clone the repo**
```bash
git clone https://github.com/<your-username>/reflectai.git
cd reflectai
```

**2. Create the backend environment file**
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in at minimum:
- `SECRET_KEY` — run `python -c "import secrets; print(secrets.token_hex(64))"`
- `ENCRYPTION_KEY` — run `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — needed for AI insights (get one free at console.anthropic.com)

**3. Create the frontend environment file**
```bash
# frontend/.env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > frontend/.env.local
```

**4. Start everything**
```bash
docker compose up --build
```

First run downloads the HuggingFace ML models (~1.3 GB) — this takes a few minutes. Subsequent starts are instant.

**5. Run database migrations** (only needed once)

In a second terminal while Docker is running:
```bash
docker exec reflectai_backend alembic upgrade head
```

**6. Open the app**

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

To stop: `docker compose down`
To stop and delete all data: `docker compose down -v`

---

### Option B — Manual Setup (without Docker)

Use this if you already have PostgreSQL and Redis installed locally.

#### 1. Clone the repo
```bash
git clone https://github.com/<your-username>/reflectai.git
cd reflectai
```

#### 2. Create the PostgreSQL database
```bash
psql -U postgres
```
```sql
CREATE USER reflectai WITH PASSWORD 'reflectai_dev_password';
CREATE DATABASE reflectai OWNER reflectai;
\q
```

#### 3. Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# Mac / Linux
source .venv/bin/activate

# Install all dependencies including ML models
pip install -e ".[ml]"

# Copy environment file
cp .env.example .env
```

Open `backend/.env` and set:

```env
DATABASE_URL=postgresql+asyncpg://reflectai:reflectai_dev_password@localhost:5432/reflectai
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(64))">
ENCRYPTION_KEY=<generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
ANTHROPIC_API_KEY=<your key>   # or OPENAI_API_KEY
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=["http://localhost:3000"]
```

#### 4. Run database migrations
```bash
# still inside backend/ with .venv active
alembic upgrade head
```

#### 5. Start the backend API
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 6. Start the Celery worker (new terminal)
```bash
cd backend
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Mac / Linux

celery -A app.celery_app worker --loglevel=info
```

#### 7. Start Celery Beat — scheduled jobs (new terminal)
```bash
cd backend
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Mac / Linux

celery -A app.celery_app beat --loglevel=info
```

#### 8. Frontend setup (new terminal)
```bash
cd frontend
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

#### 9. Open the app
- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

---

### Optional — Ollama (free local LLM, no API key needed)

If you want AI insights without using OpenAI or Anthropic:

1. Download Ollama from [ollama.com](https://ollama.com) and install it
2. Pull a model:
   ```bash
   ollama pull llama3.2
   ```
3. Add to `backend/.env`:
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   ```

The app tries Ollama first, then falls back to OpenAI, then Anthropic.

---

### Optional — Email (check-in reminders)

For development, use [Mailtrap](https://mailtrap.io) (free):
1. Sign up at mailtrap.io → Inboxes → SMTP settings
2. Add to `backend/.env`:
   ```env
   SMTP_HOST=smtp.mailtrap.io
   SMTP_PORT=587
   SMTP_USER=<your mailtrap username>
   SMTP_PASSWORD=<your mailtrap password>
   ```

---

## Environment Variables Reference

All variables go in `backend/.env`. Copy from `backend/.env.example`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL async connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `SECRET_KEY` | Yes | JWT signing secret (64+ random hex chars) |
| `ENCRYPTION_KEY` | Yes | Fernet key for journal encryption |
| `ANTHROPIC_API_KEY` | One of these | Anthropic Claude API key |
| `OPENAI_API_KEY` | One of these | OpenAI API key |
| `OLLAMA_BASE_URL` | No | Ollama server (e.g. `http://localhost:11434`) |
| `OLLAMA_MODEL` | No | Ollama model name (e.g. `llama3.2`) |
| `FRONTEND_URL` | Yes | Frontend URL for CORS (e.g. `http://localhost:3000`) |
| `SMTP_HOST` | No | SMTP server for email reminders |
| `SMTP_PORT` | No | SMTP port (usually `587`) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASSWORD` | No | SMTP password |

---

## Project Structure

```
reflectai/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── routers/          # API endpoints
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/         # Business logic (insight generation, ML)
│   │   ├── tasks/            # Celery background tasks
│   │   └── core/             # Auth, encryption, security
│   ├── alembic/              # Database migrations
│   └── pyproject.toml        # Python dependencies
│
├── frontend/                 # Next.js 15 application
│   └── src/
│       ├── app/              # App Router pages
│       ├── components/       # React components
│       ├── lib/              # API client, utilities
│       └── types/            # TypeScript types
│
├── docker-compose.yml        # Full local stack
└── README.md
```

---

## Licence

MIT — free to use, modify, and distribute.

---

*Built with care as a portfolio project for the UCD Human-AI Interaction research group.*

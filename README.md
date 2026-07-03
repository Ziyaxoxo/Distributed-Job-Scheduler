# Distributed Job Scheduler

A production-inspired distributed job scheduling platform for reliably executing asynchronous background jobs across multiple workers.

## Features

- JWT authentication and project/queue management
- Job types: immediate, delayed, scheduled, recurring (interval), and batch
- Atomic job claiming via PostgreSQL `FOR UPDATE SKIP LOCKED`
- Worker fleet with heartbeats, graceful shutdown, and dead worker recovery
- Retry strategies: fixed, linear, and exponential backoff
- Dead Letter Queue (DLQ) for permanent failures
- Execution logs, retry history, and queue statistics
- React dashboard with job creation, queue config, and polling-based live updates

## Output Sample




https://github.com/user-attachments/assets/5df11868-c88a-4efb-bc15-d3129d46f96f




## Architecture

```
┌─────────────┐     REST API      ┌──────────────┐
│   React     │◄─────────────────►│  Express API │
│  Dashboard  │                   └──────┬───────┘
└─────────────┘                          │
┌─────────────┐                          ▼
│ API Clients │                   ┌──────────────┐
└─────────────┘                   │  PostgreSQL  │
                                  └──────┬───────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
              ┌──────────┐        ┌──────────┐        ┌──────────┐
              │ Worker 1 │        │ Worker 2 │        │ Worker N │
              └──────────┘        └──────────┘        └──────────┘
```

See [architecture.md](architecture.md) and [er-diagram.md](er-diagram.md) for detailed diagrams.

---

## Quick Start (Docker)

```bash
cd job-scheduler
docker compose up --build
```

| Service   | URL                    |
|-----------|------------------------|
| API       | http://localhost:3000  |
| Dashboard | http://localhost:5173  |
| Postgres  | localhost:5432         |

Demo credentials (after seed): `demo@scheduler.local` / `password123`

---

## Local Development (Recommended)

### Prerequisites

- **Node.js 20+**
- **PostgreSQL 16+** running locally

### One-time setup

```bash
cd job-scheduler/backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed

cd ../frontend
npm install
```

Default database URL in `.env.example`:

```
postgresql://scheduler:scheduler@localhost:5432/job_scheduler
```

If using Homebrew PostgreSQL with a different user, update `DATABASE_URL` in `backend/.env`.

### Run the stack (4 terminals)

Open **four separate terminal windows/tabs** and run one command in each:

**Terminal 1 — PostgreSQL** (skip if already running as a service)

```bash
# macOS Homebrew example:
brew services start postgresql@16
```

**Terminal 2 — API server** (port 3000)

```bash
cd job-scheduler/backend
npm run dev
```

**Terminal 3 — Worker process** (polls DB and executes jobs)

```bash
cd job-scheduler/backend
npm run dev:worker
```

**Terminal 4 — Dashboard** (port 5173)

```bash
cd job-scheduler/frontend
npm run dev
```

### Access the app

| What        | URL                          |
|-------------|------------------------------|
| Dashboard   | http://localhost:5173        |
| API health  | http://localhost:3000/api/health |
| Login       | `demo@scheduler.local` / `password123` |

### Verify it works

1. Open http://localhost:5173 and sign in
2. Go to **Jobs** → click **+ Create Job**
3. Select the `default-queue` queue, choose `IMMEDIATE`, payload template `echo`
4. Click **Enqueue Job** — within a few seconds the job should move to `COMPLETED`
5. Check **Workers** to see the active worker and heartbeat

---

## Tests

```bash
cd job-scheduler/backend
npm test
```

Requires PostgreSQL running with migrations applied (15 tests).

---

## API Quick Example

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@scheduler.local","password":"password123"}' | jq -r .token)

# Create project
PROJECT=$(curl -s -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Project"}' | jq -r .id)

# Create queue
QUEUE=$(curl -s -X POST http://localhost:3000/api/projects/$PROJECT/queues \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"emails","priority":5,"max_concurrency":10}' | jq -r .id)

# Enqueue job
curl -X POST http://localhost:3000/api/queues/$QUEUE/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"job_type":"IMMEDIATE","payload":{"type":"echo","message":"hello"}}'
```

Full API reference: [backend/openapi.yaml](backend/openapi.yaml)

---

## Job Payload Handlers (Demo)

| `payload.type` | Behavior                |
|----------------|-------------------------|
| `echo`         | Returns payload as-is   |
| `fail`         | Simulates failure       |
| `slow`         | Sleeps `delay_ms`       |
| `compute`      | Simple math operations  |

---

## Project Structure

```
job-scheduler/
├── backend/          # Express API + Worker
├── frontend/         # React dashboard
├── docs/             # SRS generator + Word document
├── architecture.md
├── er-diagram.md
└── design-decisions.md
```

---

## Documentation

| Document | Path |
|----------|------|
| Architecture | [architecture.md](architecture.md) |
| ER Diagram | [er-diagram.md](er-diagram.md) |
| Design Decisions | [design-decisions.md](design-decisions.md) |
| SRS (Word) | [docs/SRS-Distributed-Job-Scheduler.docx](docs/SRS-Distributed-Job-Scheduler.docx) |
| OpenAPI Spec | [backend/openapi.yaml](backend/openapi.yaml) |

### Regenerate SRS document

```bash
pip3 install python-docx matplotlib
python3 docs/generate-srs.py
```

---

## License

MIT

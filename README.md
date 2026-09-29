```markdown
# Distributed Job Scheduler

A production-inspired distributed job scheduling platform for reliably executing asynchronous background jobs across multiple workers.

## Features

- JWT authentication and project / queue management
- Job types: **immediate**, **delayed**, **scheduled**, **recurring** (interval-based), and **batch**
- Atomic job claiming via PostgreSQL `FOR UPDATE SKIP LOCKED`
- Worker fleet with heartbeats, graceful shutdown, and dead-worker recovery
- Retry strategies: fixed, linear, and exponential backoff
- Dead Letter Queue (DLQ) for permanent failures
- Execution logs, retry history, and queue statistics
- React dashboard with job creation, queue configuration, and polling-based live updates


---

## Quick Start (Docker)

```bash
git clone https://github.com/Ziyaxoxo/Distributed-Job-Scheduler.git
cd Distributed-Job-Scheduler
docker compose up --build
```

| Service    | URL                          |
|------------|------------------------------|
| API        | http://localhost:3000        |
| Dashboard  | http://localhost:5173        |
| Postgres   | localhost:5432               |

**Demo credentials** (seeded automatically):  
`demo@scheduler.local` / `password123`

---

## Local Development

### Prerequisites

- **Node.js 20+**
- **PostgreSQL 16+** running locally

### One-time setup

```bash
# Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed

# Frontend
cd ../frontend
npm install
```

Default `DATABASE_URL` in `backend/.env.example`:

```
postgresql://scheduler:scheduler@localhost:5432/job_scheduler?schema=public
```

Update the connection string if your local Postgres user/password differs.

### Run the stack (3–4 terminals)

**Terminal 1 — PostgreSQL** (skip if already running as a service)

```bash
# macOS Homebrew example
brew services start postgresql@16
```

**Terminal 2 — API server** (port 3000)

```bash
cd backend
npm run dev
```

**Terminal 3 — Worker process**

```bash
cd backend
npm run dev:worker
```

**Terminal 4 — Dashboard** (port 5173)

```bash
cd frontend
npm run dev
```

### Access the app

| What         | URL / Credentials                              |
|--------------|------------------------------------------------|
| Dashboard    | http://localhost:5173                          |
| API health   | http://localhost:3000/api/health               |
| Login        | `demo@scheduler.local` / `password123`         |

### Verify it works

1. Open http://localhost:5173 and sign in.
2. Go to **Jobs** → **+ Create Job**.
3. Select the default queue, choose `IMMEDIATE`, payload template `echo`.
4. Click **Enqueue Job** — the job should move to `COMPLETED` within a few seconds.
5. Check **Workers** to see the active worker and its heartbeat.

---

## Tests

```bash
cd backend
npm test
```

Requires PostgreSQL running with migrations applied.

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

## Demo Job Payload Handlers

| `payload.type` | Behavior                          |
|----------------|-----------------------------------|
| `echo`         | Returns the payload as-is         |
| `fail`         | Simulates a failure               |
| `slow`         | Sleeps for `delay_ms` milliseconds|
| `compute`      | Performs simple math operations   |

---


## Output Demo


<img width="959" height="499" alt="image" src="https://github.com/user-attachments/assets/2a189b34-7b76-4dc1-9d33-044cf8dfaa64" />
<br><br>

<img width="959" height="493" alt="image" src="https://github.com/user-attachments/assets/b8a4cf4f-a577-4ec9-b4d8-7de1bfa778c7" />
<br><br>

<img width="959" height="488" alt="image" src="https://github.com/user-attachments/assets/15f68790-7eda-4aea-ae4b-29f386e586fc" />
<br><br>




## Project Structure

```
Distributed-Job-Scheduler/
├── backend/                 # Express API + Worker (TypeScript, Prisma)
│   ├── prisma/              # Schema, migrations, seed
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── workers/
│   │   └── ...
│   ├── openapi.yaml
│   └── Dockerfile
├── frontend/                # React + Vite + Tailwind dashboard
│   ├── src/
│   └── Dockerfile
├── docs/                    # SRS generator + Word document
├── architecture.md
├── er-diagram.md
├── design-decisions.md
└── docker-compose.yml
```

---

## Documentation

| Document          | Path                                                                 |
|-------------------|----------------------------------------------------------------------|
| Architecture      | [architecture.md](architecture.md)                                   |
| ER Diagram        | [er-diagram.md](er-diagram.md)                                       |
| Design Decisions  | [design-decisions.md](design-decisions.md)                           |
| SRS (Word)        | [docs/SRS-Distributed-Job-Scheduler.docx](docs/SRS-Distributed-Job-Scheduler.docx) |
| OpenAPI Spec      | [backend/openapi.yaml](backend/openapi.yaml)                         |

### Regenerate SRS document

```bash
pip3 install python-docx matplotlib
python3 docs/generate-srs.py
```

---

## Tech Stack

| Layer              | Technology                          |
|--------------------|-------------------------------------|
| Backend API        | Node.js, Express, TypeScript        |
| Worker             | Same codebase (`src/workers`)       |
| ORM / Migrations   | Prisma                              |
| Database           | PostgreSQL 16                       |
| Auth               | JWT + bcrypt                        |
| Frontend           | React 19, Vite, Tailwind CSS, Recharts |
| Validation         | Zod                                 |
| Testing            | Vitest + Supertest                  |
| Containerization   | Docker + Docker Compose             |

---

## License

MIT

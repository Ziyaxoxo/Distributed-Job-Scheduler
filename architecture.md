# System Architecture

## Overview

The Distributed Job Scheduler follows a **decoupled monolithic API + distributed workers** architecture. The API server handles authentication, job ingestion, and administrative operations. Independent worker processes poll PostgreSQL for work, claim jobs atomically, and execute them concurrently.

## Component Diagram

```mermaid
flowchart TB
    subgraph clients [Clients]
        Dashboard[React Dashboard]
        APIClients[REST API Clients]
    end

    subgraph apiLayer [API Layer]
        API[Express API Server]
        AuthMW[JWT Auth Middleware]
        JobSvc[Job Service]
        QueueSvc[Queue Service]
        WorkerSvc[Worker Registry]
        CleanupSvc[Dead Worker Cleanup]
    end

    subgraph dataLayer [Data Layer]
        PG[(PostgreSQL)]
    end

    subgraph workerFleet [Worker Fleet]
        W1[Worker Process 1]
        W2[Worker Process N]
        PollLoop[Polling + SKIP LOCKED]
        ExecPool[Concurrent Executor]
        Heartbeat[Heartbeat Loop]
    end

    Dashboard -->|REST polling 5-10s| API
    APIClients --> API
    API --> AuthMW --> JobSvc
    API --> QueueSvc
    API --> WorkerSvc
    JobSvc --> PG
    QueueSvc --> PG
    WorkerSvc --> PG
    CleanupSvc --> PG

    W1 --> PollLoop
    W2 --> PollLoop
    PollLoop -->|claim jobs| PG
    PollLoop --> ExecPool
    ExecPool -->|status updates| PG
    Heartbeat -->|POST heartbeat| API
    CleanupSvc -->|requeue stale jobs| PG
```

## Job Claiming Sequence

```mermaid
sequenceDiagram
    participant Worker
    participant DB as PostgreSQL

    Worker->>DB: BEGIN
    Worker->>DB: SELECT ... FOR UPDATE SKIP LOCKED
    DB-->>Worker: job row
    Worker->>DB: UPDATE status=CLAIMED, worker_id
    Worker->>DB: INSERT job_execution
    Worker->>DB: COMMIT
    Worker->>Worker: execute payload
    alt success
        Worker->>DB: status=COMPLETED
    else retryable failure
        Worker->>DB: compute backoff, status=SCHEDULED
    else max retries exceeded
        Worker->>DB: INSERT dead_letter_queue
    end
```

## Job Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> QUEUED: immediate job
    [*] --> SCHEDULED: delayed/scheduled/recurring
    SCHEDULED --> QUEUED: next_run_at reached
    QUEUED --> CLAIMED: worker claims
    CLAIMED --> RUNNING: execution starts
    RUNNING --> COMPLETED: success
    RUNNING --> SCHEDULED: retry with backoff
    RUNNING --> FAILED: max retries exceeded
    FAILED --> QUEUED: manual retry
    COMPLETED --> SCHEDULED: recurring reschedule
    FAILED --> [*]: DLQ entry
    COMPLETED --> [*]
```

## Deployment Topology

| Component | Scaling | Notes |
|-----------|---------|-------|
| API Server | Horizontal (stateless) | Behind load balancer |
| Worker Fleet | Horizontal | Scale based on queue depth |
| PostgreSQL | Vertical + read replicas | Single source of truth |
| Dashboard | Static CDN | Nginx serves built assets |

## Key Design Principles

1. **Database as queue** — PostgreSQL row locking eliminates duplicate execution without Redis
2. **Stateless workers** — Any worker can claim any job; no sticky sessions
3. **Transactional state changes** — All status transitions within DB transactions
4. **Heartbeat-based liveness** — Dead workers detected within 30 seconds

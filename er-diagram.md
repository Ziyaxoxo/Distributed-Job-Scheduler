# Entity-Relationship Diagram

## ER Diagram

```mermaid
erDiagram
    users ||--o{ projects : owns
    users ||--o{ organization_members : has
    organizations ||--o{ organization_members : has
    organizations ||--o{ projects : contains
    projects ||--o{ queues : has
    retry_policies ||--o{ queues : configures
    queues ||--o{ jobs : contains
    workers ||--o{ jobs : processes
    workers ||--o{ job_executions : runs
    workers ||--o{ worker_heartbeats : sends
    jobs ||--o{ job_executions : has
    jobs ||--o{ job_logs : has
    jobs ||--o| scheduled_jobs : schedules
    jobs ||--o| dead_letter_queue : fails_to

    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        timestamptz created_at
    }

    organizations {
        uuid id PK
        varchar name
        timestamptz created_at
    }

    organization_members {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        enum role
    }

    projects {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        varchar name
        text description
    }

    retry_policies {
        uuid id PK
        varchar name
        enum strategy
        int base_delay_seconds
        int max_delay_seconds
        int max_retries
    }

    queues {
        uuid id PK
        uuid project_id FK
        uuid retry_policy_id FK
        varchar name
        int priority
        int max_concurrency
        boolean is_paused
        boolean is_deleted
    }

    jobs {
        uuid id PK
        uuid queue_id FK
        uuid worker_id FK
        uuid batch_id
        jsonb payload
        enum status
        enum job_type
        timestamptz next_run_at
        int interval_seconds
        int execution_count
        int max_retries
    }

    job_executions {
        uuid id PK
        uuid job_id FK
        uuid worker_id FK
        int attempt
        enum status
        timestamptz started_at
        timestamptz completed_at
        jsonb result
        text error_message
        int duration_ms
    }

    job_logs {
        uuid id PK
        uuid job_id FK
        varchar level
        text message
        jsonb metadata
        timestamptz created_at
    }

    scheduled_jobs {
        uuid id PK
        uuid job_id FK UK
        timestamptz scheduled_for
        int interval_seconds
        boolean is_active
    }

    workers {
        uuid id PK
        varchar name
        varchar host
        enum status
        timestamptz last_heartbeat
    }

    worker_heartbeats {
        uuid id PK
        uuid worker_id FK
        timestamptz timestamp
        jsonb metadata
    }

    dead_letter_queue {
        uuid id PK
        uuid job_id FK UK
        jsonb original_payload
        text failure_reason
        timestamptz failed_at
        int retry_count
    }
```

## Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `jobs` | `(status, next_run_at, queue_id)` | Worker polling query |
| `jobs` | `(queue_id, status)` | Queue statistics |
| `jobs` | `(worker_id, status)` | Dead worker recovery |
| `workers` | `(last_heartbeat)` | Liveness checks |
| `job_logs` | `(job_id, created_at)` | Log retrieval |

## Cascade Rules

| Relationship | On Delete |
|--------------|-----------|
| `job_executions` → `jobs` | CASCADE |
| `job_logs` → `jobs` | CASCADE |
| `dead_letter_queue` → `jobs` | CASCADE |
| `scheduled_jobs` → `jobs` | CASCADE |
| `jobs` → `queues` | RESTRICT (preserve audit trail) |
| `queues` → `projects` | CASCADE |

## Normalization (3NF)

- **Retry policies** are separated from queues to avoid duplicating strategy configuration
- **Job executions** store historical attempts separately from the current job state
- **Worker heartbeats** are append-only for observability without mutating worker records
- **Scheduled jobs** normalize recurring/scheduled metadata while `jobs.next_run_at` serves the polling index

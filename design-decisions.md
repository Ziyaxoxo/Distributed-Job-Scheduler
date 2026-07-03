# Design Decisions & Trade-offs

## 1. PostgreSQL as the Job Queue

**Decision:** Use PostgreSQL with `FOR UPDATE SKIP LOCKED` instead of Redis/RabbitMQ.

**Rationale:**
- Strong transactional guarantees for atomic claiming
- Single source of truth — no sync issues between queue and state DB
- Simpler operational footprint for a 24-hour delivery scope

**Trade-off:** Lower peak throughput than dedicated message brokers. Acceptable for correctness-focused evaluation.

## 2. Database Polling vs Push Notifications

**Decision:** Workers poll the database at 1-second intervals.

**Rationale:**
- No LISTEN/NOTIFY infrastructure required
- Predictable behavior under load
- Easy to reason about and test

**Trade-off:** Up to 1s latency before job pickup. Mitigated by configurable poll interval.

## 3. Simplified Recurring Jobs

**Decision:** Interval-based recurrence (`interval_seconds`) instead of full cron parsing.

**Rationale:**
- Covers 80% of recurring use cases
- Avoids cron parser edge cases (DST, timezones)
- Rescheduling is a simple `next_run_at + interval` calculation

**Trade-off:** No cron expressions like `0 9 * * MON-FRI`.

## 4. Soft Delete for Queues

**Decision:** Queues are soft-deleted (`is_deleted` flag); jobs use `ON DELETE RESTRICT`.

**Rationale:**
- Preserves audit trail and execution history
- Prevents accidental data loss

**Trade-off:** Orphaned jobs if queue is soft-deleted while jobs exist — mitigated by blocking delete when active jobs exist.

## 5. JWT Authentication (24h)

**Decision:** Stateless JWT tokens without refresh token rotation.

**Rationale:**
- Simple for dashboard and API clients
- No session store required

**Trade-off:** No instant token revocation. Acceptable for project scope.

## 6. Dashboard Polling vs WebSockets

**Decision:** HTTP polling every 5–10 seconds.

**Rationale:**
- Faster to implement reliably
- Works through standard reverse proxies
- Sufficient for monitoring use case

**Trade-off:** Higher request volume; not real-time sub-second updates.

## 7. Demo Job Handlers

**Decision:** Pluggable handler registry keyed by `payload.type` with built-in demo handlers.

**Rationale:**
- Enables end-to-end testing without external integrations
- Clear extension point for production job types

**Trade-off:** Not a plugin system with dynamic loading.

## 8. Dead Worker Recovery

**Decision:** API server runs a background cleanup task every 30 seconds.

**Rationale:**
- Centralized recovery without worker coordination
- Requeues CLAIMED/RUNNING jobs from dead workers

**Trade-off:** Up to 30s delay before job requeue after worker death.

## Out of Scope

The following were explicitly deferred to prioritize engineering depth:

- Full cron expression parsing
- Workflow/job dependencies
- Rate limiting and queue sharding
- Distributed locking beyond DB row locks
- WebSocket live updates
- Role-based access control (RBAC)
- AI-generated failure summaries

import { Prisma } from '@prisma/client';
import prisma from '../models';

export interface ClaimedJob {
  id: string;
  queueId: string;
  payload: Prisma.JsonValue;
  executionCount: number;
  maxRetries: number;
  jobType: string;
  intervalSeconds: number | null;
  retryStrategy: string;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  queueMaxConcurrency: number;
}

export async function claimNextJob(workerId: string): Promise<ClaimedJob | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ClaimedJob[]>`
      SELECT j.id, j.queue_id as "queueId", j.payload, j.execution_count as "executionCount",
             j.max_retries as "maxRetries", j.job_type as "jobType", j.interval_seconds as "intervalSeconds",
             COALESCE(rp.strategy::text, 'EXPONENTIAL') as "retryStrategy",
             COALESCE(rp.base_delay_seconds, 5) as "baseDelaySeconds",
             COALESCE(rp.max_delay_seconds, 3600) as "maxDelaySeconds",
             q.max_concurrency as "queueMaxConcurrency"
      FROM jobs j
      INNER JOIN queues q ON q.id = j.queue_id
      LEFT JOIN retry_policies rp ON rp.id = q.retry_policy_id
      WHERE j.status IN ('QUEUED', 'SCHEDULED')
        AND j.next_run_at <= NOW()
        AND q.is_paused = false
        AND q.is_deleted = false
        AND (
          SELECT COUNT(*)::int FROM jobs rj
          WHERE rj.queue_id = j.queue_id AND rj.status IN ('CLAIMED', 'RUNNING')
        ) < q.max_concurrency
      ORDER BY q.priority DESC, j.next_run_at ASC
      LIMIT 1
      FOR UPDATE OF j SKIP LOCKED
    `;

    if (!rows.length) return null;

    const job = rows[0];
    const attempt = job.executionCount + 1;

    await tx.job.update({
      where: { id: job.id },
      data: {
        status: 'CLAIMED',
        workerId,
        executionCount: attempt,
      },
    });

    await tx.jobExecution.create({
      data: {
        jobId: job.id,
        workerId,
        attempt,
        status: 'RUNNING',
      },
    });

    await tx.jobLog.create({
      data: {
        jobId: job.id,
        level: 'INFO',
        message: `Job claimed by worker ${workerId}`,
        metadata: { attempt },
      },
    });

    return job;
  });
}

export async function markJobRunning(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: { status: 'RUNNING' },
  });
}

export async function completeJob(
  jobId: string,
  workerId: string,
  result: Record<string, unknown>
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', workerId: null },
    });

    const execution = await tx.jobExecution.findFirst({
      where: { jobId, status: 'RUNNING' },
      orderBy: { startedAt: 'desc' },
    });

    if (execution) {
      const durationMs = now.getTime() - execution.startedAt.getTime();
      await tx.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          result: result as Prisma.InputJsonValue,
          durationMs,
        },
      });
    }

    await tx.jobLog.create({
      data: {
        jobId,
        level: 'INFO',
        message: 'Job completed successfully',
        metadata: result as Prisma.InputJsonValue,
      },
    });

    if (job.jobType === 'RECURRING' && job.intervalSeconds) {
      const nextRun = new Date(now.getTime() + job.intervalSeconds * 1000);
      await tx.job.update({
        where: { id: jobId },
        data: {
          status: 'SCHEDULED',
          nextRunAt: nextRun,
          workerId: null,
        },
      });
      await tx.scheduledJob.upsert({
        where: { jobId },
        create: {
          jobId,
          scheduledFor: nextRun,
          intervalSeconds: job.intervalSeconds,
          isActive: true,
        },
        update: {
          scheduledFor: nextRun,
          isActive: true,
        },
      });
      await tx.jobLog.create({
        data: {
          jobId,
          level: 'INFO',
          message: `Recurring job rescheduled for ${nextRun.toISOString()}`,
        },
      });
    }
  });
}

export async function failJob(
  jobId: string,
  workerId: string,
  errorMessage: string,
  retryDelaySeconds?: number
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { queue: { include: { retryPolicy: true } } },
  });
  if (!job) return;

  const now = new Date();
  const attempt = job.executionCount;

  await prisma.$transaction(async (tx) => {
    const execution = await tx.jobExecution.findFirst({
      where: { jobId, status: 'RUNNING' },
      orderBy: { startedAt: 'desc' },
    });

    if (execution) {
      const durationMs = now.getTime() - execution.startedAt.getTime();
      await tx.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: now,
          errorMessage,
          durationMs,
        },
      });
    }

    await tx.jobLog.create({
      data: {
        jobId,
        level: 'ERROR',
        message: errorMessage,
        metadata: { attempt },
      },
    });

    if (attempt < job.maxRetries && retryDelaySeconds !== undefined) {
      const nextRun = new Date(Date.now() + retryDelaySeconds * 1000);
      await tx.job.update({
        where: { id: jobId },
        data: {
          status: 'SCHEDULED',
          nextRunAt: nextRun,
          workerId: null,
        },
      });
      await tx.jobLog.create({
        data: {
          jobId,
          level: 'WARN',
          message: `Job scheduled for retry in ${retryDelaySeconds}s (attempt ${attempt}/${job.maxRetries})`,
        },
      });
    } else {
      await tx.job.update({
        where: { id: jobId },
        data: { status: 'FAILED', workerId: null },
      });
      await tx.deadLetterQueue.upsert({
        where: { jobId },
        create: {
          jobId,
          originalPayload: job.payload as Prisma.InputJsonValue,
          failureReason: errorMessage,
          retryCount: attempt,
        },
        update: {
          failureReason: errorMessage,
          retryCount: attempt,
          failedAt: now,
        },
      });
      await tx.jobLog.create({
        data: {
          jobId,
          level: 'ERROR',
          message: 'Job moved to Dead Letter Queue',
        },
      });
    }
  });
}

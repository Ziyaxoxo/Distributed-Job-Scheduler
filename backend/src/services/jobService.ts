import { JobStatus, JobType, RetryStrategy, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../models';
import { NotFoundError, ValidationError } from '../utils/errors';
import { assertQueueAccess } from './queueService';

export function computeRetryDelay(
  strategy: RetryStrategy,
  attempt: number,
  baseDelaySeconds: number,
  maxDelaySeconds: number
): number {
  let delay: number;
  switch (strategy) {
    case 'FIXED':
      delay = baseDelaySeconds;
      break;
    case 'LINEAR':
      delay = baseDelaySeconds * attempt;
      break;
    case 'EXPONENTIAL':
      delay = baseDelaySeconds * Math.pow(2, attempt - 1);
      break;
    default:
      delay = baseDelaySeconds;
  }
  return Math.min(delay, maxDelaySeconds);
}

export interface CreateJobInput {
  job_type: JobType;
  payload: Record<string, unknown>;
  max_retries?: number;
  delay_seconds?: number;
  scheduled_at?: string;
  interval_seconds?: number;
  batch_jobs?: Array<{ payload: Record<string, unknown> }>;
}

export async function createJob(queueId: string, userId: string, input: CreateJobInput) {
  const queue = await assertQueueAccess(queueId, userId);
  const maxRetries = input.max_retries ?? queue.retryPolicy?.maxRetries ?? 3;

  if (input.job_type === 'BATCH') {
    if (!input.batch_jobs?.length) {
      throw new ValidationError('batch_jobs array is required for BATCH job type');
    }
    const batchId = uuidv4();
    const jobs = await prisma.$transaction(
      input.batch_jobs.map((item) =>
        prisma.job.create({
          data: {
            queueId,
            batchId,
            jobType: 'BATCH',
            payload: item.payload as Prisma.InputJsonValue,
            maxRetries,
            status: 'QUEUED',
            nextRunAt: new Date(),
          },
        })
      )
    );
    return { batchId, jobs, count: jobs.length };
  }

  let status: JobStatus = 'QUEUED';
  let nextRunAt = new Date();
  let intervalSeconds: number | undefined;

  switch (input.job_type) {
    case 'IMMEDIATE':
      break;
    case 'DELAYED': {
      const delay = input.delay_seconds ?? 0;
      if (delay < 0) throw new ValidationError('delay_seconds must be non-negative');
      nextRunAt = new Date(Date.now() + delay * 1000);
      if (delay > 0) status = 'SCHEDULED';
      break;
    }
    case 'SCHEDULED': {
      if (!input.scheduled_at) throw new ValidationError('scheduled_at is required for SCHEDULED jobs');
      nextRunAt = new Date(input.scheduled_at);
      if (isNaN(nextRunAt.getTime())) throw new ValidationError('Invalid scheduled_at date');
      status = 'SCHEDULED';
      break;
    }
    case 'RECURRING': {
      intervalSeconds = input.interval_seconds;
      if (!intervalSeconds || intervalSeconds < 1) {
        throw new ValidationError('interval_seconds is required and must be >= 1 for RECURRING jobs');
      }
      if (input.scheduled_at) {
        nextRunAt = new Date(input.scheduled_at);
      } else if (input.delay_seconds) {
        nextRunAt = new Date(Date.now() + input.delay_seconds * 1000);
      }
      status = nextRunAt > new Date() ? 'SCHEDULED' : 'QUEUED';
      break;
    }
    default:
      throw new ValidationError(`Unsupported job_type: ${input.job_type}`);
  }

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.job.create({
      data: {
        queueId,
        jobType: input.job_type,
        payload: input.payload as Prisma.InputJsonValue,
        maxRetries,
        status,
        nextRunAt,
        intervalSeconds,
      },
    });

    if (input.job_type === 'SCHEDULED' || input.job_type === 'RECURRING') {
      await tx.scheduledJob.create({
        data: {
          jobId: created.id,
          scheduledFor: nextRunAt,
          intervalSeconds,
          isActive: true,
        },
      });
    }

    await tx.jobLog.create({
      data: {
        jobId: created.id,
        level: 'INFO',
        message: `Job created with type ${input.job_type}`,
        metadata: { status, nextRunAt: nextRunAt.toISOString() },
      },
    });

    return created;
  });

  return job;
}

export async function retryJob(jobId: string, userId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { queue: { include: { project: true } }, deadLetter: true },
  });
  if (!job) throw new NotFoundError('Job');
  if (job.queue.project.userId !== userId) {
    throw new ValidationError('Access denied');
  }
  if (!['FAILED', 'COMPLETED'].includes(job.status) && !job.deadLetter) {
    throw new ValidationError('Only failed or DLQ jobs can be retried');
  }

  return prisma.$transaction(async (tx) => {
    if (job.deadLetter) {
      await tx.deadLetterQueue.delete({ where: { jobId } });
    }
    const updated = await tx.job.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        nextRunAt: new Date(),
        workerId: null,
        executionCount: job.executionCount,
      },
    });
    await tx.jobLog.create({
      data: {
        jobId,
        level: 'INFO',
        message: 'Job manually retried',
      },
    });
    return updated;
  });
}

export async function getJob(jobId: string, userId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      queue: { include: { project: true, retryPolicy: true } },
      executions: { orderBy: { startedAt: 'desc' } },
      logs: { orderBy: { createdAt: 'asc' } },
      deadLetter: true,
      worker: true,
      scheduledJob: true,
    },
  });
  if (!job) throw new NotFoundError('Job');
  if (job.queue.project.userId !== userId) {
    throw new ValidationError('Access denied');
  }
  return job;
}

export async function listJobs(
  userId: string,
  filters: {
    queueId?: string;
    status?: JobStatus;
    jobType?: JobType;
    batchId?: string;
    from?: string;
    to?: string;
  },
  pagination: { page: number; limit: number; skip: number }
) {
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  const where: Record<string, unknown> = {
    queue: { projectId: { in: projectIds } },
  };
  if (filters.queueId) where.queueId = filters.queueId;
  if (filters.status) where.status = filters.status;
  if (filters.jobType) where.jobType = filters.jobType;
  if (filters.batchId) where.batchId = filters.batchId;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        queue: { select: { id: true, name: true } },
        worker: { select: { id: true, name: true } },
      },
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs, total };
}

export async function listDeadLetterJobs(userId: string, pagination: { skip: number; limit: number }) {
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true },
  });

  const where = {
    job: { queue: { projectId: { in: projects.map((p) => p.id) } } },
  };

  const [entries, total] = await Promise.all([
    prisma.deadLetterQueue.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { failedAt: 'desc' },
      include: {
        job: {
          include: { queue: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.deadLetterQueue.count({ where }),
  ]);

  return { entries, total };
}

export async function getSystemStats(userId: string) {
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  const [jobCounts, workerCounts, recentExecutions] = await Promise.all([
    prisma.job.groupBy({
      by: ['status'],
      where: { queue: { projectId: { in: projectIds } } },
      _count: { id: true },
    }),
    prisma.worker.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.jobExecution.findMany({
      where: {
        job: { queue: { projectId: { in: projectIds } } },
        completedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      select: { status: true, completedAt: true, durationMs: true },
      orderBy: { completedAt: 'asc' },
    }),
  ]);

  const jobsByStatus = Object.fromEntries(jobCounts.map((j) => [j.status, j._count.id]));
  const workersByStatus = Object.fromEntries(workerCounts.map((w) => [w.status, w._count.id]));

  const completed = recentExecutions.filter((e) => e.status === 'COMPLETED').length;
  const failed = recentExecutions.filter((e) => e.status === 'FAILED').length;
  const successRate = completed + failed > 0 ? (completed / (completed + failed)) * 100 : 100;

  return {
    jobsByStatus,
    workersByStatus,
    throughputLastHour: completed,
    successRate: Math.round(successRate * 100) / 100,
    recentExecutions: recentExecutions.slice(-20),
  };
}

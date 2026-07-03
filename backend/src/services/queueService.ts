import { RetryStrategy } from '@prisma/client';
import prisma from '../models';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { PaginationParams, paginationMeta } from '../utils/pagination';

async function assertQueueAccess(queueId: string, userId: string) {
  const queue = await prisma.queue.findFirst({
    where: { id: queueId, isDeleted: false },
    include: { project: true, retryPolicy: true },
  });
  if (!queue) throw new NotFoundError('Queue');
  if (queue.project.userId !== userId) throw new ForbiddenError('Access denied to this queue');
  return queue;
}

async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError('Project');
  if (project.userId !== userId) throw new ForbiddenError('Access denied to this project');
  return project;
}

export async function createQueue(
  projectId: string,
  userId: string,
  data: {
    name: string;
    priority?: number;
    maxConcurrency?: number;
    retryPolicyId?: string;
  }
) {
  await assertProjectAccess(projectId, userId);

  const existing = await prisma.queue.findFirst({
    where: { projectId, name: data.name, isDeleted: false },
  });
  if (existing) throw new ConflictError('Queue name already exists in this project');

  let retryPolicyId = data.retryPolicyId;
  if (!retryPolicyId) {
    const defaultPolicy = await prisma.retryPolicy.findFirst({ where: { name: 'default' } });
    retryPolicyId = defaultPolicy?.id;
  }

  return prisma.queue.create({
    data: {
      projectId,
      name: data.name,
      priority: data.priority ?? 1,
      maxConcurrency: data.maxConcurrency ?? 10,
      retryPolicyId,
    },
    include: { retryPolicy: true },
  });
}

export async function listQueues(projectId: string, userId: string, pagination: PaginationParams) {
  await assertProjectAccess(projectId, userId);
  const where = { projectId, isDeleted: false };
  const [queues, total] = await Promise.all([
    prisma.queue.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { retryPolicy: true, _count: { select: { jobs: true } } },
    }),
    prisma.queue.count({ where }),
  ]);
  return { queues, meta: paginationMeta(total, pagination.page, pagination.limit) };
}

export async function getQueue(queueId: string, userId: string) {
  return assertQueueAccess(queueId, userId);
}

export async function updateQueue(
  queueId: string,
  userId: string,
  data: {
    name?: string;
    priority?: number;
    maxConcurrency?: number;
    isPaused?: boolean;
    retryPolicyId?: string;
  }
) {
  await assertQueueAccess(queueId, userId);
  return prisma.queue.update({
    where: { id: queueId },
    data,
    include: { retryPolicy: true },
  });
}

export async function deleteQueue(queueId: string, userId: string) {
  await assertQueueAccess(queueId, userId);
  const jobCount = await prisma.job.count({
    where: {
      queueId,
      status: { in: ['QUEUED', 'SCHEDULED', 'CLAIMED', 'RUNNING'] },
    },
  });
  if (jobCount > 0) {
    throw new ValidationError('Cannot delete queue with active jobs. Pause the queue instead.');
  }
  return prisma.queue.update({
    where: { id: queueId },
    data: { isDeleted: true },
  });
}

export async function getQueueStats(queueId: string, userId: string) {
  const queue = await assertQueueAccess(queueId, userId);

  const statusCounts = await prisma.job.groupBy({
    by: ['status'],
    where: { queueId },
    _count: { id: true },
  });

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [completedLast24h, failedLast24h, avgDuration, dlqCount] = await Promise.all([
    prisma.job.count({
      where: { queueId, status: 'COMPLETED', updatedAt: { gte: last24h } },
    }),
    prisma.job.count({
      where: { queueId, status: 'FAILED', updatedAt: { gte: last24h } },
    }),
    prisma.jobExecution.aggregate({
      where: {
        job: { queueId },
        status: 'COMPLETED',
        completedAt: { gte: last24h },
      },
      _avg: { durationMs: true },
    }),
    prisma.deadLetterQueue.count({
      where: { job: { queueId } },
    }),
  ]);

  const byStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.id])
  );

  return {
    queue: {
      id: queue.id,
      name: queue.name,
      priority: queue.priority,
      maxConcurrency: queue.maxConcurrency,
      isPaused: queue.isPaused,
    },
    stats: {
      byStatus,
      completedLast24h,
      failedLast24h,
      avgDurationMs: Math.round(avgDuration._avg.durationMs || 0),
      deadLetterCount: dlqCount,
      throughputPerHour: completedLast24h / 24,
    },
  };
}

export async function listRetryPolicies() {
  return prisma.retryPolicy.findMany({ orderBy: { name: 'asc' } });
}

export async function createRetryPolicy(data: {
  name: string;
  strategy: RetryStrategy;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  maxRetries: number;
}) {
  return prisma.retryPolicy.create({ data });
}

export { assertQueueAccess };

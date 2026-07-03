import { Prisma } from '@prisma/client';
import os from 'os';
import prisma from '../models';
import { config } from '../config';
import { NotFoundError } from '../utils/errors';
import { PaginationParams, paginationMeta } from '../utils/pagination';

export async function registerWorker(name?: string) {
  const worker = await prisma.worker.create({
    data: {
      name: name || `worker-${os.hostname()}-${Date.now()}`,
      host: os.hostname(),
      status: 'ACTIVE',
      lastHeartbeat: new Date(),
    },
  });

  await prisma.workerHeartbeat.create({
    data: { workerId: worker.id },
  });

  return worker;
}

export async function sendHeartbeat(workerId: string, metadata?: Record<string, unknown>) {
  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw new NotFoundError('Worker');

  const now = new Date();
  await prisma.$transaction([
    prisma.worker.update({
      where: { id: workerId },
      data: { lastHeartbeat: now, status: 'ACTIVE' },
    }),
    prisma.workerHeartbeat.create({
      data: { workerId, metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined },
    }),
  ]);

  return { workerId, timestamp: now };
}

export async function listWorkers(pagination: PaginationParams) {
  const [workers, total] = await Promise.all([
    prisma.worker.findMany({
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { lastHeartbeat: 'desc' },
      include: {
        _count: {
          select: {
            jobs: { where: { status: { in: ['CLAIMED', 'RUNNING'] } } },
          },
        },
      },
    }),
    prisma.worker.count(),
  ]);

  return {
    workers: workers.map((w) => ({
      ...w,
      activeJobs: w._count.jobs,
    })),
    meta: paginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function getWorker(workerId: string) {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      jobs: {
        where: { status: { in: ['CLAIMED', 'RUNNING'] } },
        take: 20,
      },
      heartbeats: {
        orderBy: { timestamp: 'desc' },
        take: 10,
      },
    },
  });
  if (!worker) throw new NotFoundError('Worker');
  return worker;
}

export async function cleanupDeadWorkers() {
  const threshold = new Date(Date.now() - config.worker.deadThresholdSeconds * 1000);

  const deadWorkers = await prisma.worker.findMany({
    where: {
      status: 'ACTIVE',
      lastHeartbeat: { lt: threshold },
    },
  });

  for (const worker of deadWorkers) {
    await prisma.$transaction(async (tx) => {
      await tx.worker.update({
        where: { id: worker.id },
        data: { status: 'DEAD' },
      });

      const staleJobs = await tx.job.findMany({
        where: {
          workerId: worker.id,
          status: { in: ['CLAIMED', 'RUNNING'] },
        },
      });

      for (const job of staleJobs) {
        await tx.job.update({
          where: { id: job.id },
          data: {
            status: 'QUEUED',
            workerId: null,
            nextRunAt: new Date(),
          },
        });
        await tx.jobLog.create({
          data: {
            jobId: job.id,
            level: 'WARN',
            message: `Job requeued due to dead worker ${worker.name}`,
          },
        });
        await tx.jobExecution.updateMany({
          where: { jobId: job.id, status: 'RUNNING' },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: 'Worker died during execution',
          },
        });
      }
    });
  }

  return { cleaned: deadWorkers.length };
}

export async function deregisterWorker(workerId: string) {
  await prisma.worker.update({
    where: { id: workerId },
    data: { status: 'DEAD' },
  });
}

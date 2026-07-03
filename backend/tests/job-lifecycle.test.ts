import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { prisma } from './setup';
import { isDatabaseAvailable, seedTestData } from './helpers';
import { claimNextJob, markJobRunning, completeJob, failJob } from '../src/services/claimService';
import { registerWorker } from '../src/services/workerService';
import { computeRetryDelay } from '../src/services/jobService';

let dbAvailable = false;
let queueId = '';
let workerId = '';

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) return;
  const { queue } = await seedTestData(prisma);
  queueId = queue.id;
});

beforeEach(async () => {
  if (!dbAvailable) return;
  await prisma.jobLog.deleteMany({ where: { job: { queueId } } });
  await prisma.jobExecution.deleteMany({ where: { job: { queueId } } });
  await prisma.deadLetterQueue.deleteMany({ where: { job: { queueId } } });
  await prisma.job.deleteMany({ where: { queueId } });
  const worker = await registerWorker('lifecycle-test');
  workerId = worker.id;
});

describe('Job lifecycle', () => {
  it('transitions QUEUED -> RUNNING -> COMPLETED', async () => {
    if (!dbAvailable) return;
    const job = await prisma.job.create({
      data: {
        queueId,
        status: 'QUEUED',
        jobType: 'IMMEDIATE',
        payload: { type: 'echo' },
        nextRunAt: new Date(),
      },
    });

    const claimed = await claimNextJob(workerId);
    expect(claimed?.id).toBe(job.id);

    await markJobRunning(job.id);
    await completeJob(job.id, workerId, { ok: true });

    const updated = await prisma.job.findUnique({ where: { id: job.id } });
    expect(updated?.status).toBe('COMPLETED');

    const execution = await prisma.jobExecution.findFirst({
      where: { jobId: job.id },
    });
    expect(execution?.status).toBe('COMPLETED');
  });

  it('retries on failure then moves to DLQ', async () => {
    if (!dbAvailable) return;
    const job = await prisma.job.create({
      data: {
        queueId,
        status: 'QUEUED',
        jobType: 'IMMEDIATE',
        payload: { type: 'fail' },
        maxRetries: 2,
        nextRunAt: new Date(),
      },
    });

    const claimed = await claimNextJob(workerId);
    expect(claimed?.id).toBe(job.id);
    await markJobRunning(job.id);

    const delay = computeRetryDelay('EXPONENTIAL', 1, 2, 60);
    await failJob(job.id, workerId, 'Simulated failure', delay);

    let updated = await prisma.job.findUnique({ where: { id: job.id } });
    expect(updated?.status).toBe('SCHEDULED');

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'QUEUED', nextRunAt: new Date() },
    });

    const claimed2 = await claimNextJob(workerId);
    expect(claimed2?.id).toBe(job.id);
    await markJobRunning(job.id);
    await failJob(job.id, workerId, 'Final failure');

    updated = await prisma.job.findUnique({ where: { id: job.id } });
    expect(updated?.status).toBe('FAILED');

    const dlq = await prisma.deadLetterQueue.findUnique({ where: { jobId: job.id } });
    expect(dlq).toBeTruthy();
    expect(dlq?.failureReason).toBe('Final failure');
  });
});

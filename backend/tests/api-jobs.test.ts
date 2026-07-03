import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from './setup';
import { isDatabaseAvailable, seedTestData } from './helpers';
import { claimNextJob } from '../src/services/claimService';
import { registerWorker } from '../src/services/workerService';

const app = createApp();
let dbAvailable = false;
let token = '';
let queueId = '';

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) return;

  const { queue } = await seedTestData(prisma);
  queueId = queue.id;

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test@scheduler.local', password: 'testpass123' });
  if (login.status !== 200) {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@scheduler.local', password: 'testpass123' });
    const retry = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@scheduler.local', password: 'testpass123' });
    token = retry.body.token;
  } else {
    token = login.body.token;
  }
});

beforeEach(async () => {
  if (!dbAvailable) return;
  await prisma.jobLog.deleteMany({ where: { job: { queueId } } });
  await prisma.jobExecution.deleteMany({ where: { job: { queueId } } });
  await prisma.deadLetterQueue.deleteMany({ where: { job: { queueId } } });
  await prisma.scheduledJob.deleteMany({ where: { job: { queueId } } });
  await prisma.job.deleteMany({ where: { queueId } });
});

describe('Job API', () => {
  it('creates immediate job', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ job_type: 'IMMEDIATE', payload: { type: 'echo', msg: 'hi' } });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('QUEUED');
  });

  it('creates delayed job', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_type: 'DELAYED',
        delay_seconds: 60,
        payload: { type: 'echo' },
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SCHEDULED');
  });

  it('creates batch jobs', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_type: 'BATCH',
        payload: {},
        batch_jobs: [{ payload: { type: 'echo', n: 1 } }, { payload: { type: 'echo', n: 2 } }],
      });
    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
  });

  it('lists jobs with pagination', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 10, queue_id: queueId });
    expect(res.status).toBe(200);
    expect(res.body.meta).toBeDefined();
    expect(Array.isArray(res.body.jobs)).toBe(true);
  });
});

describe('Job claiming', () => {
  it('claims job atomically with SKIP LOCKED', async () => {
    if (!dbAvailable) return;
    await prisma.job.create({
      data: {
        queueId,
        status: 'QUEUED',
        jobType: 'IMMEDIATE',
        payload: { type: 'echo' },
        nextRunAt: new Date(),
      },
    });

    const w1 = await registerWorker('claim-test-1');
    const w2 = await registerWorker('claim-test-2');

    const [c1, c2] = await Promise.all([
      claimNextJob(w1.id),
      claimNextJob(w2.id),
    ]);

    const claimed = [c1, c2].filter(Boolean);
    expect(claimed.length).toBe(1);
    expect(claimed[0]?.id).toBeDefined();
  });

  it('respects queue max concurrency', async () => {
    if (!dbAvailable) return;
    await prisma.queue.update({
      where: { id: queueId },
      data: { maxConcurrency: 1 },
    });

    await prisma.job.createMany({
      data: [
        { queueId, status: 'QUEUED', jobType: 'IMMEDIATE', payload: { type: 'echo' }, nextRunAt: new Date() },
        { queueId, status: 'QUEUED', jobType: 'IMMEDIATE', payload: { type: 'echo' }, nextRunAt: new Date() },
      ],
    });

    const worker = await registerWorker('concurrency-test');
    await prisma.job.updateMany({
      where: { queueId, status: 'QUEUED' },
      data: { status: 'RUNNING', workerId: worker.id },
    });
    await prisma.job.create({
      data: {
        queueId,
        status: 'QUEUED',
        jobType: 'IMMEDIATE',
        payload: { type: 'echo' },
        nextRunAt: new Date(),
      },
    });

    const w2 = await registerWorker('concurrency-test-2');
    const claimed = await claimNextJob(w2.id);
    expect(claimed).toBeNull();

    await prisma.queue.update({ where: { id: queueId }, data: { maxConcurrency: 2 } });
  });
});

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });
dotenv.config();

export const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.jobLog.deleteMany();
  await prisma.jobExecution.deleteMany();
  await prisma.deadLetterQueue.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.job.deleteMany();
  await prisma.workerHeartbeat.deleteMany();
  await prisma.worker.deleteMany();
});

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

export async function seedTestData(prisma: PrismaClient) {
  const policy = await prisma.retryPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000099' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000099',
      name: 'test-policy',
      strategy: 'EXPONENTIAL',
      baseDelaySeconds: 2,
      maxDelaySeconds: 60,
      maxRetries: 3,
    },
  });

  const bcrypt = await import('bcryptjs');
  const user = await prisma.user.upsert({
    where: { email: 'test@scheduler.local' },
    update: {},
    create: {
      email: 'test@scheduler.local',
      passwordHash: await bcrypt.hash('testpass123', 12),
    },
  });

  const project = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000099' },
    update: { userId: user.id },
    create: {
      id: '00000000-0000-0000-0000-000000000099',
      userId: user.id,
      name: 'Test Project',
    },
  });

  const queue = await prisma.queue.upsert({
    where: { id: '00000000-0000-0000-0000-000000000098' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000098',
      projectId: project.id,
      retryPolicyId: policy.id,
      name: 'test-queue',
      priority: 10,
      maxConcurrency: 2,
    },
  });

  return { user, project, queue, policy };
}

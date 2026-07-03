import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const defaultPolicy = await prisma.retryPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'default',
      strategy: 'EXPONENTIAL',
      baseDelaySeconds: 5,
      maxDelaySeconds: 3600,
      maxRetries: 3,
    },
  });

  await prisma.retryPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'fixed-30s',
      strategy: 'FIXED',
      baseDelaySeconds: 30,
      maxDelaySeconds: 30,
      maxRetries: 5,
    },
  });

  const passwordHash = await bcrypt.hash('password123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@scheduler.local' },
    update: {},
    create: {
      email: 'demo@scheduler.local',
      passwordHash,
    },
  });

  const project = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      userId: user.id,
      name: 'Demo Project',
      description: 'Sample project for testing the job scheduler',
    },
  });

  await prisma.queue.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      projectId: project.id,
      retryPolicyId: defaultPolicy.id,
      name: 'default-queue',
      priority: 5,
      maxConcurrency: 10,
    },
  });

  console.log('Seed completed:', { user: user.email, project: project.name });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

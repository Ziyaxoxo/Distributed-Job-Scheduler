import prisma from '../models';

export type JobHandler = (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

const handlers: Record<string, JobHandler> = {
  echo: async (payload) => ({
    echoed: payload,
    processedAt: new Date().toISOString(),
  }),

  fail: async (payload) => {
    const message = (payload.message as string) || 'Simulated failure';
    throw new Error(message);
  },

  slow: async (payload) => {
    const delayMs = (payload.delay_ms as number) || 2000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return { completedAfterMs: delayMs };
  },

  compute: async (payload) => {
    const a = Number(payload.a ?? 0);
    const b = Number(payload.b ?? 0);
    const op = (payload.op as string) || 'add';
    let result: number;
    switch (op) {
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      default:
        result = a + b;
    }
    return { result, op, a, b };
  },
};

export function getHandler(type: string): JobHandler {
  return handlers[type] || handlers.echo;
}

export async function executeJob(
  jobId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const type = (payload.type as string) || 'echo';
  const handler = getHandler(type);

  await prisma.jobLog.create({
    data: {
      jobId,
      level: 'INFO',
      message: `Executing handler: ${type}`,
    },
  });

  return handler(payload);
}

export function registerHandler(type: string, handler: JobHandler) {
  handlers[type] = handler;
}

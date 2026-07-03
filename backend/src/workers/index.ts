import { RetryStrategy } from '@prisma/client';
import { config } from '../config';
import {
  claimNextJob,
  markJobRunning,
  completeJob,
  failJob,
  ClaimedJob,
} from '../services/claimService';
import { computeRetryDelay } from '../services/jobService';
import { registerWorker, sendHeartbeat, deregisterWorker, cleanupDeadWorkers } from '../services/workerService';
import { executeJob } from './handlers';
import prisma from '../models';

export class WorkerProcess {
  private workerId: string | null = null;
  private running = false;
  private shuttingDown = false;
  private activeJobs = new Set<string>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  async start(name?: string) {
    const worker = await registerWorker(name);
    this.workerId = worker.id;
    this.running = true;

    console.log(`Worker started: ${worker.name} (${worker.id})`);

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat().catch(console.error);
    }, config.worker.heartbeatIntervalMs);

    this.cleanupTimer = setInterval(() => {
      cleanupDeadWorkers().catch(console.error);
    }, config.worker.deadThresholdSeconds * 1000);

    this.poll();
  }

  private async sendHeartbeat() {
    if (!this.workerId) return;
    await sendHeartbeat(this.workerId, {
      activeJobs: this.activeJobs.size,
      pid: process.pid,
    });
  }

  private poll() {
    if (!this.running) return;

    const loop = async () => {
      if (this.shuttingDown) return;

      while (
        this.activeJobs.size < config.worker.maxConcurrentJobs &&
        !this.shuttingDown
      ) {
        const claimed = await this.tryClaim();
        if (!claimed) break;
        this.runJob(claimed).catch(console.error);
      }

      this.pollTimer = setTimeout(loop, config.worker.pollIntervalMs);
    };

    loop().catch(console.error);
  }

  private async tryClaim(): Promise<ClaimedJob | null> {
    if (!this.workerId) return null;
    return claimNextJob(this.workerId);
  }

  private async runJob(job: ClaimedJob) {
    if (!this.workerId) return;

    this.activeJobs.add(job.id);
    const payload = job.payload as Record<string, unknown>;
    try {
      await markJobRunning(job.id);
      const result = await executeJob(job.id, payload);
      await completeJob(job.id, this.workerId, result);
      console.log(`Job ${job.id} completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const strategy = (job.retryStrategy || 'EXPONENTIAL') as RetryStrategy;
      const delay = computeRetryDelay(
        strategy,
        job.executionCount,
        job.baseDelaySeconds,
        job.maxDelaySeconds
      );

      const shouldRetry = job.executionCount < job.maxRetries;
      await failJob(job.id, this.workerId, message, shouldRetry ? delay : undefined);
      console.log(`Job ${job.id} failed: ${message}${shouldRetry ? ` (retry in ${delay}s)` : ' (DLQ)'}`);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  async shutdown() {
    console.log('Graceful shutdown initiated...');
    this.shuttingDown = true;
    this.running = false;

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

    const waitStart = Date.now();
    while (this.activeJobs.size > 0 && Date.now() - waitStart < 30000) {
      console.log(`Waiting for ${this.activeJobs.size} active job(s)...`);
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (this.workerId) {
      await deregisterWorker(this.workerId);
    }

    await prisma.$disconnect();
    console.log('Worker shutdown complete');
  }
}

async function main() {
  const worker = new WorkerProcess();
  const name = process.env.WORKER_NAME;

  process.on('SIGINT', () => worker.shutdown().then(() => process.exit(0)));
  process.on('SIGTERM', () => worker.shutdown().then(() => process.exit(0)));

  await worker.start(name);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Worker failed to start:', err);
    process.exit(1);
  });
}

export default WorkerProcess;

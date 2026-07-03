import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import * as projectService from '../services/projectService';
import * as queueService from '../services/queueService';
import * as jobService from '../services/jobService';
import * as workerService from '../services/workerService';
import { parsePagination, paginationMeta } from '../utils/pagination';
import { paramId } from '../utils/params';
import { JobStatus, JobType, RetryStrategy } from '@prisma/client';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.registerUser(body.email, body.password);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.loginUser(body.email, body.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getUserById(req.user!.userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

const projectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const body = projectSchema.parse(req.body);
    const project = await projectService.createProject(req.user!.userId, body.name, body.description);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
}

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query);
    const result = await projectService.listProjects(req.user!.userId, pagination);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.getProject(paramId(req.params.id), req.user!.userId);
    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const body = projectSchema.partial().parse(req.body);
    const project = await projectService.updateProject(paramId(req.params.id), req.user!.userId, body);
    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    await projectService.deleteProject(paramId(req.params.id), req.user!.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

const queueSchema = z.object({
  name: z.string().min(1).max(255),
  priority: z.number().int().min(0).max(100).optional(),
  max_concurrency: z.number().int().min(1).max(1000).optional(),
  retry_policy_id: z.string().uuid().optional(),
});

const queueUpdateSchema = queueSchema.partial().extend({
  is_paused: z.boolean().optional(),
});

export async function createQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const body = queueSchema.parse(req.body);
    const queue = await queueService.createQueue(paramId(req.params.projectId), req.user!.userId, {
      name: body.name,
      priority: body.priority,
      maxConcurrency: body.max_concurrency,
      retryPolicyId: body.retry_policy_id,
    });
    res.status(201).json(queue);
  } catch (err) {
    next(err);
  }
}

export async function listQueues(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query);
    const result = await queueService.listQueues(paramId(req.params.projectId), req.user!.userId, pagination);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const queue = await queueService.getQueue(paramId(req.params.id), req.user!.userId);
    res.json(queue);
  } catch (err) {
    next(err);
  }
}

export async function updateQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const body = queueUpdateSchema.parse(req.body);
    const queue = await queueService.updateQueue(paramId(req.params.id), req.user!.userId, {
      name: body.name,
      priority: body.priority,
      maxConcurrency: body.max_concurrency,
      isPaused: body.is_paused,
      retryPolicyId: body.retry_policy_id,
    });
    res.json(queue);
  } catch (err) {
    next(err);
  }
}

export async function deleteQueue(req: Request, res: Response, next: NextFunction) {
  try {
    await queueService.deleteQueue(paramId(req.params.id), req.user!.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getQueueStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await queueService.getQueueStats(paramId(req.params.id), req.user!.userId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

const jobCreateSchema = z.object({
  job_type: z.nativeEnum(JobType),
  payload: z.record(z.unknown()),
  max_retries: z.number().int().min(0).max(20).optional(),
  delay_seconds: z.number().int().min(0).optional(),
  scheduled_at: z.string().datetime().optional(),
  interval_seconds: z.number().int().min(1).optional(),
  batch_jobs: z.array(z.object({ payload: z.record(z.unknown()) })).optional(),
});

export async function createJob(req: Request, res: Response, next: NextFunction) {
  try {
    const body = jobCreateSchema.parse(req.body);
    const job = await jobService.createJob(paramId(req.params.queueId), req.user!.userId, body);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
}

export async function listJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query);
    const filters = {
      queueId: req.query.queue_id as string | undefined,
      status: req.query.status as JobStatus | undefined,
      jobType: req.query.job_type as JobType | undefined,
      batchId: req.query.batch_id as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    };
    const { jobs, total } = await jobService.listJobs(req.user!.userId, filters, pagination);
    res.json({ jobs, meta: paginationMeta(total, pagination.page, pagination.limit) });
  } catch (err) {
    next(err);
  }
}

export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobService.getJob(paramId(req.params.id), req.user!.userId);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function retryJob(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobService.retryJob(paramId(req.params.id), req.user!.userId);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function listDlq(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query);
    const { entries, total } = await jobService.listDeadLetterJobs(req.user!.userId, pagination);
    res.json({ entries, meta: paginationMeta(total, pagination.page, pagination.limit) });
  } catch (err) {
    next(err);
  }
}

export async function getSystemStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await jobService.getSystemStats(req.user!.userId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

export async function registerWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const name = req.body?.name as string | undefined;
    const worker = await workerService.registerWorker(name);
    res.status(201).json(worker);
  } catch (err) {
    next(err);
  }
}

export async function heartbeat(req: Request, res: Response, next: NextFunction) {
  try {
    const workerId = req.body.worker_id as string;
    if (!workerId) {
      res.status(400).json({ error: { message: 'worker_id is required' } });
      return;
    }
    const result = await workerService.sendHeartbeat(workerId, req.body.metadata);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listWorkers(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req.query);
    const result = await workerService.listWorkers(pagination);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const worker = await workerService.getWorker(paramId(req.params.id));
    res.json(worker);
  } catch (err) {
    next(err);
  }
}

export async function listRetryPolicies(_req: Request, res: Response, next: NextFunction) {
  try {
    const policies = await queueService.listRetryPolicies();
    res.json(policies);
  } catch (err) {
    next(err);
  }
}

const retryPolicySchema = z.object({
  name: z.string().min(1),
  strategy: z.nativeEnum(RetryStrategy),
  base_delay_seconds: z.number().int().min(1),
  max_delay_seconds: z.number().int().min(1),
  max_retries: z.number().int().min(0).max(20),
});

export async function createRetryPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const body = retryPolicySchema.parse(req.body);
    const policy = await queueService.createRetryPolicy({
      name: body.name,
      strategy: body.strategy,
      baseDelaySeconds: body.base_delay_seconds,
      maxDelaySeconds: body.max_delay_seconds,
      maxRetries: body.max_retries,
    });
    res.status(201).json(policy);
  } catch (err) {
    next(err);
  }
}

export async function health(_req: Request, res: Response) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as ctrl from '../controllers';

const router = Router();

router.get('/health', ctrl.health);

router.post('/auth/register', ctrl.register);
router.post('/auth/login', ctrl.login);
router.get('/auth/me', authenticate, ctrl.me);

router.get('/stats', authenticate, ctrl.getSystemStats);

router.get('/projects', authenticate, ctrl.listProjects);
router.post('/projects', authenticate, ctrl.createProject);
router.get('/projects/:id', authenticate, ctrl.getProject);
router.patch('/projects/:id', authenticate, ctrl.updateProject);
router.delete('/projects/:id', authenticate, ctrl.deleteProject);

router.get('/projects/:projectId/queues', authenticate, ctrl.listQueues);
router.post('/projects/:projectId/queues', authenticate, ctrl.createQueue);

router.get('/queues/:id', authenticate, ctrl.getQueue);
router.patch('/queues/:id', authenticate, ctrl.updateQueue);
router.delete('/queues/:id', authenticate, ctrl.deleteQueue);
router.get('/queues/:id/stats', authenticate, ctrl.getQueueStats);
router.post('/queues/:queueId/jobs', authenticate, ctrl.createJob);

router.get('/jobs', authenticate, ctrl.listJobs);
router.get('/jobs/:id', authenticate, ctrl.getJob);
router.post('/jobs/:id/retry', authenticate, ctrl.retryJob);

router.get('/dlq', authenticate, ctrl.listDlq);

router.get('/retry-policies', authenticate, ctrl.listRetryPolicies);
router.post('/retry-policies', authenticate, ctrl.createRetryPolicy);

router.post('/workers/register', ctrl.registerWorker);
router.post('/workers/heartbeat', ctrl.heartbeat);
router.get('/workers', authenticate, ctrl.listWorkers);
router.get('/workers/:id', authenticate, ctrl.getWorker);

export default router;

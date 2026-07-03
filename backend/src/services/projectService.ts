import prisma from '../models';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { PaginationParams, paginationMeta } from '../utils/pagination';

async function assertProjectOwnership(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError('Project');
  if (project.userId !== userId) throw new ForbiddenError('Access denied to this project');
  return project;
}

export async function createProject(userId: string, name: string, description?: string) {
  return prisma.project.create({
    data: { userId, name, description },
  });
}

export async function listProjects(userId: string, pagination: PaginationParams) {
  const where = { userId };
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { queues: true } } },
    }),
    prisma.project.count({ where }),
  ]);
  return { projects, meta: paginationMeta(total, pagination.page, pagination.limit) };
}

export async function getProject(projectId: string, userId: string) {
  const project = await assertProjectOwnership(projectId, userId);
  const queues = await prisma.queue.findMany({
    where: { projectId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
  });
  return { ...project, queues };
}

export async function updateProject(
  projectId: string,
  userId: string,
  data: { name?: string; description?: string }
) {
  await assertProjectOwnership(projectId, userId);
  return prisma.project.update({ where: { id: projectId }, data });
}

export async function deleteProject(projectId: string, userId: string) {
  await assertProjectOwnership(projectId, userId);
  await prisma.project.delete({ where: { id: projectId } });
}

import { useEffect, useState } from 'react';
import { projectsApi, queuesApi, retryPoliciesApi } from '../api';

interface Project {
  id: string;
  name: string;
  description?: string;
  _count?: { queues: number };
}

interface RetryPolicy {
  id: string;
  name: string;
  strategy: string;
}

interface Queue {
  id: string;
  name: string;
  priority: number;
  maxConcurrency: number;
  isPaused: boolean;
  retryPolicyId?: string;
  retryPolicy?: RetryPolicy;
}

interface QueueStats {
  stats: {
    byStatus: Record<string, number>;
    completedLast24h: number;
    failedLast24h: number;
    avgDurationMs: number;
    deadLetterCount: number;
    throughputPerHour: number;
  };
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [policies, setPolicies] = useState<RetryPolicy[]>([]);
  const [newName, setNewName] = useState('');
  const [queueName, setQueueName] = useState('');
  const [queuePriority, setQueuePriority] = useState('5');
  const [queueConcurrency, setQueueConcurrency] = useState('10');
  const [queuePolicyId, setQueuePolicyId] = useState('');
  const [editingQueue, setEditingQueue] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ priority: '', maxConcurrency: '', retryPolicyId: '' });
  const [statsQueue, setStatsQueue] = useState<QueueStats | null>(null);
  const [statsFor, setStatsFor] = useState<string | null>(null);

  const loadProjects = () => projectsApi.list().then((r) => setProjects(r.projects));
  const loadQueues = (projectId: string) =>
    queuesApi.list(projectId).then((r) => setQueues(r.queues));

  useEffect(() => {
    loadProjects();
    retryPoliciesApi.list().then(setPolicies);
    const id = setInterval(loadProjects, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (selected) loadQueues(selected.id);
  }, [selected]);

  const createProject = async () => {
    if (!newName.trim()) return;
    await projectsApi.create(newName);
    setNewName('');
    loadProjects();
  };

  const createQueue = async () => {
    if (!selected || !queueName.trim()) return;
    await queuesApi.create(selected.id, {
      name: queueName,
      priority: parseInt(queuePriority, 10) || 5,
      max_concurrency: parseInt(queueConcurrency, 10) || 10,
      retry_policy_id: queuePolicyId || undefined,
    });
    setQueueName('');
    loadQueues(selected.id);
  };

  const togglePause = async (queue: Queue) => {
    await queuesApi.update(queue.id, { is_paused: !queue.isPaused });
    if (selected) loadQueues(selected.id);
  };

  const startEdit = (queue: Queue) => {
    setEditingQueue(queue.id);
    setEditForm({
      priority: String(queue.priority),
      maxConcurrency: String(queue.maxConcurrency),
      retryPolicyId: queue.retryPolicyId || queue.retryPolicy?.id || '',
    });
    setStatsQueue(null);
    setStatsFor(null);
  };

  const saveEdit = async (queueId: string) => {
    await queuesApi.update(queueId, {
      priority: parseInt(editForm.priority, 10),
      max_concurrency: parseInt(editForm.maxConcurrency, 10),
      retry_policy_id: editForm.retryPolicyId || undefined,
    });
    setEditingQueue(null);
    if (selected) loadQueues(selected.id);
  };

  const loadStats = async (queueId: string) => {
    const data = await queuesApi.stats(queueId);
    setStatsQueue(data);
    setStatsFor(queueId);
    setEditingQueue(null);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Projects & Queues</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium mb-4">Projects</h3>
          <div className="flex gap-2 mb-4">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New project name"
              className="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
            />
            <button onClick={createProject} className="px-4 py-2 bg-indigo-600 rounded text-sm">
              Add
            </button>
          </div>
          <ul className="space-y-2">
            {projects.map((p) => (
              <li
                key={p.id}
                onClick={() => setSelected(p)}
                className={`p-3 rounded cursor-pointer ${selected?.id === p.id ? 'bg-indigo-900/50 border border-indigo-700' : 'bg-slate-800 hover:bg-slate-750'}`}
              >
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-slate-400">{p._count?.queues ?? 0} queues</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium mb-4">
            {selected ? `Queues — ${selected.name}` : 'Select a project'}
          </h3>
          {selected && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <input
                  value={queueName}
                  onChange={(e) => setQueueName(e.target.value)}
                  placeholder="Queue name"
                  className="col-span-2 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                />
                <input
                  type="number"
                  value={queuePriority}
                  onChange={(e) => setQueuePriority(e.target.value)}
                  placeholder="Priority"
                  className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                />
                <input
                  type="number"
                  value={queueConcurrency}
                  onChange={(e) => setQueueConcurrency(e.target.value)}
                  placeholder="Max concurrency"
                  className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                />
                <select
                  value={queuePolicyId}
                  onChange={(e) => setQueuePolicyId(e.target.value)}
                  className="col-span-2 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                >
                  <option value="">Default retry policy</option>
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.strategy})</option>
                  ))}
                </select>
                <button onClick={createQueue} className="col-span-2 px-4 py-2 bg-indigo-600 rounded text-sm">
                  Add Queue
                </button>
              </div>
              <ul className="space-y-2">
                {queues.map((q) => (
                  <li key={q.id} className="p-3 bg-slate-800 rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{q.name}</p>
                        <p className="text-xs text-slate-400">
                          Priority {q.priority} · Concurrency {q.maxConcurrency}
                          {q.retryPolicy && ` · Retry: ${q.retryPolicy.name}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => loadStats(q.id)} className="text-xs px-2 py-1 bg-slate-700 rounded">
                          Stats
                        </button>
                        <button onClick={() => startEdit(q)} className="text-xs px-2 py-1 bg-slate-700 rounded">
                          Edit
                        </button>
                        <button
                          onClick={() => togglePause(q)}
                          className={`text-xs px-2 py-1 rounded ${q.isPaused ? 'bg-emerald-700' : 'bg-amber-700'}`}
                        >
                          {q.isPaused ? 'Resume' : 'Pause'}
                        </button>
                      </div>
                    </div>
                    {editingQueue === q.id && (
                      <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={editForm.priority}
                          onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                          placeholder="Priority"
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-xs"
                        />
                        <input
                          type="number"
                          value={editForm.maxConcurrency}
                          onChange={(e) => setEditForm({ ...editForm, maxConcurrency: e.target.value })}
                          placeholder="Concurrency"
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-xs"
                        />
                        <select
                          value={editForm.retryPolicyId}
                          onChange={(e) => setEditForm({ ...editForm, retryPolicyId: e.target.value })}
                          className="col-span-2 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-xs"
                        >
                          <option value="">Default retry policy</option>
                          {policies.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.strategy})</option>
                          ))}
                        </select>
                        <button onClick={() => saveEdit(q.id)} className="text-xs px-2 py-1 bg-indigo-600 rounded">
                          Save
                        </button>
                        <button onClick={() => setEditingQueue(null)} className="text-xs px-2 py-1 bg-slate-700 rounded">
                          Cancel
                        </button>
                      </div>
                    )}
                    {statsFor === q.id && statsQueue && (
                      <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-300 grid grid-cols-2 gap-1">
                        <span>Completed (24h): {statsQueue.stats.completedLast24h}</span>
                        <span>Failed (24h): {statsQueue.stats.failedLast24h}</span>
                        <span>Avg duration: {statsQueue.stats.avgDurationMs}ms</span>
                        <span>Throughput/hr: {statsQueue.stats.throughputPerHour.toFixed(1)}</span>
                        <span>DLQ count: {statsQueue.stats.deadLetterCount}</span>
                        <span className="col-span-2 mt-1">
                          By status: {Object.entries(statsQueue.stats.byStatus).map(([k, v]) => `${k}:${v}`).join(' · ')}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

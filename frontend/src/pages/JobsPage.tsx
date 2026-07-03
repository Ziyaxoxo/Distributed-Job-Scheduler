import { useEffect, useState } from 'react';
import { jobsApi, listAllQueues } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { CreateJobForm } from '../components/CreateJobForm';

interface Job {
  id: string;
  status: string;
  jobType: string;
  createdAt: string;
  queue: { id: string; name: string };
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [queues, setQueues] = useState<Array<{ id: string; name: string; projectName: string }>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    jobsApi.list(params).then((r) => setJobs(r.jobs));
  };

  useEffect(() => {
    load();
    listAllQueues().then(setQueues);
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [statusFilter]);

  const viewJob = async (id: string) => {
    const job = await jobsApi.get(id);
    setSelected(job);
  };

  const retry = async (id: string) => {
    await jobsApi.retry(id);
    load();
    if (selected && (selected as { id: string }).id === id) {
      viewJob(id);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Job Explorer</h2>
      <CreateJobForm queues={queues} onCreated={load} />
      <div className="flex gap-2 mb-4">
        {['', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-sm ${statusFilter === s ? 'bg-indigo-600' : 'bg-slate-800'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Queue</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr
                  key={j.id}
                  onClick={() => viewJob(j.id)}
                  className="border-t border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                >
                  <td className="p-3 font-mono text-xs">{j.id.slice(0, 8)}...</td>
                  <td className="p-3">{j.queue.name}</td>
                  <td className="p-3"><StatusBadge status={j.status} /></td>
                  <td className="p-3">{j.jobType}</td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-slate-500">No jobs yet — create one above</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {selected && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-medium">Job Detail</h3>
              {['FAILED', 'COMPLETED'].includes(selected.status as string) && (
                <button onClick={() => retry(selected.id as string)} className="text-xs px-2 py-1 bg-indigo-600 rounded">
                  Retry
                </button>
              )}
            </div>
            <pre className="text-xs bg-slate-950 p-3 rounded overflow-auto max-h-48 mb-4">
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
            <h4 className="text-sm font-medium mb-2">Execution Logs</h4>
            <ul className="text-xs space-y-1 max-h-40 overflow-auto">
              {(selected.logs as Array<{ level: string; message: string; createdAt: string }>)?.map((l, i) => (
                <li key={i} className="text-slate-400">
                  <span className={l.level === 'ERROR' ? 'text-red-400' : ''}>[{l.level}]</span> {l.message}
                </li>
              ))}
            </ul>
            <h4 className="text-sm font-medium mt-4 mb-2">Executions</h4>
            <ul className="text-xs space-y-1">
              {(selected.executions as Array<{ attempt: number; status: string; errorMessage?: string }>)?.map((e, i) => (
                <li key={i}>Attempt {e.attempt}: {e.status} {e.errorMessage && `— ${e.errorMessage}`}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { dlqApi, jobsApi } from '../api';

interface DlqEntry {
  id: string;
  failureReason: string;
  failedAt: string;
  retryCount: number;
  job: { id: string; queue: { name: string } };
}

export function DlqPage() {
  const [entries, setEntries] = useState<DlqEntry[]>([]);

  const load = () => dlqApi.list().then((r) => setEntries(r.entries));

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const retry = async (jobId: string) => {
    await jobsApi.retry(jobId);
    load();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dead Letter Queue</h2>
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-400">
            <tr>
              <th className="text-left p-3">Job ID</th>
              <th className="text-left p-3">Queue</th>
              <th className="text-left p-3">Failure Reason</th>
              <th className="text-left p-3">Retries</th>
              <th className="text-left p-3">Failed At</th>
              <th className="text-left p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-800">
                <td className="p-3 font-mono text-xs">{e.job.id.slice(0, 8)}...</td>
                <td className="p-3">{e.job.queue.name}</td>
                <td className="p-3 text-red-400 max-w-xs truncate">{e.failureReason}</td>
                <td className="p-3">{e.retryCount}</td>
                <td className="p-3 text-slate-400">{new Date(e.failedAt).toLocaleString()}</td>
                <td className="p-3">
                  <button onClick={() => retry(e.job.id)} className="text-xs px-2 py-1 bg-indigo-600 rounded">
                    Retry
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-500">No dead letter entries</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

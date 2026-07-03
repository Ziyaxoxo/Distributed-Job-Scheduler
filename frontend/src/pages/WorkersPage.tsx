import { useEffect, useState } from 'react';
import { workersApi } from '../api';
import { StatusBadge } from '../components/StatusBadge';

interface Worker {
  id: string;
  name: string;
  host: string;
  status: string;
  lastHeartbeat: string;
  activeJobs: number;
}

export function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    const load = () => workersApi.list().then((r) => setWorkers(r.workers));
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Workers</h2>
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-400">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Host</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Active Jobs</th>
              <th className="text-left p-3">Last Heartbeat</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} className="border-t border-slate-800">
                <td className="p-3">{w.name}</td>
                <td className="p-3">{w.host}</td>
                <td className="p-3"><StatusBadge status={w.status} /></td>
                <td className="p-3">{w.activeJobs}</td>
                <td className="p-3 text-slate-400">{new Date(w.lastHeartbeat).toLocaleString()}</td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500">No workers registered</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

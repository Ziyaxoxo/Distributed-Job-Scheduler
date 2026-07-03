import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { statsApi } from '../api';

export function DashboardPage() {
  const [stats, setStats] = useState<{
    jobsByStatus: Record<string, number>;
    workersByStatus: Record<string, number>;
    throughputLastHour: number;
    successRate: number;
  } | null>(null);

  const load = () => statsApi.system().then(setStats).catch(console.error);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  if (!stats) return <p className="text-slate-400">Loading...</p>;

  const chartData = Object.entries(stats.jobsByStatus).map(([status, count]) => ({
    status,
    count,
  }));

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">System Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Throughput (1h)" value={stats.throughputLastHour} />
        <StatCard label="Success Rate" value={`${stats.successRate}%`} />
        <StatCard label="Active Workers" value={stats.workersByStatus.ACTIVE || 0} />
        <StatCard label="Dead Workers" value={stats.workersByStatus.DEAD || 0} />
      </div>
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <h3 className="font-medium mb-4">Jobs by Status</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <XAxis dataKey="status" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <p className="text-slate-400 text-sm">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

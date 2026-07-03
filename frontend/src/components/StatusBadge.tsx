const colors: Record<string, string> = {
  QUEUED: 'bg-slate-600',
  SCHEDULED: 'bg-blue-600',
  CLAIMED: 'bg-yellow-600',
  RUNNING: 'bg-amber-500',
  COMPLETED: 'bg-emerald-600',
  FAILED: 'bg-red-600',
  ACTIVE: 'bg-emerald-600',
  DEAD: 'bg-red-600',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium text-white ${colors[status] || 'bg-slate-500'}`}>
      {status}
    </span>
  );
}

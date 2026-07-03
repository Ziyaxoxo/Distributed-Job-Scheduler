import { useState } from 'react';
import { jobsApi } from '../api';

const JOB_TYPES = ['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH'] as const;
const PAYLOAD_TEMPLATES: Record<string, string> = {
  echo: '{\n  "type": "echo",\n  "message": "hello world"\n}',
  fail: '{\n  "type": "fail",\n  "message": "simulated failure"\n}',
  slow: '{\n  "type": "slow",\n  "delay_ms": 3000\n}',
  compute: '{\n  "type": "compute",\n  "a": 10,\n  "b": 5,\n  "op": "add"\n}',
};

interface Props {
  queues: Array<{ id: string; name: string; projectName: string }>;
  onCreated: () => void;
}

export function CreateJobForm({ queues, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [queueId, setQueueId] = useState('');
  const [jobType, setJobType] = useState<string>('IMMEDIATE');
  const [payload, setPayload] = useState(PAYLOAD_TEMPLATES.echo);
  const [delaySeconds, setDelaySeconds] = useState('30');
  const [scheduledAt, setScheduledAt] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState('60');
  const [maxRetries, setMaxRetries] = useState('3');
  const [batchCount, setBatchCount] = useState('3');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueId) {
      setError('Select a queue');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let parsed: Record<string, unknown>;
      if (jobType !== 'BATCH') {
        parsed = JSON.parse(payload);
      } else {
        parsed = { type: 'echo' };
      }

      const body: Record<string, unknown> = {
        job_type: jobType,
        payload: parsed,
        max_retries: parseInt(maxRetries, 10) || 3,
      };

      if (jobType === 'DELAYED') body.delay_seconds = parseInt(delaySeconds, 10) || 0;
      if (jobType === 'SCHEDULED' || jobType === 'RECURRING') {
        body.scheduled_at = scheduledAt || new Date(Date.now() + 60000).toISOString();
      }
      if (jobType === 'RECURRING') body.interval_seconds = parseInt(intervalSeconds, 10) || 60;
      if (jobType === 'BATCH') {
        const count = parseInt(batchCount, 10) || 2;
        body.batch_jobs = Array.from({ length: count }, (_, i) => ({
          payload: { type: 'echo', batch_index: i + 1 },
        }));
      }

      await jobsApi.create(queueId, body);
      setOpen(false);
      onCreated();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Failed to create job. Check payload JSON.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium"
      >
        + Create Job
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mb-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Create New Job</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white text-sm">
          Cancel
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Queue</label>
          <select
            value={queueId}
            onChange={(e) => setQueueId(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
          >
            <option value="">Select queue...</option>
            {queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.projectName} / {q.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Job Type</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
          >
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Max Retries</label>
          <input
            type="number"
            value={maxRetries}
            onChange={(e) => setMaxRetries(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
          />
        </div>
        {jobType === 'DELAYED' && (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Delay (seconds)</label>
            <input
              type="number"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
            />
          </div>
        )}
        {(jobType === 'SCHEDULED' || jobType === 'RECURRING') && (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Scheduled At (ISO)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(new Date(e.target.value).toISOString())}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
            />
          </div>
        )}
        {jobType === 'RECURRING' && (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Interval (seconds)</label>
            <input
              type="number"
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
            />
          </div>
        )}
        {jobType === 'BATCH' && (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Batch Size</label>
            <input
              type="number"
              value={batchCount}
              onChange={(e) => setBatchCount(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
            />
          </div>
        )}
      </div>

      {jobType !== 'BATCH' && (
        <div className="mt-4">
          <div className="flex gap-2 mb-2">
            <label className="text-xs text-slate-400">Payload (JSON)</label>
            <div className="flex gap-1 ml-auto">
              {Object.keys(PAYLOAD_TEMPLATES).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPayload(PAYLOAD_TEMPLATES[key])}
                  className="text-xs px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-mono"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Enqueue Job'}
      </button>
    </form>
  );
}

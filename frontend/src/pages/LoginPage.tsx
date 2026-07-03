import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { setToken } from '../api/client';

export function LoginPage() {
  const [email, setEmail] = useState('demo@scheduler.local');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await authApi.login(email, password);
      setToken(token);
      navigate('/');
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <form onSubmit={submit} className="bg-slate-900 p-8 rounded-xl border border-slate-800 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">Job Scheduler</h1>
        <p className="text-slate-400 text-sm mb-6">Sign in to manage queues and jobs</p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded bg-slate-800 border border-slate-700"
        />
        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 px-3 py-2 rounded bg-slate-800 border border-slate-700"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-medium disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="text-xs text-slate-500 mt-4">Demo: demo@scheduler.local / password123</p>
      </form>
    </div>
  );
}

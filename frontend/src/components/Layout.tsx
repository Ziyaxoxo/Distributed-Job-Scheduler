import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken } from '../api/client';

const links = [
  { to: '/', label: 'Overview' },
  { to: '/projects', label: 'Projects' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/workers', label: 'Workers' },
  { to: '/dlq', label: 'DLQ' },
];

export function Layout() {
  const navigate = useNavigate();

  const logout = () => {
    clearToken();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
        <h1 className="text-lg font-bold text-indigo-400 mb-6">Job Scheduler</h1>
        <nav className="flex flex-col gap-1 flex-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-sm ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="text-sm text-slate-400 hover:text-white mt-4 text-left px-3">
          Logout
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

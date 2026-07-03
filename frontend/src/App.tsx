import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { JobsPage } from './pages/JobsPage';
import { WorkersPage } from './pages/WorkersPage';
import { DlqPage } from './pages/DlqPage';
import { getToken } from './api/client';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/workers" element={<WorkersPage />} />
          <Route path="/dlq" element={<DlqPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

import { Navigate } from 'react-router-dom';
export default function AdminProtectedRoute({ children }) {
  const t = localStorage.getItem('adminToken');
  if (!t) return <Navigate to="/admin/login" replace />;
  return children;
}

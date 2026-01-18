import { useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import api from '../api/api.js';
import LoadingBar from './LoadingBar.jsx';

export default function ProtectedRoute({ children, redirectTo = '/login' }) {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();
  const [consentChecked, setConsentChecked] = useState(false);
  const [requireReconsent, setRequireReconsent] = useState(false);

  const legalRedirect = useMemo(() => {
    const params = new URLSearchParams({
      reconsent: '1',
      redirect: location.pathname + location.search
    });
    return `/politica-de-privacidade?${params.toString()}`;
  }, [location.pathname, location.search]);

  useEffect(() => {
    let active = true;

    async function checkConsent() {
      if (!user) {
        setConsentChecked(true);
        return;
      }
      try {
        const res = await api.get('/auth/consent-status');
        if (!active) return;
        setRequireReconsent(res?.data?.data?.requireReconsent === true);
        setConsentChecked(true);
      } catch (err) {
        if (active) {
          console.error('Não foi possível validar o consentimento legal.', err);
          setConsentChecked(true);
        }
      }
    }

    checkConsent();

    return () => {
      active = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="page-loading">
        <LoadingBar message="Carregando..." />
      </div>
    );
  }

  if (!user) return <Navigate to={redirectTo} replace />;

  if (!consentChecked) {
    return (
      <div className="page-loading">
        <LoadingBar message="Carregando..." />
      </div>
    );
  }
  if (requireReconsent) return <Navigate to={legalRedirect} replace />;

  return children;
}

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const RETURN_TARGET_KEY = 'templesale:return-target';

export default function useReturnNavigation() {
  const navigate = useNavigate();

  return useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(RETURN_TARGET_KEY);
        const target = raw ? JSON.parse(raw) : null;
        if (target?.path && window.history.length > 1) {
          navigate(-1);
          return;
        }
        if (target?.path) {
          navigate(target.path);
          return;
        }
      } catch {
        // ignore storage failures
      }
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
    }
    navigate('/');
  }, [navigate]);
}

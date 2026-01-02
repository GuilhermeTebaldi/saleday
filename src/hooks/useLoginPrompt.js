import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { buildLoginUrl } from '../utils/authRedirect.js';

export default function useLoginPrompt() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (message = 'Faça login para continuar.', options = {}) => {
      toast.error(message);
      // Keep the current path so login can return the user to the same screen.
      const nextPath =
        options.nextPath ?? `${location.pathname}${location.search || ''}`;
      navigate(buildLoginUrl(nextPath));
      return false;
    },
    [location.pathname, location.search, navigate]
  );
}

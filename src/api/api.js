// frontend/src/api/api.js
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { notifyBanReason } from '../utils/banNotice.js';

const resolveBaseURL = () => {
  const envUrl = import.meta.env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname);
    if (isLocal) {
      return `${protocol}//${hostname}:5000/api`;
    }
    return `${window.location.origin.replace(/\/+$/, '')}/api`;
  }
  return 'http://localhost:5000/api';
};

const api = axios.create({ baseURL: resolveBaseURL(), withCredentials: true });

let sessionExpiredNotice = false;
let networkErrorNotice = false;

const handleSessionExpiration = (message) => {
  if (typeof window === 'undefined') return;
  if (!sessionExpiredNotice) {
    sessionExpiredNotice = true;
    const finalMessage = message || 'Sua sessão expirou. Entre novamente para continuar.';
    try {
      toast.error(finalMessage, { id: 'session-expired' });
    } catch {
      window.alert(finalMessage);
    }
  }
  localStorage.removeItem('token');
  const onAdminPage =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  if (onAdminPage) {
    localStorage.removeItem('adminToken');
    if (!window.location.pathname.startsWith('/admin/login')) {
      setTimeout(() => {
        window.location.href = '/admin/login';
      }, 1200);
    }
    return;
  }
  if (!window.location.pathname.startsWith('/login')) {
    setTimeout(() => {
      window.location.href = '/login';
    }, 1200);
  }
};

api.interceptors.request.use((config) => {
  config.headers ||= {};

  // Não sobrescreve Authorization se já foi setado manualmente
  if (!config.headers.Authorization) {
    const url = (config.url || '').toLowerCase();
    const isAdmin =
      url.startsWith('/admin') || url.includes('/api/admin') || url.includes('/support/admin');
    const adminToken = localStorage.getItem('adminToken');
    const userToken  = localStorage.getItem('token');

    if (isAdmin && adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    } else if (!isAdmin && userToken) {
      config.headers.Authorization = `Bearer ${userToken}`;
    }
  }

  // Content-Type automático (mantém upload funcionando)
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

// 401 em rotas admin → força logout do admin
api.interceptors.response.use(
  r => r,
  err => {
    if (err?.code === 'ERR_NETWORK') {
      if (!networkErrorNotice) {
        networkErrorNotice = true;
        const finalMessage =
          'Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente.';
        try {
          toast.error(finalMessage, { id: 'network-error' });
        } catch {
          if (typeof window !== 'undefined') window.alert(finalMessage);
        }
      }
      return Promise.reject(err);
    }
    const banReasonFromServer = err?.response?.data?.banReason;
    const messageFromServer = err?.response?.data?.message || '';
    const normalizedMessage = messageFromServer.toLowerCase();
    if (banReasonFromServer) {
      notifyBanReason(banReasonFromServer);
    } else if (err?.response?.status === 403 && normalizedMessage.includes('suspensa')) {
      notifyBanReason(messageFromServer);
    }

    const url = err?.config?.url || '';
    const status = err?.response?.status;
    const isAdmin = url.startsWith('/admin') || url.includes('/api/admin');
    if (isAdmin && status === 401) {
      localStorage.removeItem('adminToken');
      if (!location.pathname.startsWith('/admin/login')) {
        location.href = '/admin/login';
      }
      return Promise.reject(err);
    }

    const likelyTokenIssue =
      normalizedMessage.includes('token') ||
      normalizedMessage.includes('sessão') ||
      normalizedMessage.includes('autentica');

    if (!isAdmin && (status === 401 || status === 403) && likelyTokenIssue) {
      handleSessionExpiration(
        normalizedMessage.includes('expirado')
          ? 'Sua sessão expirou. Faça login novamente.'
          : messageFromServer || 'Não foi possível validar sua sessão. Entre novamente.'
      );
    }
    return Promise.reject(err);
  }
);

export default api;

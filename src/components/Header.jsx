// frontend/src/components/Header.jsx
// barra superior com logo e sino e casa
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import api from '../api/api.js';
import { toast } from 'react-hot-toast';
import { formatOfferAmount, parseOfferMessage, parseOfferResponse } from '../utils/offers.js';
import { toAbsoluteImageUrl } from '../utils/images.js';
import { IMG_PLACEHOLDER } from '../utils/placeholders.js';
import { PRODUCT_CONTEXT_PREFIX } from '../utils/productContext.js';
import { usePurchaseNotifications } from '../context/PurchaseNotificationsContext.jsx';

const parseMessageContextPreview = (content) => {
  if (!content || typeof content !== 'string') return null;
  if (!content.startsWith(PRODUCT_CONTEXT_PREFIX)) return null;
  try {
    const payload = JSON.parse(content.slice(PRODUCT_CONTEXT_PREFIX.length));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
};
import { getUnseenSellerOrderIds } from '../utils/orders.js';

const NOTIF_CLEAR_KEY = 'templesale:last-cleared-unread';
const PROFILE_ALERTS_KEY = 'templesale:profile-alerts';
const PROFILE_ALERT_DELAY = 4000;
const PROFILE_ALERT_CLICK_COOLDOWN = 3 * 24 * 60 * 60 * 1000;
const PROFILE_ALERT_FORCE = false;

const readProfileAlertState = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PROFILE_ALERTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeProfileAlertState = (nextState) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROFILE_ALERTS_KEY, JSON.stringify(nextState));
  } catch {
    // ignore storage failures
  }
};

const updateProfileAlertState = (updates) => {
  const current = readProfileAlertState();
  writeProfileAlertState({ ...current, ...updates });
};

function BellIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18a3 3 0 1 1-6 0" />
      <path d="M18 16v-5a6 6 0 0 0-5-5.91V4a1 1 0 1 0-2 0v1.09A6 6 0 0 0 6 11v5l-1.3 1.3A1 1 0 0 0 5.7 19h12.6a1 1 0 0 0 .71-1.7Z" />
    </svg>
  );
}

function HomeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h5v-5h4v5h5V10" />
    </svg>
  );
}

function MenuIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function SearchIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      <path d="M16.5 16.5 21 21" />
    </svg>
  );
}

function LogoutIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15.75 16.5v1.75a1.75 1.75 0 0 1-1.75 1.75H6.25A1.75 1.75 0 0 1 4.5 18.25V5.75A1.75 1.75 0 0 1 6.25 4h7.75a1.75 1.75 0 0 1 1.75 1.75V7.5" />
      <path d="M10.5 12h9" />
      <path d="m17.25 9.75 2.75 2.25-2.75 2.25" />
    </svg>
  );
}
function playUISound(file) {
  try {
    const sound = new Audio(`/sounds/${file}`);
    sound.volume = 0.4;
    sound.play().catch(() => {});
  } catch {
    // ignora falhas
  }
}

export default function Header() {
  const { user, token, logout } = useContext(AuthContext);
  const { hasUnseenOrders, unseenCount } = usePurchaseNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navPanelOpen, setNavPanelOpen] = useState(false);
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const headerSearchRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [displayUnreadCount, setDisplayUnreadCount] = useState(0);
  const [sellerAlerts, setSellerAlerts] = useState({ unseen: 0, pending: 0 });
  const [questionNotifications, setQuestionNotifications] = useState([]);
  const [hasNewQuestionAlerts, setHasNewQuestionAlerts] = useState(false);
  const [profileAlert, setProfileAlert] = useState(null);
  const [profileAlertVisible, setProfileAlertVisible] = useState(false);
  const drawerRef = useRef(null);
  const seenOffersRef = useRef(null);
  const notificationSoundRef = useRef(null);
  const lastCountRef = useRef(0);
  const actualUnreadRef = useRef(0);
  const lastClearedCountRef = useRef(0);
  const profileAlertPendingRef = useRef(null);
  const profileAlertTimerRef = useRef(null);
  const profileAlertClearTimerRef = useRef(null);
  const headerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const showProfileAlert = useCallback((payload) => {
    setProfileAlert(payload);
    setProfileAlertVisible(false);
    if (profileAlertTimerRef.current) window.clearTimeout(profileAlertTimerRef.current);
    if (profileAlertClearTimerRef.current) window.clearTimeout(profileAlertClearTimerRef.current);

    window.requestAnimationFrame(() => {
      setProfileAlertVisible(true);
    });

    profileAlertTimerRef.current = window.setTimeout(() => {
      setProfileAlertVisible(false);
      profileAlertClearTimerRef.current = window.setTimeout(() => {
        setProfileAlert(null);
        profileAlertClearTimerRef.current = null;
      }, 450);
      profileAlertTimerRef.current = null;
    }, 4200);
  }, []);
  const persistClearedCount = useCallback((count) => {
    lastClearedCountRef.current = count;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(NOTIF_CLEAR_KEY, String(count));
    } catch {
      // ignore write failures
    }
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = Number(window.localStorage.getItem(NOTIF_CLEAR_KEY));
      if (Number.isFinite(stored) && stored >= 0) {
        lastClearedCountRef.current = stored;
      }
    } catch {
      // ignore storage issues
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('templesale-panel-open', navPanelOpen);
    return () => document.body.classList.remove('templesale-panel-open');
  }, [navPanelOpen]);

  useEffect(() => {
    if (isHome) return;
    if (navPanelOpen) setNavPanelOpen(false);
  }, [isHome, navPanelOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleClosePanel = () => setNavPanelOpen(false);
    window.addEventListener('templesale:close-panel', handleClosePanel);
    return () => window.removeEventListener('templesale:close-panel', handleClosePanel);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleToggleSearch = () => setHeaderSearchOpen((prev) => !prev);
    window.addEventListener('templesale:toggle-header-search', handleToggleSearch);
    return () =>
      window.removeEventListener('templesale:toggle-header-search', handleToggleSearch);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('templesale-header-search-open', headerSearchOpen);
    return () => document.body.classList.remove('templesale-header-search-open');
  }, [headerSearchOpen]);

  useEffect(() => {
    return () => {
      if (profileAlertTimerRef.current) {
        window.clearTimeout(profileAlertTimerRef.current);
      }
      if (profileAlertClearTimerRef.current) {
        window.clearTimeout(profileAlertClearTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!user?.id && !PROFILE_ALERT_FORCE) return undefined;
    if (location.pathname === '/edit-profile') return undefined;

    const hasPhoto = Boolean(user.profile_image_url || user.profile_image);
    const hasCity = Boolean(String(user.city || '').trim());
    const missing = [];

    if (!hasPhoto) {
      missing.push({
        key: 'photo',
        title: 'Atualize sua foto para ter mais credibilidade.',
        description: 'Perfis com foto passam mais confianca para quem compra.',
        cta: 'Atualizar foto'
      });
    }

    if (!hasCity) {
      missing.push({
        key: 'city',
        title: 'Adicione sua cidade para aparecer nas buscas proximas.',
        description: 'Ajude compradores a encontrar voce na sua regiao.',
        cta: 'Adicionar cidade'
      });
    }

    if (missing.length === 0) return undefined;

    const state = readProfileAlertState();
    const now = Date.now();

    if (state.nextEligibleAt && now < state.nextEligibleAt) {
      return undefined;
    }

    const chosen = missing[0];
    if (profileAlertPendingRef.current === chosen.key) return undefined;
    profileAlertPendingRef.current = chosen.key;

    const jitter = Math.floor(Math.random() * 1200);
    const timer = window.setTimeout(() => {
      updateProfileAlertState({ nextEligibleAt: now + PROFILE_ALERT_CLICK_COOLDOWN });

      showProfileAlert(chosen);
      profileAlertPendingRef.current = null;
    }, PROFILE_ALERT_DELAY + jitter);

    return () => {
      window.clearTimeout(timer);
      profileAlertPendingRef.current = null;
    };
  }, [
    user?.id,
    user?.profile_image_url,
    user?.profile_image,
    user?.city,
    navigate,
    showProfileAlert,
    location.pathname
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const fallbackAlert = {
      key: 'manual',
      title: 'Atualize seu cadastro para mais credibilidade.',
      description: 'Complete a foto e a cidade para melhorar a confianca.',
      cta: 'Atualizar cadastro'
    };
    window.templesaleShowProfileAlert = (kind = 'auto') => {
      const payload = {
        photo: {
          key: 'photo',
          title: 'Atualize sua foto para ter mais credibilidade.',
          description: 'Perfis com foto passam mais confianca para quem compra.',
          cta: 'Atualizar foto'
        },
        city: {
          key: 'city',
          title: 'Adicione sua cidade para aparecer nas buscas proximas.',
          description: 'Ajude compradores a encontrar voce na sua regiao.',
          cta: 'Adicionar cidade'
        },
        auto: fallbackAlert
      }[kind] || fallbackAlert;

      showProfileAlert(payload);
    };
    return () => {
      delete window.templesaleShowProfileAlert;
    };
  }, [showProfileAlert]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!navPanelOpen) return undefined;
    const handleOutside = (event) => {
      const target = event.target;
      if (!target) return;
      if (target.closest('.home-search-toolbar')) return;
      if (target.closest('.nav-hamburger')) return;
      setNavPanelOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [navPanelOpen]);

  const closeDrawer = () => setDrawerOpen(false);
  const purchaseLabel = hasUnseenOrders
    ? `${unseenCount} compra${unseenCount > 1 ? 's' : ''} confirmada${unseenCount > 1 ? 's' : ''}`
    : '';
  const dashboardLabel = purchaseLabel
    ? `Ir para o painel • ${purchaseLabel}`
    : 'Ir para o painel';

  const handleMessagesNavigation = useCallback(
    (to) => {
      closeDrawer();
      if (location.pathname === '/messages') {
        window.location.assign(to);
        return;
      }
      navigate(to);
    },
    [closeDrawer, location.pathname, navigate]
  );
  const runHeaderSearch = useCallback(
    (rawValue) => {
      const trimmed = String(rawValue ?? '').trim();
      if (!trimmed) return false;
      if (isHome) {
        window.dispatchEvent(
          new CustomEvent('templesale:set-search-query', {
            detail: { value: trimmed }
          })
        );
        window.dispatchEvent(
          new CustomEvent('templesale:trigger-search', {
            detail: { value: trimmed }
          })
        );
        return true;
      }
      const params = new URLSearchParams({ q: trimmed });
      navigate(`/?${params.toString()}`);
      return true;
    },
    [isHome, navigate]
  );
  const sortConversationsByDate = useCallback((items) => {
    if (!Array.isArray(items)) return [];
    const latestByKey = new Map();
    items.forEach((item) => {
      if (!item) return;
      const key =
        item.id != null
          ? `conv-${item.id}`
          : `${item.product_id ?? 'product'}-${
              [item.sender_id ?? 'sender', item.receiver_id ?? 'receiver'].sort().join('-')
            }`;
      const currentDate = new Date(item?.created_at ?? item?.updated_at ?? 0).getTime();
      const stored = latestByKey.get(key);
      if (!stored || currentDate > stored.__timestamp) {
        latestByKey.set(key, { ...item, __timestamp: currentDate });
      }
    });
    return Array.from(latestByKey.values())
      .map(({ __timestamp, ...rest }) => rest)
      .sort(
        (a, b) =>
          new Date(b?.created_at ?? b?.updated_at ?? 0).getTime() -
          new Date(a?.created_at ?? a?.updated_at ?? 0).getTime()
    );
  }, []);

  const getConversationCounterpartId = useCallback(
    (conversation) => {
      if (!conversation) return null;
      const currentUserId = Number(user?.id);
      if (!Number.isFinite(currentUserId)) return null;
      if (conversation.sender_id === currentUserId) return conversation.receiver_id;
      if (conversation.receiver_id === currentUserId) return conversation.sender_id;
      return null;
    },
    [user?.id]
  );

  const getConversationCounterpartName = useCallback((conversation, counterpartId) => {
    if (!conversation) return null;
    if (counterpartId === conversation.sender_id) {
      return conversation.sender_name || conversation.seller_name || null;
    }
    if (counterpartId === conversation.receiver_id) {
      return conversation.receiver_name || conversation.seller_name || null;
    }
    return conversation.seller_name || null;
  }, []);

  // Resolve avatar sources for notifications without altering existing message logic.
  const getConversationCounterpartAvatar = useCallback((conversation, counterpartId) => {
    if (!conversation) return null;
    if (counterpartId === conversation.sender_id) {
      return (
        conversation.sender_avatar ||
        conversation.sender_profile_image ||
        conversation.sender_photo ||
        conversation.seller_avatar ||
        null
      );
    }
    if (counterpartId === conversation.receiver_id) {
      return (
        conversation.receiver_avatar ||
        conversation.receiver_profile_image ||
        conversation.receiver_photo ||
        conversation.seller_avatar ||
        null
      );
    }
    return (
      conversation.seller_avatar ||
      conversation.sender_avatar ||
      conversation.receiver_avatar ||
      null
    );
  }, []);

  const getAvatarInitial = useCallback((value, fallback) => {
    const trimmed = String(value || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : fallback;
  }, []);

  const seenQuestionNotificationKeysRef = useRef(new Set());
  const QA_SEEN_STORAGE_KEY = 'templesale_seen_question_notifications';
  const getStorageKey = useCallback(
    (userId) => `${QA_SEEN_STORAGE_KEY}:${userId}`,
    []
  );
  const pendingClearRef = useRef(false);

  const persistSeenQuestionKeys = useCallback(() => {
    if (!user?.id || typeof window === 'undefined') return;
    try {
      const serialized = JSON.stringify(Array.from(seenQuestionNotificationKeysRef.current));
      window.localStorage.setItem(getStorageKey(user.id), serialized);
    } catch {
      // ignore write failures
    }
  }, [getStorageKey, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!user?.id) {
      seenQuestionNotificationKeysRef.current.clear();
      return undefined;
    }
    try {
      const raw = window.localStorage.getItem(getStorageKey(user.id));
      const parsed = raw ? JSON.parse(raw) : [];
      seenQuestionNotificationKeysRef.current = new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      seenQuestionNotificationKeysRef.current.clear();
    }
    return undefined;
  }, [getStorageKey, user?.id]);

  const processQuestionNotifications = useCallback(
    (questions) => {
      if (!Array.isArray(questions) || questions.length === 0) return;
      const userIdNumber = Number(user?.id);
      if (!Number.isFinite(userIdNumber)) return;
      const now = Date.now();
      const relevantEntries = [];

      questions.forEach((question) => {
        const type = question?.type === 'response' ? 'response' : 'question';
        const questionId = question?.questionId;
        const productId = question?.productId;
        if (!questionId || !productId) return;

        const entry = {
          questionId,
          productId,
          productTitle: question.productTitle,
          content: question.content,
          userName: question.userName,
          createdAt: question.createdAt || now,
          type
        };

        if (type === 'question') {
          const sellerId = Number(question?.sellerId);
          if (!Number.isFinite(sellerId) || sellerId !== userIdNumber) return;
          relevantEntries.push(entry);
          return;
        }

        const questionUserId = Number(question?.questionUserId);
        if (!Number.isFinite(questionUserId) || questionUserId !== userIdNumber) return;
        relevantEntries.push(entry);
      });

      if (!relevantEntries.length) return;
      const badgeEntries = [];
      const entriesForDrawer = relevantEntries.map((entry) => {
        const entryType = entry.type || 'question';
        const dedupKey = `${entry.questionId}#${entryType}`;
        if (!seenQuestionNotificationKeysRef.current.has(dedupKey)) {
          badgeEntries.push(entry);
          seenQuestionNotificationKeysRef.current.add(dedupKey);
        }
        return { entry, dedupKey };
      });

      if (!entriesForDrawer.length) return;
      if (badgeEntries.length > 0) {
        persistSeenQuestionKeys();
        setHasNewQuestionAlerts(true);
      }
      setQuestionNotifications((prev) => {
        const existingIds = new Set(
          prev.map((item) => `${item.questionId}#${item.type || 'question'}`)
        );
        const deduped = [...prev];
        const orderedEntries = entriesForDrawer
          .map(({ entry, dedupKey }) => ({ ...entry, entryKey: dedupKey }))
          .slice()
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        orderedEntries.forEach((item) => {
          if (existingIds.has(item.entryKey)) return;
          existingIds.add(item.entryKey);
          const { entryKey, ...rest } = item;
          const entryType = item.type || 'question';
          deduped.unshift({ ...rest, type: entryType });
        });
        return deduped;
      });
    },
    [user?.id, persistSeenQuestionKeys]
  );

  const normalizeTimestamp = useCallback((value) => {
    if (!value) return 0;
    const parsed = new Date(value);
    const time = parsed.getTime();
    return Number.isFinite(time) ? time : 0;
  }, []);

  const mergedNotifications = useMemo(() => {
    const questionItems = questionNotifications.map((notification) => ({
      ...notification,
      type: notification.type || 'question',
      timestamp: normalizeTimestamp(notification.createdAt)
    }));
    const messageItems = conversations.map((conversation) => ({
      ...conversation,
      type: 'message',
      timestamp: normalizeTimestamp(
        conversation.created_at ?? conversation.updated_at ?? conversation.createdAt
      )
    }));
    return [...questionItems, ...messageItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [questionNotifications, conversations, normalizeTimestamp]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const [convosRes, unreadRes, ordersRes] = await Promise.all([
        api.get('/messages', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/messages/unread/count', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/orders/seller', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const list = sortConversationsByDate(convosRes.data?.data ?? []);
      setConversations(list);

      const newCount = unreadRes.data?.count ?? 0;
      actualUnreadRef.current = newCount;
      if (pendingClearRef.current) {
        persistClearedCount(newCount);
        setDisplayUnreadCount(0);
        pendingClearRef.current = false;
      } else {
        const baseline = Number.isFinite(lastClearedCountRef.current)
          ? lastClearedCountRef.current
          : 0;
        const nextDisplayCount = newCount > baseline ? newCount : 0;
        setDisplayUnreadCount(nextDisplayCount);
      }

      if (newCount > lastCountRef.current && lastCountRef.current !== 0 && notificationSoundRef.current) {
        notificationSoundRef.current.currentTime = 0;
        notificationSoundRef.current.play().catch(() => {});
      }
      lastCountRef.current = newCount;

      const orders = Array.isArray(ordersRes.data?.data) ? ordersRes.data.data : [];
      const unseenIds = getUnseenSellerOrderIds(user?.id, orders);
      const pending = orders.filter((order) => order?.status === 'pending').length;
      setSellerAlerts({
        unseen: unseenIds.length,
        pending
      });

      try {
        const qaRes = await api.get('/notifications/product-questions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = qaRes.data?.data;
        const entries = [...(payload?.questions || []), ...(payload?.responses || [])];
        processQuestionNotifications(entries);
      } catch (qaErr) {
        console.error('Falha ao buscar alertas de perguntas públicas.', qaErr);
      }
    } catch (err) {
      console.error(err);
    }
  }, [sortConversationsByDate, token, user?.id, processQuestionNotifications]);

  const formatConversationTime = (value) => {
    if (!value) return '';
    try {
      const date = new Date(value);
      return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return '';
    }
  };

  function handleLogoClick(e) {
    // permite abrir em nova aba com Ctrl/Cmd+clique
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();

    if (location.pathname === '/') {
      window.location.reload();
      return;
    }
    // navega para home e força recarregar para limpar estados e refazer fetch
    navigate('/', { replace: true });
    // força recarga completa
    window.location.href = '/';
  }

  useEffect(() => {
    if (!token) {
      setConversations([]);
      setDisplayUnreadCount(0);
      setDrawerOpen(false);
      lastCountRef.current = 0;
      setQuestionNotifications([]);
      setHasNewQuestionAlerts(false);
      seenQuestionNotificationKeysRef.current.clear();
      return undefined;
    }

    if (!notificationSoundRef.current) {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.3;
      notificationSoundRef.current = audio;
    }

    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 8000);
    const handleFocus = () => fetchNotifications();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('templesale:seller-orders-sync', fetchNotifications);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('templesale:seller-orders-sync', fetchNotifications);
    };
  }, [fetchNotifications, token]);

  useEffect(() => {
    if (!token || !user?.id) return;
    if (!Array.isArray(conversations) || conversations.length === 0) return;

    if (!seenOffersRef.current) {
      try {
        const stored = localStorage.getItem('templesale_seen_offer_responses');
        const parsed = stored ? JSON.parse(stored) : [];
        seenOffersRef.current = new Set(Array.isArray(parsed) ? parsed : []);
      } catch {
        seenOffersRef.current = new Set();
      }
    }

    const persistSeen = () => {
      if (!seenOffersRef.current) return;
      try {
        const data = Array.from(seenOffersRef.current);
        localStorage.setItem('templesale_seen_offer_responses', JSON.stringify(data));
      } catch {
        // se falhar em persistir, ignorar
      }
    };

    const showToast = ({
      productId,
      productTitle,
      amount,
      currency,
      productImage,
      responderName,
      sellerId = null,
      sellerName = ''
    }) => {
      const formattedAmount = amount ? formatOfferAmount(amount, currency) : null;
      toast.custom(
        (t) => (
          <div className={`offer-toast ${t.visible ? 'offer-toast--visible' : 'offer-toast--hidden'}`}>
            <div className="offer-toast__badge">Oferta aceita</div>
            <div className="offer-toast__content">
              {productImage ? (
                <img src={productImage} alt={productTitle ?? 'Produto'} className="offer-toast__image" />
              ) : (
                <div className="offer-toast__image offer-toast__image--placeholder">✓</div>
              )}
              <div className="offer-toast__text">
                <p className="offer-toast__headline">
                  {responderName ? `${responderName} aceitou sua oferta!` : 'Oferta aceita!'}
                </p>
                {productTitle && <h3 className="offer-toast__title">{productTitle}</h3>}
                {formattedAmount && <p className="offer-toast__amount">Valor acordado: {formattedAmount}</p>}
                <button
                  type="button"
                  className="offer-toast__cta"
                  onClick={() => {
                    toast.dismiss(t.id);
                    setDrawerOpen(false);
                    playUISound('open-home.mp3');
                    const params = new URLSearchParams();
                    if (productId) params.set('product', String(productId));
                    if (sellerId) params.set('seller', String(sellerId));
                    if (sellerName) params.set('sellerName', sellerName);
                    const query = params.toString();
                    navigate(`/messages${query ? `?${query}` : ''}`);
                  }}
                >
                  Abrir conversa
                </button>
              </div>
            </div>
          </div>
        ),
        { duration: 9000 }
      );
    };

    conversations.forEach((conversation) => {
      if (!conversation?.id) return;
      const response = parseOfferResponse(conversation.content);
      if (!response || response.status !== 'accepted') return;
      if (conversation.receiver_id !== user.id) return;
      if (seenOffersRef.current?.has(conversation.id)) return;

      seenOffersRef.current.add(conversation.id);
      persistSeen();

      const offerData = response.offer ?? {};
      const productId = offerData.productId ?? conversation.product_id;
      const productTitle = offerData.productTitle ?? conversation.product_title;
      const responderName = response.responderName ?? conversation.seller_name;

      const counterpartId = getConversationCounterpartId(conversation);
      const counterpartName =
        getConversationCounterpartName(conversation, counterpartId) || 'Vendedor';
      const completeToast = (productImage) =>
        showToast({
          productId,
          productTitle,
          amount: offerData.amount,
          currency: offerData.currency,
          productImage,
          responderName,
          sellerId: counterpartId,
          sellerName: counterpartName
        });

      if (offerData.productImage) {
        completeToast(offerData.productImage);
        return;
      }

      if (!productId) {
        completeToast(null);
        return;
      }

      api
        .get(`/products/${productId}`)
        .then((res) => {
          const data = res.data?.data;
          const firstImage =
            Array.isArray(data?.image_urls) && data.image_urls.length > 0
              ? data.image_urls[0]
              : data?.image_url ?? null;
          completeToast(firstImage);
        })
        .catch(() => {
          completeToast(null);
        });
    });
  }, [conversations, token, user?.id, navigate]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return undefined;
    const handleProductQuestion = (event) => {
      processQuestionNotifications(event?.detail?.questions);
    };
    const handleStorageEvent = (event) => {
      if (event.key !== 'templesale:product-question' || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        processQuestionNotifications(payload?.questions);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('templesale:product-question', handleProductQuestion);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('templesale:product-question', handleProductQuestion);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [processQuestionNotifications]);

  const handleQuestionNotificationClick = useCallback(
    (notification) => {
      const productId = notification.productId ?? notification.product_id;
      if (!productId) return;
      setQuestionNotifications((prev) =>
        prev.filter((item) => item.questionId !== notification.questionId)
      );
      setDrawerOpen(false);
      const target = `/product/${productId}${
        notification.questionId ? `?highlightQuestion=${notification.questionId}` : ''
      }`;
      navigate(target);
    },
    [navigate]
  );

  const handleToggleDrawer = () => {
    if (!drawerOpen) {
      pendingClearRef.current = true;
      fetchNotifications();
      setDisplayUnreadCount(0);
      if (hasNewQuestionAlerts) setHasNewQuestionAlerts(false);
    }
    const next = !drawerOpen;
    setDrawerOpen(next);
    if (next) playUISound('open-bell.mp3');
  };
  

  const handleLogout = () => logout();

  useEffect(() => {
    function handleClickOutside(event) {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        setDrawerOpen(false);
      }
    }

    if (drawerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const headerEl = headerRef.current;
    if (!headerEl) return;
    const root = document.documentElement;
    const updateHeaderHeight = () => {
      const nextHeight = Math.ceil(headerEl.getBoundingClientRect().height);
      if (nextHeight > 0) {
        root.style.setProperty('--home-header-height', `${nextHeight}px`);
      }
    };
    updateHeaderHeight();
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHeaderHeight);
      observer.observe(headerEl);
    } else {
      window.addEventListener('resize', updateHeaderHeight);
    }
    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', updateHeaderHeight);
      }
    };
  }, []);

  return (
    <>
      <header className="app-header" ref={headerRef}>
      <button
        type="button"
        className="nav-icon-button nav-hamburger"
        aria-label={isHome ? "Abrir menu" : "Ir para a página inicial"}
        aria-expanded={isHome ? navPanelOpen : false}
        onClick={() => {
          if (!isHome) {
            navigate('/');
            return;
          }
          setNavPanelOpen((prev) => !prev);
        }}
      >
        <MenuIcon size={20} />
      </button>
      {navPanelOpen && (
        <div
          className="nav-side-backdrop"
          role="presentation"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setNavPanelOpen(false);
          }}
        />
      )}
      <div className="app-shell">
        {headerSearchOpen ? (
          <div className="app-logo transition-transform duration-300 active:scale-95" translate="no">
            <div className="relative flex items-center justify-center">
              <div className="relative">
                <form
                  className="app-header__search animate-logoEntry"
                  onSubmit={(event) => {
                    event.preventDefault();
                    runHeaderSearch(headerSearchQuery);
                    setHeaderSearchOpen(false);
                    setHeaderSearchQuery('');
                  }}
                >
                  <input
                    type="search"
                    value={headerSearchQuery}
                    onChange={(event) => setHeaderSearchQuery(event.target.value)}
                    placeholder="Buscar"
                    aria-label="Buscar"
                    ref={headerSearchRef}
                  />
                </form>
              </div>
            </div>
          </div>
        ) : (
          <a
            href="/"
            className="app-logo transition-transform duration-300 active:scale-95"
            translate="no"
            onClick={(e) => {
              e.preventDefault();
              // toca o som
              const sound = new Audio('/sounds/open-logo.mp3');
              sound.volume = 0.10;
              sound.play().catch(() => {});
              // adiciona pequena animação de saída
              const logo = e.currentTarget.querySelector('.app-logo__word');
              if (logo) {
                logo.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                logo.style.transform = 'scale(0.9) rotate(-5deg)';
                logo.style.opacity = '0.8';
              }
              // redireciona junto com o fim do som
              setTimeout(() => handleLogoClick(e), 400);
            }}
            aria-label="Ir para a página inicial e recarregar"
          >
            <div className="relative flex items-center justify-center gap-3">
              <img src="/mira.png" alt="Templesale" className="app-logo__mark" />
              <div className="relative">
                <span className="app-logo__word animate-logoEntry" aria-hidden="true">
                  TEMPLESALE
                </span>
              </div>
            </div>
          </a>
        )}
      </div>

      <nav className="app-nav" aria-label="Menu principal">
        {user ? (
          <>
            <button
              type="button"
              className="nav-icon-button"
              aria-label="Buscar"
              onClick={() => {
                playUISound('open-home.mp3');
                if (headerSearchOpen) {
                  if (headerSearchQuery.trim()) {
                    runHeaderSearch(headerSearchQuery);
                    setHeaderSearchOpen(false);
                    setHeaderSearchQuery('');
                    return;
                  }
                  setHeaderSearchOpen(false);
                  setHeaderSearchQuery('');
                  return;
                } else {
                  setHeaderSearchOpen(true);
                  setTimeout(() => headerSearchRef.current?.focus(), 0);
                }
              }}
            >
              <SearchIcon size={20} />
              <span className="sr-only">Buscar</span>
            </button>
            <Link
              to="/dashboard"
              className={`nav-icon-button${sellerAlerts.unseen > 0 ? ' nav-icon-button--alert' : ''}`}
              aria-label={dashboardLabel}
              onClick={() => playUISound('open-home.mp3')}
            >
              <HomeIcon size={20} />
              {hasUnseenOrders && (
                <span className="nav-home-alert" aria-hidden="true">
                  {unseenCount > 99 ? '99+' : unseenCount}
                </span>
              )}
              {sellerAlerts.unseen > 0 && (
                <span className="nav-icon-button__badge">{sellerAlerts.unseen}</span>
              )}
              <span className="sr-only">Dashboard</span>
            </Link>


            <div className="nav-notification-wrapper">
            <button
              type="button"
              className={`nav-icon-button nav-notifications${displayUnreadCount > 0 ? ' has-unread' : ''}${
                hasNewQuestionAlerts ? ' nav-notifications--question' : ''
              }`}
              onClick={handleToggleDrawer}
              aria-haspopup="true"
              aria-expanded={drawerOpen}
              aria-label="Abrir notificações"
            >
              <BellIcon size={20} />
              {displayUnreadCount > 0 && (
                <>
                  <span className="nav-notifications__badge" aria-hidden="true" />
                  <span className="sr-only">
                    {`Você tem ${displayUnreadCount} novas notificações`}
                  </span>
                </>
              )}
              {hasNewQuestionAlerts && (
                <span className="nav-notifications__question-dot" aria-hidden="true" />
              )}
            </button>

              {drawerOpen && (
                <div ref={drawerRef} className="nav-notifications__drawer animate-smoothZoom">

                  <div className="nav-notifications__header">
                    <h3>Mensagens</h3>
                    <button type="button" onClick={closeDrawer} aria-label="Fechar notificações">
                      ×
                    </button>
                  </div>
                  <div className="nav-notifications__body">
                    {mergedNotifications.length ? (
                      mergedNotifications.map((notification) => {
                        const isQuestionType =
                          notification.type === 'question' || notification.type === 'response';
                        if (isQuestionType) {
                          const productFromPayload =
                            notification.product && (notification.product.title || notification.product.name);
                          const productLabel =
                            notification.productTitle ??
                            notification.product_title ??
                            productFromPayload ??
                            notification.title ??
                            (notification.productId ? `Produto #${notification.productId}` : 'Pergunta pública');
                          const isResponse = notification.type === 'response';
                          return (
                            <button
                              key={`qa-${notification.type}-${notification.questionId}`}
                              type="button"
                              className="nav-notifications__item nav-notifications__item--question"
                              onClick={() => handleQuestionNotificationClick(notification)}
                            >
                              <p className="nav-notifications__item-title">{productLabel}</p>
                              <p
                                className="nav-notifications__item-label"
                                style={{ fontSize: '0.65rem', color: '#0ea5e9', textTransform: 'uppercase' }}
                              >
                                {isResponse ? 'Nova resposta pública' : 'Nova pergunta pública'}
                              </p>
                              <p className="nav-notifications__item-preview">
                                {notification.content?.slice(0, 60) ||
                                  (isResponse
                                    ? 'Resposta pública registrada.'
                                    : 'Pergunta pública enviada.')}
                              </p>
                              <span
                                className="nav-notifications__item-meta"
                                style={{ fontSize: '0.75rem', color: '#64748b' }}
                              >
                                {notification.userName || 'Usuário'} •{' '}
                                {formatConversationTime(notification.createdAt)}
                              </span>
                            </button>
                          );
                        }
                        const safeProductId = notification.product_id ?? notification.productId ?? 'unknown';
                        const safeSender = notification.sender_id ?? notification.sender ?? 'sender';
                        const safeReceiver = notification.receiver_id ?? notification.receiver ?? 'receiver';
                        const fallbackTs =
                          notification.created_at ?? notification.updated_at ?? notification.createdAt ?? '';

                        const conversationCounterpartId = getConversationCounterpartId(notification);
                        const counterpartName =
                          getConversationCounterpartName(notification, conversationCounterpartId) ||
                          'Usuário';

                        const isDirectConversation = !notification.product_id;
                        const messageKey =
                          notification.id != null
                            ? `msg-${notification.id}`
                            : `msg-${safeProductId}-${safeSender}-${safeReceiver}-${fallbackTs}`;

                        const params = new URLSearchParams();
                        if (notification.product_id) {
                          params.set('product', String(notification.product_id));
                          if (notification.product_title) {
                            params.set('productTitle', notification.product_title);
                          }
                        }
                        if (conversationCounterpartId) {
                          params.set('seller', String(conversationCounterpartId));
                        }
                        if (counterpartName) {
                          params.set('sellerName', counterpartName);
                        }

                        const conversationTitle = isDirectConversation
                          ? counterpartName
                          : notification.product_title || `Produto #${notification.product_id}`;
                        const conversationSubtitle = isDirectConversation
                          ? 'Mensagem direta'
                          : `com ${notification.seller_name || counterpartName || 'Vendedor'}`;

                        const offerNotification = parseOfferMessage(notification.content);
                        const offerPreview =
                          offerNotification && offerNotification.amount
                            ? `Nova oferta de ${formatOfferAmount(
                                offerNotification.amount,
                                offerNotification.currency
                              )}`
                            : null;
                        const offerResponse = parseOfferResponse(notification.content);
                        const offerResponsePreview = offerResponse
                          ? offerResponse.status === 'accepted'
                            ? 'Oferta aceita'
                            : offerResponse.status === 'declined'
                              ? 'Oferta recusada'
                              : `Status da oferta: ${offerResponse.status}`
                          : null;
                        const contextPreview = parseMessageContextPreview(notification.content);
                        const contextTitle =
                          contextPreview?.title ||
                          contextPreview?.productTitle ||
                          contextPreview?.product_title ||
                          null;
                        const previewText =
                          contextPreview && contextTitle
                            ? `Produto em foco: ${contextTitle}`
                            : offerResponsePreview ||
                              offerPreview ||
                              notification.content?.slice(0, 60) ||
                              'Sem conteúdo recente.';
                        const avatarUrl = toAbsoluteImageUrl(
                          getConversationCounterpartAvatar(
                            notification,
                            conversationCounterpartId
                          )
                        );
                        const avatarLabel = `Foto de ${counterpartName || 'usuário'}`;
                        const avatarFallback = getAvatarInitial(counterpartName, 'U');

                        return (
                          <button
                          key={messageKey}
                          type="button"
                          className="nav-notifications__item"
                          onClick={() =>
                            handleMessagesNavigation(`/messages?${params.toString()}`)
                          }
                        >
                          <div className="nav-notifications__item-row">
                            <div
                              className={`nav-notifications__avatar${
                                isDirectConversation
                                  ? ' nav-notifications__avatar--direct'
                                  : ' nav-notifications__avatar--product'
                              }`}
                            >
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={avatarLabel}
                                  loading="lazy"
                                  onError={(event) => {
                                    event.currentTarget.src = IMG_PLACEHOLDER;
                                  }}
                                />
                              ) : (
                                <span aria-hidden="true">{avatarFallback}</span>
                              )}
                            </div>
                            <div className="nav-notifications__item-content">
                              <p
                                className={`nav-notifications__item-title${
                                  isDirectConversation
                                    ? ' nav-notifications__item-title--direct'
                                    : ' nav-notifications__item-title--product'
                                }`}
                              >
                                {conversationTitle}
                              </p>
                              <p className="nav-notifications__item-subtitle">
                                {conversationSubtitle}
                              </p>
                              <p className="nav-notifications__item-preview">{previewText}</p>
                              <span
                                className="nav-notifications__item-meta"
                                style={{ fontSize: '0.75rem', color: '#64748b' }}
                              >
                                {formatConversationTime(
                                  notification.created_at || notification.updated_at
                                )}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                    ) : (
                      <p className="nav-notifications__empty">Nenhuma nova mensagem.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

          
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/register" className="nav-link">Cadastre-se</Link>
          </>
        )}
      </nav>
      </header>
      {profileAlert && (
        <div className="profile-toast-wrapper" aria-live="polite">
          <div
            className={`profile-toast ${
              profileAlertVisible ? 'profile-toast--visible' : 'profile-toast--hidden'
            }`}
          >
            <div className="profile-toast__content">
              <div className="profile-toast__icon" aria-hidden="true">
                <span>!</span>
              </div>
              <div className="profile-toast__text">
                <p className="profile-toast__title">{profileAlert.title}</p>
                <button
                  type="button"
                  className="profile-toast__cta"
                  onClick={() => {
                    const now = Date.now();
                    updateProfileAlertState({
                      lastClickAt: now,
                      nextEligibleAt: now + PROFILE_ALERT_CLICK_COOLDOWN
                    });
                    setProfileAlert(null);
                    setDrawerOpen(false);
                    navigate('/edit-profile');
                  }}
                >
                  {profileAlert.cta}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

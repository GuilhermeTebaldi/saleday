// frontend/src/pages/Dashboard.jsx
// Página de painel com resumo e atalhos do usuário.

import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { LocaleContext } from '../context/LocaleContext.jsx';
import { usePurchaseNotifications } from '../context/PurchaseNotificationsContext.jsx';
import { getUnseenSellerOrderIds } from '../utils/orders.js';
import { toast } from 'react-hot-toast';
import formatProductPrice from '../utils/currency.js';
import { isProductFree } from '../utils/product.js';
import { normalizeOrderStatus } from '../utils/orderStatus.js';
import { IMG_PLACEHOLDER } from '../utils/placeholders.js';
import CloseBackButton from '../components/CloseBackButton.jsx';
import LoadingBar from '../components/LoadingBar.jsx';

const getInitial = (value) => {
  if (!value) return 'S';
  const letter = value.trim().charAt(0);
  return letter ? letter.toUpperCase() : 'S';
};

const getInitialSecurityPasswords = () => ({
  current: '',
  next: '',
  confirm: ''
});

const formatSupportTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatLegalDate = (timestamp) => {
  if (!timestamp) return 'Não informado';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};


const formatOrderDatetime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const privacyHighlights = [
  {
    title: 'Como usamos',
    description:
      'Suas informações identificam você para compradores e vendedores, autenticações e relatórios fiscais. Garantimos acesso seguro, criptografado e auditado em todas as camadas.'
  },
  {
    title: 'Bases legais',
    list: [
      'Execução de contrato (compra, venda e entrega).',
      'Consentimento para combinações comerciais e marketing.',
      'Obrigações legais e prevenção a fraudes.'
    ]
  },
  {
    title: 'Seus direitos',
    list: [
      'Acessar, corrigir ou excluir seus dados.',
      'Solicitar portabilidade ou oposição ao tratamento.',
      'Revogar o consentimento a qualquer momento.'
    ]
  }
];

const HeartIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 016.364 6.364L12 21.092 3.318 12.682a4.5 4.5 0 010-6.364z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M5 13l4 4 10-11"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ShopIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M7 9V6a5 5 0 0110 0v3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 9h18l-1.5 9H4.5L3 9z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BagIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M7 8V6a4 4 0 018 0v2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.5 8h15l-1.5 12h-11z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 20V18h8v2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MessageIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H8l-4 4V6z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlusIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 5v14m7-7H5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ShieldIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 2l7 3v5c0 5.5-3.5 9.64-7 10-3.5-.36-7-4.5-7-10V5l7-3z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.5 12l2 2 4-4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArrowRightIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M5 12h10m0 0l-4-4m4 4l-4 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CogIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M19.4 13a1.5 1.5 0 00.11 1.03l1.43 1.1a.5.5 0 01-.12.84l-1.53.7a1.5 1.5 0 00-.65 1.62l.36 1.61a.5.5 0 01-.64.59l-1.64-.45a1.5 1.5 0 00-1.64.41l-1.12 1.35a.5.5 0 01-.8 0l-1.12-1.35a1.5 1.5 0 00-1.64-.41l-1.64.45a.5.5 0 01-.64-.59l.36-1.61a1.5 1.5 0 00-.65-1.62l-1.53-.7a.5.5 0 01-.12-.84l1.43-1.1A1.5 1.5 0 004.6 11L3.17 9.9a.5.5 0 01.12-.84l1.53-.7a1.5 1.5 0 00.65-1.62L5.32 4.1A.5.5 0 015.96 3.5l1.64.45a1.5 1.5 0 001.64-.41l1.12-1.35a.5.5 0 01.8 0l1.12 1.35a1.5 1.5 0 001.64.41l1.64-.45a.5.5 0 01.64.59l-.36 1.61a1.5 1.5 0 00.65 1.62l1.53.7a.5.5 0 01.12.84L19.4 13z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BOOST_LINK_TARGET = '/dashboard/impulsiona';
const BOOST_LINK_STATE = undefined;
const watermarkLogoSrc = '/logo-templesale.png';
const LOCALE_OPTIONS = [
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Español' },
  { value: 'it-IT', label: 'Italiano' }
];

const PrimaryButton = ({
  as: Component = 'button',
  children,
  icon,
  trailingIcon,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const variants = {
    primary:
      'bg-[var(--ts-cta)] text-white shadow-[0_16px_28px_-20px_rgba(31,143,95,0.65)] hover:bg-[#1a7a51] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(31,143,95,0.6)]',
    secondary:
      'bg-[var(--ts-surface)] text-[var(--ts-text)] border border-black/10 hover:border-[rgba(200,178,106,0.45)] hover:bg-white shadow-sm',
    muted:
      'bg-transparent text-[var(--ts-text)] hover:bg-[var(--ts-surface)] shadow-none border border-black/10',
    accent:
      'bg-[var(--ts-gold)] text-[#1a1d21] shadow-[0_16px_28px_-20px_rgba(200,178,106,0.6)] hover:bg-[#d1bd78] focus-visible:outline-[rgba(200,178,106,0.6)]'
  };
  const baseStyles =
    'inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition duration-150 focus-visible:ring focus-visible:ring-offset-2 focus-visible:ring-[rgba(200,178,106,0.45)] focus-visible:outline-none';
  const ComponentProps = {
    ...props,
    className: `${baseStyles} ${variants[variant] ?? variants.primary} ${className}`.trim()
  };
  if (Component === 'button') {
    ComponentProps.type = ComponentProps.type ?? 'button';
  }
  return (
    <Component {...ComponentProps}>
      {icon && <span className="text-base">{icon}</span>}
      <span>{children}</span>
      {trailingIcon && <span className="text-base">{trailingIcon}</span>}
    </Component>
  );
};

const StatBox = ({ label, value, detail, tone = 'blue' }) => {
  const toneMap = {
    blue: 'from-sky-50 to-white border-sky-100 text-sky-700 shadow-sky-200/60',
    emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-700 shadow-emerald-200/60',
    amber: 'from-amber-50 to-white border-amber-100 text-amber-800 shadow-amber-200/60'
  };
  return (
    <article
      className={`rounded-3xl border bg-gradient-to-br px-5 py-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${toneMap[tone] ?? toneMap.blue}`}
      role="status"
    >
      <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
    </article>
  );
};

const UserCard = ({ user, userInitial, userAvatar, avatarMenuOpen, onAvatarToggle, avatarMenuRef }) => (
  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
    <div className="relative" ref={avatarMenuRef}>
      <button
        type="button"
        className="focus-visible:outline-none"
        aria-haspopup="true"
        aria-expanded={Boolean(avatarMenuOpen)}
        onClick={onAvatarToggle}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(200,178,106,0.4)] bg-[var(--ts-surface)] text-xl font-semibold text-[var(--ts-text)] shadow-inner shadow-black/5">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt="Foto do perfil"
              className="h-full w-full rounded-2xl object-cover"
              loading="lazy"
            />
          ) : (
            <span>{userInitial}</span>
          )}
        </div>
      </button>
      {avatarMenuOpen && (
        <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2 z-50">
          <PrimaryButton
            as={Link}
            to="/edit-profile"
            variant="secondary"
            className="min-w-[150px]"
            icon={<ShieldIcon className="h-4 w-4 text-[var(--ts-muted)]" />}
          >
            Editar perfil
          </PrimaryButton>
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs uppercase tracking-[0.4em] text-[var(--ts-muted)]">Painel do usuário</p>
      <h1 className="dashboard-title mt-1 text-2xl font-semibold text-[var(--ts-text)] truncate">
        {user?.username || user?.email}
      </h1>
      <p className="text-sm text-[var(--ts-muted)] truncate">{user?.email}</p>
    </div>
  </div>
);

const QuickAccessBar = ({ className = '', children, ...props }) => (
  <div className={`flex flex-wrap gap-3 ${className}`} {...props}>
    {children}
  </div>
);

const ActionCard = forwardRef(
  ({ title, description, icon, to, onClick, badge, className = '' }, ref) => {
    const Element = to ? Link : 'button';
    const elementProps = {
      className: `group flex flex-col gap-3 rounded-2xl border border-black/5 bg-[var(--ts-card)] px-4 py-5 shadow-[0_14px_28px_-24px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-28px_rgba(0,0,0,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(200,178,106,0.5)] ${className}`,
      onClick,
      ...(to ? { to } : { type: 'button' })
    };
    if (ref) elementProps.ref = ref;

    return (
      <Element {...elementProps}>
        <div className="flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-[var(--ts-surface)] text-[var(--ts-muted)] shadow-inner shadow-black/5">
            {icon}
          </span>
          {badge && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[var(--ts-muted)]">
              {badge}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--ts-text)]">{title}</p>
          <p className="text-xs text-[var(--ts-muted)]">{description}</p>
        </div>
      </Element>
    );
  }
);

const MobileMenu = ({ actions }) => (
  <div className="sm:hidden">
    <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 justify-between gap-2 rounded-3xl border border-slate-200 bg-white/90 px-4 py-3 shadow-2xl backdrop-blur">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className="flex flex-col items-center gap-1 text-center text-[11px] text-slate-600 transition hover:text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            {action.icon}
          </span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  </div>
);

export default function Dashboard() {
  const { user, token, logout } = useContext(AuthContext);
  const { locale, setLocale } = useContext(LocaleContext);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  const [passwords, setPasswords] = useState(getInitialSecurityPasswords);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isSecuritySaving, setIsSecuritySaving] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportConversation, setSupportConversation] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportInput, setSupportInput] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportConversationList, setSupportConversationList] = useState([]);
  const [supportAlert, setSupportAlert] = useState(null);
  const supportListRef = useRef(null);
  const supportNotificationRef = useRef(0);
  const [isTermsPanelOpen, setIsTermsPanelOpen] = useState(false);
  const [isPrivacyPanelOpen, setIsPrivacyPanelOpen] = useState(false);

  const [orderSummary, setOrderSummary] = useState({
    total: 0,
    pending: 0,
    confirmed: 0
  });

  const [newOrderIds, setNewOrderIds] = useState([]);
  const [sellerOrdersList, setSellerOrdersList] = useState([]);
  const [isQuickPanelOpen, setIsQuickPanelOpen] = useState(false);
  const [quickPanelTab, setQuickPanelTab] = useState(null);
  const [favoritePanelItems, setFavoritePanelItems] = useState([]);
  const [favoritePanelLoading, setFavoritePanelLoading] = useState(false);
  const { hasUnseenOrders, unseenCount, markOrdersSeen } = usePurchaseNotifications();
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);
  const purchaseActionRef = useRef(null);
  const [hasAutoScrolledPurchases, setHasAutoScrolledPurchases] = useState(false);
  const purchaseBadge = hasUnseenOrders ? `+${unseenCount}` : undefined;
  const purchaseActionClasses = `h-full min-h-[140px] md:col-span-2 purchase-action-card ${
    hasUnseenOrders ? 'purchase-action-card--alert' : ''
  }`.trim();
  const activeLocale = locale || 'pt-BR';

  const userId = user?.id;
  const userAvatar = user?.profile_image_url ?? '';
  const sellerProfilePath = userId ? `/users/${userId}` : '';

  const userInitial = useMemo(
    () => getInitial(user?.username || user?.email || 'TempleSale'),
    [user?.username, user?.email]
  );
  const toggleAvatarMenu = useCallback(() => {
    setIsAvatarMenuOpen((state) => !state);
  }, []);
  const closeAvatarMenu = useCallback(() => {
    setIsAvatarMenuOpen(false);
  }, []);

  const openFavoritesPanel = useCallback(() => {
    setQuickPanelTab('favorites');
    setIsQuickPanelOpen(true);
  }, []);

  const openOrdersPanel = useCallback(() => {
    setQuickPanelTab('orders');
    setIsQuickPanelOpen(true);
  }, []);

  const closeQuickPanel = useCallback(() => {
    setIsQuickPanelOpen(false);
  }, []);

  useEffect(() => {
    if (!hasUnseenOrders) {
      if (hasAutoScrolledPurchases) {
        setHasAutoScrolledPurchases(false);
      }
      return;
    }
    if (hasAutoScrolledPurchases) return;
    const node = purchaseActionRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHasAutoScrolledPurchases(true);
  }, [hasAutoScrolledPurchases, hasUnseenOrders]);

  const legalEntries = useMemo(() => {
    if (!user) return [];
    return [
      {
        label: 'Termos de Uso',
        version: user.accepted_terms_version,
        date: user.accepted_terms_at
      },
      {
        label: 'Política de Privacidade',
        version: user.accepted_privacy_version,
        date: user.accepted_privacy_at
      },
      {
        label: 'Diretrizes da Comunidade',
        version: user.accepted_community_version,
        date: user.accepted_community_at
      }
    ];
  }, [user]);

  useEffect(() => {
    const handleClickOutsideAvatar = (event) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target)) {
        closeAvatarMenu();
      }
    };

    document.addEventListener('click', handleClickOutsideAvatar);
    return () => document.removeEventListener('click', handleClickOutsideAvatar);
  }, [closeAvatarMenu]);

  useEffect(() => {
    if (!token) {
      setOrderSummary({ total: 0, pending: 0, confirmed: 0 });
      setNewOrderIds([]);
      return;
    }

    let active = true;

    api
      .get('/orders/seller', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!active) return;

        const raw = res.data;
        const orders = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
        setSellerOrdersList(orders);

              const pending = orders.filter(
          (o) => normalizeOrderStatus(o.status ?? o.order_status ?? o.state) === 'pending'
        ).length;

        const confirmed = orders.filter(
          (o) => normalizeOrderStatus(o.status ?? o.order_status ?? o.state) === 'confirmed'
        ).length;



        setOrderSummary({
          total: orders.length,
          pending,
          confirmed
        });

        const fresh = getUnseenSellerOrderIds(userId, orders);
        setNewOrderIds(fresh);
      })
      .catch(() => {
        if (!active) return;
        setOrderSummary({ total: 0, pending: 0, confirmed: 0 });
      });

    return () => {
      active = false;
    };
  }, [token, userId]);

  const fetchSupportMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const { data } = await api.get(`/support/conversations/${conversationId}/messages`);
      const payload = data?.data ?? {};
      setSupportConversation((prev) => (payload.conversation ? payload.conversation : prev));
      setSupportMessages(Array.isArray(payload.messages) ? payload.messages : []);
    } catch (error) {
      console.error('support.fetchSupportMessages', error);
    }
  }, []);

  const supportConversationRef = useRef(null);

  useEffect(() => {
    supportConversationRef.current = supportConversation;
  }, [supportConversation]);

  const updateSupportNotification = useCallback((conversations) => {
    if (!Array.isArray(conversations) || conversations.length === 0) return;
    const latestAdminId = conversations.reduce(
      (max, conversation) => Math.max(max, conversation.last_admin_message_id ?? 0),
      0
    );
    if (latestAdminId <= supportNotificationRef.current) return;
    const targetConversation = conversations.find(
      (conversation) =>
        (conversation.last_admin_message_id ?? 0) > (conversation.user_last_seen_message_id ?? 0)
    );
    if (targetConversation) {
      setSupportAlert({
        conversationId: targetConversation.id,
        message: targetConversation.last_message || 'Suporte respondeu!'
      });
    }
    supportNotificationRef.current = latestAdminId;
  }, []);

  const loadSupportConversations = useCallback(
    async ({ focusId, skipLoading = false } = {}) => {
      if (!skipLoading) {
        setSupportLoading(true);
      }
      try {
        const { data } = await api.get('/support/conversations');
        const list = Array.isArray(data?.data) ? data.data : [];
        setSupportConversationList(list);
        updateSupportNotification(list);
        let nextConversation = null;
        if (focusId) {
          nextConversation = list.find((conversation) => conversation.id === focusId) ?? null;
        } else if (isSupportModalOpen && supportConversationRef.current) {
          const activeConversation = list.find(
            (conversation) => conversation.id === supportConversationRef.current.id
          );
          nextConversation = activeConversation ?? supportConversationRef.current;
        } else {
          nextConversation = list[0] ?? null;
        }
        setSupportConversation(nextConversation);
        setSupportSubject(nextConversation?.subject ?? '');
        if (!nextConversation) {
          setSupportMessages([]);
        }
      } catch (error) {
        console.error('support.loadConversations', error);
        toast.error('Não foi possível carregar o suporte no momento.');
      } finally {
        if (!skipLoading) {
          setSupportLoading(false);
        }
      }
    },
    [isSupportModalOpen, updateSupportNotification]
  );

  const handleSupportSubmit = async (event) => {
    event.preventDefault();
    if (supportSending || !supportInput.trim()) return;
    setSupportSending(true);
    const trimmedContent = supportInput.trim();
    const trimmedSubject = supportSubject.trim();
    const hasExistingConversation = Boolean(supportConversation?.id);
    const payloadBody = { content: trimmedContent };
    if (!supportConversation?.subject && trimmedSubject) {
      payloadBody.subject = trimmedSubject;
    } else if (!hasExistingConversation && trimmedSubject) {
      payloadBody.subject = trimmedSubject;
    }
    try {
      const url = hasExistingConversation
        ? `/support/conversations/${supportConversation.id}/messages`
        : '/support/conversations';
      const { data } = await api.post(url, payloadBody);
      const responseData = data?.data ?? {};
      if (responseData.conversation) {
        setSupportConversation(responseData.conversation);
        setSupportSubject(responseData.conversation.subject ?? trimmedSubject);
      }
      if (Array.isArray(responseData.messages)) {
        setSupportMessages(responseData.messages);
      } else if (responseData.conversation?.id) {
        await fetchSupportMessages(responseData.conversation.id);
      }
      setSupportInput('');
    } catch (error) {
      console.error('support.handleSubmit', error);
      toast.error('Falha ao enviar sua mensagem.');
    } finally {
      setSupportSending(false);
    }
  };

  const openSupportChat = (conversationId) => {
    setSupportAlert(null);
    setIsSupportModalOpen(true);
    loadSupportConversations({ focusId: conversationId });
  };

  useEffect(() => {
    loadSupportConversations();
  }, [loadSupportConversations]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadSupportConversations({ skipLoading: true });
    }, 6000);
    return () => clearInterval(interval);
  }, [loadSupportConversations]);

  useEffect(() => {
    if (!isSupportModalOpen || !supportConversation?.id) return undefined;
    fetchSupportMessages(supportConversation.id);
    const interval = setInterval(() => {
      fetchSupportMessages(supportConversation.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [isSupportModalOpen, supportConversation?.id, fetchSupportMessages]);

  useEffect(() => {
    if (!isSupportModalOpen) return;
    setSupportAlert(null);
    const latestAdminId = supportConversationList.reduce(
      (max, conversation) => Math.max(max, conversation.last_admin_message_id ?? 0),
      0
    );
    supportNotificationRef.current = Math.max(supportNotificationRef.current, latestAdminId);
  }, [isSupportModalOpen, supportConversationList]);

  const handleSecurityChange = (event) => {
    const { name, value } = event.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
  };

  const handleSecuritySubmit = async (event) => {
    event.preventDefault();
    if (isSecuritySaving) return;

    if (!passwords.current || !passwords.next) {
      toast.error('Preencha a senha atual e a nova senha.');
      return;
    }

    if (passwords.next.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (passwords.next !== passwords.confirm) {
      toast.error('A confirmação da senha não confere.');
      return;
    }

    setIsSecuritySaving(true);
    try {
      const payload = {
        currentPassword: passwords.current,
        newPassword: passwords.next
      };

      await api.put('/auth/password', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Senha alterada com sucesso!');
      setPasswords(getInitialSecurityPasswords());
      setIsSecurityModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível atualizar a senha.');
    } finally {
      setIsSecuritySaving(false);
    }
  };

  useEffect(() => {
    if (!isSupportModalOpen) return undefined;
    loadSupportConversations();
    const interval = setInterval(() => {
      if (supportConversation?.id) {
        fetchSupportMessages(supportConversation.id);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isSupportModalOpen, loadSupportConversations, fetchSupportMessages, supportConversation?.id]);

  useEffect(() => {
    if (!isSupportModalOpen) return;
    const node = supportListRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [supportMessages, isSupportModalOpen]);

  useEffect(() => {
    if (!isQuickPanelOpen || quickPanelTab !== 'favorites') return undefined;
    if (!token) {
      setFavoritePanelItems([]);
      setFavoritePanelLoading(false);
      return undefined;
    }
    let active = true;
    setFavoritePanelLoading(true);
    api
      .get('/favorites')
      .then((res) => {
        if (!active) return;
        setFavoritePanelItems(res.data?.data ?? []);
      })
      .catch((error) => {
        if (!active) return;
        console.error(error);
        if (error?.code === 'ERR_NETWORK') {
          setFavoritePanelItems([]);
          return;
        }
        const status = error?.response?.status;
        const message = String(error?.response?.data?.message || '').toLowerCase();
        const likelyTokenIssue =
          message.includes('token') || message.includes('sessão') || message.includes('autentica');
        if (status === 401 || status === 403) {
          if (!likelyTokenIssue) {
            toast.error('Sua sessão expirou. Faça login novamente para ver seus favoritos.');
          }
        } else {
          toast.error('Não foi possível carregar seus favoritos.');
        }
        setFavoritePanelItems([]);
      })
      .finally(() => {
        if (active) setFavoritePanelLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isQuickPanelOpen, quickPanelTab, token]);


  return (
    <section className="dashboard min-h-screen bg-[var(--ts-bg)] px-4 pb-16 pt-2 sm:px-6 lg:px-8 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <CloseBackButton />
        <div className="space-y-3">
          {supportAlert?.conversationId && !isSupportModalOpen && (
            <div
              className="flex flex-col rounded-3xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              role="status"
            >
              <div>
                <p className="text-sm font-semibold text-emerald-800">Suporte respondeu!</p>
                <p className="text-xs text-emerald-700">{supportAlert.message}</p>
              </div>
              <button
                type="button"
                className="mt-3 inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-white sm:mt-0"
                onClick={() => openSupportChat(supportAlert.conversationId)}
              >
                Abrir chat
              </button>
            </div>
          )}
          {newOrderIds.length > 0 && (
            <div className="rounded-3xl border border-yellow-200 bg-gradient-to-r from-yellow-50 to-white px-4 py-3 text-sm text-yellow-800 shadow-sm">
              Você recebeu {newOrderIds.length}{' '}
              {newOrderIds.length === 1 ? 'nova solicitação de compra' : 'novas solicitações de compra'}.
              Confira em <strong>Gerenciar pedidos</strong>.
            </div>
          )}
        </div>

        <div className="relative overflow-visible rounded-[36px] border border-black/5 bg-white p-6 shadow-[0_24px_50px_-34px_rgba(0,0,0,0.55)]">
          <img
            src={watermarkLogoSrc}
            alt="TempleSale logo"
            className="pointer-events-none absolute top-[-4px] right-[-14px] h-40 w-40 opacity-20 mix-blend-multiply blur-sm lg:hidden"
          />
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <UserCard
              user={user}
              userAvatar={userAvatar}
              userInitial={userInitial}
              avatarMenuOpen={isAvatarMenuOpen}
              onAvatarToggle={toggleAvatarMenu}
              avatarMenuRef={avatarMenuRef}
            />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton
                as={Link}
                to="/sales-requests"
                icon={<ArrowRightIcon className="h-4 w-4 text-white" />}
                className={`min-w-[180px] ${
                  newOrderIds.length > 0
                    ? 'dashboard-order-summary__cta dashboard-order-summary__cta--highlight'
                    : ''
                }`}
              >
                {newOrderIds.length > 0 ? (
                  <span className="flex items-center gap-2">
                    <span>Gerenciar pedidos</span>
                    <span className="dashboard-order-summary__badge">+{newOrderIds.length}</span>
                  </span>
                ) : (
                  'Gerenciar pedidos'
                )}
              </PrimaryButton>
              {sellerProfilePath && (
                <PrimaryButton
                  as={Link}
                  to={sellerProfilePath}
                  variant="secondary"
                  className="min-w-[180px]"
                >
                  Meu perfil público
                </PrimaryButton>
              )}

            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--ts-muted)]">
            <span>Pedidos totais: {orderSummary.total}</span>
            <span>Pendentes: {orderSummary.pending}</span>
            <span>Confirmados: {orderSummary.confirmed}</span>
            {newOrderIds.length > 0 && (
              <span className="rounded-full border border-[rgba(200,178,106,0.45)] bg-[rgba(200,178,106,0.18)] px-2 py-0.5 text-xs font-semibold text-[var(--ts-text)]">
                +{newOrderIds.length} novas solicitações
              </span>
            )}
          </div>

          <QuickAccessBar className="mt-6 w-full gap-3">
            <button
              type="button"
              onClick={openFavoritesPanel}
              aria-label="Abrir curtidas"
              className="flex min-w-[220px] flex-1 items-center justify-between gap-3 rounded-2xl border border-black/5 bg-[var(--ts-card)] px-4 py-3 text-left shadow-[0_12px_22px_-18px_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-24px_rgba(0,0,0,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(200,178,106,0.5)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-[var(--ts-surface)] text-[var(--ts-gold)] shadow-inner shadow-black/5">
                  <HeartIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--ts-muted)]">Coleção</p>
                  <p className="text-sm font-semibold text-[var(--ts-text)]">Curtidas</p>
                </div>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-[var(--ts-muted)]" />
            </button>
            <button
              type="button"
              onClick={openOrdersPanel}
              aria-label="Abrir vendas confirmadas"
              className="flex min-w-[220px] flex-1 items-center justify-between gap-3 rounded-2xl border border-black/5 bg-[var(--ts-card)] px-4 py-3 text-left shadow-[0_12px_22px_-18px_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-24px_rgba(0,0,0,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(200,178,106,0.5)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-[var(--ts-surface)] text-[var(--ts-cta)] shadow-inner shadow-black/5">
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--ts-muted)]">Vendas</p>
                  <p className="text-sm font-semibold text-[var(--ts-text)]">
                    {newOrderIds.length ? 'Pedidos com novidades' : 'Painel de vendas'}
                  </p>
                </div>
              </div>
              {newOrderIds.length > 0 ? (
                <span className="rounded-full border border-[rgba(200,178,106,0.45)] bg-[rgba(200,178,106,0.18)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ts-text)]">
                  +{newOrderIds.length}
                </span>
              ) : (
                <ArrowRightIcon className="h-4 w-4 text-[var(--ts-muted)]" />
              )}
            </button>
          </QuickAccessBar>
          <div className="mt-5 flex justify-end">

          {false && isOwner && !isSold && ( // nao perder esse botao agora ele esta bloqueado só apagar {false && isOwner && !isSold && ( e o botao volta ! 
            <Link
              to={BOOST_LINK_TARGET}
              state={BOOST_LINK_STATE}
              className="inline-flex items-center gap-2 rounded-full border border-transparent bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-400"
            >
              Impulsionar anúncio
            </Link>
 )} 
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            
            <div className="rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_24px_45px_-34px_rgba(0,0,0,0.5)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-[var(--ts-muted)]">Atalhos rápidos</p>
                  <h2 className="dashboard-title text-xl font-semibold text-[var(--ts-text)]">Organize seu ritmo</h2>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[var(--ts-muted)]">
                  Atualização automática
                </span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ActionCard
                  title="Meus anúncios"
                  description="Revise estoque, preços e histórico de exibição."
                  icon={<ShopIcon className="h-5 w-5 text-[var(--ts-muted)]" />}
                  to="/my-products"
                  className="h-full min-h-[140px]"
                />
                <ActionCard
                  title="Mensagens"
                  description="Responda compradores e acompanhe conversas ativas."
                  icon={<MessageIcon className="h-5 w-5 text-[var(--ts-muted)]" />}
                  to="/messages"
                  className="h-full min-h-[140px]"
                />
                <ActionCard
                  title="Novo produto"
                  description="Publique rapidamente com fotos, descrições e preços."
                  icon={<PlusIcon className="h-5 w-5 text-[var(--ts-muted)]" />}
                  to="/new-product"
                  className="h-full min-h-[140px]"
                />
                <ActionCard
                  ref={purchaseActionRef}
                  title="Minhas compras"
                  description="Reveja pedidos confirmados, acompanhe o contato e avalie vendedores."
                  icon={<BagIcon className="h-5 w-5 text-[var(--ts-muted)]" />}
                  to="/buyer-purchases"
                  badge={purchaseBadge}
                  className={purchaseActionClasses}
                  onClick={() => markOrdersSeen?.()}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_24px_45px_-34px_rgba(0,0,0,0.5)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-[var(--ts-muted)]">Suporte</p>
                  <h3 className="dashboard-title text-lg font-semibold text-[var(--ts-text)]">Tem dúvidas?</h3>
                </div>
                <MessageIcon className="h-6 w-6 text-[var(--ts-muted)]" />
              </div>
              <p className="mt-3 text-sm text-[var(--ts-muted)]">
                Converse com o time operacional e acompanhe o histórico em tempo real.
              </p>
              {supportAlert && (
                <p className="mt-3 rounded-2xl border border-[rgba(31,143,95,0.25)] bg-[rgba(31,143,95,0.12)] px-3 py-2 text-xs font-semibold text-[var(--ts-text)]">
                  {supportAlert.message}
                </p>
              )}
              <PrimaryButton
                variant="secondary"
                icon={<MessageIcon className="h-4 w-4 text-[var(--ts-muted)]" />}
                className="min-w-[180px]"
                onClick={() => openSupportChat()}
              >
                Conversar com o suporte
              </PrimaryButton>
            </div>

            <div className="rounded-[32px] border border-black/5 bg-white p-6 shadow-[0_24px_45px_-34px_rgba(0,0,0,0.5)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-[var(--ts-muted)]">Conta & privacidade</p>
                  <h3 className="dashboard-title text-lg font-semibold text-[var(--ts-text)]">Ajustes essenciais</h3>
                </div>
                <CogIcon className="h-6 w-6 text-[var(--ts-muted)]" />
              </div>
              <p className="mt-3 text-sm text-[var(--ts-muted)]">
                Mantenha a segurança em dia, sincronize termos aceitos e revise permissões.
              </p>
              <div className="mt-4 rounded-2xl border border-gray-100 bg-[var(--ts-surface)] p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--ts-muted)]">Idioma</p>
                  <p className="text-sm font-semibold text-[var(--ts-text)]">Idioma da interface</p>
                  <p className="text-xs text-[var(--ts-muted)]">
                    Escolha como deseja ver o app.
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LOCALE_OPTIONS.map((option) => {
                    const isActive = option.value === activeLocale;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setLocale(option.value)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          isActive
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <PrimaryButton
                  variant="muted"
                  className="px-3 py-1 text-[10px] uppercase tracking-[0.3em]"
                  icon={<CogIcon className="h-3 w-3 text-[var(--ts-muted)]" />}
                  onClick={() => setIsConfigPanelOpen(true)}
                >
                  Painel lateral
                </PrimaryButton>
                <PrimaryButton
                  as={Link}
                  to="/edit-profile"
                  variant="secondary"
                  className="flex-1 min-w-[130px]"
                  icon={<ShieldIcon className="h-4 w-4 text-[var(--ts-muted)]" />}
                >
                  Editar perfil
                </PrimaryButton>
                <PrimaryButton
                  variant="secondary"
                  className="flex-1 min-w-[130px]"
                  icon={<ShieldIcon className="h-4 w-4 text-[var(--ts-muted)]" />}
                  onClick={() => {
                    setPasswords(getInitialSecurityPasswords());
                    setIsSecurityModalOpen(true);
                  }}
                >
                  Segurança
                </PrimaryButton>
                <PrimaryButton
                  variant="secondary"
                  className="flex-1 min-w-[130px]"
                  icon={<CogIcon className="h-4 w-4 text-[var(--ts-muted)]" />}
                  onClick={() => setIsTermsPanelOpen(true)}
                >
                  Termos
                </PrimaryButton>
                <PrimaryButton
                  variant="secondary"
                  className="flex-1 min-w-[130px]"
                  icon={<CogIcon className="h-4 w-4 text-[var(--ts-muted)]" />}
                  onClick={() => setIsPrivacyPanelOpen(true)}
                >
                  Privacidade
                </PrimaryButton>
                <PrimaryButton
                  variant="accent"
                  className="flex-1 min-w-[130px]"
                  icon={<ArrowRightIcon className="h-4 w-4 text-[#1a1d21]" />}
                  onClick={logout}
                >
                  Sair
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--ts-muted)]">
          Acompanhe suas métricas principais, organize anúncios e mantenha a segurança em dia.
        </p>
      </div>

      {isQuickPanelOpen && (
        <>
          <div className="home-drawer__overlay" onClick={closeQuickPanel} aria-hidden="true" />
          <div className="home-drawer" role="dialog" aria-modal="true">
            <header className="home-drawer__header">
              <nav className="home-drawer__tabs" aria-label="Painéis rápidos">
                
                <button
                  type="button"
                  className={`home-drawer__tab ${quickPanelTab === 'favorites' ? 'is-active' : ''}`}
                  onClick={() => setQuickPanelTab('favorites')}
                >
                  Curtidas <span>{favoritePanelItems.length}</span>
                </button>
                <button
                  type="button"
                  className={`home-drawer__tab ${quickPanelTab === 'orders' ? 'is-active' : ''}`}
                  onClick={() => setQuickPanelTab('orders')}
                >
                  Vendas {orderSummary.total ? <span>({orderSummary.total})</span> : null}
                </button>
              </nav>
              <button type="button" className="home-drawer__close" onClick={closeQuickPanel}>
                ✕
              </button>
            </header>
            <div className="home-drawer__body">
              {quickPanelTab === 'favorites' ? (
                <div className="home-drawer__section">
                  <div className="flex items-start justify-between gap-3">
                    <p className="home-drawer__eyebrow">Coleção pessoal</p>
                    <button
                      type="button"
                      className="home-drawer__close"
                      onClick={closeQuickPanel}
                      aria-label="Fechar painel de curtidas"
                    >
                      ✕
                    </button>
                  </div>
                  <h2 className="home-drawer__title">
                    {favoritePanelItems.length
                      ? `Você tem ${favoritePanelItems.length} curtida${
                          favoritePanelItems.length > 1 ? 's' : ''
                        }`
                      : 'Nenhum favorito salvo'}
                  </h2>

                  <div className="home-drawer__content">
                    {favoritePanelLoading ? (
                      <LoadingBar
                        message="Carregando favoritos..."
                        className="home-drawer__empty"
                        size="sm"
                      />
                    ) : favoritePanelItems.length === 0 ? (
                      <p className="home-drawer__empty">
                        Marque produtos como favoritos para acessá-los rapidamente aqui no painel.
                      </p>
                    ) : (
                      favoritePanelItems.slice(0, 5).map((product) => {
                        const targetProduct = product.product || product;
                        const imageUrl =
                          targetProduct?.image_urls?.[0] ||
                          targetProduct?.image_url ||
                          IMG_PLACEHOLDER;
                        const title = targetProduct?.title || product.title || 'Produto favorito';
                        const priceLabel = isProductFree(targetProduct)
                          ? 'Grátis'
                          : formatProductPrice(targetProduct?.price, targetProduct?.country);
                        return (
                          <Link
                            key={targetProduct?.id ?? product.id ?? product.product_id}
                            to={`/product/${targetProduct?.id ?? product.id ?? product.product_id}`}
                            className="home-fav-card"
                            onClick={closeQuickPanel}
                          >
                            <div className="home-fav-card__image-wrapper">
                              <img
                                src={imageUrl}
                                alt={title}
                                className="home-fav-card__image"
                                loading="eager"
                                decoding="async"
                                onError={(event) => {
                                  event.currentTarget.src = IMG_PLACEHOLDER;
                                  event.currentTarget.onerror = null;
                                }}
                              />
                            </div>
                            <div className="home-fav-card__details">
                              <p className="home-fav-card__title">{title}</p>
                              <p
                                className={`home-fav-card__price ${
                                  isProductFree(targetProduct) ? 'is-free' : ''
                                }`}
                              >
                                {priceLabel}
                              </p>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="home-drawer__section">
                  <div className="flex items-start justify-between gap-3">
                    <p className="home-drawer__eyebrow">Vendas</p>
                    <button
                      type="button"
                      className="home-drawer__close"
                      onClick={closeQuickPanel}
                      aria-label="Fechar painel de vendas"
                    >
                      ✕
                    </button>
                  </div>
                  <h2 className="home-drawer__title">
                    {orderSummary.total
                      ? `Você tem ${orderSummary.total} pedidos`
                      : 'Nenhuma venda registrada ainda'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {orderSummary.pending} pendente{orderSummary.pending === 1 ? '' : 's'} •{' '}
                    {orderSummary.confirmed} confirmado
                    {orderSummary.confirmed === 1 ? '' : 's'}
                  </p>
                  <div className="home-drawer__content">
                    {sellerOrdersList.length === 0 ? (
                      <p className="home-drawer__empty">
                        Assim que houver novas vendas elas aparecerão aqui.
                      </p>
                    ) : (
                      sellerOrdersList.slice(0, 5).map((order) => {
                        const orderId = order.id;
                        const statusLabel = (order.status || '').replace(/_/g, ' ');
                        return (
                          <div
                            key={orderId}
                            className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-slate-50 p-3 text-sm"
                          >
                            <div className="flex flex-col gap-1">
                              <p className="font-semibold text-gray-700">
                                {order.product_title || order.product?.title || `Pedido #${orderId}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatOrderDatetime(order.created_at || order.updated_at)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-600">
                                {statusLabel || 'Status'}
                                {newOrderIds.includes(orderId) ? ' • Novo' : ''}
                              </span>
                              <span className="text-[12px] text-gray-500">
                                {order.quantity ? `${order.quantity}x` : '—'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <Link
                      to="/sales-requests"
                      className="dashboard-button bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 text-sm font-semibold rounded-xl shadow-sm hover:shadow transition"
                      onClick={closeQuickPanel}
                    >
                      Ver pedidos
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

    
 {false && isOwner && !isSold && ( // botoes bonitos nao apagar 
      <MobileMenu
        actions={[
          { label: 'Curtidas', icon: <HeartIcon className="h-4 w-4 text-rose-500" />, onClick: openFavoritesPanel },
          {
            label: 'Vendas',
            icon: <CheckIcon className="h-4 w-4 text-emerald-500" />,
            onClick: openOrdersPanel
          }
        ]}
      />
    )}


      {/* PAINEL DE CONFIGURAÇÕES */}
      <div
        className={`fixed inset-0 z-40 transition duration-300 ${
          isConfigPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!isConfigPanelOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            isConfigPanelOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsConfigPanelOpen(false)}
        />
        <aside
          className={`fixed top-0 right-0 h-full w-full max-w-xs bg-white shadow-2xl border-l border-gray-100 transition-transform duration-300 ${
            isConfigPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Configurações</p>
              <p className="text-base font-semibold text-gray-800">Ajustes rápidos</p>
            </div>
            <button
              type="button"
              onClick={() => setIsConfigPanelOpen(false)}
              className="text-gray-500 hover:text-gray-700 transition"
              aria-label="Fechar painel"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <button
              type="button"
              className="text-left rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm hover:bg-gray-100 transition"
              onClick={() => {
                setIsConfigPanelOpen(false);
                setIsSecurityModalOpen(true);
                setPasswords(getInitialSecurityPasswords());
              }}
            >
              <p className="font-semibold text-gray-800">Segurança</p>
              <p className="text-sm text-gray-500 mt-1">
                Alterar senha ou revisar como mantém sua conta protegida.
              </p>
            </button>

            <button
              type="button"
              className="text-left rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm hover:bg-gray-100 transition"
              onClick={() => {
                setIsConfigPanelOpen(false);
                setIsTermsPanelOpen(true);
              }}
            >
              <p className="font-semibold text-gray-800">Termos e Política</p>
              <p className="text-sm text-gray-500 mt-1">Diretrizes da plataforma e obrigações do usuário.</p>
            </button>

            <button
              type="button"
              className="text-left rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm hover:bg-gray-100 transition"
              onClick={() => {
                setIsConfigPanelOpen(false);
                openSupportChat();
              }}
            >
              <p className="font-semibold text-gray-800">Suporte</p>
              <p className="text-sm text-gray-500 mt-1">
                Precisa de ajuda? Abra um chamado com nossa equipe de suporte.
              </p>
            </button>

            <button
              type="button"
              className="text-left rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm hover:bg-gray-100 transition"
              onClick={() => {
                setIsConfigPanelOpen(false);
                setIsPrivacyPanelOpen(true);
              }}
            >
              <p className="font-semibold text-gray-800">Central de Privacidade</p>
              <p className="text-sm text-gray-500 mt-1">
                Saiba como tratamos seus dados, seus direitos e opções de controle.
              </p>
            </button>
          </div>
        </aside>
      </div>
      {isSecurityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!isSecuritySaving) {
                setIsSecurityModalOpen(false);
              }
            }}
          />
          <form
            onSubmit={handleSecuritySubmit}
            className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-gray-400">Segurança</p>
                <h3 className="text-2xl font-semibold text-gray-900">Trocar senha</h3>
                <p className="text-sm text-gray-500">
                  Atualize sua senha com uma nova combinação forte e segura.
                </p>
              </div>
              <button
                type="button"
                className="text-gray-500 transition hover:text-gray-700"
                onClick={() => {
                  if (!isSecuritySaving) {
                    setIsSecurityModalOpen(false);
                  }
                }}
                aria-label="Fechar modal de segurança"
              >
                ✕
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="flex flex-col text-sm text-gray-600">
                Senha atual
                <input
                  type="password"
                  name="current"
                  value={passwords.current}
                  onChange={handleSecurityChange}
                  placeholder="Digite a senha atual"
                  className="mt-2 rounded-2xl border border-gray-200 px-4 py-3 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isSecuritySaving}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Nova senha
                <input
                  type="password"
                  name="next"
                  value={passwords.next}
                  onChange={handleSecurityChange}
                  placeholder="No mínimo 6 caracteres"
                  className="mt-2 rounded-2xl border border-gray-200 px-4 py-3 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isSecuritySaving}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Confirmar nova senha
                <input
                  type="password"
                  name="confirm"
                  value={passwords.confirm}
                  onChange={handleSecurityChange}
                  placeholder="Repita a nova senha"
                  className="mt-2 rounded-2xl border border-gray-200 px-4 py-3 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isSecuritySaving}
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                className="shrink-0 rounded-2xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-800"
                onClick={() => {
                  setPasswords(getInitialSecurityPasswords());
                  if (!isSecuritySaving) {
                    setIsSecurityModalOpen(false);
                  }
                }}
                disabled={isSecuritySaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="shrink-0 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:bg-blue-400"
                disabled={isSecuritySaving}
              >
                {isSecuritySaving ? 'Salvando...' : 'Trocar senha'}
              </button>
            </div>
          </form>
        </div>
      )}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!supportSending) {
                setIsSupportModalOpen(false);
              }
            }}
          />
          <form
            onSubmit={handleSupportSubmit}
            className="relative z-10 flex h-[85vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-black/10"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Suporte</p>
                <h3 className="text-2xl font-semibold text-slate-900">Fale com o time operacional</h3>
                <p className="text-sm text-slate-500">
                  Compartilhe o que precisa e acompanhe as respostas em tempo real.
                </p>
              </div>
              <button
                type="button"
                className="text-slate-500 transition hover:text-slate-700"
                onClick={() => {
                  if (!supportSending) {
                    setIsSupportModalOpen(false);
                  }
                }}
                aria-label="Fechar chat de suporte"
              >
                ✕
              </button>
            </header>

            <div
              ref={supportListRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
            >
              {supportLoading ? (
                <LoadingBar message="Carregando a conversa..." className="text-sm text-slate-500" size="sm" />
              ) : supportMessages.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Aqui vão aparecer as mensagens trocadas com o suporte. Envie a primeira agora!
                </p>
              ) : (
                supportMessages.map((message) => {
                  const isUserMessage = message.sender_type === 'user';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isUserMessage
                            ? 'bg-blue-600 text-white shadow-[0_3px_6px_rgba(15,23,42,0.2)]'
                            : 'bg-slate-100 text-slate-900 shadow-inner'
                        }`}
                      >
                        <span
                          className={`text-[10px] uppercase tracking-[0.4em] ${
                            isUserMessage ? 'text-white/70' : 'text-slate-400'
                          }`}
                        >
                          {isUserMessage ? 'Você' : 'Suporte'}
                        </span>
                        <p className="mt-1 whitespace-pre-line break-words">{message.content}</p>
                        <span
                          className={`mt-2 block text-[11px] ${
                            isUserMessage ? 'text-white/60' : 'text-slate-400'
                          }`}
                        >
                          {formatSupportTime(message.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-5">
              {(!supportConversation?.subject || supportConversation?.subject === '') && (
                <label className="block text-[11px] font-semibold uppercase tracking-[0.38em] text-slate-500">
                  Assunto
                  <input
                    type="text"
                    value={supportSubject}
                    onChange={(event) => setSupportSubject(event.target.value)}
                    disabled={supportSending}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Assunto opcional da conversa"
                  />
                  <span className="mt-1 text-[11px] font-normal text-slate-400">
                    Ajuda o time a entender o que precisa.
                  </span>
                </label>
              )}
              {supportConversation?.subject && (
                <p className="text-xs text-slate-500">
                  Assunto atual:{' '}
                  <span className="font-semibold text-slate-900">{supportConversation.subject}</span>
                </p>
              )}

              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Escreva sua mensagem
                <textarea
                  rows={4}
                  value={supportInput}
                  onChange={(event) => setSupportInput(event.target.value)}
                  disabled={supportSending}
                  placeholder="Descreva o que aconteceu, compartilhe prints ou o que for importante."
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  {supportConversation?.id ? 'Conversa conectada' : 'Nova conversa'}
                </span>
                <button
                  type="submit"
                  className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={supportSending || !supportInput.trim()}
                >
                  {supportSending ? 'Enviando...' : 'Enviar para o suporte'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {isTermsPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsTermsPanelOpen(false)}
          />
          <aside className="relative z-10 w-full max-w-md rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl text-[11px] sm:text-xs">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Termos e Política</p>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Documentos aceitos</h3>
                <p className="mt-1 text-[10px] sm:text-xs text-gray-500">
                  Aqui estão as versões e datas que você validou para continuar usando a plataforma.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar termos"
                onClick={() => setIsTermsPanelOpen(false)}
                className="text-gray-500 transition hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {legalEntries.map((entry) => (
                <details
                  key={entry.label}
                  className="group rounded-2xl border border-gray-100 bg-gray-50 p-2 shadow-sm text-[11px] sm:text-xs"
                >
                  <summary className="flex items-center justify-between gap-2 list-none cursor-pointer text-gray-900">
                    <span className="font-semibold">{entry.label}</span>
                    <span className="text-[11px] uppercase tracking-[0.3em] text-gray-500">
                      {entry.version ?? 'Versão desconhecida'}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-500 transition-transform duration-150 group-open:rotate-180">
                      ⌄
                    </span>
                  </summary>
                  <div className="mt-2 text-gray-500">
                    <p className="text-[10px]">Atualizado em {formatLegalDate(entry.date)}</p>
                  </div>
                </details>
              ))}
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 p-3 text-[10px] sm:text-[11px] text-gray-600">
                <p className="font-semibold text-gray-800">Compromisso de uso responsável</p>
                <p className="mt-2">
                  Mantenha seus dados atualizados e leia as alterações sempre que forem publicadas. Ao continuar
                  usando a TempleSale, você confirma que entende e aceita essas diretrizes.
                </p>
              </div>
            </div>

            <section className="mt-4 rounded-2xl border border-gray-100 bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white shadow-xl">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-white/80">Garantia</p>
              <p className="mt-2 text-[10px] sm:text-xs">
                Esses documentos são regulamentados pela nossa equipe de compliance. Caso surjam dúvidas ou
                divergências, entre em contato com o suporte e solicite revisão oficial do termo.
              </p>
              <p className="mt-3 text-xs text-white/70">Atualizado automaticamente conforme nossa base de legalidade.</p>
              <a
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 transition hover:bg-white"
                href="/politica-de-privacidade"
                target="_blank"
                rel="noreferrer"
              >
                Ler termos completo
              </a>
            </section>
          </aside>
        </div>
      )}
      {isPrivacyPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsPrivacyPanelOpen(false)}
          />
          <aside className="relative z-10 w-full max-w-md rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl text-[11px] sm:text-xs">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-400">Central de Privacidade</p>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Você no controle dos dados</h3>
                <p className="mt-1 text-[10px] sm:text-xs text-gray-500">
                  Consolidamos abaixo tudo que a TempleSale faz com suas informações e como você pode agir sobre cada
                  parte.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar central de privacidade"
                onClick={() => setIsPrivacyPanelOpen(false)}
                className="text-gray-500 transition hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {privacyHighlights.map((section) => (
                <details
                  key={section.title}
                  className="group rounded-2xl border border-gray-100 bg-gray-50 p-2 shadow-sm text-[11px] sm:text-xs"
                >
                  <summary className="flex items-center justify-between gap-2 list-none cursor-pointer text-gray-900">
                    <span className="font-semibold">{section.title}</span>
                    <span className="text-[10px] font-semibold text-gray-500 transition-transform duration-150 group-open:rotate-180">
                      ⌄
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1 text-gray-600">
                    {section.description && (
                      <p className="text-[10px] sm:text-xs text-gray-700">{section.description}</p>
                    )}
                    {section.list && (
                      <ul className="space-y-1 pl-3 text-[10px] sm:text-xs text-gray-700 list-disc">
                        {section.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-3 text-[10px] sm:text-[11px] text-gray-700">
              <p className="font-semibold text-gray-800">Gerencie o que compartilha</p>
              <p className="mt-2 text-[10px] sm:text-xs">
                Acesse o perfil para revisar seus dados, desabilitar comunicações promocionais ou enviar documentos
                para atualização. A transparência começa por aqui.
              </p>
              <p className="mt-2 text-[9px] text-gray-500">
                Cookies são usados somente para manter sessão, melhorar recomendações e proteger contra abusos.
              </p>
            </div>

            <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white shadow-xl">
              <div>
                <h5 className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                  Precisa de ajuda?
                </h5>
                <p className="mt-2 text-[10px] sm:text-xs text-white/90">
                  Fale com nosso encarregado de privacidade e receba o dossiê completo dos registros tratados.
                </p>
              </div>
              <a
                href="mailto:privacidade@templesale.com"
                className="rounded-2xl border border-white/30 bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-black/20 transition hover:bg-white"
              >
                Enviar solicitação
              </a>
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}

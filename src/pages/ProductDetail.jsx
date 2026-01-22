// frontend/src/pages/ProductDetail.jsx
// Página com os detalhes completos de um produto e ações de contato.
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Heart,
  Send,
  Share2,
  MapPin,
  MessageCircle,
  Eye,
  X as CloseIcon,
  Copy as CopyIcon,
  ChevronLeft,
  PhoneCall,
  ShoppingCart,
  Home,
  Ruler,
  BedDouble,
  Bath,
  Car,
  Building2,
  Tag
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import ImageViewerModal from '../components/ImageViewerModal.jsx';
import LoadingBar from '../components/LoadingBar.jsx';
import SoldBadge from '../components/SoldBadge.jsx';
import SellerProductGrid from '../components/SellerProductGrid.jsx';
import { getCountryLabel, normalizeCountryCode } from '../data/countries.js';
import { getCurrencySettings, resolveCurrencyFromCountry } from '../utils/currency.js';
import { PRODUCT_CONTEXT_PREFIX, buildProductContextPayload } from '../utils/productContext.js';
import { isProductFree, getProductPriceLabel } from '../utils/product.js';
import { OFFER_PREFIX } from '../utils/offers.js';
import { asStars } from '../utils/rating.js';
import { buildProductImageEntries, parseImageList, toAbsoluteImageUrl } from '../utils/images.js';
import { IMAGE_KIND, IMAGE_KIND_BADGE_LABEL } from '../utils/imageKinds.js';
import useImageViewer from '../hooks/useImageViewer.js';
import useLoginPrompt from '../hooks/useLoginPrompt.js';
import { getPhoneActions } from '../utils/phone.js';
import { buildProductMessageLink } from '../utils/messageLinks.js';

const getInitial = (value) => {
  if (!value) return 'S';
  const letter = value.trim().charAt(0);
  return letter ? letter.toUpperCase() : 'S';
};

const viewCountFromProduct = (product) => {
  if (!product) return 0;
  const raw = Number(product.views_count ?? product.view_count ?? 0);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
};

const favoriteCountFromProduct = (product) => {
  if (!product) return 0;
  const raw = Number(product.likes_count ?? product.likes ?? product.favorites_count ?? 0);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
};

const updateProductMetric = (product, candidates, nextValue) => {
  if (!product) return product;
  const normalized = Math.max(0, Number(nextValue) || 0);
  const existingField = candidates.find((field) =>
    Object.prototype.hasOwnProperty.call(product, field)
  );
  const targetField = existingField || candidates[0];
  return { ...product, [targetField]: normalized };
};

const applyViewDelta = (product, delta = 0) => {
  if (!product) return product;
  const nextValue = viewCountFromProduct(product) + delta;
  return updateProductMetric(product, ['views_count', 'view_count'], nextValue);
};

const applyFavoriteDelta = (product, delta = 0) => {
  if (!product) return product;
  const nextValue = favoriteCountFromProduct(product) + delta;
  return updateProductMetric(product, ['likes_count', 'likes', 'favorites_count'], nextValue);
};

const getMessageIdentifier = (message) => {
  if (!message) return '';
  if (message.id) return String(message.id);
  if (message.message_id) return String(message.message_id);
  const productField = message.product_id ?? 'product';
  const senderField = message.sender_id ?? message.user_id ?? 'sender';
  const receiverField = message.receiver_id ?? 'receiver';
  const timestamp = message.created_at ?? message.updated_at ?? Date.now();
  return `${productField}-${senderField}-${receiverField}-${timestamp}`;
};

const normalizeProductLinks = (links) => {
  if (!links) return [];
  if (Array.isArray(links)) {
    return links.filter((link) => link && link.url);
  }
  if (typeof links === 'string') {
    try {
      const parsed = JSON.parse(links);
      if (Array.isArray(parsed)) {
        return parsed.filter((link) => link && link.url);
      }
    } catch {
      return [];
    }
  }
  return [];
};

const formatMessageTimestamp = (value) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return '';
  }
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isImageUrl = (value) =>
  /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(String(value || ''));

const buildOpenStreetMapEmbedUrl = (lat, lng) => {
  const delta = 0.01;
  const minLat = lat - delta;
  const maxLat = lat + delta;
  const minLng = lng - delta;
  const maxLng = lng + delta;
  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox
  )}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
};

const buildOpenStreetMapLink = (lat, lng) =>
  `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(
    lng
  )}#map=16/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`;

const buildLocationQuery = (city, state, country) =>
  [city, state, country].filter(Boolean).join(', ');

const QUESTION_PAGE_SIZE = 4;
const MESSAGE_LIMIT = 200;
const REGION_RESULT_LIMIT = 6;
const REGION_BOUNDS_DELTA = 0.03;
const QUICK_QUESTION_PRESETS = [
  'Eu posso visitar?',
  'Aceita permuta?',
  'Me retorne no WhatsApp!',
  'Tenho interesse, está disponível?'
];
const DESKTOP_LAYOUT_WIDTH = 1024;

const buildRegionBounds = (lat, lng, delta = REGION_BOUNDS_DELTA) => ({
  minLat: lat - delta,
  maxLat: lat + delta,
  minLng: lng - delta,
  maxLng: lng + delta
});

const HIGHLIGHT_ICON_BY_LABEL = {
  'Tipo de imóvel': Home,
  'Área (m²)': Ruler,
  Quartos: BedDouble,
  Banheiros: Bath,
  Vagas: Car,
  Condomínio: Building2,
  'Tipo de aluguel': Building2
};

const resolveHighlightIcon = (label) => HIGHLIGHT_ICON_BY_LABEL[label] || Tag;

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [productQuestions, setProductQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState('');
  const questionPollingRef = useRef(null);
  const seenQuestionStateRef = useRef(new Map());
  const initialQuestionsLoadedRef = useRef(false);
  const [visibleQuestionCount, setVisibleQuestionCount] = useState(QUESTION_PAGE_SIZE);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [activeReplyQuestionId, setActiveReplyQuestionId] = useState(null);
  const [answerLoadingId, setAnswerLoadingId] = useState(null);
  const [favorite, setFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPortalRoot] = useState(() => {
    if (typeof document === 'undefined') return null;
    const node = document.createElement('div');
    node.setAttribute('data-templesale-product-viewer', 'true');
    return node;
  });
  const {
    isOpen: isSellerAvatarViewerOpen,
    src: sellerAvatarViewerSrc,
    alt: sellerAvatarViewerAlt,
    openViewer: openSellerAvatarViewer,
    closeViewer: closeSellerAvatarViewer
  } = useImageViewer();
  const [touchStartX, setTouchStartX] = useState(null);
  const galleryTouchStartXRef = useRef(null);
  const galleryTouchMovedRef = useRef(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerValue, setOfferValue] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [confirmPurchaseOpen, setConfirmPurchaseOpen] = useState(false);
  const [buyerInfo, setBuyerInfo] = useState(null);
  const [mapCoords, setMapCoords] = useState({ lat: null, lng: null, source: null });
  const [mapLoading, setMapLoading] = useState(false);
  const [regionProducts, setRegionProducts] = useState([]);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionError, setRegionError] = useState('');
  const [phoneActionsOpen, setPhoneActionsOpen] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [floatingBarHeight, setFloatingBarHeight] = useState(0);
  const floatingBarRef = useRef(null);
  const { user, token } = useContext(AuthContext);
  const promptLogin = useLoginPrompt();
  const requireAuth = useCallback(
    (message) => {
      if (token) return true;
      return promptLogin(message);
    },
    [promptLogin, token]
  );
  const handleGoBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem('templesale:return-target');
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
  const viewIncrementPending = useRef(false);
  const questionRefs = useRef(new Map());
  const replyInputRefs = useRef(new Map());
  const questionInputRef = useRef(null);
  const highlightHandledRef = useRef(false);
  const [highlightQuestionKey, setHighlightQuestionKey] = useState('');
  const sellerRating = Number(product?.seller_rating_avg ?? 0);
  const { full: fullStars, half: halfStar, empty: emptyStars } = useMemo(
    () => asStars(sellerRating),
    [sellerRating]
  );
  const locCity = product?.city || product?.seller_city || '';
  const locState = product?.state || product?.seller_state || '';
  const locCountry = product?.country || product?.seller_country || '';
  const locRegion = product?.region || product?.zone || product?.district || '';
  const regionLabel = useMemo(() => {
    const candidates = [product?.neighborhood, locCity, locState, locCountry];
    const match = candidates.find((value) => typeof value === 'string' && value.trim());
    return match ? match.trim() : '';
  }, [product?.neighborhood, locCity, locState, locCountry]);
  const breadcrumbItems = useMemo(() => {
    const items = [{ label: 'Home', to: '/' }];
    const seen = new Set();
    const normalize = (value) => String(value || '').trim().toLowerCase();
    const pushUnique = (label) => {
      if (!label) return;
      const key = normalize(label);
      if (!key || seen.has(key)) return;
      seen.add(key);
      items.push({ label });
    };
    const normalizedCountry = normalizeCountryCode(locCountry);
    const countryLabel = getCountryLabel(normalizedCountry) || locCountry;
    pushUnique(countryLabel);
    pushUnique(locState);
    pushUnique(locCity);
    pushUnique(locRegion);
    pushUnique(product?.neighborhood);
    pushUnique(product?.street);
    return items;
  }, [locCity, locCountry, locRegion, locState, product?.neighborhood, product?.street]);
  const latValue = toFiniteNumber(
    product?.lat ?? product?.latitude ?? product?.location_lat ?? product?.location?.lat
  );
  const lngValue = toFiniteNumber(
    product?.lng ?? product?.longitude ?? product?.location_lng ?? product?.location?.lng
  );
  const regionLat = Number.isFinite(latValue) ? latValue : mapCoords.lat;
  const regionLng = Number.isFinite(lngValue) ? lngValue : mapCoords.lng;
  const sellerPhoneRaw = product?.seller_phone ?? product?.sellerPhone ?? '';
  const phoneActions = useMemo(
    () => getPhoneActions(sellerPhoneRaw),
    [sellerPhoneRaw]
  );

  // Sugere anúncios próximos para complementar o anúncio atual.
  useEffect(() => {
    if (!phoneActions) {
      setPhoneActionsOpen(false);
    }
  }, [phoneActions]);

  const broadcastQuestionToStorage = useCallback((payload) => {
    if (typeof window === 'undefined' || !payload) return;
    try {
      window.localStorage.setItem('templesale:product-question', JSON.stringify(payload));
      window.localStorage.removeItem('templesale:product-question');
    } catch {
      // ignore storage issues
    }
  }, []);

  const notifyHeaderAboutProductQuestions = useCallback(
    (questionList) => {
      if (!Array.isArray(questionList) || questionList.length === 0) return;
      const ownerId = Number(product?.user_id);
      const ownerIdValid = Number.isFinite(ownerId);
      const nextState = new Map();
      const incoming = [];

      questionList.forEach((question) => {
        const key = getMessageIdentifier(question);
        if (!key) return;
        const prevEntry = seenQuestionStateRef.current.get(key);
        const hasResponse = Boolean(question.response_content || question.response_created_at);
        nextState.set(key, {
          hasResponse
        });

        if (!prevEntry) {
          if (!ownerIdValid) return;
          const questionAuthorId = Number(question.user_id);
          if (!Number.isFinite(questionAuthorId) || questionAuthorId === ownerId) return;
          incoming.push({
            questionId: key,
            productId: question.product_id,
            sellerId: ownerId,
            questionUserId: questionAuthorId,
            productTitle: question.product_title || product?.title || 'Produto TempleSale',
            content: question.content || '',
            userName: question.user_name || 'Usuário TempleSale',
            createdAt: question.created_at || Date.now(),
            type: 'question'
          });
          return;
        }

        const prevHadResponse = Boolean(prevEntry?.hasResponse);
        if (!prevHadResponse && hasResponse) {
          const questionAuthorId = Number(question.user_id);
          if (!Number.isFinite(questionAuthorId)) return;
          incoming.push({
            questionId: key,
            productId: question.product_id,
            sellerId: ownerId,
            questionUserId: questionAuthorId,
            productTitle: question.product_title || product?.title || 'Produto TempleSale',
            content: question.response_content || '',
            userName: question.response_user_name || 'Vendedor TempleSale',
            createdAt: question.response_created_at || Date.now(),
            type: 'response'
          });
        }
      });

      seenQuestionStateRef.current = nextState;
      if (!initialQuestionsLoadedRef.current) {
        initialQuestionsLoadedRef.current = true;
        return;
      }

      if (!incoming.length || typeof window === 'undefined') return;
      const detail = { questions: incoming };
      window.dispatchEvent(
        new CustomEvent('templesale:product-question', {
          detail
        })
      );
      broadcastQuestionToStorage(detail);
    },
    [product?.title, product?.user_id, broadcastQuestionToStorage]
  );

  useEffect(() => {
    if (!product) return;
    if (latValue !== null && lngValue !== null) {
      setMapCoords((prev) => {
        if (prev.lat === latValue && prev.lng === lngValue && prev.source === 'product') return prev;
        return { lat: latValue, lng: lngValue, source: 'product' };
      });
      setMapLoading(false);
      return;
    }

    const query = buildLocationQuery(locCity, locState, locCountry);
    if (!query) {
      setMapCoords({ lat: null, lng: null, source: null });
      return;
    }

    let active = true;
    setMapLoading(true);
    api
      .get('/geo/forward', { params: { q: query } })
      .then((response) => {
        const latNum = toFiniteNumber(response?.data?.data?.lat);
        const lngNum = toFiniteNumber(response?.data?.data?.lng);
        if (!active) return;
        if (latNum !== null && lngNum !== null) {
          setMapCoords({ lat: latNum, lng: lngNum, source: 'city' });
          return;
        }
        setMapCoords({ lat: null, lng: null, source: null });
      })
      .catch(() => {
        if (!active) return;
        setMapCoords({ lat: null, lng: null, source: null });
      })
      .finally(() => {
        if (active) setMapLoading(false);
      });

    return () => {
      active = false;
    };
  }, [product, latValue, lngValue, locCity, locState, locCountry]);

  const regionQueryParams = useMemo(() => {
    if (!product?.id) return null;
    const params = { sort: 'rank' };
    if (Number.isFinite(regionLat) && Number.isFinite(regionLng)) {
      return {
        ...params,
        ...buildRegionBounds(regionLat, regionLng),
        ...(locCountry ? { country: locCountry } : {})
      };
    }
    if (locCity) {
      return {
        ...params,
        city: locCity,
        ...(locCountry ? { country: locCountry } : {}),
        ...(product?.neighborhood ? { q: product.neighborhood } : {})
      };
    }
    if (locCountry) {
      return { ...params, country: locCountry };
    }
    return null;
  }, [product?.id, product?.neighborhood, regionLat, regionLng, locCity, locCountry]);

  useEffect(() => {
    if (!product?.id || !regionQueryParams) {
      setRegionProducts([]);
      setRegionError('');
      setRegionLoading(false);
      return;
    }

    let active = true;
    setRegionLoading(true);

    api
      .get('/products', { params: regionQueryParams })
      .then((res) => {
        if (!active) return;
        const data = Array.isArray(res.data?.data) ? res.data.data : [];
        const currentId = String(product.id);
        const seen = new Set();
        const next = [];
        for (const item of data) {
          if (!item?.id) continue;
          const itemId = String(item.id);
          if (itemId === currentId || seen.has(itemId)) continue;
          seen.add(itemId);
          next.push(item);
          if (next.length >= REGION_RESULT_LIMIT) break;
        }
        setRegionProducts(next);
        setRegionError('');
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        setRegionError('Não foi possível carregar anúncios da região.');
        setRegionProducts([]);
      })
      .finally(() => {
        if (active) setRegionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [product?.id, regionQueryParams]);

  const fetchProductQuestions = useCallback(async () => {
    if (!product?.id) return;
    setQuestionsLoading(true);
    try {
      const response = await api.get(`/products/${product.id}/questions`);
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setProductQuestions(data);
      setQuestionsError('');
      notifyHeaderAboutProductQuestions(data);
    } catch (err) {
      console.error(err);
      const serverMessage = err?.response?.data?.message;
      setQuestionsError(serverMessage || 'Não foi possível carregar as perguntas.');
    } finally {
      setQuestionsLoading(false);
    }
  }, [notifyHeaderAboutProductQuestions, product?.id]);

  useEffect(() => {
    if (!product?.id) {
      if (questionPollingRef.current) {
        clearInterval(questionPollingRef.current);
        questionPollingRef.current = null;
      }
      questionRefs.current.clear();
      seenQuestionStateRef.current = new Map();
      initialQuestionsLoadedRef.current = false;
      highlightHandledRef.current = false;
      setHighlightQuestionKey('');
      setProductQuestions([]);
      setQuestionsError('');
      setQuestionsLoading(false);
      return;
    }

    questionRefs.current.clear();
    seenQuestionStateRef.current = new Map();
    initialQuestionsLoadedRef.current = false;
    highlightHandledRef.current = false;
    setHighlightQuestionKey('');
    setQuestionsError('');
    setProductQuestions([]);
    setVisibleQuestionCount(QUESTION_PAGE_SIZE);
    setReplyDrafts({});
    setActiveReplyQuestionId(null);
    setAnswerLoadingId(null);

    fetchProductQuestions();
    const intervalId = setInterval(fetchProductQuestions, 12000);
    questionPollingRef.current = intervalId;

    return () => {
      clearInterval(intervalId);
      if (questionPollingRef.current === intervalId) {
        questionPollingRef.current = null;
      }
    };
  }, [fetchProductQuestions, product?.id]);

  useEffect(() => {
    let active = true;
    api
      .get(`/products/${id}`)
      .then((res) => {
        if (active && res.data?.data) {
          let nextProduct = res.data.data;
          if (viewIncrementPending.current) {
            nextProduct = applyViewDelta(nextProduct, 1);
            viewIncrementPending.current = false;
          }
          setProduct(nextProduct);
          setActiveImageIndex(0);
        }
      })
      .catch(() => active && setError('Não foi possível carregar o produto.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let canceled = false;
    viewIncrementPending.current = false;
    api
      .put(`/products/${id}/view`)
      .then(() => {
        if (canceled) return;
        viewIncrementPending.current = true;
        setProduct((prev) => {
          if (!prev) return prev;
          viewIncrementPending.current = false;
          return applyViewDelta(prev, 1);
        });
      })
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, [id]);

  const imageEntries = useMemo(() => buildProductImageEntries(product), [product]);
  const images = useMemo(
    () => imageEntries.map((entry) => entry.url).filter(Boolean),
    [imageEntries]
  );
  const floorplanUrls = useMemo(
    () => parseImageList(product?.floorplan_urls ?? product?.floorplanUrls),
    [product?.floorplan_urls, product?.floorplanUrls]
  );
  const activeImageKind = imageEntries[activeImageIndex]?.kind ?? null;

  const detailLinks = useMemo(() => normalizeProductLinks(product?.links), [product?.links]);

  useEffect(() => {
    if (activeImageIndex > 0 && activeImageIndex >= images.length) {
      setActiveImageIndex(0);
    }
  }, [images, activeImageIndex]);

  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setViewerOpen(false);
      if (e.key === 'ArrowLeft') goPrevImage();
      if (e.key === 'ArrowRight') goNextImage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerOpen, images.length]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!viewerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [viewerOpen]);

  useEffect(() => {
    if (typeof document === 'undefined' || !viewerPortalRoot) return undefined;
    document.body.appendChild(viewerPortalRoot);
    return () => {
      if (viewerPortalRoot.parentNode) viewerPortalRoot.parentNode.removeChild(viewerPortalRoot);
    };
  }, [viewerPortalRoot]);

  useEffect(() => {
    if (!product?.id || !token) {
      setFavorite(false);
      setFavoriteLoading(false);
      return;
    }
    let active = true;
    setFavoriteLoading(true);
    api
      .get(`/favorites/check/${product.id}`)
      .then((res) => {
        if (!active) return;
        const fav = Boolean(res.data?.data?.favorite);
        setFavorite(fav);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setFavoriteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [product?.id, token]);

  useEffect(() => {
    if (!product?.id || !user || !token) {
      setBuyerInfo(null);
      return;
    }
    if (Number(user.id) !== Number(product.user_id)) {
      setBuyerInfo(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await api.get(`/orders/product/${product.id}/buyer`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!active) return;
        if (res.data?.success) {
          setBuyerInfo(res.data.data);
        } else {
          setBuyerInfo(null);
        }
      } catch {
        if (active) setBuyerInfo(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [product?.id, product?.user_id, token, user]);

  const handleSendMessage = async () => {
    if (!requireAuth('Faça login para enviar mensagens.')) return;
    if (!message.trim()) {
      toast.error('Digite uma mensagem antes de enviar.');
      return;
    }
    if (!product?.id) {
      return;
    }
    setSending(true);
    try {
      await api.post(
        `/products/${product.id}/questions`,
        { content: message },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isOwner ? 'Resposta registrada.' : 'Pergunta enviada ao vendedor.');
      setMessage('');
      await fetchProductQuestions();
    } catch (error) {
      const serverMessage = error?.response?.data?.message;
      toast.error(serverMessage || 'Erro ao enviar pergunta pública.');
    } finally {
      setSending(false);
    }
  };

  const handleQuickQuestionPick = useCallback((preset) => {
    setMessage(preset);
    requestAnimationFrame(() => {
      questionInputRef.current?.focus();
    });
  }, []);

  const handleReplyChange = (questionId, value) => {
    setReplyDrafts((prev) => ({
      ...prev,
      [questionId]: value
    }));
  };

  const toggleReplyArea = (questionId) => {
    setActiveReplyQuestionId((prev) => (prev === questionId ? null : questionId));
  };

  const submitAnswer = async (questionId) => {
    if (!requireAuth('Faça login para responder perguntas.')) return;
    const content = (replyDrafts[questionId] || '').trim();
    if (!content) {
      toast.error('Digite uma resposta antes de enviar.');
      return;
    }
    if (!product?.id) {
      return;
    }
    setAnswerLoadingId(questionId);
    try {
      await api.post(
        `/products/${product.id}/questions/${questionId}/answer`,
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Resposta registrada.');
      setReplyDrafts((prev) => ({ ...prev, [questionId]: '' }));
      setActiveReplyQuestionId(null);
      await fetchProductQuestions();
    } catch (error) {
      const serverMessage = error?.response?.data?.message;
      toast.error(serverMessage || 'Não foi possível enviar a resposta.');
    } finally {
      setAnswerLoadingId(null);
    }
  };

  const showMoreQuestions = () => {
    setVisibleQuestionCount((prev) => prev + QUESTION_PAGE_SIZE);
  };

  const handleFavorite = async () => {
    if (!product?.id) return;
    if (!requireAuth('Faça login para favoritar produtos.')) return;
    if (favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      if (favorite) {
        await api.delete(`/favorites/${product.id}`);
        setFavorite(false);
        setProduct((prev) => (prev ? applyFavoriteDelta(prev, -1) : prev));
        toast.success('Produto removido dos favoritos.');
      } else {
        await api.post('/favorites', { product_id: product.id });
        setFavorite(true);
        setProduct((prev) => (prev ? applyFavoriteDelta(prev, 1) : prev));
        toast.success('Produto adicionado aos favoritos.');
      }
    } catch {
      toast.error('Não foi possível atualizar seus favoritos.');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const goPrevImage = () => {
    if (images.length < 2) return;
    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goNextImage = () => {
    if (images.length < 2) return;
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const SWIPE_THRESHOLD = 40;

  const handleViewerTouchStart = (event) => {
    const startX = event.touches?.[0]?.clientX;
    setTouchStartX(typeof startX === 'number' ? startX : null);
  };

  const handleViewerTouchMove = (event) => {
    if (touchStartX === null) return;
    const currentX = event.touches?.[0]?.clientX;
    if (typeof currentX !== 'number') return;
    const delta = currentX - touchStartX;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta > 0) {
      goPrevImage();
    } else {
      goNextImage();
    }
    setTouchStartX(null);
  };

  const handleViewerTouchEnd = () => {
    setTouchStartX(null);
  };

  const handleGalleryTouchStart = (event) => {
    galleryTouchMovedRef.current = false;
    const startX = event.touches?.[0]?.clientX;
    galleryTouchStartXRef.current = typeof startX === 'number' ? startX : null;
  };

  const handleGalleryTouchMove = (event) => {
    const startX = galleryTouchStartXRef.current;
    if (startX === null) return;
    const currentX = event.touches?.[0]?.clientX;
    if (typeof currentX !== 'number') return;
    const delta = currentX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    galleryTouchMovedRef.current = true;
    if (delta > 0) {
      goPrevImage();
    } else {
      goNextImage();
    }
    galleryTouchStartXRef.current = currentX;
  };

  const handleGalleryTouchEnd = () => {
    galleryTouchStartXRef.current = null;
  };

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  const handleGalleryClick = () => {
    if (galleryTouchMovedRef.current) {
      galleryTouchMovedRef.current = false;
      return;
    }
    setViewerOpen(true);
  };

  const openOfferModal = () => {
    if (product?.status === 'sold' || isOwner) return;
    if (!requireAuth('Faça login para fazer uma oferta.')) return;
    if (isFreeProduct) {
      toast.info('Produto gratuito! Utilize o chat para combinar a retirada com o vendedor.');
      return;
    }
    setOfferOpen(true);
  };

  const closeOfferModal = () => {
    setOfferOpen(false);
    setOfferValue('');
    setOfferNote('');
  };

  const submitOffer = async () => {
    if (!product?.id || !requireAuth('Faça login para enviar ofertas.')) return;

    const normalizedValue = offerValue.replace(',', '.').trim();
    const amountNumber = Number(normalizedValue);

    if (!normalizedValue || Number.isNaN(amountNumber) || amountNumber <= 0) {
      toast.error('Informe um valor válido para a sua oferta.');
      return;
    }

    const currencyCode = resolveCurrencyFromCountry(product.country);
    const primaryImage = images?.[0] ?? product.image_url ?? null;

    const offerPayload = {
      amount: Number(amountNumber.toFixed(2)),
      currency: currencyCode,
      productId: product.id,
      productTitle: product.title,
       productImage: primaryImage,
      senderName: user?.username || user?.name || 'Usuário TempleSale',
      message: offerNote.trim() || null,
      createdAt: new Date().toISOString()
    };

    const content = `${OFFER_PREFIX}${JSON.stringify(offerPayload)}`;

    setSendingOffer(true);
    try {
      if (product.user_id) {
        const contextPayload = buildProductContextPayload(product.id, {}, product);
        if (contextPayload) {
          try {
            await api.post(
              '/messages',
              {
                product_id: product.id,
                content: `${PRODUCT_CONTEXT_PREFIX}${JSON.stringify(contextPayload)}`,
                receiver_id: product.user_id
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } catch (ctxErr) {
            console.error('Erro ao enviar contexto do produto', ctxErr);
          }
        }
      }
      await api.post(
        '/messages',
        { product_id: product.id, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Oferta enviada ao vendedor!');
      closeOfferModal();
    } catch {
      toast.error('Não foi possível enviar sua oferta. Tente novamente.');
    } finally {
      setSendingOffer(false);
    }
  };

  const openShare = () => {
    const url = window.location.href;
    const title = product?.title || 'TempleSale';
    const text = `Dê uma olhada neste produto: ${title}`;
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {});
    } else {
      setShareOpen(true);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copiado.');
    } catch {
      toast.error('Falha ao copiar link.');
    }
  };

  const registerRegionClick = useCallback((productId) => {
    if (!productId) return;
    api.put(`/products/${productId}/click`).catch(() => {});
  }, []);

  const handleOpenConversation = () => {
    if (!product?.id) return;
    if (!requireAuth('Faça login para conversar com o vendedor.')) return;
    if (Number(user.id) === Number(product.user_id)) {
      toast.error('Você é o vendedor deste anúncio.');
      return;
    }
    const primaryImage = images?.[0] || product?.image_url || '';
    const formattedPrice = getProductPriceLabel({
      price: product?.price,
      country: product?.country
    });
    const messageLink = buildProductMessageLink({
      product,
      sellerId: product.user_id,
      sellerName: product.seller_name,
      productImage: primaryImage,
      productPrice: formattedPrice
    });
    navigate(messageLink);
  };

  const submitPurchaseRequest = async () => {
    if (!product?.id) return;
    if (!requireAuth('Faça login para solicitar a compra.')) return;
    setOrdering(true);
    try {
      const { data } = await api.post(
        '/orders',
        { product_id: product.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data?.success) {
        const message =
          data.message ||
          (data.alreadyExists
            ? 'Você já solicitou a compra. Aguarde confirmação.'
            : 'Pedido enviado ao vendedor. Aguarde confirmação.');
        toast.success(message);
      } else {
        toast.error(data?.message || 'Falha ao solicitar compra.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Falha ao solicitar compra.';
      toast.error(msg);
    } finally {
      setOrdering(false);
    }
  };

  const handleRequestPurchase = () => {
    if (!product?.id) return;
    if (!requireAuth('Faça login para solicitar a compra.')) return;
    setConfirmPurchaseOpen(true);
  };

  const sellerName = product?.seller_name || 'Usuário TempleSale';
  const showBreadcrumbs = breadcrumbItems.length > 1;
  const regionTitle = regionLabel
    ? `Anúncios na região de ${regionLabel}`
    : 'Anúncios na sua região';
  const sellerAvatar = useMemo(
    () => toAbsoluteImageUrl(product?.seller_avatar) || '',
    [product?.seller_avatar]
  );
  const sellerInitial = useMemo(() => getInitial(sellerName), [sellerName]);
  const sellerAvatarLabel = sellerName ? `Foto de ${sellerName}` : 'Foto do vendedor';
  const handleSellerAvatarPreview = useCallback(
    (event) => {
      if (!sellerAvatar) return;
      if (event?.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      if (event?.preventDefault) event.preventDefault();
      if (event?.stopPropagation) event.stopPropagation();
      openSellerAvatarViewer(sellerAvatar, sellerAvatarLabel);
    },
    [openSellerAvatarViewer, sellerAvatar, sellerAvatarLabel]
  );
  const entryState = location.state;
  const stateSellerId = entryState?.sellerId;
  const sellerProfilePath = product?.user_id ? `/users/${product.user_id}` : '';
  const cameFromSellerProfile =
    Boolean(entryState?.fromSellerProfile) &&
    (stateSellerId == null || Number(stateSellerId) === Number(product?.user_id));
  const showReturnToSellerProfile = cameFromSellerProfile && Boolean(sellerProfilePath);
  const handleReturnToSellerProfile = useCallback(() => {
    if (!sellerProfilePath) return;
    navigate(sellerProfilePath);
  }, [navigate, sellerProfilePath]);
  const viewsCount = viewCountFromProduct(product);
  const likesCount = favoriteCountFromProduct(product);
  const visibleProductQuestions = useMemo(() => {
    if (!Array.isArray(productQuestions) || productQuestions.length === 0) {
      return [];
    }
    const normalized = productQuestions.map((question) => ({
      ...question,
      content: typeof question.content === 'string' ? question.content.trim() : ''
    }));
    return normalized.sort(
      (a, b) =>
        new Date(b.created_at || b.updated_at || 0).getTime() -
        new Date(a.created_at || a.updated_at || 0).getTime()
    );
  }, [productQuestions]);
  const displayedQuestions = visibleProductQuestions.slice(0, visibleQuestionCount);
  const hasMoreQuestions = visibleProductQuestions.length > visibleQuestionCount;
  const hasLoadedQuestions = initialQuestionsLoadedRef.current;
  const showQuestionsLoading = questionsLoading && !hasLoadedQuestions;
  const showQuestionsEmpty = !questionsError && visibleProductQuestions.length === 0;

  const setQuestionRef = useCallback((key, node) => {
    if (!key) return;
    if (node) {
      questionRefs.current.set(key, node);
    } else {
      questionRefs.current.delete(key);
    }
  }, []);

  useEffect(() => {
    if (!location.search) return;
    const params = new URLSearchParams(location.search);
    const highlight = params.get('highlightQuestion');
    if (!highlight) return;
    setHighlightQuestionKey(highlight);
    highlightHandledRef.current = false;
  }, [location.search]);

  useEffect(() => {
    if (!highlightQuestionKey || highlightHandledRef.current) return;
    const target = questionRefs.current.get(highlightQuestionKey);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightHandledRef.current = true;
    if (!location.search) return;
    const params = new URLSearchParams(location.search);
    if (params.has('highlightQuestion')) {
      params.delete('highlightQuestion');
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : ''
        },
        { replace: true }
      );
    }
  }, [highlightQuestionKey, displayedQuestions.length, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!activeReplyQuestionId) return;
    const targetInput = replyInputRefs.current.get(activeReplyQuestionId);
    if (!targetInput) return;
    requestAnimationFrame(() => {
      targetInput.focus();
    });
  }, [activeReplyQuestionId]);

  const isOwner = user && user.id === product?.user_id;
  const isSeller = Boolean(isOwner);
  const showChatAction = Boolean(!isSeller);
  const showPhoneAction = Boolean(!isSeller && phoneActions);
  const showWhatsappAction = Boolean(!isSeller && phoneActions);
  const hasContactActions = showChatAction || showPhoneAction || showWhatsappAction;
  const showFloatingContactBar = hasContactActions && !isDesktopLayout;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia(`(min-width: ${DESKTOP_LAYOUT_WIDTH}px)`);
    const updateLayout = () => setIsDesktopLayout(query.matches);
    updateLayout();
    if (query.addEventListener) {
      query.addEventListener('change', updateLayout);
      return () => query.removeEventListener('change', updateLayout);
    }
    query.addListener(updateLayout);
    return () => query.removeListener(updateLayout);
  }, []);

  useLayoutEffect(() => {
    if (!showFloatingContactBar) {
      setFloatingBarHeight(0);
      return;
    }
    const measure = () => {
      const height = floatingBarRef.current?.offsetHeight || 0;
      setFloatingBarHeight(height);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [showFloatingContactBar, showChatAction, showPhoneAction, showWhatsappAction]);

  if (loading) {
    return (
      <div className="p-6 text-center" aria-busy="true">
        <LoadingBar message="Carregando produto..." className="sr-only" />
      </div>
    );
  }
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!product) return null;

  const isFreeProduct = isProductFree(product);
  const priceFmt = getProductPriceLabel(product);
  const whatsappContactLink = phoneActions
    ? `${phoneActions.whatsappHref}?text=${encodeURIComponent(
        `Olá! Tenho interesse no produto: ${product?.title || 'TempleSale'} - ${window.location.href}`
      )}`
    : '';
  const propertyType = product.property_type ?? product.propertyType;
  const surfaceArea = product.surface_area ?? product.surfaceArea ?? product.area;
  const condoFee = product.condo_fee ?? product.condoFee;
  const rentType = product.rent_type ?? product.rentType;
  const serviceType = product.service_type ?? product.serviceType;
  const serviceDuration = product.service_duration ?? product.serviceDuration;
  const serviceRate = product.service_rate ?? product.serviceRate;
  const serviceLocation = product.service_location ?? product.serviceLocation;
  const jobTitle = product.job_title ?? product.jobTitle;
  const jobType = product.job_type ?? product.jobType;
  const jobSalary = product.job_salary ?? product.jobSalary;
  const jobRequirements = product.job_requirements ?? product.jobRequirements;

  const propertySpecs = [
    { label: 'Tipo de imóvel', value: propertyType },
    { label: 'Área (m²)', value: surfaceArea },
    { label: 'Quartos', value: product.bedrooms },
    { label: 'Banheiros', value: product.bathrooms },
    { label: 'Vagas', value: product.parking },
    { label: 'Condomínio', value: condoFee },
    { label: 'Tipo de aluguel', value: rentType }
  ].filter((entry) => entry.value);
  const serviceSpecs = [
    { label: 'Tipo de serviço', value: serviceType },
    { label: 'Duração / carga horária', value: serviceDuration },
    { label: 'Valor por hora', value: serviceRate },
    { label: 'Local de atendimento', value: serviceLocation }
  ].filter((entry) => entry.value);
  const jobSpecs = [
    { label: 'Cargo', value: jobTitle },
    { label: 'Tipo de vaga', value: jobType },
    { label: 'Salário', value: jobSalary },
    { label: 'Requisitos', value: jobRequirements }
  ].filter((entry) => entry.value);
  const specEntries = [
    ...propertySpecs,
    ...serviceSpecs,
    ...jobSpecs,
    { label: 'Marca', value: product.brand },
    { label: 'Modelo', value: product.model },
    { label: 'Cor', value: product.color },
    { label: 'Ano', value: product.year }
  ].filter((entry) => entry.value);
  const highlightSource =
    propertySpecs.length > 0
      ? propertySpecs
      : serviceSpecs.length > 0
      ? serviceSpecs
      : jobSpecs.length > 0
      ? jobSpecs
      : specEntries;
  const highlightSpecs = highlightSource.slice(0, 6);
  const highlightSignature = new Set(
    highlightSpecs.map((entry) => `${entry.label}::${entry.value}`)
  );
  const detailSpecs = specEntries.filter(
    (entry) => !highlightSignature.has(`${entry.label}::${entry.value}`)
  );

  const hasMapLocation =
    mapCoords.lat !== null && mapCoords.lng !== null;
  const isSold = product.status === 'sold';
  const isDeleted = Boolean(product.hidden_by_seller);
  const productIsBoosted = Boolean(product?.manual_rank_plan);
  const boostLinkTarget = productIsBoosted
    ? '/dashboard/impulsiona'
    : `/dashboard/impulsiona/${product.id}`;
  const boostLinkState = productIsBoosted ? undefined : { product };

  const sendQuickAvailability = async () => {
    if (isSold) return;
    if (!requireAuth('Faça login para enviar mensagens.')) return;
    try {
      await api.post(
        '/messages',
        { product_id: product.id, content: 'Ainda está disponível?' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Mensagem enviada ao vendedor.');
    } catch {
      toast.error('Erro ao enviar mensagem.');
    }
  };

  const shareUrl = encodeURIComponent(window.location.href);
  const shareText = encodeURIComponent(product.title || 'Produto TempleSale');
  const whatsapp = `https://wa.me/?text=${shareText}%20${shareUrl}`;
  const telegram = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
  const xUrl = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`;


  const sellerCardContent = (
    <>
      <div
        className={`product-detail__seller-avatar ${sellerAvatar ? 'cursor-pointer' : ''}`}
        role={sellerAvatar ? 'button' : undefined}
        tabIndex={sellerAvatar ? 0 : undefined}
        aria-label={sellerAvatar ? `Ver foto de ${sellerName}` : undefined}
        onClick={handleSellerAvatarPreview}
        onKeyDown={handleSellerAvatarPreview}
      >
        {sellerAvatar ? (
          <img src={sellerAvatar} alt={sellerName} loading="lazy" />
        ) : (
          <span>{sellerInitial}</span>
        )}
      </div>
      <div className="product-detail__seller-info">
        <p className="product-detail__seller-label">Vendedor</p>
        <p className="product-detail__seller-name">{sellerName}</p>
        <div className="flex items-center gap-1 text-yellow-500 text-xs md:text-sm mt-1">
          {'★'.repeat(fullStars)}
          {halfStar ? '☆' : ''}
          {'✩'.repeat(emptyStars)}
          <span className="text-xs text-gray-500 ml-1">
            {sellerRating.toFixed(1)} / 5
          </span>
        </div>
      </div>
    </>
  );

  const viewerPortal =
    viewerOpen && viewerPortalRoot
      ? createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black/95 backdrop-blur-sm"
            style={{ zIndex: 8000 }}
            onClick={closeViewer}
          >
            <div
              className="relative w-full h-full flex items-center justify-center overflow-hidden"
              onClick={(event) => event.stopPropagation()}
              onTouchStart={handleViewerTouchStart}
              onTouchMove={handleViewerTouchMove}
              onTouchEnd={handleViewerTouchEnd}
            >
              <button
                type="button"
                aria-label="Fechar"
                title="Fechar"
                className="fixed z-[60] rounded-full border border-red-300 bg-red-600 p-3 text-white shadow-lg transition hover:bg-red-500 focus-visible:outline-none focus-visible:ring focus-visible:ring-red-200"
                style={{
                  top: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
                  right: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
                  zIndex: 8010
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  closeViewer();
                }}
              >
                <CloseIcon size={26} />
              </button>

              <img
                src={images[activeImageIndex]}
                alt={product?.title || 'Produto TempleSale'}
                draggable="false"
                className="z-10 max-w-full max-h-full object-contain"
              />
              {activeImageKind === IMAGE_KIND.ILLUSTRATIVE && (
                <span className="product-detail__viewer-badge">
                  {IMAGE_KIND_BADGE_LABEL}
                </span>
              )}

              {images.length > 1 && (
                <button
                  type="button"
                  aria-label="Imagem anterior"
                  className="product-detail__viewer-arrow product-detail__viewer-arrow--left"
                  onClick={(event) => {
                    event.stopPropagation();
                    goPrevImage();
                  }}
                >
                  ‹
                </button>
              )}

              {images.length > 1 && (
                <button
                  type="button"
                  aria-label="Próxima imagem"
                  className="product-detail__viewer-arrow product-detail__viewer-arrow--right"
                  onClick={(event) => {
                    event.stopPropagation();
                    goNextImage();
                  }}
                >
                  ›
                </button>
              )}
            </div>
           
          </div>,
          viewerPortalRoot
        )
      : null;

  const safetyNotice = (
    <details className="product-detail__safety">
      <summary>
        <span className="product-detail__safety-title">Cuidados a serem tomados:</span>
        <span className="product-detail__safety-preview">
          Nunca faça nenhum pagamento antecipado. O Portal serve apenas como divulgação, sendo assim não se
          responsabiliza pelas negociações feitas.
        </span>
      </summary>
      <div className="product-detail__safety-body">    
        <p>
              Não pedimos PINs, senhas, protocolos ou códigos de confirmação. Desconfie se alguém entrar em contato em
              nome do TempleSale.
        </p>
        <ul>
          <li>Desconfie de preços abaixo do mercado</li>
          <li>Na dúvida ligue para o anunciante</li>
          <li>Verifique bem toda a documentação</li>
          <li>Nunca efetue pagamento antecipado</li>
        </ul>
        <p>
              O TempleSale é um portal de classificados online e tem como objetivo a aproximação de interessados na
          compra, venda ou locação de imóveis, carros e motos, de modo que não presta serviços de consultoria ou
          intermediações de negócios entre seus anunciantes e usuários, portanto sendo de exclusiva responsabilidade
          dos seus anunciantes e usuários pelos anúncios e pelas negociações empreendidas.
        </p>
        <p>
          <strong>*Importante:</strong> Os anúncios listados em nosso site são publicados por terceiros. Logo, não
          nos responsabilizamos pelos dados apresentados.
        </p>
      </div>
    </details>
  );

  const floatingBarPortal =
    showFloatingContactBar && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-x-0 bottom-0 z-50 px-0 pb-[calc(env(safe-area-inset-bottom,0px)+0.0rem)]">
            <div
              ref={floatingBarRef}
              className="flex w-full max-w-none items-center gap-2 rounded-none border border-emerald-10 bg-white/95 p-3 shadow-2xl backdrop-blur"
            >
              {showChatAction && (
                <button
                  type="button"
                  onClick={handleOpenConversation}
                  className="product-detail__cta product-detail__cta--primary"
                >
                  <MessageCircle size={18} /> Contatar
                </button>
              )}
              {showPhoneAction && (
                <button
                  type="button"
                  onClick={() => setPhoneActionsOpen(true)}
                  className="product-detail__cta product-detail__cta--secondary"
                >
                  <PhoneCall size={18} /> Chamar
                </button>
              )}
              {showWhatsappAction && (
                <a
                  href={whatsappContactLink}
                  target="_blank"
                  rel="noreferrer"
                  className="product-detail__cta product-detail__cta--whatsapp"
                >
                  <MessageCircle size={18} /> WhatsApp
                </a>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  const backButtonPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <button
            type="button"
            onClick={handleGoBack}
            className="product-detail__back"
            aria-label="Voltar para a página anterior"
          >
            <ChevronLeft size={14} />
            Voltar
          </button>,
          document.body
        )
      : null;

  return (
    <>
      {backButtonPortal}
      <section
        className="product-detail-page"
        style={
          showFloatingContactBar
            ? {
                paddingBottom: `calc(${floatingBarHeight}px + env(safe-area-inset-bottom,0px) + 1rem)`
              }
            : undefined
        }
      >
        <article className="product-detail-card p-4 md:p-6 space-y-6">
          {isDeleted && (
            <div className="product-detail__alert">
              Produto excluído!
            </div>
          )}
          {/* Layout ajustado para refletir card lateral e perguntas rápidas. */}
          <div className="product-detail__layout">
            <div className="product-detail__main">
              {showBreadcrumbs && (
                <nav className="product-detail__breadcrumb" aria-label="Caminho do anúncio">
                  <ol className="product-detail__breadcrumb-list">
                    {breadcrumbItems.map((item, index) => (
                      <li key={`${item.label}-${index}`} className="product-detail__breadcrumb-item">
                        {item.to ? (
                          <Link to={item.to} className="product-detail__breadcrumb-link">
                            {item.label}
                          </Link>
                        ) : (
                          <span
                            className="product-detail__breadcrumb-text"
                            aria-current={index === breadcrumbItems.length - 1 ? 'page' : undefined}
                          >
                            {item.label}
                          </span>
                        )}
                        {index < breadcrumbItems.length - 1 && (
                          <span className="product-detail__breadcrumb-sep">{'>'}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              {/* Cabeçalho com vendedor */}
              <header className="product-detail__header">
                <div className="product-detail__header-actions">
                  {sellerProfilePath ? (
                    <Link
                      to={sellerProfilePath}
                      className="product-detail__seller-card"
                      aria-label={`Ver perfil completo de ${sellerName}`}
                    >
                      {sellerCardContent}
                    </Link>
                  ) : (
                    <div className="product-detail__seller-card">
                      {sellerCardContent}
                    </div>
                  )}

                  {showReturnToSellerProfile && (
                    <button
                      type="button"
                      onClick={handleReturnToSellerProfile}
                      className="product-detail__backlink"
                    >
                      <ChevronLeft size={14} />
                      Voltar ao perfil
                    </button>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="product-detail__title">
                    {product.title}
                  </h1>
                  {isSold && (
                    <span className="product-detail__tag product-detail__tag--sold">
                      Vendido
                    </span>
                  )}
                  {!isSold && isFreeProduct && (
                    <span className="product-detail__tag product-detail__tag--free">
                      Grátis
                    </span>
                  )}
                  <p className="product-detail__location">
                    <MapPin size={14} /> {locCity || 'Local não informado'}
                    {locState ? `, ${locState}` : ''}
                    {locCountry ? ` (${locCountry})` : ''}
                  </p>
                </div>
              </header>

              <div className="product-detail__gallery-group">
                {/* Galeria de imagens */}
                <div
                  className="product-detail__gallery"
                  onTouchStart={handleGalleryTouchStart}
                  onTouchMove={handleGalleryTouchMove}
                  onTouchEnd={handleGalleryTouchEnd}
                >
                  {images.length > 0 ? (
                    <img
                      src={images[activeImageIndex]}
                      alt={product.title}
                      className="product-detail__gallery-image"
                      onClick={handleGalleryClick}
                    />
                  ) : (
                    <div className="product-detail__gallery-empty">
                      Sem imagem
                    </div>
                  )}

                  {product.status === 'sold' && <SoldBadge className="absolute -top-1 -left-1" />}
                  {isFreeProduct && !isSold && (
                    <span className="product-detail__badge product-detail__badge--free">
                      Grátis
                    </span>
                  )}
                  {activeImageKind === IMAGE_KIND.ILLUSTRATIVE && (
                    <span className="product-detail__badge product-detail__badge--illustrative">
                      {IMAGE_KIND_BADGE_LABEL}
                    </span>
                  )}

                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={goPrevImage}
                        className="product-detail__gallery-arrow product-detail__gallery-arrow--left"
                        aria-label="Imagem anterior"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={goNextImage}
                        className="product-detail__gallery-arrow product-detail__gallery-arrow--right"
                        aria-label="Próxima imagem"
                      >
                        ›
                      </button>
                    </>
                  )}
                </div>

                {/* Tiras de miniaturas responsivas sem vazar largura */}
                {images.length > 1 && (
                  <div className="product-detail__thumbs">
                    {images.map((image, index) => (
                      <button
                        key={`${product.id}-${image}`}
                        type="button"
                        onClick={() => setActiveImageIndex(index)}
                        className={`product-detail__thumb ${
                          activeImageIndex === index ? 'is-active' : ''
                        }`}
                      >
                        <img src={image} alt={`${product.title} ${index + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Detalhes do produto */}
              <section className="product-detail__section">
                <div className="product-detail__summary">
                  <div className="product-detail__price-card">
                    <div className="product-detail__metrics">
                      <div className="product-detail__metric">
                        <Eye size={16} className="product-detail__metric-icon" aria-hidden="true" />
                        <span className="product-detail__metric-count">{viewsCount}</span>
                        <span>Visualizações</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleFavorite}
                        disabled={favoriteLoading}
                        aria-pressed={favorite}
                        title={favorite ? 'Remover curtida' : 'Curtir'}
                        className={`product-detail__metric product-detail__metric--favorite ${
                          favorite ? 'is-active' : ''
                        }`}
                      >
                        <Heart size={16} className="product-detail__metric-icon" aria-hidden="true" />
                        <span className="product-detail__metric-count">{likesCount}</span>
                        <span>Curtidas</span>
                      </button>
                      <details className="product-detail__more-actions product-detail__more-actions--inline">
                        <summary
                          className="product-detail__more-actions-toggle"
                          aria-label="Mais ações"
                          title="Mais ações"
                        >
                          ⋯
                        </summary>
                        <div className="product-detail__more-actions-panel">
                          <button
                            onClick={openOfferModal}
                            disabled={isSold || isOwner}
                            className="product-detail__action product-detail__action--secondary"
                          >
                            <Send size={18} />{' '}
                            {isSold
                              ? 'Produto vendido'
                              : isOwner
                              ? 'Você é o vendedor'
                              : isFreeProduct
                              ? 'Combinar retirada'
                              : 'Fazer oferta'}
                          </button>

                          {!isSeller && !isSold && user && (
                            <button
                              onClick={handleRequestPurchase}
                              disabled={ordering}
                              className="product-detail__action product-detail__action--tertiary"
                            >
                              <ShoppingCart size={18} /> {ordering ? 'Solicitando...' : 'Solicitar compra'}
                            </button>
                          )}

                          <button
                            onClick={openShare}
                            className="product-detail__action product-detail__action--secondary"
                          >
                            <Share2 size={18} /> Compartilhar
                          </button>

                          {isOwner && !isSold && (
                            <button
                              onClick={async () => {
                                try {
                                  await api.put(
                                    `/products/${product.id}/status`,
                                    { status: 'sold' },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  setProduct((prev) => ({ ...prev, status: 'sold' }));
                                  toast.success('Produto marcado como vendido.');
                                } catch {
                                  toast.error('Falha ao marcar como vendido.');
                                }
                              }}
                              className="product-detail__action product-detail__action--dark"
                            >
                              Marcar como vendido
                            </button>
                          )}

                          {false && isOwner && !isSold && (
                            // para voltar o botao é só tirar o : false &&
                            <Link
                              to={boostLinkTarget}
                              state={boostLinkState}
                              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-full border border-transparent bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 text-white text-sm font-semibold shadow-lg shadow-pink-500/30 hover:opacity-95 transition"
                            >
                              Impulsionar anúncio
                            </Link>
                          )}
                        </div>
                      </details>
                    </div>
                    <p className={`product-detail__price ${isFreeProduct ? 'is-free' : ''}`}>
                      {priceFmt}
                    </p>
                    {product.pickup_only && (
                      <p className="product-detail__pickup">
                        Entrega: retirada em mãos combinada com o vendedor.
                      </p>
                    )}
                  </div>
              

                  {highlightSpecs.length > 0 && (
                    <div className="product-detail__highlights">
                      {highlightSpecs.map((entry) => {
                        const HighlightIcon = resolveHighlightIcon(entry.label);
                        return (
                          <div
                            key={`${entry.label}-${entry.value}`}
                            className="product-detail__highlight-card"
                          >
                            <span className="product-detail__highlight-icon" aria-hidden="true">
                              <HighlightIcon size={18} />
                            </span>
                            <div className="product-detail__highlight-info">
                              <span className="product-detail__highlight-label">{entry.label}</span>
                              <span className="product-detail__highlight-value">{entry.value}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <hr className="divider" />

                {isSeller && buyerInfo && (
                  <div className="product-detail__buyer-card">
                    <p>
                      <strong>Status:</strong>{' '}
                      {buyerInfo.status === 'confirmed'
                        ? 'Compra confirmada'
                        : 'Pedido pendente de confirmação'}
                    </p>
                    <p>
                      <strong>Comprador:</strong> {buyerInfo.buyer_name}{' '}
                      {buyerInfo.buyer_email ? `(${buyerInfo.buyer_email})` : ''}
                    </p>
                    {buyerInfo.confirmed_at && (
                      <p>
                        <strong>Confirmado em:</strong>{' '}
                        {new Date(buyerInfo.confirmed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <p className="product-detail__description">
                  {product.description || 'Sem descrição disponível.'}
                </p>

                {detailLinks.length > 0 && (
                  <div className="product-detail__links">
                    <p className="product-detail__links-title">Links úteis</p>
                    <div className="product-detail__links-grid">
                      {detailLinks.map((link, index) => (
                        <a
                          key={`${link.url ?? 'link'}-${index}`}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="product-detail__link"
                        >
                          <span className="product-detail__link-label">
                            {link.label || `Link ${index + 1}`}
                          </span>
                          <span className="product-detail__link-url">{link.url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
<hr className="divider" />

                {detailSpecs.length > 0 && (
                  <div className="product-detail__specs">
                    {detailSpecs.map((entry) => (
                      <p key={entry.label}>
                        <span className="product-detail__field-label">{entry.label}</span>
                        <span className="product-detail__field-value text-gray-800">{entry.value}</span>
                      </p>
                    ))}
                  </div>
                )}

                <div className="product-detail__location-grid">
                  <p>
                    <span className="product-detail__field-label">Categoria</span>
                    <span className="product-detail__field-value">{product.category || 'Não informada'}</span>
                  </p>
                  <p>
                    <span className="product-detail__field-label">CEP</span>
                    <span className="product-detail__field-value">{product.zip || 'Não informado'}</span>
                  </p>
                  <p>
                    <span className="product-detail__field-label">Rua</span>
                    <span className="product-detail__field-value">{product.street || 'Não informada'}</span>
                  </p>
                  <p>
                    <span className="product-detail__field-label">Bairro</span>
                    <span className="product-detail__field-value">{product.neighborhood || 'Não informado'}</span>
                  </p>
                </div>
                <hr className="divider" />

                {(hasMapLocation || mapLoading) && (
                  <div className="product-detail__map-card">
                    <div className="product-detail__map-header">
                      <div>
                        <p className="product-detail__map-title">Mapa do local</p>
                        <p className="product-detail__map-subtitle">
                          {mapCoords.source === 'city'
                            ? 'Aproximação baseada na cidade informada no anúncio.'
                            : 'Aproximação baseada nas coordenadas informadas no anúncio.'}
                        </p>

                       
           
                      </div>
                      {hasMapLocation && (
                        <a
                          href={buildOpenStreetMapLink(mapCoords.lat, mapCoords.lng)}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="product-detail__map-link"
                        >
                          Abrir mapa
                        </a>
                      )}
                    </div>
                    <div className="product-detail__map-frame">
                      {hasMapLocation ? (
                        <iframe
                          title="Mapa do local do produto"
                          src={buildOpenStreetMapEmbedUrl(mapCoords.lat, mapCoords.lng)}
                          className="product-detail__map-embed"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      ) : (
                        <div className="product-detail__map-placeholder">
                          Buscando mapa pela cidade...
                        </div>
                      )}
                    </div>
                  </div>
                )}<hr className="divider" />


                {images.length > 0 && (
                  <div className="product-detail__image-stack">
                    <p className="product-detail__image-stack-title">Fotos do anúncio</p>
                    <div className="product-detail__image-stack-list">
                      {images.map((image, index) => (
                        <img
                          key={`${product.id}-stack-${image}`}
                          src={image}
                          alt={`${product.title} ${index + 1}`}
                          className="product-detail__image-stack-item"
                          loading="lazy"
                          decoding="async"
                        />
                      ))}
                    </div>
                  </div>
                )}
<hr className="divider" />

                {floorplanUrls.length > 0 && (
                  <div className="product-detail__image-stack">
                    <p className="product-detail__image-stack-title">Plantas do ambiente</p>
                    <div className="product-detail__image-stack-list">
                      {floorplanUrls.map((url, index) =>
                        isImageUrl(url) ? (
                          <img
                            key={`floorplan-${url}`}
                            src={url}
                            alt={`${product.title} planta ${index + 1}`}
                            className="product-detail__image-stack-item"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <a
                            key={`floorplan-${url}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="product-detail__image-stack-file"
                          >
                            Abrir arquivo da planta {index + 1}
                          </a>
                        )
                      )}
                    </div>
                  </div>
                )}

                {!isDesktopLayout && safetyNotice}
              </section>

              {/* Perguntas e respostas da publicação */}
              {!isSold && (
                <section className="product-detail__qa">
                  <div className="product-detail__qa-header">
                    <div>
                      <h3 className="product-detail__qa-title">Perguntas rápidas para o anunciante</h3>
                      <p className="product-detail__qa-subtitle">
                        Faça perguntas rápidas ao anunciante e acompanhe as respostas publicamente no anúncio.
                      </p>
                    </div>
                    <span className="product-detail__qa-count">
                      {visibleProductQuestions.length} {visibleProductQuestions.length === 1 ? 'mensagem' : 'mensagens'}
                    </span>
                  </div>

                  {!isOwner && (
                    <div className="product-detail__qa-form">
                      <div className="product-detail__qa-quick">
                        <p className="product-detail__qa-quick-title">Sugestões rápidas</p>
                        <div className="product-detail__qa-quick-list">
                          {QUICK_QUESTION_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleQuickQuestionPick(preset)}
                              className={`product-detail__qa-chip ${
                                message.trim() === preset ? 'is-active' : ''
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="product-detail__qa-input">
                        <textarea
                          rows={3}
                          maxLength={MESSAGE_LIMIT}
                          className="product-detail__qa-textarea"
                          placeholder="Escreva sua pergunta..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          ref={questionInputRef}
                        />
                        <div className="product-detail__qa-actions">
                          <span className="product-detail__qa-charcount">
                            {message.length}/{MESSAGE_LIMIT}
                          </span>
                          <button
                            onClick={handleSendMessage}
                            disabled={sending}
                            className="product-detail__qa-submit"
                          >
                            {sending ? 'Enviando...' : 'Enviar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
<hr className="divider" />

                  <div className="product-detail__qa-list">
                    <p className="product-detail__qa-list-title">Perguntas e respostas</p>
                    {showQuestionsLoading && (
                      <LoadingBar message="Carregando perguntas..." className="sr-only" size="sm" />
                    )}
                    {!questionsLoading && questionsError && (
                      <p className="product-detail__qa-error">{questionsError}</p>
                    )}
                    {showQuestionsEmpty && (
                      <p className="product-detail__qa-empty">Ainda não há perguntas para este anúncio.</p>
                    )}
                    {displayedQuestions.map((msg) => {
                      const messageKey = getMessageIdentifier(msg);
                      const responseText = (msg.response_content || '').trim();
                      const hasResponse = Boolean(responseText);
                      const authorLabel = msg.user_name || 'Usuário TempleSale';
                      const responseAuthor = msg.response_user_name || 'Vendedor';
                      const isHighlighted = highlightQuestionKey === messageKey;
                      return (
                        <article
                          key={messageKey}
                          ref={(node) => setQuestionRef(messageKey, node)}
                          className={`product-detail__qa-card ${
                            isHighlighted ? 'is-highlighted' : ''
                          }`}
                        >
                          <header className="product-detail__qa-meta">
                            <span>Pergunta</span>
                            <span>{formatMessageTimestamp(msg.created_at)}</span>
                          </header>
                          <p className="product-detail__qa-text">{msg.content}</p>
                          <p className="product-detail__qa-author">Feita por {authorLabel}</p>

                          {hasResponse && (
                            <div className="product-detail__qa-response">
                              <div className="product-detail__qa-response-meta">
                                <span>Resposta do vendedor</span>
                                <span>{formatMessageTimestamp(msg.response_created_at)}</span>
                              </div>
                              <p className="product-detail__qa-response-text">{responseText}</p>
                              <p className="product-detail__qa-response-author">Por {responseAuthor}</p>
                            </div>
                          )}

                          {!hasResponse && isOwner && (
                            <div className="product-detail__qa-reply">
                              <button
                                type="button"
                                onClick={() => toggleReplyArea(msg.id)}
                                className="product-detail__qa-reply-toggle"
                              >
                                {activeReplyQuestionId === msg.id ? 'Cancelar' : 'Responder'}
                              </button>
                              {activeReplyQuestionId === msg.id && (
                                <div className="product-detail__qa-reply-form">
                                  <textarea
                                    rows={3}
                                    value={replyDrafts[msg.id] || ''}
                                    onChange={(event) => handleReplyChange(msg.id, event.target.value)}
                                    ref={(node) => {
                                      if (node) {
                                        replyInputRefs.current.set(msg.id, node);
                                      } else {
                                        replyInputRefs.current.delete(msg.id);
                                      }
                                    }}
                                    className="product-detail__qa-reply-textarea"
                                    placeholder="Responda diretamente esta pergunta..."
                                  />
                                  <button
                                    type="button"
                                    onClick={() => submitAnswer(msg.id)}
                                    disabled={answerLoadingId === msg.id}
                                    className="product-detail__qa-reply-submit"
                                  >
                                    {answerLoadingId === msg.id ? 'Enviando...' : 'Enviar resposta'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                    {!questionsLoading && hasMoreQuestions && (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={showMoreQuestions}
                          className="product-detail__qa-more"
                        >
                          Ver mais perguntas
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}
              {regionQueryParams && (
                <section className="product-detail__region">
                  <div className="product-detail__region-header">
                    <div>
                      <h3 className="product-detail__region-title">{regionTitle}</h3>
                      <p className="product-detail__region-subtitle">
                        Mais anúncios próximos ao endereço deste anúncio.
                      </p>
                    </div>
                    {regionProducts.length > 0 && !regionLoading && !regionError && (
                      <span className="product-detail__region-count">
                        {regionProducts.length}{' '}
                        {regionProducts.length === 1 ? 'anúncio' : 'anúncios'}
                      </span>
                    )}
                  </div>
                  {regionLoading ? (
                    <LoadingBar
                      message="Carregando anúncios da região..."
                      size="sm"
                      className="product-detail__region-loading"
                    />
                  ) : regionError ? (
                    <p className="product-detail__region-error">{regionError}</p>
                  ) : regionProducts.length === 0 ? (
                    <p className="product-detail__region-empty">
                      Nenhum anúncio disponível nesta região ainda.
                    </p>
                  ) : (
                    <SellerProductGrid
                      products={regionProducts}
                      registerClick={registerRegionClick}
                      layout="compact"
                    />
                  )}
                </section>
              )}
            </div>
            <aside className="product-detail__aside"><hr className="divider" />

              <div className="product-detail__contact-card">
                <div className="product-detail__contact-header">
                  <p className="product-detail__contact-eyebrow">Fale com o anunciante</p>
                  <p className="product-detail__contact-title">Atendimento rápido</p>
                  <p className="product-detail__contact-subtitle">
                    Escolha o melhor canal para falar com {sellerName}.
                  </p>
                </div>
                <div className="product-detail__contact-actions">
                  {showChatAction && (
                    <button
                      type="button"
                      onClick={handleOpenConversation}
                      className="product-detail__contact-button product-detail__contact-button--primary"
                    >
                      <MessageCircle size={18} /> Mensagem
                    </button>
                  )}
                  {showPhoneAction && (
                    <button
                      type="button"
                      onClick={() => setPhoneActionsOpen(true)}
                      className="product-detail__contact-button product-detail__contact-button--secondary"
                    >
                      <PhoneCall size={18} /> Ligar agora
                    </button>
                  )}
                  {showWhatsappAction && (
                    <a
                      href={whatsappContactLink}
                      target="_blank"
                      rel="noreferrer"
                      className="product-detail__contact-button product-detail__contact-button--whatsapp"
                    >
                      <MessageCircle size={18} /> WhatsApp
                    </a>
                  )}
                </div>
                {!hasContactActions && (
                  <p className="product-detail__contact-note">
                    Você é o vendedor deste anúncio.
                  </p>
                )}
              </div>
              {isDesktopLayout && safetyNotice}
            </aside>
          </div>

          {floatingBarPortal}

          {phoneActionsOpen &&
            phoneActions &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 pt-10 md:items-center"
                onClick={() => setPhoneActionsOpen(false)}
              >
                <div
                  className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Contato do vendedor
                      </p>
                      <p className="text-base font-semibold text-gray-900">{phoneActions.display}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhoneActionsOpen(false)}
                      className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200"
                      aria-label="Fechar"
                    >
                      <CloseIcon size={18} />
                    </button>
                  </header>

                  <div className="mt-4 grid gap-2">
                    <a
                      href={phoneActions.telHref}
                      className="flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                    >
                      <PhoneCall size={18} /> Ligar agora
                    </a>
                    <a
                      href={whatsappContactLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <MessageCircle size={18} /> WhatsApp
                    </a>
                  </div>
                </div>
              </div>,
              document.body
            )}

          {showFloatingContactBar && (
            <div
              aria-hidden="true"
              style={{
                height: `calc(${floatingBarHeight}px + env(safe-area-inset-bottom,0px) + 1 rem)`
              }}
            />
          )}
<hr className="divider" />

          {offerOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6 transition-opacity duration-200">
                <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-400 to-emerald-600 shadow-2xl">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9)_0,_transparent_55%)] pointer-events-none" />
                  <div className="relative p-6 sm:p-8 space-y-5 text-white">
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-semibold drop-shadow-sm">Fazer oferta</h3>
                        <p className="text-sm text-emerald-50">
                          Negocie um valor especial para{' '}
                          <span className="font-medium">{product.title}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closeOfferModal}
                        className="rounded-full bg-white/15 p-2 hover:bg-white/25 transition"
                        aria-label="Fechar"
                      >
                        <CloseIcon size={20} />
                      </button>
                    </header>

                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-sm font-medium uppercase tracking-wide text-white/80">
                          Valor da oferta
                        </span>
                        <div className="mt-2 flex items-center rounded-2xl bg-white/90 px-4 shadow-lg ring-2 ring-white/40 focus-within:ring-emerald-100">
                          <span className="text-emerald-700 font-semibold text-sm">
                            {getCurrencySettings(resolveCurrencyFromCountry(product.country)).symbol}
                          </span>
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            inputMode="decimal"
                            className="w-full bg-transparent py-3 pl-3 pr-1 text-lg font-semibold text-emerald-900 placeholder:text-emerald-400 focus:outline-none"
                            placeholder="0,00"
                            value={offerValue}
                            onChange={(event) => setOfferValue(event.target.value)}
                          />
                        </div>
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium uppercase tracking-wide text-white/80">
                          Mensagem ao vendedor (opcional)
                        </span>
                        <textarea
                          rows={3}
                          className="mt-2 w-full resize-none rounded-2xl bg-white/90 px-4 py-3 text-sm text-emerald-900 placeholder:text-emerald-400 shadow-lg ring-2 ring-white/40 focus:outline-none focus:ring-emerald-100"
                          placeholder="Ex.: Posso retirar amanhã à tarde, tudo bem?"
                          value={offerNote}
                          onChange={(event) => setOfferNote(event.target.value)}
                        />
                      </label>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={closeOfferModal}
                        className="rounded-full border border-white/40 px-5 py-2 text-sm font-medium text-white hover:bg-white/15 transition"
                        disabled={sendingOffer}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={submitOffer}
                        className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-emerald-700 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={sendingOffer}
                      >
                        {sendingOffer ? 'Enviando oferta...' : 'Enviar oferta'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}

          <ImageViewerModal
            isOpen={isSellerAvatarViewerOpen}
            src={sellerAvatarViewerSrc}
            alt={sellerAvatarViewerAlt}
            onClose={closeSellerAvatarViewer}
          />
          {viewerPortal}

          {confirmPurchaseOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6">
                <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
                  <div className="p-6 space-y-4">
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Confirmar compra</h3>
                        <p className="text-sm text-slate-600">
                          Ao confirmar, o pedido será enviado e a compra só será concluída após a aprovação do vendedor.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmPurchaseOpen(false)}
                        className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                        aria-label="Fechar"
                      >
                        <CloseIcon size={18} />
                      </button>
                    </header>

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setConfirmPurchaseOpen(false)}
                        className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                        disabled={ordering}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await submitPurchaseRequest();
                          setConfirmPurchaseOpen(false);
                        }}
                        className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={ordering}
                      >
                        {ordering ? 'Enviando...' : 'Confirmar compra'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}

          {/* Modal de compartilhamento (fallback) */}
          {shareOpen && (
            <div className="product-detail__share-overlay">
              <div className="product-detail__share-sheet">
                <div className="product-detail__share-header">
                  <h4>Compartilhar</h4>
                  <button
                    onClick={() => setShareOpen(false)}
                    className="product-detail__share-close"
                    aria-label="Fechar"
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>

                <div className="product-detail__share-grid">
                  <a href={whatsapp} target="_blank" rel="noreferrer" className="product-detail__share-item">
                    <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/whatsapp.svg" alt="WhatsApp" className="w-8 h-8 mx-auto" />
                    WhatsApp
                  </a>
                  <a href={telegram} target="_blank" rel="noreferrer" className="product-detail__share-item">
                    <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/telegram.svg" alt="Telegram" className="w-8 h-8 mx-auto" />
                    Telegram
                  </a>
                  <a href={facebook} target="_blank" rel="noreferrer" className="product-detail__share-item">
                    <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/facebook.svg" alt="Facebook" className="w-8 h-8 mx-auto" />
                    Facebook
                  </a>
                  <a href={xUrl} target="_blank" rel="noreferrer" className="product-detail__share-item">
                    <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/x.svg" alt="X" className="w-8 h-8 mx-auto" />
                    X
                  </a>
                </div>

                <div className="product-detail__share-actions">
                  <button
                    onClick={copyLink}
                    className="product-detail__share-button"
                  >
                    <CopyIcon size={16} /> Copiar link
                  </button>
                  <button
                    onClick={() => setShareOpen(false)}
                    className="product-detail__share-button product-detail__share-button--dark"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </article>
      </section>
    </>
  );
}

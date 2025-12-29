// frontend/src/pages/ProductDetail.jsx
// Página com os detalhes completos de um produto e ações de contato.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Heart, Send, Share2, MapPin, MessageCircle, Eye, X as CloseIcon, Copy as CopyIcon, ChevronLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import SoldBadge from '../components/SoldBadge.jsx';
import { getCurrencySettings, resolveCurrencyFromCountry } from '../utils/currency.js';
import { PRODUCT_CONTEXT_PREFIX, buildProductContextPayload } from '../utils/productContext.js';
import { isProductFree, getProductPriceLabel } from '../utils/product.js';
import { OFFER_PREFIX } from '../utils/offers.js';
import { asStars } from '../utils/rating.js';
import { buildProductImageEntries } from '../utils/images.js';
import { IMAGE_KIND, IMAGE_KIND_BADGE_LABEL } from '../utils/imageKinds.js';

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
    node.setAttribute('data-saleday-product-viewer', 'true');
    return node;
  });
  const [touchStartX, setTouchStartX] = useState(null);
  const galleryTouchStartXRef = useRef(null);
  const galleryTouchMovedRef = useRef(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerValue, setOfferValue] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [buyerInfo, setBuyerInfo] = useState(null);
  const [mapCoords, setMapCoords] = useState({ lat: null, lng: null, source: null });
  const [mapLoading, setMapLoading] = useState(false);
  const { user, token } = useContext(AuthContext);
  const viewIncrementPending = useRef(false);
  const questionRefs = useRef(new Map());
  const replyInputRefs = useRef(new Map());
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
  const latValue = toFiniteNumber(
    product?.lat ?? product?.latitude ?? product?.location_lat ?? product?.location?.lat
  );
  const lngValue = toFiniteNumber(
    product?.lng ?? product?.longitude ?? product?.location_lng ?? product?.location?.lng
  );

  const broadcastQuestionToStorage = useCallback((payload) => {
    if (typeof window === 'undefined' || !payload) return;
    try {
      window.localStorage.setItem('saleday:product-question', JSON.stringify(payload));
      window.localStorage.removeItem('saleday:product-question');
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
            productTitle: question.product_title || product?.title || 'Produto SaleDay',
            content: question.content || '',
            userName: question.user_name || 'Usuário SaleDay',
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
            productTitle: question.product_title || product?.title || 'Produto SaleDay',
            content: question.response_content || '',
            userName: question.response_user_name || 'Vendedor SaleDay',
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
        new CustomEvent('saleday:product-question', {
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
    if (!message.trim()) {
      toast.error('Digite uma mensagem antes de enviar.');
      return;
    }
    if (!product?.id || !token) {
      toast.error('Você precisa estar logado para enviar mensagens.');
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
    const content = (replyDrafts[questionId] || '').trim();
    if (!content) {
      toast.error('Digite uma resposta antes de enviar.');
      return;
    }
    if (!product?.id || !token) {
      toast.error('Você precisa estar logado.');
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
    if (!token) {
      toast.error('Você precisa estar logado para favoritar.');
      return;
    }
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

  const handleGalleryClick = () => {
    if (galleryTouchMovedRef.current) {
      galleryTouchMovedRef.current = false;
      return;
    }
    setViewerOpen(true);
  };

  const openOfferModal = () => {
    if (product?.status === 'sold' || isOwner) return;
    if (!token) {
      toast.error('Você precisa estar logado para fazer uma oferta.');
      return;
    }
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
    if (!product?.id || !token) return;

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
      senderName: user?.username || user?.name || 'Usuário SaleDay',
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
    const title = product?.title || 'SaleDay';
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

  const handleOpenConversation = () => {
    if (!product?.id) return;
    if (!user || !token) {
      toast.error('Você precisa estar logado para conversar com o vendedor.');
      return;
    }
    if (Number(user.id) === Number(product.user_id)) {
      toast.error('Você é o vendedor deste anúncio.');
      return;
    }

    const params = new URLSearchParams();
    params.set('product', String(product.id));
    if (product.user_id) params.set('seller', String(product.user_id));
    if (product.seller_name) params.set('sellerName', product.seller_name);
    if (product.title) {
      params.set('productTitle', product.title);
    }
    const primaryImage = images?.[0] || product?.image_url || '';
    const formattedPrice = getProductPriceLabel({
      price: product?.price,
      country: product?.country
    });
    const locationLabel = [product?.city, product?.state, product?.country]
      .filter(Boolean)
      .join(', ');
    if (primaryImage) {
      params.set('productImage', primaryImage);
    }
    if (formattedPrice) {
      params.set('productPrice', formattedPrice);
    }
    if (locationLabel) {
      params.set('productLocation', locationLabel);
    }
    navigate(`/messages?${params.toString()}`);
  };

  const handleRequestPurchase = async () => {
    if (!product?.id) return;
    if (!token) {
      toast.error('Você precisa estar logado.');
      return;
    }
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

  const sellerName = product?.seller_name || 'Usuário SaleDay';
  const sellerAvatar = product?.seller_avatar || '';
  const sellerInitial = useMemo(() => getInitial(sellerName), [sellerName]);
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

  if (loading) return <div className="p-6 text-center">Carregando produto...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!product) return null;

  const isFreeProduct = isProductFree(product);
  const priceFmt = getProductPriceLabel(product);
  const propertySpecs = [
    { label: 'Tipo de imóvel', value: product.property_type },
    {
      label: 'Área (m²)',
      value: product.surface_area
    },
    { label: 'Quartos', value: product.bedrooms },
    { label: 'Banheiros', value: product.bathrooms },
    { label: 'Vagas', value: product.parking },
    { label: 'Condomínio', value: product.condo_fee },
    { label: 'Tipo de aluguel', value: product.rent_type }
  ].filter((entry) => entry.value);
  const serviceSpecs = [
    { label: 'Tipo de serviço', value: product.service_type },
    { label: 'Duração / carga horária', value: product.service_duration },
    { label: 'Valor por hora', value: product.service_rate },
    { label: 'Local de atendimento', value: product.service_location }
  ].filter((entry) => entry.value);
  const jobSpecs = [
    { label: 'Cargo', value: product.job_title },
    { label: 'Tipo de vaga', value: product.job_type },
    { label: 'Salário', value: product.job_salary },
    { label: 'Requisitos', value: product.job_requirements }
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

  const hasMapLocation =
    mapCoords.lat !== null && mapCoords.lng !== null;
  const isSold = product.status === 'sold';
  const isOwner = user && user.id === product.user_id;
  const isSeller = Boolean(isOwner);
  const productIsBoosted = Boolean(product?.manual_rank_plan);
  const boostLinkTarget = productIsBoosted
    ? '/dashboard/impulsiona'
    : `/dashboard/impulsiona/${product.id}`;
  const boostLinkState = productIsBoosted ? undefined : { product };

  const sendQuickAvailability = async () => {
    if (isSold) return;
    if (!token) {
      toast.error('Você precisa estar logado para enviar mensagem.');
      return;
    }
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
  const shareText = encodeURIComponent(product.title || 'Produto SaleDay');
  const whatsapp = `https://wa.me/?text=${shareText}%20${shareUrl}`;
  const telegram = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
  const xUrl = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`;

  const sellerCardContent = (
    <>
      <div className="product-detail__seller-avatar w-12 h-12 rounded-full overflow-hidden shadow-inner bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-600">
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
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/95 backdrop-blur-sm"
            onClick={() => setViewerOpen(false)}
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
                className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring focus-visible:ring-white/70"
                onClick={(event) => {
                  event.stopPropagation();
                  setViewerOpen(false);
                }}
              >
                <CloseIcon size={26} />
              </button>

              <img
                src={images[activeImageIndex]}
                alt={product?.title || 'Produto SaleDay'}
                draggable="false"
                className="z-10 max-w-full max-h-full object-contain"
              />
              {activeImageKind === IMAGE_KIND.ILLUSTRATIVE && (
                <span className="absolute left-4 top-4 z-20 rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
                  {IMAGE_KIND_BADGE_LABEL}
                </span>
              )}

              {images.length > 1 && (
                <button
                  type="button"
                  aria-label="Imagem anterior"
                  className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring focus-visible:ring-white/70 w-12 h-12 flex items-center justify-center"
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
                  className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring focus-visible:ring-white/70 w-12 h-12 flex items-center justify-center"
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

  return (
    <section className="product-detail-page">
      <article className="product-detail-card p-4 md:p-6 space-y-6 bg-white/90 backdrop-blur-sm border border-gray-100 rounded-2xl shadow-lg">
        {/* Cabeçalho com vendedor */}
        <header className="product-detail__header flex flex-col gap-3 border-b pb-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 leading-snug">
              {product.title}
            </h1>
            {isSold && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700">
                Vendido
              </span>
            )}
            {!isSold && isFreeProduct && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700 font-semibold">
                Grátis
              </span>
            )}
            <p className="text-gray-600 flex items-center gap-1 text-xs md:text-sm mt-1">
              <MapPin size={14} /> {locCity || 'Local não informado'}
              {locState ? `, ${locState}` : ''}
              {locCountry ? ` (${locCountry})` : ''}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            {sellerProfilePath ? (
              <Link
                to={sellerProfilePath}
                className="product-detail__seller-card flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 hover:shadow-md transition md:min-w-[220px]"
                aria-label={`Ver perfil completo de ${sellerName}`}
              >
                {sellerCardContent}
              </Link>
            ) : (
              <div className="product-detail__seller-card flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 hover:shadow-md transition md:min-w-[220px]">
                {sellerCardContent}
              </div>
            )}

            {showReturnToSellerProfile && (
              <button
                type="button"
                onClick={handleReturnToSellerProfile}
                className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-[12px] font-semibold uppercase tracking-widest text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring focus-visible:ring-slate-400"
              >
                <ChevronLeft size={14} />
                Voltar ao perfil
              </button>
            )}
          </div>
        </header>

          <div className="flex flex-wrap gap-2 text-xs md:text-sm text-gray-600 mt-2">
        <div className="flex items-center gap-1 rounded-full bg-white/70 backdrop-blur-sm border border-gray-200 px-3 py-1 shadow-sm">
          <Eye size={16} className="text-gray-500" aria-hidden="true" />
          <span className="font-semibold text-gray-900">{viewsCount}</span>
          <span>Visualizações</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/70 backdrop-blur-sm border border-gray-200 px-3 py-1 shadow-sm">
          <Heart size={16} className="text-gray-500" aria-hidden="true" />
          <span className="font-semibold text-gray-900">{likesCount}</span>
          <span>Curtidas</span>
        </div>
      </div>

      {/* Galeria de imagens */}
      <div
        className="w-full bg-white/70 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg relative border border-gray-200"
        onTouchStart={handleGalleryTouchStart}
        onTouchMove={handleGalleryTouchMove}
        onTouchEnd={handleGalleryTouchEnd}
      >
        {images.length > 0 ? (
          <img
            src={images[activeImageIndex]}
            alt={product.title}
            className="w-full h-72 md:h-[430px] object-cover cursor-zoom-in transition-all hover:scale-[1.02]"
            onClick={handleGalleryClick}
          />
        ) : (
          <div className="w-full h-72 md:h-[420px] flex items-center justify-center text-gray-400">
            Sem imagem
          </div>
        )}

        {product.status === 'sold' && <SoldBadge className="absolute -top-1 -left-1" />}
        {isFreeProduct && !isSold && (
          <span className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Grátis
          </span>
        )}
        {activeImageKind === IMAGE_KIND.ILLUSTRATIVE && (
          <span className="absolute top-3 right-3 rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
            {IMAGE_KIND_BADGE_LABEL}
          </span>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrevImage}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/30 backdrop-blur-md text-white rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-white/50 transition"
              aria-label="Imagem anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNextImage}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/30 backdrop-blur-md text-white rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-white/50 transition"
              aria-label="Próxima imagem"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Tiras de miniaturas responsivas sem vazar largura */}
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2 pt-1 -mx-1 px-1 md:justify-start justify-center">
          {images.map((image, index) => (
            <button
              key={`${product.id}-${image}`}
              type="button"
              onClick={() => setActiveImageIndex(index)}
              className={`shrink-0 h-16 w-16 md:h-20 md:w-20 rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition
          ${activeImageIndex === index ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200'}`}
            >
              <img src={image} alt={`${product.title} ${index + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex flex-wrap gap-2 md:gap-3 justify-center">
        <button
          onClick={handleFavorite}
          disabled={favoriteLoading}
          className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-full border text-sm disabled:opacity-70 disabled:cursor-not-allowed ${
            favorite ? 'bg-red-500 text-white' : 'bg-white text-gray-700'
          }`}
        >
          <Heart size={18} className={favoriteLoading ? 'animate-pulse' : ''} />{' '}
          {favoriteLoading ? 'Atualizando...' : favorite ? 'Favorito' : 'Favoritar'}
        </button>

        <button
          onClick={openOfferModal}
          disabled={isSold || isOwner}
          className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-full border text-sm ${
            isSold || isOwner
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
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
            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-full border bg-purple-600 text-white hover:bg-purple-700 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {ordering ? 'Solicitando...' : 'Solicitar compra'}
          </button>
        )}

        {!isSeller && user && (
          <button
            onClick={handleOpenConversation}
            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-full border bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
          >
            <MessageCircle size={18} /> Abrir conversa com o vendedor
          </button>
        )}

        <button
          onClick={openShare}
          className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-full border bg-blue-600 text-white hover:bg-blue-700 text-sm"
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
            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-full border bg-gray-800 text-white text-sm"
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

      {/* Detalhes do produto */}
      <section className="space-y-2 border-t pt-4">
      <p className={`text-2xl md:text-3xl font-bold ${isFreeProduct ? 'text-emerald-600' : 'text-green-600'}`}>
        {priceFmt}
      </p>
        {product.pickup_only && (
          <p className="text-sm text-emerald-700">
            Entrega: retirada em mãos combinada com o vendedor.
          </p>
        )}

        {isSeller && buyerInfo && (
          <div className="p-3 border rounded bg-gray-50 text-sm space-y-1">
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

        <p className="text-gray-700 text-sm md:text-base leading-relaxed whitespace-pre-line">
          {product.description || 'Sem descrição disponível.'}
        </p>

        {detailLinks.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-semibold text-gray-700">Links úteis</p>
            <div className="space-y-2">
              {detailLinks.map((link, index) => (
                <a
                  key={`${link.url ?? 'link'}-${index}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-800 transition hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <span className="font-medium text-emerald-600">
                    {link.label || `Link ${index + 1}`}
                  </span>
                  <span className="text-xs text-gray-500 break-all">{link.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {specEntries.length > 0 && (
          <div className="text-xs md:text-sm text-gray-600 grid grid-cols-1 md:grid-cols-2 gap-y-2 md:gap-y-1 md:gap-x-8 mt-2">
            {specEntries.map((entry) => (
              <p key={entry.label}>
                {entry.label}: <span className="text-gray-800">{entry.value}</span>
              </p>
            ))}
          </div>
        )}

        <div className="text-xs md:text-sm text-gray-600 grid grid-cols-1 md:grid-cols-2 gap-y-1 md:gap-y-0 md:gap-x-6">
          <p>Categoria: <span className="text-gray-800">{product.category || 'Não informada'}</span></p>
          <p>CEP: <span className="text-gray-800">{product.zip || 'Não informado'}</span></p>
          <p>Rua: <span className="text-gray-800">{product.street || 'Não informada'}</span></p>
          <p>Bairro: <span className="text-gray-800">{product.neighborhood || 'Não informado'}</span></p>
        </div>

        {(hasMapLocation || mapLoading) && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white/80 p-3 md:p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">Mapa do local</p>
                <p className="text-xs text-gray-500">
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
                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                >
                  Abrir mapa
                </a>
              )}
            </div>
            <div className="mt-3 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
              {hasMapLocation ? (
                <iframe
                  title="Mapa do local do produto"
                  src={buildOpenStreetMapEmbedUrl(mapCoords.lat, mapCoords.lng)}
                  className="h-64 w-full md:h-80"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="h-64 md:h-80 w-full flex items-center justify-center text-xs text-gray-500">
                  Buscando mapa pela cidade...
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Perguntas e respostas da publicação */}
      {!isSold && user && (
        <section className="border-t pt-4 space-y-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-sm md:text-base">Perguntas e respostas</h3>
              <p className="text-xs text-gray-500">
                As mensagens ficam registradas aqui para que qualquer pessoa veja a conversa diretamente no produto.
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-500">
              {visibleProductQuestions.length} {visibleProductQuestions.length === 1 ? 'mensagem' : 'mensagens'}
            </span>
          </div>

          {!isOwner && (
            <div className="space-y-2">
              <textarea
                rows={4}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Faça uma pergunta pública ao vendedor sobre este produto..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button
                onClick={handleSendMessage}
                disabled={sending}
                className="flex w-fit items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? 'Enviando...' : 'Enviar pergunta'}
              </button>
            </div>
          )}

          <div className="space-y-4">
            {questionsLoading && (
              <p className="text-center text-gray-500">Carregando perguntas...</p>
            )}
            {!questionsLoading && questionsError && (
              <p className="text-xs text-red-600">{questionsError}</p>
            )}
            {!questionsLoading && !questionsError && visibleProductQuestions.length === 0 && (
              <p className="text-xs text-gray-500">Ainda não há perguntas para este anúncio.</p>
            )}
            {displayedQuestions.map((msg) => {
              const messageKey = getMessageIdentifier(msg);
              const responseText = (msg.response_content || '').trim();
              const hasResponse = Boolean(responseText);
              const authorLabel = msg.user_name || 'Usuário SaleDay';
              const responseAuthor = msg.response_user_name || 'Vendedor';
              const isHighlighted = highlightQuestionKey === messageKey;
              return (
                <article
                  key={messageKey}
                  ref={(node) => setQuestionRef(messageKey, node)}
                  className={`space-y-3 rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-gray-200 transition ${
                    isHighlighted ? 'ring-sky-400 bg-sky-50 shadow-lg' : ''
                  }`}
                >
                  <header className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">Pergunta</span>
                    <span>{formatMessageTimestamp(msg.created_at)}</span>
                  </header>
                  <p className="text-sm text-gray-900 leading-relaxed">{msg.content}</p>
                  <p className="text-xs text-gray-400">Feita por {authorLabel}</p>

                  {hasResponse && (
                    <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                      <div className="flex items-center justify-between text-xs text-emerald-700">
                        <span>Resposta do vendedor</span>
                        <span>{formatMessageTimestamp(msg.response_created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed">{responseText}</p>
                      <p className="text-[0.65rem] text-emerald-600">Por {responseAuthor}</p>
                    </div>
                  )}

                  {!hasResponse && isOwner && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleReplyArea(msg.id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        {activeReplyQuestionId === msg.id ? 'Cancelar' : 'Responder'}
                      </button>
                      {activeReplyQuestionId === msg.id && (
                        <div className="space-y-2">
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
                            className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Responda diretamente esta pergunta..."
                          />
                          <button
                            type="button"
                            onClick={() => submitAnswer(msg.id)}
                            disabled={answerLoadingId === msg.id}
                            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  className="rounded-full border border-gray-300 px-4 py-1 text-xs font-semibold text-gray-700 hover:border-gray-400 hover:text-gray-900"
                >
                  Ver mais perguntas
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {offerOpen && (
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
        </div>
      )}


      {viewerPortal}


      {/* Modal de compartilhamento (fallback) */}
      {shareOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-[420px] rounded-t-2xl md:rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Compartilhar</h4>
              <button
                onClick={() => setShareOpen(false)}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="Fechar"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              <a href={whatsapp} target="_blank" rel="noreferrer" className="text-sm hover:opacity-80">
                <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/whatsapp.svg" alt="WhatsApp" className="w-8 h-8 mx-auto" />
                WhatsApp
              </a>
              <a href={telegram} target="_blank" rel="noreferrer" className="text-sm hover:opacity-80">
                <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/telegram.svg" alt="Telegram" className="w-8 h-8 mx-auto" />
                Telegram
              </a>
              <a href={facebook} target="_blank" rel="noreferrer" className="text-sm hover:opacity-80">
                <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/facebook.svg" alt="Facebook" className="w-8 h-8 mx-auto" />
                Facebook
              </a>
              <a href={xUrl} target="_blank" rel="noreferrer" className="text-sm hover:opacity-80">
                <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/x.svg" alt="X" className="w-8 h-8 mx-auto" />
                X
              </a>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"
              >
                <CopyIcon size={16} /> Copiar link
              </button>
              <button
                onClick={() => setShareOpen(false)}
                className="ml-auto px-3 py-2 bg-gray-800 text-white rounded text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
    </section>
  );
}
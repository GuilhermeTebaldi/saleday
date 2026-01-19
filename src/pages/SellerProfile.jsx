// frontend/src/pages/SellerProfile.jsx
// rede social
// Página com o perfil público de um vendedor e seus produtos.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { LocaleContext } from '../context/LocaleContext.jsx';
import { asStars } from '../utils/rating.js';
import { getProductPriceLabel } from '../utils/product.js';
import { buildProductMessageLink } from '../utils/messageLinks.js';
import { Share2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import SellerProductGrid from '../components/SellerProductGrid.jsx';
import { makeAbsolute } from '../utils/urlHelpers.js';
import useLoginPrompt from '../hooks/useLoginPrompt.js';
import CloseBackButton from '../components/CloseBackButton.jsx';
import ImageViewerModal from '../components/ImageViewerModal.jsx';
import useImageViewer from '../hooks/useImageViewer.js';
import LoadingBar from '../components/LoadingBar.jsx';

function getInitial(name) {
  if (!name) return 'U';
  const c = name.trim().charAt(0);
  return c ? c.toUpperCase() : 'U';
}

export default function SellerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const { locale } = useContext(LocaleContext);
  const promptLogin = useLoginPrompt();
  const requireAuth = useCallback(
    (message) => {
      if (token) return true;
      return promptLogin(message);
    },
    [promptLogin, token]
  );

  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [activeTab, setActiveTab] = useState('products');
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editingReviewText, setEditingReviewText] = useState('');
  const [savingReviewId, setSavingReviewId] = useState(null);
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef(null);

  const [reviewStatus, setReviewStatus] = useState({
    loading: false,
    data: null
  });
  const [reviewStatusTrigger, setReviewStatusTrigger] = useState(0);
  const [reviewsRefreshTrigger, setReviewsRefreshTrigger] = useState(0);
  const refreshReviewStatus = useCallback(
    () => setReviewStatusTrigger((prev) => prev + 1),
    []
  );
  const refreshReviews = useCallback(
    () => setReviewsRefreshTrigger((prev) => prev + 1),
    []
  );

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarMenuRef = useRef(null);
  const {
    isOpen: isAvatarViewerOpen,
    src: avatarViewerSrc,
    alt: avatarViewerAlt,
    openViewer: openAvatarViewer,
    closeViewer: closeAvatarViewer
  } = useImageViewer();

  // modal avaliar
  const [rateOpen, setRateOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [sendingReview, setSendingReview] = useState(false);

  const isSelf = user && Number(user.id) === Number(id);
  const showReviewActions = Boolean(user && !isSelf);
  const isReviewButtonEnabled = Boolean(reviewStatus.data?.canReview);
  const reviewButtonDisabled = !isReviewButtonEnabled || reviewStatus.loading;
  const isSellerOnline = isSelf || Boolean(seller?.is_online);

  // métricas vindas direto do seller
  const avgRating = useMemo(
    () => Number(seller?.rating_avg ?? 0),
    [seller?.rating_avg]
  );
  const ratingCount = Number(seller?.rating_count ?? 0);
  const hasRatings = ratingCount > 0;
  const { full, half, empty } = useMemo(
    () => asStars(avgRating),
    [avgRating]
  );
  const fallbackSalesCount = useMemo(
    () => products.reduce((total, p) => total + (p.status === 'sold' ? 1 : 0), 0),
    [products]
  );
  const salesCount = Number.isFinite(Number(seller?.sales_count))
    ? Number(seller.sales_count)
    : fallbackSalesCount;
  const purchasesCount = Number.isFinite(Number(seller?.purchase_count))
    ? Number(seller.purchase_count)
    : 0;
  const sellerDisplayName = seller?.username || 'Vendedor TempleSale';

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const previousTranslate = document.documentElement.getAttribute('translate');
    document.documentElement.setAttribute('translate', 'no');
    return () => {
      if (previousTranslate == null) {
        document.documentElement.removeAttribute('translate');
      } else {
        document.documentElement.setAttribute('translate', previousTranslate);
      }
    };
  }, []);

  // carregar vendedor + produtos
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sellerRes, prodRes] = await Promise.all([
          api.get(`/users/${id}`),
          api.get(`/users/${id}/products`, { params: { status: 'active' } })
        ]);

        if (!active) return;

        if (!sellerRes.data?.data) {
          setErrMsg('Vendedor não encontrado.');
          setSeller(null);
          setProducts([]);
        } else {
          setSeller(sellerRes.data.data);
          setProducts(Array.isArray(prodRes.data?.data) ? prodRes.data.data : []);
        }
      } catch (e) {
        if (!active) return;
        setErrMsg('Vendedor não encontrado.');
        setSeller(null);
        setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoadingReviews(true);
    api
      .get(`/users/${id}/reviews`, { params: { limit: 30 } })
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setReviews(list);
      })
      .catch(() => {
        if (!active) return;
        setReviews([]);
      })
      .finally(() => {
        if (active) setLoadingReviews(false);
      });
    return () => {
      active = false;
    };
  }, [id, reviewsRefreshTrigger]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setReviewStatus({ loading: false, data: null });
      return () => {
        active = false;
      };
    }

    setReviewStatus((prev) => ({ ...prev, loading: true }));
    api
      .get(`/users/${id}/reviews/status`)
      .then((res) => {
        if (!active) return;
        setReviewStatus({ loading: false, data: res.data?.data ?? null });
      })
      .catch(() => {
        if (!active) return;
        setReviewStatus((prev) => ({ ...prev, loading: false }));
      });

    return () => {
      active = false;
    };
  }, [id, user, reviewStatusTrigger]);

  useEffect(() => {
    if (!showAvatarMenu || typeof document === 'undefined') return undefined;
    const handleClickOutside = (event) => {
      if (typeof event.target === 'object' && event.target !== null) {
        if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target)) {
          setShowAvatarMenu(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAvatarMenu]);

  useEffect(() => {
    if (!isSelf && showAvatarMenu) {
      setShowAvatarMenu(false);
    }
  }, [isSelf, showAvatarMenu]);

  useEffect(() => {
    if (!shareMenuOpen || typeof document === 'undefined') return undefined;
    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setShareMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [shareMenuOpen]);

  const reloadSellerProfile = useCallback(async () => {
    try {
      const sellerRes = await api.get(`/users/${id}`);
      if (sellerRes.data?.data) {
        setSeller(sellerRes.data.data);
      }
    } catch {
      // manter estado atual em caso de falha
    }
  }, [id]);

  // enviar review (aqui continua chamando POST /users/:id/reviews
  // se seu backend também não tem isso ainda você pode remover todo esse bloco e o modal)
  const sendReview = async () => {
    if (!requireAuth('Faça login para enviar avaliações.')) return;
    if (!stars || stars < 1 || stars > 5) {
      toast.error('Nota inválida.');
      return;
    }
    setSendingReview(true);
    try {
      const res = await api.post(
        `/users/${id}/reviews`,
        { stars, comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        toast.success('Avaliação enviada.');
        setRateOpen(false);
        setStars(5);
        setComment('');
        refreshReviewStatus();
        refreshReviews();
        // opcional: atualizar média do seller após avaliar
        await reloadSellerProfile();
      } else {
        toast.error(res.data?.message || 'Erro.');
      }
    } catch (e) {
      const msg = e?.response?.data?.message || 'Erro.';
      toast.error(msg);
    } finally {
      setSendingReview(false);
    }
  };

  const startEditingReview = useCallback((review) => {
    if (!review) return;
    setEditingReviewId(review.id);
    setEditingReviewText(review.comment ?? '');
  }, []);

  const cancelEditingReview = useCallback(() => {
    setEditingReviewId(null);
    setEditingReviewText('');
  }, []);

  const handleSaveReview = async (reviewId) => {
    if (!reviewId) return;
    if (!requireAuth('Faça login para editar avaliações.')) return;
    setSavingReviewId(reviewId);
    try {
      const normalizedComment = editingReviewText.trim();
      const res = await api.patch(
        `/users/${id}/reviews/${reviewId}`,
        { comment: normalizedComment || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        toast.success('Comentário atualizado.');
        cancelEditingReview();
        refreshReviews();
      } else {
        toast.error(res.data?.message || 'Erro ao atualizar comentário.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao atualizar comentário.';
      toast.error(msg);
    } finally {
      setSavingReviewId(null);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!reviewId) return;
    if (!requireAuth('Faça login para excluir avaliações.')) return;
    setDeletingReviewId(reviewId);
    try {
      const res = await api.delete(`/users/${id}/reviews/${reviewId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success('Comentário excluído.');
        refreshReviews();
        refreshReviewStatus();
        await reloadSellerProfile();
        if (editingReviewId === reviewId) {
          cancelEditingReview();
        }
      } else {
        toast.error(res.data?.message || 'Erro ao excluir comentário.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao excluir comentário.';
      toast.error(msg);
    } finally {
      setDeletingReviewId(null);
    }
  };

  useEffect(() => {
    if (
      editingReviewId &&
      !reviews.some((review) => review.id === editingReviewId)
    ) {
      cancelEditingReview();
    }
  }, [cancelEditingReview, editingReviewId, reviews]);

  if (loading) {
    return (
      <section className="ig-wrap">
        <div className="ig-card ig-center ig-muted">
          <LoadingBar message="Carregando..." className="text-slate-500" />
        </div>
      </section>
    );
  }

  if (errMsg || !seller) {
    return (
      <section className="ig-wrap">
        <div className="ig-card ig-center ig-error">{errMsg || 'Erro'}</div>
      </section>
    );
  }

  // avatar
  const rawAvatar =
    seller.profile_image_url ||
    seller.avatar_url ||
    seller.profile_image ||
    seller.avatar ||
    '';
  const avatarUrl = rawAvatar ? makeAbsolute(rawAvatar) : '';

  const initials = getInitial(seller.username || seller.email || 'U');
  const city = seller.city || '';
  const state = seller.state || '';
  const country = seller.country || '';
  const locationStr =
    [city, state, country].filter(Boolean).join(', ') ||
    'Localização não informada';
  const avatarLabel = sellerDisplayName ? `Foto de ${sellerDisplayName}` : 'Foto do vendedor';
  const handleAvatarClick = () => {
    if (!isSelf) {
      if (avatarUrl) {
        openAvatarViewer(avatarUrl, avatarLabel);
      }
      return;
    }
    setShowAvatarMenu((prev) => !prev);
  };
  const shareLogoSrc = '/logo-templesale.png';

  const profileUrl = seller?.id
    ? typeof window === 'undefined'
      ? `/users/${seller.id}`
      : `${window.location.origin}/users/${seller.id}`
    : '';
  const shareLabel = `${sellerDisplayName} · TempleSale`;
  const shareMessage = profileUrl
    ? `${shareLabel}\nConfira o perfil completo: ${profileUrl}`
    : `${shareLabel}\nVeja as novidades do vendedor na TempleSale.`;
  const encodedShareMessage = encodeURIComponent(shareMessage);
  const whatsappShareHref = `https://wa.me/?text=${encodedShareMessage}`;
  const emailSubject = encodeURIComponent(`Perfil de ${sellerDisplayName} no TempleSale`);
  const emailBody = encodeURIComponent(`${shareLabel}\n${profileUrl || 'https://templesale.com'}`);
  const emailShareHref = `mailto:?subject=${emailSubject}&body=${emailBody}`;
  const displayProfileLink = profileUrl ? profileUrl.replace(/^https?:\/\//, '') : '';
  const handleCopyProfileLink = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Link copiado.');
    } catch {
      toast.error('Falha ao copiar link.');
    }
  };

  function registerClick(productId) {
    if (!productId) return;
    api.put(`/products/${productId}/click`).catch(() => {});
  }

  const handleOpenSellerChat = () => {
    if (!requireAuth('Faça login para conversar com vendedores.')) return;
    const params = new URLSearchParams();
    params.set('seller', String(seller.id));
    if (seller.username) {
      params.set('sellerName', seller.username);
    }
    navigate(`/messages?${params.toString()}`);
  };

  const handleOpenProductChat = (product) => {
    if (!requireAuth('Faça login para conversar com vendedores.')) return;
    if (isSelf) {
      toast.error('Você não pode iniciar uma conversa com você mesmo.');
      return;
    }
    if (!product?.id) {
      toast.error('Produto inválido.');
      return;
    }
    const primaryImage =
      (Array.isArray(product.image_urls) && product.image_urls[0]) ||
      product.image_url ||
      '';
    const productPrice = getProductPriceLabel({
      price: product.price,
      country: product.country
    });
    const messageLink = buildProductMessageLink({
      product,
      sellerId: seller.id,
      sellerName: seller.username,
      productImage: primaryImage ? makeAbsolute(primaryImage) : '',
      productPrice
    });
    navigate(messageLink);
  };

  const reviewLocale = locale || 'pt-BR';

  const formatReviewDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(reviewLocale || 'pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <>
      <ImageViewerModal
        isOpen={isAvatarViewerOpen}
        src={avatarViewerSrc}
        alt={avatarViewerAlt}
        onClose={closeAvatarViewer}
      />
      <section className="ig-wrap ig-wrap--wide min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-slate-100 py-6 px-3">
        <CloseBackButton />
        <div className="max-w-[1400px] w-full mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* HEADER / INFO PRINCIPAL */}
          <header className="flex flex-col md:flex-row md:items-center gap-6 p-6">
            {/* Avatar */}
            <div className="flex justify-center md:block">
              <div className="relative" ref={avatarMenuRef}>
                <button
                  type="button"
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  onClick={handleAvatarClick}
                  aria-label={isSelf ? 'Editar foto do perfil' : 'Foto do perfil'}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={seller.username || 'Usuário'}
                      className="h-24 w-24 md:h-28 md:w-28 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                    />
                  ) : (
                    <div className="h-24 w-24 md:h-28 md:w-28 rounded-full bg-slate-200 flex items-center justify-center text-3xl font-semibold text-slate-700 border border-slate-300">
                      {initials}
                    </div>
                  )}
                </button>
                {isSellerOnline && (
                  <span className="absolute -bottom-1 -right-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-[10px] font-medium text-white shadow">
                    • Online agora
                  </span>
                )}
                {isSelf && showAvatarMenu && (
                  <div className="absolute left-1/2 top-full z-10 mt-2 w-48 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white py-2 shadow-lg">
                    <Link
                      to="/edit-profile"
                      className="mx-2 inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-3 py-1 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                      onClick={() => setShowAvatarMenu(false)}
                    >
                      Editar foto
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Nome, rating e localização */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-col gap-1">
                <h1 className="text-xl md:text-2xl font-semibold text-slate-900 truncate">
                  {seller.username || 'Vendedor'}
                </h1>
                <p className="text-xs md:text-sm text-slate-500 truncate">
                  @{(seller.username || seller.email || 'usuario').toLowerCase()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-lg text-amber-400">
                    {'★'.repeat(full)}
                    {half ? '☆' : ''}
                    {'✩'.repeat(empty)}
                  </span>
                  <span className="text-xs text-slate-600">
                    {hasRatings ? (
                      <>
                        {avgRating.toFixed(1)} / 5
                        <span className="text-slate-400">
                          {' '}
                          · {ratingCount}{' '}
                          {ratingCount === 1 ? 'avaliação' : 'avaliações'}
                        </span>
                      </>
                    ) : (
                      'Nenhuma venda'
                    )}
                  </span>
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                <p className="flex items-center gap-1 text-xs md:text-sm text-slate-500">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      isSellerOnline ? 'bg-emerald-400' : 'bg-slate-300'
                    }`}
                  />
                  {locationStr}
                </p>
              </div>
            </div>

            {/* Ações principais */}
            <div className="flex flex-col gap-2 w-full md:w-auto md:items-end">
              {showReviewActions && (
                <>
                  <button
                    type="button"
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 text-white text-sm px-4 py-2 shadow-sm hover:bg-slate-800 transition"
                    onClick={handleOpenSellerChat}
                  >
                    Mensagem
                  </button>
                  <div className="w-full md:w-auto flex flex-col gap-1">
                    <button
                      type="button"
                      className={`w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 text-slate-700 text-xs px-4 py-1.5 transition ${
                        reviewButtonDisabled
                          ? 'cursor-not-allowed opacity-60'
                          : 'hover:bg-slate-50'
                      }`}
                      disabled={reviewButtonDisabled}
                      onClick={() => {
                        if (reviewButtonDisabled) return;
                        setRateOpen(true);
                      }}
                    >
                      Avaliar vendedor
                    </button>
                    {!reviewStatus.loading &&
                      reviewStatus.data &&
                      !reviewStatus.data.canReview && (
                        <span className="text-[11px] text-slate-500 text-right">
                          Avaliação liberada após confirmar nova compra com este vendedor.
                        </span>
                      )}
                  </div>
                </>
              )}

              <div ref={shareMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShareMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring focus-visible:ring-slate-400"
                >
                  <Share2 size={14} className="text-slate-500" />
                  Compartilhar perfil
                </button>
                {shareMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-64 space-y-2 rounded-2xl border border-slate-200 bg-white py-3 px-3 shadow-lg">
                    <div className="space-y-1 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-3 py-2 text-white shadow">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-slate-200 font-semibold">TempleSale · Perfil</p>
                          <p className="truncate text-sm font-semibold">{sellerDisplayName}</p>
                        </div>
                        <img
                          src={shareLogoSrc}
                          alt="Logo TempleSale"
                          className="h-10 w-10 rounded-full border border-white/30 bg-white/10 object-contain p-1"
                        />
                      </div>
                      {displayProfileLink && (
                        <div className="mt-1 flex items-center justify-between gap-3 rounded-xl bg-white/20 px-3 py-1 text-[10px] font-semibold tracking-wide text-slate-100">
                          <span className="truncate">{displayProfileLink}</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              handleCopyProfileLink();
                            }}
                            className="rounded-full border border-white/40 px-2 py-0.5 text-[9px]"
                          >
                            Copiar
                          </button>
                        </div>
                      )}
                    </div>
                    <a
                      href={whatsappShareHref}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white"
                    >
                      WhatsApp
                      <span className="text-[10px] text-slate-500">↗</span>
                    </a>
                    <a
                      href={emailShareHref}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white"
                    >
                      E-mail
                      <span className="text-[10px] text-slate-500">✉</span>
                    </a>
                  </div>
                )}
              </div>

              {isSelf && (
                <span className="inline-flex items-center rounded-full bg-slate-100 text-[11px] text-slate-600 px-3 py-1 mt-1">
                Este é o seu perfil público
                </span>
              )}
            </div>
          </header>

        {/* BARRA DE RESUMO */}
        <div className="bg-white border-t border-slate-200 px-3 py-3 shadow-sm w-full min-h-[110px]">
          <div className="grid grid-cols-4 gap-2 w-full">

            {/* PUBLICAÇÕES */}
            <div className="flex flex-col items-center rounded-lg bg-slate-50 py-2">
              <span className="text-sm font-extrabold text-blue-700 leading-none">
                {products.length}
              </span>
              <span className="text-[10px] tracking-wide text-slate-500 mt-0.5 leading-tight">
                {products.length === 1 ? 'Publicação' : 'Publicações'}
              </span>
            </div>

            {/* NOTA MÉDIA */}
            <div className="flex flex-col items-center rounded-lg bg-slate-50 py-2">
              <span className="text-sm font-extrabold text-yellow-600 leading-none">
                {hasRatings ? avgRating.toFixed(1) : '—'}
              </span>
              <span className="text-[10px] tracking-wide text-slate-500 mt-0.5 leading-tight">
                Nota média
              </span>
            </div>

            {/* VENDAS */}
            <div className="flex flex-col items-center rounded-lg bg-slate-50 py-2">
              <span className="text-sm font-extrabold text-green-600 leading-none">
                {salesCount}
              </span>
              <span className="text-[10px] tracking-wide text-slate-500 mt-0.5 leading-tight">
                {salesCount === 1 ? 'Venda' : 'Vendas'}
              </span>
            </div>

            {/* COMPRAS */}
            <div className="flex flex-col items-center rounded-lg bg-slate-50 py-2">
              <span className="text-sm font-extrabold text-blue-600 leading-none">
                {purchasesCount}
              </span>
              <span className="text-[10px] tracking-wide text-slate-500 mt-0.5 leading-tight">
                {purchasesCount === 1 ? 'Compra' : 'Compras'}
              </span>
            </div>

          </div>
          
        </div>


        {isSelf && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-blue-600">Catálogo TempleSale</p>
                <h3 className="text-lg font-semibold leading-snug text-slate-900">
                  Crie um catálogo profissional para seus produtos
                </h3>
                <p className="text-sm text-slate-500">
                  Separe seus destaques, escolha o visual e gere um PDF pronto para compartilhar com clientes e parceiros.
                </p>
              </div>
              <Link
                to="/catalogo"
                className="inline-flex w-full max-w-xs items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow transition hover:bg-slate-800 md:w-auto"
              >
                Abrir meu catálogo
              </Link>
            </div>
          </div>
        )}


          {/* GRID / COMENTÁRIOS */}
          <section className="p-4 md:p-6">
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide uppercase transition ${
                  activeTab === 'products'
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Publicações do vendedor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('comments')}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide uppercase transition ${
                  activeTab === 'comments'
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Comentários
              </button>
            </div>

            {activeTab === 'products' ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                    Publicações do vendedor
                  </h2>
                  {products.length > 0 && (
                    <span className="text-xs text-slate-500">
                      Mostrando {products.length} item{products.length > 1 && 's'}
                    </span>
                  )}
                </div>
                {products.length === 0 ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 px-4 text-center">
                    <p className="text-sm text-slate-500 max-w-sm">
                      Nenhuma publicação ainda.
                      {isSelf
                        ? ' Comece anunciando seu primeiro produto para aparecer aqui.'
                        : ' Assim que este vendedor publicar algo, os anúncios vão aparecer aqui.'}
                    </p>
                  </div>
                ) : (
                  <SellerProductGrid
                    products={products}
                    isSelf={isSelf}
                    registerClick={registerClick}
                    handleOpenProductChat={handleOpenProductChat}
                    linkState={{ fromSellerProfile: true, sellerId: seller?.id }}
                  />
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                    Comentários sobre o vendedor
                  </h2>
                  {!loadingReviews && reviews.length > 0 && (
                    <span className="text-xs text-slate-500">
                      {reviews.length}{' '}
                      {reviews.length === 1 ? 'comentário recente' : 'comentários recentes'}
                    </span>
                  )}
                </div>
                {loadingReviews ? (
                  <LoadingBar
                    message="Carregando comentários..."
                    className="text-sm text-slate-500 py-6 text-center"
                    size="sm"
                  />
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">
                    {isSelf
                      ? 'Ainda não há comentários. Assim que suas vendas forem avaliadas, eles aparecem aqui.'
                      : 'Este vendedor ainda não recebeu comentários de compradores.'}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {reviews.map((review) => {
                      const reviewerName = review.reviewer_name || 'Cliente TempleSale';
                      const reviewerInitial = getInitial(reviewerName);
                      const reviewerAvatar = review.reviewer_avatar ? makeAbsolute(review.reviewer_avatar) : '';
                      const starsValueRaw = Math.max(0, Math.min(5, Number(review.stars) || 0));
                      const starsValue = Math.round(starsValueRaw);
                      const emptyStars = Math.max(0, 5 - starsValue);
                      const commentText = review.comment?.trim() || 'Sem comentário adicional.';
                      const purchaseRawImage =
                        review.product_image_url ||
                        (Array.isArray(review.image_urls) ? review.image_urls[0] : '');
                      const purchaseImageUrl = purchaseRawImage ? makeAbsolute(purchaseRawImage) : '';
                      const purchaseTitle = review.product_title?.trim();
                      const reviewerId = Number(review.reviewer_id ?? 0);
                      const currentUserId = Number(user?.id ?? 0);
                      const isReviewOwner = reviewerId > 0 && currentUserId > 0 && reviewerId === currentUserId;
                      const editingThisReview = editingReviewId === review.id;
                      const isSaving = savingReviewId === review.id;
                      const isDeleting = deletingReviewId === review.id;
                      const createdAtDate = review.created_at ? new Date(review.created_at) : null;
                      const updatedAtDate = review.updated_at ? new Date(review.updated_at) : null;
                      const wasEdited =
                        updatedAtDate &&
                        createdAtDate &&
                        typeof updatedAtDate.getTime === 'function' &&
                        typeof createdAtDate.getTime === 'function' &&
                        updatedAtDate.getTime() > createdAtDate.getTime();
                      const editedLabel = wasEdited ? formatReviewDate(review.updated_at) : null;

                      return (
                        <li
                          key={review.id}
                          className="flex gap-3 rounded-xl border border-slate-100 bg-white/60 p-3"
                        >
                          <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-600">
                            {reviewerAvatar ? (
                              <img src={reviewerAvatar} alt={reviewerName} className="h-full w-full object-cover" />
                            ) : (
                              reviewerInitial
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700">{reviewerName}</span>
                                {purchaseImageUrl && (
                                  <img
                                    src={purchaseImageUrl}
                                    alt={purchaseTitle || 'Produto comprado'}
                                    className="h-6 w-6 rounded-lg border border-slate-100 shadow-sm object-cover"
                                  />
                                )}
                                {purchaseTitle && (
                                  <span className="text-[11px] text-slate-400 max-w-[10rem] truncate">
                                    {purchaseTitle}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span>{formatReviewDate(review.created_at)}</span>
                                {isReviewOwner && (
                                  <div className="flex items-center gap-2">
                                    {!editingThisReview && (
                                      <button
                                        type="button"
                                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition"
                                        onClick={() => startEditingReview(review)}
                                        disabled={isSaving || isDeleting}
                                      >
                                        Editar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 transition"
                                      onClick={() => handleDeleteReview(review.id)}
                                      disabled={isDeleting}
                                    >
                                      {isDeleting ? 'Excluindo...' : 'Excluir'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-amber-400 text-sm">
                              <span>{'★'.repeat(starsValue)}{'☆'.repeat(emptyStars)}</span>
                              <span className="text-[11px] text-slate-500">{starsValue} / 5</span>
                            </div>
                            {editingThisReview ? (
                              <div className="mt-3 space-y-2">
                                <textarea
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                                  rows={3}
                                  value={editingReviewText}
                                  onChange={(event) => setEditingReviewText(event.target.value)}
                                  disabled={isSaving}
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-semibold px-4 py-1.5 shadow-sm hover:bg-slate-800 transition disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={isSaving || isDeleting}
                                    onClick={() => handleSaveReview(review.id)}
                                  >
                                    {isSaving ? 'Salvando...' : 'Salvar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-600 px-4 py-1.5 hover:bg-slate-100 transition"
                                    onClick={cancelEditingReview}
                                    disabled={isSaving}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-slate-700 mt-1">{commentText}</p>
                                {editedLabel && (
                                  <span className="mt-1 inline-block text-[10px] text-slate-400 uppercase tracking-wide">
                                    Editado dia {editedLabel}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      </section>

      {/* modal de avaliação */}
      {rateOpen && (
        <div className="ig-rate-overlay">
          <div className="ig-rate-sheet">
            <div className="ig-rate-handle" />

            <p className="ig-rate-title">
              Avaliar {seller.username || 'vendedor'}
            </p>

            <div className="ig-rate-stars-row">
              <label className="ig-rate-label">
                Nota
                <select
                  className="ig-rate-select"
                  value={stars}
                  onChange={(e) => setStars(Number(e.target.value))}
                >
                  {[5,4,3,2,1].map(n => (
                    <option key={n} value={n}>{n} estrela(s)</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="ig-rate-label ig-rate-label-full">
              Comentário (opcional)
              <textarea
                className="ig-rate-textarea"
                placeholder="Conte rapidamente como foi negociar"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>

            <div className="ig-rate-actions">
              <button
                type="button"
                className="ig-rate-cancel"
                onClick={() => {
                  if (!sendingReview) setRateOpen(false);
                }}
              >
                Fechar
              </button>

              <button
                type="button"
                className="ig-rate-send"
                disabled={sendingReview}
                onClick={sendReview}
              >
                {sendingReview ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

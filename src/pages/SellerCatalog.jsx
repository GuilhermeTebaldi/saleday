import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import api from '../api/api.js';
import GeoContext from '../context/GeoContext.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import SellerProductGrid from '../components/SellerProductGrid.jsx';
import {
  createCatalogTranslator,
  DEFAULT_CATALOG_LOCALE,
  CATALOG_STYLE_OPTIONS,
  CATALOG_PREVIEW_META,
  CATALOG_THUMBNAILS,
  drawPremiumCatalog,
  drawClassicCatalog,
  drawVibrantCatalog,
  drawModernCatalog
} from '../utils/catalogBuilder.js';
import { localeFromCountry } from '../i18n/localeMap.js';

export default function SellerCatalog() {
  const { user } = useContext(AuthContext);
  const geo = useContext(GeoContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalogSelection, setCatalogSelection] = useState([]);
  const [catalogStyle, setCatalogStyle] = useState('premium');
  const [generatingCatalog, setGeneratingCatalog] = useState(false);

  const sellerDisplayName = user?.username || 'Vendedor SaleDay';

  useEffect(() => {
    if (!user?.id) {
      setProducts([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setError('');
    setLoading(true);
    api
      .get(`/users/${user.id}/products`, { params: { status: 'active' } })
      .then((res) => {
        if (!active) return;
        const items = Array.isArray(res.data?.data) ? res.data.data : [];
        setProducts(items);
      })
      .catch(() => {
        if (!active) return;
        setError('Não foi possível carregar seus produtos. Atualize a página para tentar novamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const registerClick = useCallback((productId) => {
    if (!productId) return;
    api.put(`/products/${productId}/click`).catch(() => {});
  }, []);

  const toggleProductSelection = useCallback((productId) => {
    if (!productId) return;
    const normalizedId = String(productId);
    setCatalogSelection((prev) => {
      if (prev.includes(normalizedId)) {
        return prev.filter((id) => id !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  }, []);

  const selectedProductsForCatalog = useMemo(() => {
    if (!catalogSelection.length) return [];
    const ids = new Set(catalogSelection);
    return products.filter((product) => product?.id && ids.has(String(product.id)));
  }, [catalogSelection, products]);

  const catalogLocale = useMemo(() => {
    if (user?.country) return localeFromCountry(user.country);
    if (geo?.locale) return geo.locale;
    if (geo?.country) return localeFromCountry(geo.country);
    return DEFAULT_CATALOG_LOCALE;
  }, [user?.country, geo?.locale, geo?.country]);

  const catalogTranslator = useMemo(
    () => createCatalogTranslator(catalogLocale),
    [catalogLocale]
  );

  const isCatalogReady = selectedProductsForCatalog.length > 0;

  const handleGenerateCatalog = useCallback(async () => {
    if (!isCatalogReady) {
      toast.error(
        catalogTranslator(
          'Selecione ao menos um produto para gerar o catálogo.',
          'Select at least one product to generate the catalog.'
        )
      );
      return;
    }
    if (typeof window === 'undefined') {
      toast.error(
        catalogTranslator(
          'Não foi possível gerar o catálogo neste ambiente.',
          'Could not generate the catalog in this environment.'
        )
      );
      return;
    }
    setGeneratingCatalog(true);
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 30;
      const props = {
        doc,
        margin,
        pageWidth,
        pageHeight,
        sellerDisplayName,
        selectedProductsForCatalog,
        translate: catalogTranslator
      };
      if (catalogStyle === 'classic') {
        await drawClassicCatalog(props);
      } else if (catalogStyle === 'vibrant') {
        await drawVibrantCatalog(props);
      } else if (catalogStyle === 'modern') {
        await drawModernCatalog(props);
      } else {
        await drawPremiumCatalog(props);
      }
      const safeName = (
        (sellerDisplayName || 'SaleDay')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9-_]/g, '') || 'SaleDay'
      );
      doc.save(`${safeName}-catalogo.pdf`);
      toast.success(
        catalogTranslator(
          'Catálogo gerado com sucesso.',
          'Catalog generated successfully.'
        )
      );
    } catch (error) {
      console.error(error);
      toast.error(
        catalogTranslator(
          'Não foi possível gerar o catálogo.',
          'Could not generate the catalog.'
        )
      );
    } finally {
      setGeneratingCatalog(false);
    }
  }, [
    catalogStyle,
    catalogTranslator,
    isCatalogReady,
    selectedProductsForCatalog,
    sellerDisplayName
  ]);

  const renderCatalogAction = useCallback(
    ({ product, isSelected }) => (
      <button
        type="button"
        className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-[10px] font-semibold transition ${
          isSelected
            ? 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        }`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleProductSelection(product.id);
        }}
      >
        {isSelected ? 'Remover do catálogo' : 'Adicionar ao catálogo'}
      </button>
    ),
    [toggleProductSelection]
  );

  const selectedStyleMeta = CATALOG_PREVIEW_META[catalogStyle];

  if (!user) {
    return null;
  }

  return (
    <section className="ig-wrap ig-wrap--wide min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-slate-100 py-6 px-3">
      <div className="max-w-[1200px] mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Catálogo SaleDay</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Crie um catálogo profissional</h1>
            <p className="mt-2 text-sm text-slate-500">
              Selecione os seus melhores produtos, escolha um estilo e gere um PDF premium pronto para compartilhar.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              to={`/users/${user.id}`}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
            >
              Voltar ao meu perfil
            </Link>
            <button
              type="button"
              onClick={handleGenerateCatalog}
              disabled={!isCatalogReady || generatingCatalog}
              className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow transition ${
                isCatalogReady
                  ? 'bg-slate-900 hover:bg-slate-800'
                  : 'cursor-not-allowed bg-slate-400/70'
              }`}
            >
              {generatingCatalog ? 'Gerando catálogo...' : 'Gerar meu catálogo SaleDay'}
            </button>
            <p className="text-[11px] text-slate-500">
              {selectedProductsForCatalog.length} produto
              {selectedProductsForCatalog.length === 1 ? '' : 's'} selecionado
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.3em] text-slate-500">
              <span>Modelos disponíveis</span>
              <span className="text-[8px] text-slate-400">Miniaturas</span>
            </div>
            <div className="flex gap-3 overflow-x-auto px-1 py-2">
              {CATALOG_STYLE_OPTIONS.map((option) => {
                const meta = CATALOG_PREVIEW_META[option.key];
                const thumbSrc = CATALOG_THUMBNAILS[option.key] || '/catalogo/catalogo.jpg';
                const selected = catalogStyle === option.key;
                const optionLabel = catalogTranslator(option.label, option.label);
                const optionBadge = meta?.badge ? catalogTranslator(meta.badge, meta.badge) : '';
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setCatalogStyle(option.key)}
                    className={`flex-shrink-0 w-32 sm:w-36 rounded-2xl border p-2 text-left transition ${
                      selected
                        ? 'border-slate-900 bg-slate-50 shadow-lg'
                        : 'border-slate-200 bg-white hover:border-slate-400'
                    }`}
                  >
                    <div className="h-24 w-full overflow-hidden rounded-xl bg-slate-100">
                      <img src={thumbSrc} alt={`${optionLabel} SaleDay`} className="h-full w-full object-cover" />
                    </div>
                    <div className="mt-2 space-y-0.5">
                      <p className="text-xs font-semibold text-slate-900">{optionLabel}</p>
                      {meta?.badge && (
                        <p className="text-[9px] uppercase tracking-[0.3em] text-slate-500">{optionBadge}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedStyleMeta && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 shadow-inner">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    {catalogTranslator(selectedStyleMeta.badge, selectedStyleMeta.badge)}
                  </p>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: selectedStyleMeta.accent }}
                  />
                </div>
                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  {catalogTranslator(selectedStyleMeta.title, selectedStyleMeta.title)}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {catalogTranslator(selectedStyleMeta.description, selectedStyleMeta.description)}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  {selectedStyleMeta.bullets?.map((item) => (
                    <li key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1">
                      {catalogTranslator(item, item)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isCatalogReady && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                {selectedProductsForCatalog.slice(0, 5).map((product) => (
                  <span
                    key={product.id}
                    className="max-w-[12rem] truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 shadow-sm"
                  >
                    {product.title}
                  </span>
                ))}
                {selectedProductsForCatalog.length > 5 && (
                  <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    +{selectedProductsForCatalog.length - 5} outros
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Meus produtos</p>
                <p className="text-sm font-semibold text-slate-900">
                  {products.length} publicação{products.length === 1 ? '' : 's'} ativa{products.length === 1 ? '' : 's'}
                </p>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Carregando produtos...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-slate-500">
                Você ainda não publicou produtos. Crie um anúncio para aparecer no catálogo.
              </p>
            ) : (
              <SellerProductGrid
                products={products}
                isSelf
                catalogSelection={catalogSelection}
                renderSelfAction={renderCatalogAction}
                registerClick={registerClick}
                linkState={{ fromSellerProfile: true, sellerId: user.id }}
                layout="strip"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

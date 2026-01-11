// frontend/src/pages/EditProduct.jsx
// Página para edição completa de um anúncio existente.
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { toast } from 'react-hot-toast';
import { PRODUCT_CATEGORIES } from '../data/productCategories.js';
import { getCategoryDetailFields } from '../utils/categoryFields.js';
import { resolveCurrencyFromCountry } from '../utils/currency.js';
import LinkListEditor from '../components/LinkListEditor.jsx';
import { buildLinkPayloadEntries, mapStoredLinksToForm } from '../utils/links.js';
import { getProductPriceLabel, normalizeProductYear, sanitizeProductYearInput } from '../utils/product.js';
import { parsePriceFlexible, sanitizePriceInput } from '../utils/priceInput.js';
import { FREE_HELP_LINES, FREE_HELP_TITLE } from '../constants/freeModeHelp.js';
import { buildProductImageEntries, parseImageList } from '../utils/images.js';
import CloseBackButton from '../components/CloseBackButton.jsx';
import {
  IMAGE_KIND,
  IMAGE_KIND_BADGE_LABEL,
  IMAGE_KIND_HELP_TEXT,
  IMAGE_KIND_LABELS,
  IMAGE_KIND_PROMPT,
  IMAGE_KIND_REQUIRED_MESSAGE
} from '../utils/imageKinds.js';

const MAX_PRODUCT_PHOTOS = 10;
const MAX_FLOORPLAN_FILES = 4;
const FLOORPLAN_ACCEPT = 'image/*,application/pdf';

const initialFormState = {
  title: '',
  description: '',
  price: '',
  category: '',
  city: '',
  country: '',
  state: '',
  neighborhood: '',
  street: '',
  zip: '',
  lat: '',
  lng: '',
  brand: '',
  model: '',
  color: '',
  year: '',
  propertyType: '',
  area: '',
  bedrooms: '',
  bathrooms: '',
  parking: '',
  rentType: '',
  serviceType: '',
  serviceDuration: '',
  serviceRate: '',
  serviceLocation: '',
  jobTitle: '',
  jobType: '',
  jobSalary: '',
  jobRequirements: '',
  links: [],
  isFree: false,
  pickupOnly: false
};

const normalizeFieldValue = (value) =>
  value === undefined || value === null ? '' : String(value);

const normalizeCategoryLabel = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default function EditProduct() {
  const { id } = useParams();
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const routeRefreshSignal = useRef(0);

  const goToMyProducts = () => {
    routeRefreshSignal.current = Date.now();
    navigate('/my-products', { state: { refreshId: routeRefreshSignal.current } });
  };
  const [form, setForm] = useState(initialFormState);
  const currencyCode = useMemo(() => resolveCurrencyFromCountry(form.country), [form.country]);
  const [existingImages, setExistingImages] = useState([]);
  const [existingImageKinds, setExistingImageKinds] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [existingFloorplans, setExistingFloorplans] = useState([]);
  const [newFloorplans, setNewFloorplans] = useState([]);
  const previewsRef = useRef(new Set());
  const floorplanPreviewsRef = useRef(new Set());
  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [freeHelpVisible, setFreeHelpVisible] = useState(false);
  const freeHelpRef = useRef(null);
  const [activeImageKindId, setActiveImageKindId] = useState(null);
  const isFloorplanCategory = useMemo(() => {
    const normalized = normalizeCategoryLabel(form.category);
    return normalized.includes('moveis') || normalized.includes('imovel');
  }, [form.category]);

  const totalImages = existingImages.length + newImages.length;
  const totalFloorplans = existingFloorplans.length + newFloorplans.length;
  const showFloorplanSection = isFloorplanCategory || totalFloorplans > 0;
  const isActionLoading = isSubmitting || isDeleting;
  const overlayLabel = isSubmitting ? 'Salvando produto' : 'Excluindo produto';

  const cleanupPreviews = () => {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current.clear();
    floorplanPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    floorplanPreviewsRef.current.clear();
  };

  const resetUploads = () => {
    cleanupPreviews();
    setNewImages([]);
    setNewFloorplans([]);
  };

  useEffect(() => {
    return () => {
      cleanupPreviews();
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
    api
      .get(`/products/${id}`, config)
      .then((res) => {
        if (!active) return;
        const data = res.data?.data;
        if (!data) {
          toast.error('Produto não encontrado.');
          return;
        }
        if (data.hidden_by_seller) {
          toast.info('Este produto já foi removido e não pode ser editado.');
          goToMyProducts();
          return;
        }
        const imageEntries = buildProductImageEntries(data);
        const images = imageEntries.map((entry) => entry.url);
        const kinds = imageEntries.map((entry) => entry.kind ?? null);
        const floorplans = parseImageList(data.floorplan_urls ?? data.floorplanUrls);
        const isFree = Boolean(data.is_free);
        setExistingImages(images);
        setExistingImageKinds(kinds.length ? kinds : images.map(() => null));
        setExistingFloorplans(floorplans);
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          price: data.price !== null && data.price !== undefined ? String(data.price) : '',
          category: data.category ?? '',
          city: data.city ?? '',
          country: data.country ?? '',
          state: data.state ?? '',
          neighborhood: data.neighborhood ?? '',
          street: data.street ?? '',
          zip: data.zip ?? '',
          lat: data.lat !== undefined && data.lat !== null ? String(data.lat) : '',
          lng: data.lng !== undefined && data.lng !== null ? String(data.lng) : '',
          brand: data.brand ?? '',
          model: data.model ?? '',
          color: data.color ?? '',
          year: data.year !== undefined && data.year !== null ? String(data.year) : '',
          propertyType: normalizeFieldValue(data.propertyType ?? data.property_type),
          area: normalizeFieldValue(data.area ?? data.surface_area),
          bedrooms: normalizeFieldValue(data.bedrooms),
          bathrooms: normalizeFieldValue(data.bathrooms),
          parking: normalizeFieldValue(data.parking),
          rentType: normalizeFieldValue(data.rentType ?? data.rent_type),
          serviceType: normalizeFieldValue(data.serviceType ?? data.service_type),
          serviceDuration: normalizeFieldValue(data.serviceDuration ?? data.service_duration),
          serviceRate: normalizeFieldValue(data.serviceRate ?? data.service_rate),
          serviceLocation: normalizeFieldValue(data.serviceLocation ?? data.service_location),
          jobTitle: normalizeFieldValue(data.jobTitle ?? data.job_title),
          jobType: normalizeFieldValue(data.jobType ?? data.job_type),
          jobSalary: normalizeFieldValue(data.jobSalary ?? data.job_salary),
          jobRequirements: normalizeFieldValue(data.jobRequirements ?? data.job_requirements),
          links: mapStoredLinksToForm(data.links),
          isFree,
          pickupOnly: isFree ? true : Boolean(data.pickup_only)
        });
      })
      .catch(() => toast.error('Erro ao carregar produto.'))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, token]);

  const isValid = useMemo(() => Boolean(form.title?.trim()), [form.title]);

  const pricePreview = useMemo(() => {
    if (form.isFree) return 'Grátis';
    if (!form.price?.trim()) return 'Valor a negociar';
    const parsed = parsePriceFlexible(form.price);
    if (!Number.isFinite(parsed)) return 'Valor a negociar';
    return getProductPriceLabel(
      { price: parsed, country: form.country },
      'Valor a negociar'
    );
  }, [form.price, form.country, form.isFree]);

  const categoryDetailFields = useMemo(
    () => getCategoryDetailFields(form.category),
    [form.category]
  );

  const pendingImage = useMemo(
    () => newImages.find((image) => !image.kind),
    [newImages]
  );
  const activeImage = useMemo(
    () => newImages.find((image) => image.id === activeImageKindId) ?? null,
    [newImages, activeImageKindId]
  );

  useEffect(() => {
    if (!pendingImage) {
      setActiveImageKindId(null);
      return;
    }
    setActiveImageKindId((current) => (current === pendingImage.id ? current : pendingImage.id));
  }, [pendingImage]);

  const setImageKind = (id, kind) => {
    setNewImages((prev) =>
      prev.map((image) => (image.id === id ? { ...image, kind } : image))
    );
  };

  useEffect(() => {
    setForm((prev) => {
      if (!prev.isFree) return prev;
      if (prev.price === '' && prev.pickupOnly) return prev;
      return { ...prev, price: '', pickupOnly: true };
    });
  }, [form.isFree]);

  useEffect(() => {
    if (form.isFree) return;
    setForm((prev) => {
      const normalized = sanitizePriceInput(prev.price, currencyCode);
      if (normalized === prev.price) return prev;
      return { ...prev, price: normalized };
    });
  }, [currencyCode, form.isFree]);

  useEffect(() => {
    if (!form.isFree) {
      setFreeHelpVisible(false);
    }
  }, [form.isFree]);

  useEffect(() => {
    if (!freeHelpVisible || typeof document === 'undefined') return undefined;
    const handleClickOutside = (event) => {
      if (freeHelpRef.current?.contains(event.target)) return;
      setFreeHelpVisible(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [freeHelpVisible]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'year') {
      setForm((prev) => ({ ...prev, year: sanitizeProductYearInput(value) }));
      return;
    }
    if (name === 'price') {
      const normalized = sanitizePriceInput(value, currencyCode);
      setForm((prev) => ({ ...prev, price: normalized }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFreeToggle = (eventOrValue) => {
    const checked =
      typeof eventOrValue === 'boolean'
        ? eventOrValue
        : eventOrValue?.target?.checked ?? false;
    setForm((prev) => ({
      ...prev,
      isFree: checked,
      price: checked ? '' : prev.price,
      pickupOnly: checked ? true : prev.pickupOnly
    }));
  };

  const handlePickupToggle = (event) => {
    const { checked } = event.target;
    setForm((prev) => ({
      ...prev,
      pickupOnly: prev.isFree ? true : checked
    }));
  };

  const handleImageSelection = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) {
      toast.error('Selecione apenas arquivos de imagem.');
      return;
    }

    let addedCount = 0;
    let hitLimit = false;

    setNewImages((prev) => {
      const available = MAX_PRODUCT_PHOTOS - existingImages.length - prev.length;
      if (available <= 0) {
        hitLimit = true;
        return prev;
      }

      const limited = imageFiles.slice(0, available);
      addedCount = limited.length;

      const mapped = limited.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewsRef.current.add(previewUrl);
        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          preview: previewUrl,
          kind: null
        };
      });

      return [...prev, ...mapped];
    });

    if (hitLimit) {
      toast.error('Você já atingiu o limite de 10 fotos.');
      return;
    }

    if (addedCount < imageFiles.length) {
      toast.error('Algumas imagens não foram adicionadas por exceder o limite de 10.');
    }
  };

  const removeExistingImage = (url) => {
    setExistingImages((prev) => {
      const index = prev.indexOf(url);
      if (index === -1) return prev;
      setExistingImageKinds((kinds) => kinds.filter((_, idx) => idx !== index));
      return prev.filter((imageUrl) => imageUrl !== url);
    });
  };

  const removeNewImage = (id) => {
    setNewImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
        previewsRef.current.delete(target.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleFloorplanSelection = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const validFiles = files.filter(
      (file) => file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    if (!validFiles.length) {
      toast.error('Envie imagens ou PDF para a planta do ambiente.');
      return;
    }

    let hitLimit = false;

    setNewFloorplans((prev) => {
      const available = MAX_FLOORPLAN_FILES - existingFloorplans.length - prev.length;
      if (available <= 0) {
        hitLimit = true;
        return prev;
      }
      const limited = validFiles.slice(0, available);
      const mapped = limited.map((file) => {
        const isImage = file.type.startsWith('image/');
        const previewUrl = isImage ? URL.createObjectURL(file) : '';
        if (previewUrl) floorplanPreviewsRef.current.add(previewUrl);
        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          preview: previewUrl,
          isImage,
          name: file.name
        };
      });
      return [...prev, ...mapped];
    });

    if (hitLimit) {
      toast.error('Você já atingiu o limite de 4 plantas.');
    }
  };

  const removeExistingFloorplan = (url) => {
    setExistingFloorplans((prev) => prev.filter((item) => item !== url));
  };

  const removeNewFloorplan = (id) => {
    setNewFloorplans((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
        floorplanPreviewsRef.current.delete(target.preview);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const buildPayload = () => {
    const latNum = form.lat === '' ? null : Number(form.lat);
    const lngNum = form.lng === '' ? null : Number(form.lng);
    const lat = Number.isFinite(latNum) ? latNum : null;
    const lng = Number.isFinite(lngNum) ? lngNum : null;
    const normalizedYear = normalizeProductYear(form.year);

    const payload = {
      title: form.title?.trim() || '',
      description: form.description?.trim() || null,
      category: form.category || null,
      city: form.city?.trim() || null,
      country: form.country || null,
      state: form.state || null,
      neighborhood: form.neighborhood?.trim() || null,
      street: form.street?.trim() || null,
      zip: form.zip?.trim() || null,
      lat: lat !== null ? String(lat) : null,
      lng: lng !== null ? String(lng) : null,
      brand: form.brand?.trim() || null,
      model: form.model?.trim() || null,
      color: form.color?.trim() || null,
      year: normalizedYear,
      propertyType: form.propertyType?.trim() || null,
      area: form.area?.trim() || null,
      bedrooms: form.bedrooms?.trim() || null,
      bathrooms: form.bathrooms?.trim() || null,
      parking: form.parking?.trim() || null,
      rentType: form.rentType?.trim() || null,
      serviceType: form.serviceType?.trim() || null,
      serviceDuration: form.serviceDuration?.trim() || null,
      serviceRate: form.serviceRate?.trim() || null,
      serviceLocation: form.serviceLocation?.trim() || null,
      jobTitle: form.jobTitle?.trim() || null,
      jobType: form.jobType?.trim() || null,
      jobSalary: form.jobSalary?.trim() || null,
      jobRequirements: form.jobRequirements?.trim() || null,
      is_free: form.isFree ? 'true' : 'false',
      pickup_only: form.pickupOnly ? 'true' : 'false'
    };

    if (!form.isFree) {
      const parsedPrice = parsePriceFlexible(form.price);
      if (Number.isFinite(parsedPrice)) {
        payload.price = Number(parsedPrice).toFixed(2);
      }
    }

    const normalizedLinks = buildLinkPayloadEntries(form.links);
    payload.links = JSON.stringify(normalizedLinks);

    return payload;
  };

  async function handleDetectLocation() {
    if (!navigator.geolocation) {
      toast.error('Seu navegador não suporta GPS.');
      return;
    }
    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const { data } = await api.get(`/geo/reverse?lat=${latitude}&lng=${longitude}`);
          if (data.success) {
            const addr = data.data;
            setForm((prev) => ({
              ...prev,
              country: addr.country,
              state: addr.state,
              city: addr.city,
              neighborhood: addr.neighborhood,
              street: addr.street,
              zip: addr.zip,
              lat: latitude,
              lng: longitude
            }));
            toast.success('Localização atualizada.');
          } else {
            toast.error('Falha ao detectar endereço.');
          }
        } catch {
          toast.error('Erro ao consultar localização.');
        } finally {
          setLoadingLocation(false);
        }
      },
      () => {
        toast.error('Não foi possível acessar o GPS.');
        setLoadingLocation(false);
      }
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid) {
      toast.error('Informe um título para atualizar o produto.');
      return;
    }
    if (newImages.some((image) => !image.kind)) {
      toast.error(IMAGE_KIND_REQUIRED_MESSAGE);
      return;
    }
    const normalizedYear = normalizeProductYear(form.year);
    if (form.year?.trim() && !normalizedYear) {
      toast.error('Ano inválido. Use 4 dígitos entre 1900 e o ano atual.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        if (typeof value === 'string') {
          if (!['is_free', 'pickup_only', 'country', 'state'].includes(key) && value.trim() === '') return;
          formData.append(key, value);
          return;
        }
        formData.append(key, String(value));
      });
      formData.append('existing_images', JSON.stringify(existingImages));
      formData.append('existing_image_kinds', JSON.stringify(existingImageKinds));
      formData.append('existing_floorplans', JSON.stringify(existingFloorplans));
      newImages.forEach((image) => {
        formData.append('images', image.file);
      });
      newFloorplans.forEach((item) => {
        formData.append('floorplan_files', item.file);
      });
      formData.append(
        'new_image_kinds',
        JSON.stringify(newImages.map((image) => image.kind))
      );

      await api.put(`/products/${id}`, formData);
      toast.success('Produto atualizado.');
      resetUploads();
      goToMyProducts();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar produto.');
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm('Deseja realmente excluir este produto?');
    if (!confirmDelete) return;

    setIsDeleting(true);

    try {
      await api.delete(`/products/${id}`);
      toast.success('Produto ocultado da sua lista de anúncios.');
      resetUploads();
      goToMyProducts();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir produto.');
    } finally {
      if (isMountedRef.current) {
        setIsDeleting(false);
      }
    }
  };

  if (loading) return <div className="page-loading">Carregando produto...</div>;

  return (
    <div className="edit-product-page">
      {isActionLoading && (
        <div
          className="edit-product-page__overlay"
          role="status"
          aria-live="polite"
          aria-label={overlayLabel}
          aria-hidden={false}
        >
          <span className="edit-product-page__spinner" aria-hidden="true" />
          <span className="sr-only">{overlayLabel}</span>
        </div>
      )}
      <CloseBackButton />
      <h2>Editar Produto</h2>
      <form onSubmit={handleSubmit} className="edit-product-form space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
          <div className="flex w-full flex-col gap-2" ref={freeHelpRef}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleFreeToggle(!form.isFree)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:ring focus-visible:ring-emerald-300 ${
                  form.isFree
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-emerald-200 text-emerald-700'
                }`}
                aria-pressed={form.isFree}
              >
                Zona Free
              </button>
              <button
                type="button"
                onClick={() => setFreeHelpVisible((prev) => !prev)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 text-emerald-700"
                aria-label={FREE_HELP_TITLE}
                aria-expanded={freeHelpVisible}
              >
                ?
              </button>
              <span className="text-xs font-semibold text-emerald-700">{form.isFree ? 'Ativado' : 'Desativado'}</span>
            </div>
            {freeHelpVisible && (
              <div className="mt-1 w-full max-w-sm rounded-xl border border-emerald-200 bg-white p-3 text-xs text-emerald-800 shadow-lg">
                <p className="font-semibold text-emerald-900">{FREE_HELP_TITLE}</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-emerald-700">
                  {FREE_HELP_LINES.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-emerald-700">
              Ative para destacar o anúncio como gratuito. O preço não será exibido e o produto ficará disponível apenas para retirada.
            </p>
            <label className="flex items-center gap-2 text-xs text-emerald-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600"
                checked={form.pickupOnly}
                onChange={handlePickupToggle}
                disabled={form.isFree}
              />
              Apenas retirada em mãos {form.isFree ? '(obrigatório no modo grátis)' : ''}
            </label>
          </div>
        </div>

        <input name="title" value={form.title} onChange={handleChange} placeholder="Título" required />

        <div className="flex flex-col gap-1">
          <input
            name="price"
            value={form.price}
            onChange={handleChange}
            placeholder="Valor a negociar"
            type="text"
            inputMode="decimal"
            disabled={form.isFree}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
          />
          <span className="text-xs text-gray-500">
            {form.isFree
              ? 'Este anúncio será exibido como “Grátis”.'
              : form.price?.trim()
                ? `Será exibido como: ${pricePreview}`
                : 'Deixe em branco para mostrar “Valor a negociar”.'}
          </span>
        </div>

        <label className="flex flex-col text-sm">
          <span className="text-[11px] text-gray-500 mb-1">Categoria</span>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-300"
          >
            <option value="">Selecione uma categoria</option>
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        {categoryDetailFields.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {categoryDetailFields.map((field) => (
              <label key={field.name} className="flex flex-col text-sm">
                <span className="text-[11px] text-gray-500 mb-1">{field.label}</span>
                <input
                  name={field.name}
                  value={form[field.name] ?? ''}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  inputMode={field.inputMode}
                />
              </label>
            ))}
          </div>
        )}
        <input name="city" value={form.city} onChange={handleChange} placeholder="Cidade" />

        <div className="flex items-center justify-between w-full" translate="no">
          <span className="text-sm text-gray-600">Atualizar endereço automaticamente:</span>
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={loadingLocation}
            className="bg-blue-600 text-white px-3 py-1 rounded"
          >
            {loadingLocation ? 'Detectando...' : 'Usar minha localização'}
          </button>
        </div>

        <input name="country" value={form.country} onChange={handleChange} placeholder="País" />
        <input name="state" value={form.state} onChange={handleChange} placeholder="Estado" />
        <input name="neighborhood" value={form.neighborhood} onChange={handleChange} placeholder="Bairro" />
        <input name="street" value={form.street} onChange={handleChange} placeholder="Rua" />
        <input name="zip" value={form.zip} onChange={handleChange} placeholder="CEP" />

        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Descrição"
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Fotos do anúncio</span>
            <span className="text-xs text-gray-500">{totalImages}/{MAX_PRODUCT_PHOTOS}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {existingImages.map((url) => (
              <div key={`existing-${url}`} className="relative group aspect-square rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <img src={url} alt="Imagem atual do produto" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                  atual
                </span>
                <button
                  type="button"
                  onClick={() => removeExistingImage(url)}
                  className="absolute top-1 right-1 rounded-full bg-black/70 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition"
                >
                  remover
                </button>
              </div>
            ))}
            {newImages.map((image) => (
              <div key={image.id} className="relative group aspect-square rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <img src={image.preview} alt="Nova imagem selecionada" className="h-full w-full object-cover" />
                {image.kind === IMAGE_KIND.ILLUSTRATIVE && (
                  <span className="absolute left-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
                    {IMAGE_KIND_BADGE_LABEL}
                  </span>
                )}
                <span className="absolute bottom-1 left-1 rounded bg-emerald-600/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                  nova
                </span>
                <button
                  type="button"
                  onClick={() => removeNewImage(image.id)}
                  className="absolute top-1 right-1 rounded-full bg-black/70 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition"
                >
                  remover
                </button>
              </div>
            ))}
            {totalImages < MAX_PRODUCT_PHOTOS && (
              <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 cursor-pointer hover:border-emerald-400 hover:text-emerald-600 transition bg-gray-50">
                <span>Adicionar fotos</span>
                <span className="mt-1 text-[10px] text-gray-400">Máx. {MAX_PRODUCT_PHOTOS}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelection}
                />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Prefira imagens nítidas, com boa iluminação. Você pode manter as fotos atuais, remover alguma ou enviar novas (até {MAX_PRODUCT_PHOTOS} arquivos de 5MB).
          </p>
          <p className="text-xs text-gray-500">{IMAGE_KIND_HELP_TEXT}</p>
        </div>

        {showFloorplanSection && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Planta do ambiente</span>
              <span className="text-xs text-gray-500">
                {totalFloorplans}/{MAX_FLOORPLAN_FILES}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {existingFloorplans.map((url) => (
                <div key={`floorplan-${url}`} className="relative group aspect-square rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  {url.match(/\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i) ? (
                    <img src={url} alt="Planta atual" className="h-full w-full object-cover" />
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-full w-full flex items-center justify-center bg-slate-100 text-xs text-slate-600 px-2 text-center"
                    >
                      Arquivo
                    </a>
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                    atual
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExistingFloorplan(url)}
                    className="absolute top-1 right-1 rounded-full bg-black/70 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    remover
                  </button>
                </div>
              ))}
              {newFloorplans.map((item) => (
                <div key={item.id} className="relative group aspect-square rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  {item.isImage ? (
                    <img src={item.preview} alt="Nova planta selecionada" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-slate-100 text-xs text-slate-600 px-2 text-center">
                      {item.name || 'Arquivo'}
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-emerald-600/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                    nova
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNewFloorplan(item.id)}
                    className="absolute top-1 right-1 rounded-full bg-black/70 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    remover
                  </button>
                </div>
              ))}
              {totalFloorplans < MAX_FLOORPLAN_FILES && (
                <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 cursor-pointer hover:border-emerald-400 hover:text-emerald-600 transition bg-gray-50">
                  <span>Adicionar planta</span>
                  <span className="mt-1 text-[10px] text-gray-400">Máx. {MAX_FLOORPLAN_FILES}</span>
                  <input
                    type="file"
                    accept={FLOORPLAN_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={handleFloorplanSelection}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Você pode manter as plantas atuais, remover alguma ou enviar novas (até {MAX_FLOORPLAN_FILES} arquivos).
            </p>
          </div>
        )}

        <LinkListEditor
          links={form.links}
          onChange={(links) => setForm((prev) => ({ ...prev, links }))}
        />

        <p className="text-xs text-gray-500">
          Coordenadas: {form.lat && form.lng ? `${form.lat}, ${form.lng}` : 'não definidas'}
        </p>

        <div className="edit-product-actions">
          <button type="submit" disabled={!isValid || isActionLoading}>
            Salvar
          </button>
          <button type="button" className="danger" onClick={handleDelete} disabled={isActionLoading}>
            Excluir
          </button>
          {isActionLoading && (
            <div
              className="edit-product-actions__loader"
              role="status"
              aria-live="polite"
              aria-label={isSubmitting ? 'Salvando produto' : 'Excluindo produto'}
            >
              <span className="edit-product-actions__spinner" aria-hidden="true" />
              <span className="sr-only">{isSubmitting ? 'Salvando produto' : 'Excluindo produto'}</span>
            </div>
          )}
        </div>
      </form>
      {activeImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <p className="text-sm font-semibold text-gray-800">{IMAGE_KIND_PROMPT}</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-xl border border-gray-200">
                <img
                  src={activeImage.preview}
                  alt="Pré-visualização da foto"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setImageKind(activeImage.id, IMAGE_KIND.REAL)}
                  className="w-full rounded-lg border border-emerald-200 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                >
                  {IMAGE_KIND_LABELS[IMAGE_KIND.REAL]}
                </button>
                <button
                  type="button"
                  onClick={() => setImageKind(activeImage.id, IMAGE_KIND.ILLUSTRATIVE)}
                  className="w-full rounded-lg border border-amber-200 bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-400"
                >
                  {IMAGE_KIND_LABELS[IMAGE_KIND.ILLUSTRATIVE]}
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-gray-500">
              {IMAGE_KIND_HELP_TEXT}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

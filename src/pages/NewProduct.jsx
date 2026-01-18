// frontend/src/pages/NewProduct.jsx
// Página de cadastro de um novo produto.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { toast } from 'react-hot-toast';
import { formatProductPrice, getCurrencySettings, resolveCurrencyFromCountry } from '../utils/currency.js';
import { COUNTRY_OPTIONS, normalizeCountryCode } from '../data/countries.js';
import { PRODUCT_CATEGORIES } from '../data/productCategories.js';
import { getCategoryDetailFields } from '../utils/categoryFields.js';
import { normalizeProductYear, sanitizeProductYearInput } from '../utils/product.js';
import LinkListEditor from '../components/LinkListEditor.jsx';
import CloseBackButton from '../components/CloseBackButton.jsx';
import LoadingBar from '../components/LoadingBar.jsx';
import { buildLinkPayloadEntries } from '../utils/links.js';
import { parsePriceFlexible, sanitizePriceInput } from '../utils/priceInput.js';
import { FREE_HELP_LINES, FREE_HELP_TITLE } from '../constants/freeModeHelp.js';
import {
  IMAGE_KIND,
  IMAGE_KIND_BADGE_LABEL,
  IMAGE_KIND_HELP_TEXT,
  IMAGE_KIND_LABELS,
  IMAGE_KIND_PROMPT,
  IMAGE_KIND_REQUIRED_MESSAGE
} from '../utils/imageKinds.js';

// bounds simples por país
const BOUNDS = {
  BR: { lat: [-34, 5], lng: [-74, -34] },
  US: { lat: [18, 72], lng: [-170, -66] },
  IT: { lat: [35, 47], lng: [6, 19] }
};

const MAX_PRODUCT_PHOTOS = 10;
const MAX_FLOORPLAN_FILES = 4;
const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2048;
const MIN_COMPRESS_QUALITY = 0.6;
const FIELD_BASE_CLASS =
  'w-full rounded-lg border border-[rgba(200,178,106,0.28)] bg-white px-3 py-2 text-[var(--ts-text)] shadow-sm placeholder:text-[var(--ts-muted)] focus:border-[var(--ts-cta)] focus:ring-2 focus:ring-[rgba(31,143,95,0.25)] transition';
const FIELD_LABEL_CLASS = 'block text-sm font-semibold text-[var(--ts-text)] mt-3';
const WATERMARK_TEXT = 'templesale.com';
const WATERMARK_TEXT_COLOR = '#0c0c0c';
const FLOORPLAN_ACCEPT = 'image/*,application/pdf';

const buildSafeImageFilename = (name, extension) => {
  const base = typeof name === 'string' && name.trim() ? name.trim() : 'imagem';
  const stripped = base.replace(/\.[^.]+$/, '');
  return `${stripped}${extension}`;
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((output) => resolve(output), type, quality);
  });

async function createWatermarkedFile(file) {
  // Keep mobile uploads under backend limits by downscaling/compressing when needed.
  if (!file || typeof document === 'undefined') return file;
  if (typeof createImageBitmap !== 'function') return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const maxSide = Math.max(bitmap.width, bitmap.height);
  const scale = maxSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / maxSide : 1;
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const minSide = Math.min(canvas.width, canvas.height);
  const padding = Math.max(10, Math.round(minSide * 0.03));
  const fontSize = Math.max(20, Math.round(minSide * 0.045));
  ctx.font = `600 ${fontSize}px 'Inter', 'Helvetica Neue', sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  const textMetrics = ctx.measureText(WATERMARK_TEXT);
  const x = Math.max(padding, Math.round(canvas.width / 2));
  const y = canvas.height * 0.38;
  ctx.fillStyle = '#111';
  ctx.globalAlpha = 0.18;
  ctx.fillText(WATERMARK_TEXT, x, y);

  ctx.globalAlpha = 1;
  const preferredType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  let outputType = preferredType;
  let quality = 0.9;
  let blob = await canvasToBlob(canvas, outputType, quality);
  if (!blob) return file;

  let workingCanvas = canvas;
  if (blob.size > MAX_IMAGE_UPLOAD_BYTES) {
    outputType = 'image/jpeg';
    quality = 0.85;
    blob = await canvasToBlob(workingCanvas, outputType, quality);
  }

  let attempts = 0;
  while (blob && blob.size > MAX_IMAGE_UPLOAD_BYTES && attempts < 5) {
    if (quality > MIN_COMPRESS_QUALITY) {
      quality = Math.max(MIN_COMPRESS_QUALITY, Number((quality - 0.1).toFixed(2)));
      blob = await canvasToBlob(workingCanvas, outputType, quality);
      if (blob && blob.size <= MAX_IMAGE_UPLOAD_BYTES) break;
    }

    const downscale = 0.85;
    const nextCanvas = document.createElement('canvas');
    nextCanvas.width = Math.max(1, Math.round(workingCanvas.width * downscale));
    nextCanvas.height = Math.max(1, Math.round(workingCanvas.height * downscale));
    const nextCtx = nextCanvas.getContext('2d');
    nextCtx.drawImage(workingCanvas, 0, 0, nextCanvas.width, nextCanvas.height);
    workingCanvas = nextCanvas;
    blob = await canvasToBlob(workingCanvas, outputType, quality);
    attempts += 1;
  }

  const finalType = blob.type || outputType || file.type || 'image/jpeg';
  const finalExtension = finalType === 'image/png' ? '.png' : '.jpg';
  const finalName = buildSafeImageFilename(file.name, finalExtension);
  return new File([blob], finalName, { type: finalType });
}

const PUBLISH_STAGE_META = {
  uploading: {
    title: 'Carregando imagens...',
    detail: 'Enviando arquivos e metadados...'
  },
  processing: {
    title: 'Processando o anúncio...',
    detail: 'Processando o anúncio...'
  }
};

const PROGRESS_DETAIL_STEPS = [
  { threshold: 0, message: 'Ajustando...' },
  { threshold: 10, message: 'Preparando as imagens...' },
  { threshold: 30, message: 'Preparando legendas...' },
  { threshold: 50, message: 'Quase tudo pronto...' },
  { threshold: 60, message: 'Finalizando...' },
  { threshold: 90, message: 'Publicando...' },
  { threshold: 95, message: 'Aguarde...' }
];

const PROCESSING_STEPS = [
  'Aguardando confirmação...',
  'Validando dados...',
  'Processando imagens...',
  'Atualizando o banco...',
  'Concluído.'
];

const UPLOAD_PHASE_WEIGHT = 0.7;
const SERVER_PHASE_WEIGHT = 1 - UPLOAD_PHASE_WEIGHT;
const TITLE_MAX_LENGTH = 30; // limite do titulo no cadastro

const inBounds = (code, lat, lng) => {
  const b = BOUNDS[code];
  if (!b || lat == null || lng == null) return true;
  return lat >= b.lat[0] && lat <= b.lat[1] && lng >= b.lng[0] && lng <= b.lng[1];
};

const initialFormState = {
  title: '',
  description: '',
  price: '',
  category: '',
  city: '',
  country: 'BR', // padrão BR
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
  pickupOnly: false,
  image_url: ''
};

const normalizeCategoryLabel = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();


// normaliza UF para duas letras quando possível
function normalizeState(uf, country) {
  if (!uf) return '';
  const s = String(uf).trim().toUpperCase();

  if (country === 'BR') {
    // aceita nome ou sigla e converte para sigla
    const mapBR = {
      'ACRE':'AC','AC':'AC','ALAGOAS':'AL','AL':'AL','AMAPA':'AP','AMAPÁ':'AP','AP':'AP',
      'AMAZONAS':'AM','AM':'AM','BAHIA':'BA','BA':'BA','CEARA':'CE','CEARÁ':'CE','CE':'CE',
      'DISTRITO FEDERAL':'DF','DF':'DF','ESPIRITO SANTO':'ES','ESPÍRITO SANTO':'ES','ES':'ES',
      'GOIAS':'GO','GOIÁS':'GO','GO':'GO','MARANHAO':'MA','MARANHÃO':'MA','MA':'MA',
      'MATO GROSSO':'MT','MT':'MT','MATO GROSSO DO SUL':'MS','MS':'MS',
      'MINAS GERAIS':'MG','MG':'MG','PARA':'PA','PARÁ':'PA','PA':'PA',
      'PARAIBA':'PB','PARAÍBA':'PB','PB':'PB','PARANA':'PR','PARANÁ':'PR','PR':'PR',
      'PERNAMBUCO':'PE','PE':'PE','PIAUI':'PI','PIAUÍ':'PI','PI':'PI',
      'RIO DE JANEIRO':'RJ','RJ':'RJ','RIO GRANDE DO NORTE':'RN','RN':'RN',
      'RIO GRANDE DO SUL':'RS','RS':'RS','RONDONIA':'RO','RONDÔNIA':'RO','RO':'RO',
      'RORAIMA':'RR','RR':'RR','SANTA CATARINA':'SC','SC':'SC','SAO PAULO':'SP','SÃO PAULO':'SP','SP':'SP',
      'SERGIPE':'SE','SE':'SE','TOCANTINS':'TO','TO':'TO'
    };
    return mapBR[s] || s.slice(0, 2); // fallback
  }

  if (country === 'US') {
    // normaliza para 2 letras US
    const mapUS = {
      'ALABAMA':'AL','AL':'AL','ALASKA':'AK','AK':'AK','ARIZONA':'AZ','AZ':'AZ','ARKANSAS':'AR','AR':'AR',
      'CALIFORNIA':'CA','CA':'CA','COLORADO':'CO','CO':'CO','CONNECTICUT':'CT','CT':'CT',
      'DELAWARE':'DE','DE':'DE','FLORIDA':'FL','FL':'FL','GEORGIA':'GA','GA':'GA',
      'HAWAII':'HI','HI':'HI','IDAHO':'ID','ID':'ID','ILLINOIS':'IL','IL':'IL','INDIANA':'IN','IN':'IN',
      'IOWA':'IA','IA':'IA','KANSAS':'KS','KS':'KS','KENTUCKY':'KY','KY':'KY',
      'LOUISIANA':'LA','LA':'LA','MAINE':'ME','ME':'ME','MARYLAND':'MD','MD':'MD',
      'MASSACHUSETTS':'MA','MA':'MA','MICHIGAN':'MI','MI':'MI','MINNESOTA':'MN','MN':'MN',
      'MISSISSIPPI':'MS','MS':'MS','MISSOURI':'MO','MO':'MO','MONTANA':'MT','MT':'MT',
      'NEBRASKA':'NE','NE':'NE','NEVADA':'NV','NV':'NV','NEW HAMPSHIRE':'NH','NH':'NH',
      'NEW JERSEY':'NJ','NJ':'NJ','NEW MEXICO':'NM','NM':'NM','NEW YORK':'NY','NY':'NY',
      'NORTH CAROLINA':'NC','NC':'NC','NORTH DAKOTA':'ND','ND':'ND','OHIO':'OH','OH':'OH',
      'OKLAHOMA':'OK','OK':'OK','OREGON':'OR','OR':'OR','PENNSYLVANIA':'PA','PA':'PA',
      'RHODE ISLAND':'RI','RI':'RI','SOUTH CAROLINA':'SC','SC':'SC','SOUTH DAKOTA':'SD','SD':'SD',
      'TENNESSEE':'TN','TN':'TN','TEXAS':'TX','TX':'TX','UTAH':'UT','UT':'UT',
      'VERMONT':'VT','VT':'VT','VIRGINIA':'VA','VA':'VA','WASHINGTON':'WA','WA':'WA',
      'WEST VIRGINIA':'WV','WV':'WV','WISCONSIN':'WI','WI':'WI','WYOMING':'WY','WY':'WY',
      'DISTRICT OF COLUMBIA':'DC','DC':'DC'
    };
    return mapUS[s] || s.slice(0, 2);
  }

  // IT ou outros: mantém como digitado, em maiúsculas curto
  return s.slice(0, 5);
}

// normaliza nome de cidade para capitalização adequada (ex: "ardea" -> "Ardea", "rio de janeiro" -> "Rio de Janeiro")
function normalizeCityName(value) {
  if (!value) return '';
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return '';

  const LOWER_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'di', 'del', 'della', 'e']);

  return trimmed
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return '';
      if (index > 0 && LOWER_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// ===== Util para limpar e limitar CEP/ZIP (antes do componente) =====
const cleanZip = (z, country) => {
  const digits = String(z || '').replace(/\D/g, '');
  return country === 'US' ? digits.slice(0, 9) : digits.slice(0, 8);
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ADDRESS_FIELDS = new Set(['city', 'state', 'neighborhood', 'street', 'zip']);

const FIELD_SCROLL_IDS = {
  title: 'new-product-field-title',
  price: 'new-product-field-price',
  category: 'new-product-field-category'
};

const NEW_PRODUCT_ADDRESS_STORAGE_KEY = 'newProductAddress';

const safeTrim = (value) => (typeof value === 'string' ? value.trim() : '');

function loadSavedNewProductAddress(defaultCountry) {
  const fallbackCountry = normalizeCountryCode(defaultCountry) || initialFormState.country;
  const fallback = {
    country: fallbackCountry,
    city: '',
    state: '',
    neighborhood: '',
    street: '',
    zip: ''
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const stored = window.localStorage.getItem(NEW_PRODUCT_ADDRESS_STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    const country = normalizeCountryCode(parsed?.country) || fallbackCountry;
    const state = normalizeState(parsed?.state, country);
    return {
      country,
      city: normalizeCityName(parsed?.city),
      state,
      neighborhood: safeTrim(parsed?.neighborhood),
      street: safeTrim(parsed?.street),
      zip: safeTrim(parsed?.zip)
    };
  } catch {
    return fallback;
  }
}

function persistNewProductAddress(payload, fallbackCountry) {
  const normalizedCountry = normalizeCountryCode(payload?.country) || fallbackCountry || initialFormState.country;
  const entry = {
    country: normalizedCountry,
    city: normalizeCityName(payload?.city),
    state: normalizeState(payload?.state, normalizedCountry),
    neighborhood: safeTrim(payload?.neighborhood),
    street: safeTrim(payload?.street),
    zip: safeTrim(payload?.zip)
  };

  if (typeof window === 'undefined') {
    return entry;
  }

  try {
    window.localStorage.setItem(NEW_PRODUCT_ADDRESS_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // no-op
  }

  return entry;
}

const localizeFieldTarget = (field) => {
  if (typeof document === 'undefined') return null;
  const dataTarget = document.querySelector(`[data-new-product-field="${field}"]`);
  if (dataTarget) return dataTarget;
  if (FIELD_SCROLL_IDS[field]) {
    const byId = document.getElementById(FIELD_SCROLL_IDS[field]);
    if (byId) return byId;
  }
  return document.querySelector(`[name="${field}"]`);
};

const highlightField = (element) => {
  if (!element || typeof element.classList === 'undefined') return;
  element.classList.add('ring-4', 'ring-yellow-400');
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    element.classList.remove('ring-4', 'ring-yellow-400');
  }, 1200);
};

const scrollToField = (field) => {
  if (!field || typeof document === 'undefined') return;
  requestAnimationFrame(() => {
    const target = localizeFieldTarget(field);
    if (!target) return;
    if (target.scrollIntoView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
    highlightField(target);
  });
};

export default function NewProduct() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const defaultCountry = useMemo(
    () => normalizeCountryCode(user?.country) || initialFormState.country,
    [user?.country]
  );
  const [savedAddress, setSavedAddress] = useState(() => loadSavedNewProductAddress(defaultCountry));
  useEffect(() => {
    if (!defaultCountry) return;
    setSavedAddress(loadSavedNewProductAddress(defaultCountry));
  }, [defaultCountry]);
  const baseForm = useMemo(() => ({ ...initialFormState, ...savedAddress }), [savedAddress]);
  const [form, setForm] = useState(baseForm);
  const [images, setImages] = useState([]);
  const [floorplanFiles, setFloorplanFiles] = useState([]);
  const [mainImageUploading, setMainImageUploading] = useState(false);
  const previewsRef = useRef(new Set());
  const floorplanPreviewsRef = useRef(new Set());
  const [sending, setSending] = useState(false);
  const [publishStage, setPublishStage] = useState('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [hasUploadProgress, setHasUploadProgress] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [serverProgress, setServerProgress] = useState(0);
  const [serverStep, setServerStep] = useState('');
  const [serverStatus, setServerStatus] = useState('idle');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [showMissingSummary, setShowMissingSummary] = useState(false);
  const [freeHelpVisible, setFreeHelpVisible] = useState(false);
  const freeHelpRef = useRef(null);
  const zipInputRef = useRef(null);
  const geocodeTimeoutRef = useRef(null);
  const geocodeInFlightRef = useRef(false);
  const lastGeoQueryRef = useRef('');
  const lastZipAutoFillRef = useRef({ zip: '', at: 0 });
  const autoZipTriggeredRef = useRef(false);
  const initialZipRef = useRef(baseForm.zip);
  const [activeImageKindId, setActiveImageKindId] = useState(null);
  const isFloorplanCategory = useMemo(() => {
    const normalized = normalizeCategoryLabel(form.category);
    return normalized.includes('moveis') || normalized.includes('imovel');
  }, [form.category]);
  const lastFloorplanCategoryRef = useRef(isFloorplanCategory);
  const suppressFloorplanToastRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  useEffect(() => {
    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setForm(baseForm);
    setShowFieldErrors(false);
    initialZipRef.current = baseForm.zip;
    autoZipTriggeredRef.current = false;
  }, [baseForm]);

  useEffect(() => {
    if (!form.isFree) {
      setFreeHelpVisible(false);
    }
  }, [form.isFree]);

  useEffect(() => {
    setShowMissingSummary(false);
  }, []);

  useEffect(() => {
    if (!freeHelpVisible) return undefined;
    const handleClickOutside = (event) => {
      if (freeHelpRef.current?.contains(event.target)) return;
      setFreeHelpVisible(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [freeHelpVisible]);

  const isValid = useMemo(
    () =>
      form.title?.trim() &&
      form.description?.trim() &&
      form.category?.trim() &&
      form.country?.trim() &&
      form.city?.trim() &&
      form.zip?.trim() &&
      true,
    [form.title, form.description, form.category, form.price, form.isFree, form.country, form.city, form.zip]
  );
  const currencyCode = useMemo(
    () => resolveCurrencyFromCountry(form.country),
    [form.country]
  );
  const currencyInfo = useMemo(
    () => getCurrencySettings(currencyCode),
    [currencyCode]
  );
  useEffect(() => {
    if (form.isFree) return;
    setForm((prev) => {
      if (prev.isFree || !prev.price) return prev;
      const normalized = sanitizePriceInput(prev.price, currencyCode);
      return normalized === prev.price ? prev : { ...prev, price: normalized };
    });
  }, [currencyCode, form.isFree]);

  const resetImagePreviews = useCallback(() => {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current.clear();
    setImages([]);
    floorplanPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    floorplanPreviewsRef.current.clear();
    setFloorplanFiles([]);
  }, []);

  const resetFloorplanPreviews = useCallback(() => {
    floorplanPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    floorplanPreviewsRef.current.clear();
    setFloorplanFiles([]);
  }, []);

  useEffect(() => () => {
    resetImagePreviews();
  }, [resetImagePreviews]);

  const resetPublishState = useCallback(() => {
    setPublishStage('idle');
    setUploadProgress(0);
    setHasUploadProgress(false);
    setJobId(null);
    setServerProgress(0);
    setServerStep('');
    setServerStatus('idle');
  }, []);

  const finalizePublishSuccess = useCallback(() => {
    toast.success('Produto publicado com sucesso!');
    suppressFloorplanToastRef.current = true;
    resetImagePreviews();
    resetPublishState();
    setForm(baseForm);
    setShowFieldErrors(false);
    setSending(false);
    navigate('/dashboard');
  }, [baseForm, navigate, resetImagePreviews, resetPublishState]);

  useEffect(() => {
    if (!jobId) return undefined;
    let active = true;
    let intervalId;

    const fetchStatus = async () => {
      try {
        const { data } = await api.get(`/products/publish-status/${jobId}`);
        if (!active) return;
        const payload = data?.data || {};
        const status = payload?.status || 'processing';
        setServerProgress(typeof payload?.percent === 'number' ? payload.percent : 0);
        setServerStep(payload?.step || 'Processando o anúncio...');
        setServerStatus(status);

        if (status === 'done') {
          if (intervalId) clearInterval(intervalId);
          finalizePublishSuccess();
          return;
        }

        if (status === 'error') {
          if (intervalId) clearInterval(intervalId);
          toast.error(payload?.error || 'Erro ao processar o anúncio.');
          setSending(false);
          resetPublishState();
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 900);
    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, finalizePublishSuccess, resetPublishState]);

  const isOverlayVisible = sending && publishStage !== 'idle';
  const uploadPhasePercent = Math.round(uploadProgress * UPLOAD_PHASE_WEIGHT);
  const serverPhasePercent = Math.round(serverProgress * SERVER_PHASE_WEIGHT);
  const totalProgress =
    publishStage === 'uploading'
      ? Math.min(100, uploadPhasePercent)
      : Math.min(100, 70 + serverPhasePercent);
  const stageMeta = PUBLISH_STAGE_META[publishStage] ?? PUBLISH_STAGE_META.processing;
  const stageTitle = stageMeta.title;
  const currentStageProgress = publishStage === 'uploading' ? uploadProgress : serverProgress;
  const progressDetailMessage =
    PROGRESS_DETAIL_STEPS.filter((step) => currentStageProgress >= step.threshold).slice(-1)[0]
      ?.message ?? PROGRESS_DETAIL_STEPS[0].message;
  const stageDetail =
    publishStage === 'processing'
      ? serverStep || progressDetailMessage
      : progressDetailMessage;
  const progressWidth = totalProgress;
  const normalizedProcessingStep = serverStep || PROCESSING_STEPS[0];
  const processingStepIndex = PROCESSING_STEPS.findIndex((step) => step === normalizedProcessingStep);
  const processingActiveIndex = processingStepIndex === -1 ? 0 : processingStepIndex;
  const pricePreview = useMemo(() => {
    if (form.isFree) return 'Grátis';
    if (!form.price?.trim()) return 'Valor a negociar';
    const parsed = parsePriceFlexible(form.price);
    if (parsed === '' || parsed === null) return null;
    return formatProductPrice(parsed, form.country, { respectPreference: false });
  }, [form.price, form.country, form.isFree]);
  const previewFallback = useMemo(() => {
    if (form.isFree) return 'Grátis';
    const parsedExample = parsePriceFlexible(currencyInfo.example);
    if (parsedExample === '') return `${currencyInfo.symbol} 0,00`;
    return formatProductPrice(parsedExample, form.country, { respectPreference: false });
  }, [currencyInfo.example, currencyInfo.symbol, form.country, form.isFree]);
  const titleLength = form.title?.length ?? 0;
  const titleRemaining = Math.max(0, TITLE_MAX_LENGTH - titleLength);

  const missingFields = useMemo(() => {
    const missing = [];
    if (!form.title?.trim()) missing.push({ name: 'title', label: 'Título' });
    if (!form.description?.trim()) missing.push({ name: 'description', label: 'Descrição' });
    if (!form.category?.trim()) missing.push({ name: 'category', label: 'Categoria' });
    if (!form.country?.trim()) missing.push({ name: 'country', label: 'País' });
    if (!form.city?.trim()) missing.push({ name: 'city', label: 'Cidade' });
    if (!form.zip?.trim()) missing.push({ name: 'zip', label: 'CEP/ZIP' });
    return missing;
  }, [form.title, form.description, form.category, form.price, form.isFree, form.country, form.city, form.zip]);

  const hasFieldError = (field) =>
    showFieldErrors && missingFields.some((item) => item.name === field);

  const pendingImage = useMemo(
    () => images.find((image) => !image.kind),
    [images]
  );
  const activeImage = useMemo(
    () => images.find((image) => image.id === activeImageKindId) ?? null,
    [images, activeImageKindId]
  );

  useEffect(() => {
    if (!pendingImage) {
      setActiveImageKindId(null);
      return;
    }
    setActiveImageKindId((current) => (current === pendingImage.id ? current : pendingImage.id));
  }, [pendingImage]);

  const setImageKind = useCallback((id, kind) => {
    setImages((prev) =>
      prev.map((image) => (image.id === id ? { ...image, kind } : image))
    );
  }, []);

  useEffect(() => {
    setForm((prev) => {
      if (!prev.isFree) return prev;
      if (prev.price === '' && prev.pickupOnly) return prev;
      return { ...prev, price: '', pickupOnly: true };
    });
  }, [form.isFree]);
  const categoryDetails = useMemo(() => getCategoryDetailFields(form.category), [form.category]);

  useEffect(() => {
    const wasEligible = lastFloorplanCategoryRef.current;
    if (suppressFloorplanToastRef.current) {
      if (floorplanFiles.length === 0) {
        suppressFloorplanToastRef.current = false;
      }
      lastFloorplanCategoryRef.current = isFloorplanCategory;
      return;
    }
    if (wasEligible && !isFloorplanCategory && floorplanFiles.length > 0) {
      resetFloorplanPreviews();
    }
    lastFloorplanCategoryRef.current = isFloorplanCategory;
  }, [floorplanFiles.length, isFloorplanCategory, resetFloorplanPreviews]);

  const prepareImagesForUpload = useCallback(async (entries) => {
    if (!entries?.length) return [];

    const processed = [];
    for (const entry of entries) {
      try {
        processed.push(await createWatermarkedFile(entry.file));
      } catch (err) {
        console.error('Erro ao aplicar marca d’água', err);
        processed.push(entry.file);
      }
    }
    return processed;
  }, []);

  const prepareFloorplansForUpload = useCallback(async (entries) => {
    if (!entries?.length) return [];
    const processed = [];
    for (const entry of entries) {
      if (entry.isImage) {
        try {
          processed.push(await createWatermarkedFile(entry.file));
          continue;
        } catch (err) {
          console.error('Erro ao aplicar marca d’água nas plantas', err);
        }
      }
      processed.push(entry.file);
    }
    return processed;
  }, []);

  const handleMainImageFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas arquivos de imagem.');
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error('A imagem principal deve ter no máximo 5MB.');
      return;
    }
    if (!token) {
      toast.error('Faça login para enviar imagens.');
      return;
    }

    setMainImageUploading(true);
    try {
      let uploadFile = file;
      try {
        uploadFile = await createWatermarkedFile(file);
      } catch (processingError) {
        console.error('Erro ao ajustar a imagem principal:', processingError);
      }

      const formData = new FormData();
      formData.append('image', uploadFile);

      const response = await api.post('/uploads/image', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const uploadedUrl = response?.data?.url;
      if (!uploadedUrl) {
        throw new Error('URL da imagem não foi retornada.');
      }

      setForm((prev) => ({ ...prev, image_url: uploadedUrl }));
      toast.success('Imagem principal enviada para a nuvem.');
    } catch (error) {
      console.error('Erro ao enviar a imagem principal:', error);
      const message = error?.response?.data?.message?.toString?.() || '';
      toast.error(message || 'Não foi possível enviar a imagem principal.');
    } finally {
      setMainImageUploading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === 'title') {
      const nextTitle = value.slice(0, TITLE_MAX_LENGTH);
      setForm((prev) => ({ ...prev, title: nextTitle }));
      return;
    }

    if (name === 'year') {
      const cleaned = sanitizeProductYearInput(value);
      setForm((prev) => ({ ...prev, year: cleaned }));
      return;
    }

    if (name === 'country') {
      const nextCountry = normalizeCountryCode(value) || String(value).trim().toUpperCase() || initialFormState.country;
      setForm((prev) => ({
        ...prev,
        country: nextCountry,
        // limpa endereço e coordenadas para evitar país/CEP misturados
        state: '',
        city: '',
        neighborhood: '',
        street: '',
        zip: '',
        lat: '',
        lng: ''
      }));
      return;
    }

    if (name === 'city') {
      const normalizedCity = normalizeCityName(value);
      setForm((prev) => ({ ...prev, city: normalizedCity, lat: '', lng: '' }));
      return;
    }

    if (ADDRESS_FIELDS.has(name)) {
      setForm((prev) => ({ ...prev, [name]: value, lat: '', lng: '' }));
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
    setForm((prev) => ({ ...prev, pickupOnly: prev.isFree ? true : checked }));
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
    let resultingLength = 0;

    setImages((prev) => {
      const available = MAX_PRODUCT_PHOTOS - prev.length;
      if (available <= 0) {
        hitLimit = true;
        resultingLength = prev.length;
        return prev;
      }

      const limited = imageFiles.slice(0, available);
      addedCount = limited.length;
      resultingLength = prev.length + addedCount;

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
      toast.error('Você já alcançou o limite de 10 fotos. Remova alguma para adicionar outra.');
      return;
    }

    if (addedCount === 0) return;

    const remaining = Math.max(0, MAX_PRODUCT_PHOTOS - resultingLength);
    const leftover = Math.max(0, imageFiles.length - addedCount);
    let message = 'Fotos atualizadas.';
    if (leftover > 0) {
      message += ` ${leftover} imagem${leftover === 1 ? '' : 'ens'} ficaram de fora.`;
    }
    if (remaining > 0) {
      message += ` Pode colar ainda ${remaining} foto${remaining === 1 ? '' : 's'}.`;
    } else {
      message += ' Limite de 10 fotos atingido – remova uma para incluir outra.';
    }

    if (leftover > 0) {
      toast(message);
      return;
    }
    toast.success(message);
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

    let addedCount = 0;
    let hitLimit = false;

    setFloorplanFiles((prev) => {
      const available = MAX_FLOORPLAN_FILES - prev.length;
      if (available <= 0) {
        hitLimit = true;
        return prev;
      }
      const limited = validFiles.slice(0, available);
      addedCount = limited.length;
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
      toast.error('Você já alcançou o limite de 4 plantas. Remova alguma para adicionar outra.');
      return;
    }

    if (addedCount > 0) {
      toast.success('Plantas atualizadas.');
    }
  };

  const handleRemoveFloorplan = (id) => {
    setFloorplanFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
        floorplanPreviewsRef.current.delete(target.preview);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleRemoveImage = (id) => {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
        previewsRef.current.delete(target.preview);
      }
      return prev.filter((image) => image.id !== id);
    });
  };

  // GPS -> normaliza país para sigla e UF
  async function handleDetectLocation() {
    if (!navigator.geolocation) return toast.error('Seu navegador não suporta GPS.');
    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const { data } = await api.get(`/geo/reverse?lat=${latitude}&lng=${longitude}`);
          if (data.success) {
            const addr = data.data || {};
            const countryCode = normalizeCountryCode(addr.country) || form.country || defaultCountry;
            const stateNorm = normalizeState(addr.state, countryCode);
            const lat = latitude;
            const lng = longitude;

            if (!inBounds(countryCode, lat, lng)) {
              toast.error('Seu GPS parece apontar outro país. Ajuste o país/UF ou use “Preencher pelo CEP”.');
              setLoadingLocation(false);
              return;
            }

            setForm((f) => ({
              ...f,
              country: countryCode,
              state: stateNorm,
              city: normalizeCityName(addr.city) || f.city,
              neighborhood: addr.neighborhood || f.neighborhood,
              street: addr.street || f.street,
              zip: addr.zip || f.zip,
              lat,
              lng
            }));
            toast.success('Localização detectada com sucesso.');
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

  const focusZipInput = () => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => zipInputRef.current?.focus?.());
  };

  // Valida e usa o CEP/ZIP higienizado no fetch
  async function applyZipLookup({ showSuccessToast = true } = {}) {
    const country = (form.country || 'BR').toUpperCase();
    const cleaned = cleanZip(form.zip, country);
    if (!cleaned) {
      toast.error('Informe o CEP/ZIP.');
      setForm((prev) => ({ ...prev, zip: '', lat: '', lng: '' }));
      focusZipInput();
      return { success: false };
    }
    if (country === 'BR' && cleaned.length !== 8) {
      toast.error('CEP deve ter 8 dígitos.');
      setForm((prev) => ({ ...prev, zip: '', lat: '', lng: '' }));
      focusZipInput();
      return { success: false };
    }
    if (country === 'US' && !(cleaned.length === 5 || cleaned.length === 9)) {
      toast.error('ZIP deve ter 5 ou 9 dígitos.');
      setForm((prev) => ({ ...prev, zip: '', lat: '', lng: '' }));
      focusZipInput();
      return { success: false };
    }

    if (loadingZip) {
      return { success: false };
    }
    setLoadingZip(true);
    try {
      const { data } = await api.get('/geo/cep', { params: { country, zip: cleaned } });
      if (!data.success || !data.data) {
        toast.error('CEP/ZIP não encontrado.');
        setForm((prev) => ({ ...prev, zip: '', lat: '', lng: '' }));
        focusZipInput();
        return { success: false };
      }
      const a = data.data;
      const resolvedCountry = normalizeCountryCode(a.country) || form.country || country;
      const next = {
        country: resolvedCountry,
        state: a.state || '',
        city: normalizeCityName(a.city) || '',
        neighborhood: a.neighborhood ?? '',
        street: a.street ?? '',
        zip: a.zip || cleaned
      };

      if (a.lat == null || a.lng == null) {
        const parts = [next.street, next.neighborhood, next.city, next.state, next.country].filter(Boolean);
        const q = parts.join(', ');
        const fr = await api.get('/geo/forward', { params: { q } });
        if (fr.data?.success && fr.data?.data?.lat != null && fr.data?.data?.lng != null) {
          next.lat = fr.data.data.lat;
          next.lng = fr.data.data.lng;
        }
      } else {
        next.lat = a.lat;
        next.lng = a.lng;
      }

      const latNum = toFiniteNumber(next.lat);
      const lngNum = toFiniteNumber(next.lng);
      if (latNum === null || lngNum === null || !inBounds(resolvedCountry, latNum, lngNum)) {
        toast.error('CEP localizado sem coordenadas válidas. Digite novamente.');
        setForm((prev) => ({ ...prev, zip: '', lat: '', lng: '' }));
        focusZipInput();
        return { success: false };
      }
      next.lat = latNum;
      next.lng = lngNum;
      setForm((prev) => ({ ...prev, ...next }));
      if (showSuccessToast) {
        toast.success('Endereço preenchido pelo CEP.');
      }
      return { success: true, next };
    } catch (err) {
      console.error(err?.response?.data || err.message);
      toast.error('Erro ao consultar CEP.');
      setForm((prev) => ({ ...prev, zip: '', lat: '', lng: '' }));
      focusZipInput();
      return { success: false };
    } finally {
      setLoadingZip(false);
    }
  }

  async function handleFillByZip() {
    await applyZipLookup({ showSuccessToast: true });
  }

  useEffect(() => {
    if (autoZipTriggeredRef.current) return;
    const country = (form.country || 'BR').toUpperCase();
    const initialZip = initialZipRef.current;
    if (!initialZip || form.zip !== initialZip) return;
    const cleaned = cleanZip(initialZip, country);
    if (!shouldAutoFillZip(country, cleaned)) return;
    autoZipTriggeredRef.current = true;
    handleFillByZip();
  }, [form.country, form.zip]);

  const shouldAutoFillZip = (country, cleanedZip) => {
    if (loadingZip) return false;
    if (!cleanedZip) return false;
    if (country === 'BR' && cleanedZip.length !== 8) return false;
    if (country === 'US' && !(cleanedZip.length === 5 || cleanedZip.length === 9)) return false;
    return true;
  };

  const handleZipBlur = (event) => {
    if (event?.relatedTarget?.dataset?.zipAutofill === 'true') return;
    const country = (form.country || 'BR').toUpperCase();
    const cleaned = cleanZip(form.zip, country);
    if (!shouldAutoFillZip(country, cleaned)) return;
    const now = Date.now();
    const last = lastZipAutoFillRef.current;
    if (last.zip === cleaned && now - last.at < 5000) return;
    lastZipAutoFillRef.current = { zip: cleaned, at: now };
    handleFillByZip();
  };

  const buildForwardGeoQuery = (countryCode, stateCode, address) => {
    const parts = [
      address.street,
      address.neighborhood,
      address.city,
      stateCode,
      countryCode,
      address.zip
    ].filter(Boolean);
    return parts.join(', ');
  };

  const canAttemptGeocode = (address, countryCode) => {
    if (!countryCode) return false;
    if (address.city?.trim()) return true;
    if (address.zip?.trim()) return true;
    if (address.street?.trim() && address.state?.trim()) return true;
    return false;
  };

  const resolveCoordinatesFromAddress = useCallback(
    async ({ force = false, notifyOnFail = false } = {}) => {
      const latExisting = toFiniteNumber(form.lat);
      const lngExisting = toFiniteNumber(form.lng);
      if (!force && latExisting !== null && lngExisting !== null) {
        return { lat: latExisting, lng: lngExisting, attempted: false, success: true };
      }

      const countryCode = normalizeCountryCode(form.country) || initialFormState.country;
      const stateCode = normalizeState(form.state, countryCode);
      const query = buildForwardGeoQuery(countryCode, stateCode, form);
      if (!query || !canAttemptGeocode(form, countryCode)) {
        return { lat: null, lng: null, attempted: false, success: false };
      }

      try {
        const response = await api.get('/geo/forward', { params: { q: query } });
        const latValue = response?.data?.data?.lat;
        const lngValue = response?.data?.data?.lng;
        const latNum = toFiniteNumber(latValue);
        const lngNum = toFiniteNumber(lngValue);
        if (latNum !== null && lngNum !== null && inBounds(countryCode, latNum, lngNum)) {
          setForm((prev) => ({ ...prev, lat: latNum, lng: lngNum }));
          return { lat: latNum, lng: lngNum, attempted: true, success: true };
        }
      } catch {
        // segue sem bloquear publicacao
      }

      if (notifyOnFail) {
        toast('Não foi possível localizar as coordenadas agora. Você pode publicar mesmo assim.');
      }
      return { lat: null, lng: null, attempted: true, success: false };
    },
    [form]
  );

  const scheduleAutoGeocode = useCallback(() => {
    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }
    geocodeTimeoutRef.current = setTimeout(async () => {
      const countryCode = normalizeCountryCode(form.country) || initialFormState.country;
      const stateCode = normalizeState(form.state, countryCode);
      const query = buildForwardGeoQuery(countryCode, stateCode, form);
      if (!query || !canAttemptGeocode(form, countryCode)) return;
      if (lastGeoQueryRef.current === query) return;
      if (geocodeInFlightRef.current) return;

      geocodeInFlightRef.current = true;
      lastGeoQueryRef.current = query;
      await resolveCoordinatesFromAddress({ force: true, notifyOnFail: false });
      geocodeInFlightRef.current = false;
    }, 400);
  }, [form, resolveCoordinatesFromAddress]);

  // normalização final antes de enviar
  function buildPayload(overrides = {}, base = form) {
    const countryCode = normalizeCountryCode(base.country) || initialFormState.country;

    const stateCode = normalizeState(base.state, countryCode);
    const latNum =
      overrides.lat === undefined || overrides.lat === null || overrides.lat === ''
        ? base.lat === '' || base.lat === null || base.lat === undefined
          ? null
          : Number(base.lat)
        : Number(overrides.lat);
    const lngNum =
      overrides.lng === undefined || overrides.lng === null || overrides.lng === ''
        ? base.lng === '' || base.lng === null || base.lng === undefined
          ? null
          : Number(base.lng)
        : Number(overrides.lng);
    const latOk =
      Number.isFinite(latNum) &&
      Number.isFinite(lngNum) &&
      inBounds(countryCode, latNum, lngNum);
    const lat = latOk ? latNum : null;
    const lng = latOk ? lngNum : null;

    const payload = {
      title: base.title?.trim() || '',
      description: base.description?.trim() || null,
      category: base.category?.trim() || null,
      country: countryCode,
      state: stateCode || null,
      city: base.city?.trim() || null,
      neighborhood: base.neighborhood?.trim() || null,
      street: base.street?.trim() || null,
      zip: base.zip?.trim() || null,
      lat: lat !== null ? String(lat) : null,
      lng: lng !== null ? String(lng) : null,
      brand: base.brand?.trim() || null,
      model: base.model?.trim() || null,
      color: base.color?.trim() || null,
      year: normalizeProductYear(base.year),
      propertyType: base.propertyType?.trim() || null,
      area: base.area?.trim() || null,
      bedrooms: base.bedrooms?.trim() || null,
      bathrooms: base.bathrooms?.trim() || null,
      parking: base.parking?.trim() || null,
      rentType: base.rentType?.trim() || null,
      serviceType: base.serviceType?.trim() || null,
      serviceDuration: base.serviceDuration?.trim() || null,
      serviceRate: base.serviceRate?.trim() || null,
      serviceLocation: base.serviceLocation?.trim() || null,
      jobTitle: base.jobTitle?.trim() || null,
      jobType: base.jobType?.trim() || null,
      jobSalary: base.jobSalary?.trim() || null,
      jobRequirements: base.jobRequirements?.trim() || null,
      is_free: base.isFree ? 'true' : 'false',
      pickup_only: base.pickupOnly ? 'true' : 'false'
    };

    if (!base.isFree && base.price) {
      const parsedPrice = parsePriceFlexible(base.price);
      if (parsedPrice !== '' && parsedPrice !== null) {
        payload.price = Number(parsedPrice).toFixed(2);
      }
    }

    const mainImageUrl = base.image_url?.trim();
    const normalizedLinks = buildLinkPayloadEntries(base.links);
    payload.links = JSON.stringify(normalizedLinks);
    payload.image_kinds = JSON.stringify(images.map((image) => image.kind));
    payload.image_url = mainImageUrl || null;

    return payload;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid || sending) {
      setShowFieldErrors(true);
      if (missingFields.length) {
        const labels = missingFields.map((item) => item.label).join(', ');
        toast.error(`Preencha: ${labels}.`);
        scrollToField(missingFields[0]?.name);
      }
      return;
    }
    if (!token) return toast.error('Você precisa estar logado para publicar.');
    if (images.length === 0) {
      toast.error('Adicione ao menos uma foto antes de publicar.');
      return;
    }
    if (images.some((image) => !image.kind)) {
      toast.error(IMAGE_KIND_REQUIRED_MESSAGE);
      return;
    }
    const normalizedYear = normalizeProductYear(form.year);
    if (form.year?.trim() && !normalizedYear) {
      toast.error('Ano inválido. Use 4 dígitos entre 1900 e o ano atual.');
      scrollToField('year');
      return;
    }
    const zipToastId = toast.loading('Validando CEP... só um segundo.');
    const zipCheck = await applyZipLookup({ showSuccessToast: false });
    toast.dismiss(zipToastId);
    if (!zipCheck.success) {
      setShowFieldErrors(true);
      return;
    }

    setPublishStage(images.length > 0 ? 'uploading' : 'processing');
    setUploadProgress(0);
    setHasUploadProgress(false);
    setJobId(null);
    setServerProgress(0);
    setServerStep('');
    setServerStatus('idle');
    setSending(true);

    try {
      const resolvedCoords = await resolveCoordinatesFromAddress({ notifyOnFail: true });
      if (!resolvedCoords.success) {
        toast.error('Não foi possível obter a localização. Revise o endereço e tente novamente.');
        setSending(false);
        resetPublishState();
        return;
      }
      const formSnapshot = zipCheck.next ? { ...form, ...zipCheck.next } : form;
      const payload = buildPayload(resolvedCoords, formSnapshot);
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

      const uploadFiles = await prepareImagesForUpload(images);
      const floorplanUploadFiles = isFloorplanCategory
        ? await prepareFloorplansForUpload(floorplanFiles)
        : [];
      const allUploads = [...uploadFiles, ...floorplanUploadFiles];
      const oversizeCount = allUploads.filter((file) => file.size > MAX_IMAGE_UPLOAD_BYTES).length;
      if (oversizeCount > 0) {
        toast.error('Algumas imagens estão acima de 5MB. Reduza o tamanho antes de publicar.');
        setSending(false);
        resetPublishState();
        return;
      }
      uploadFiles.forEach((file) => {
        formData.append('images', file);
      });
      floorplanUploadFiles.forEach((file) => {
        formData.append('floorplan_files', file);
      });

      const { data } = await api.post('/products', formData, {
        onUploadProgress: (progressEvent) => {
          const total = progressEvent?.total ?? 0;
          const loaded = progressEvent?.loaded ?? 0;
          if (total > 0) {
            setHasUploadProgress(true);
            const percent = Math.min(100, Math.round((loaded / total) * 100));
            setUploadProgress(percent);
            return;
          }
          setHasUploadProgress(true);
          setUploadProgress((prev) => Math.min(99, prev + 6));
        }
      });

      const savedEntry = persistNewProductAddress(payload, defaultCountry);
      setSavedAddress(savedEntry);

      const jobIdentifier = data?.jobId ?? null;
      if (!jobIdentifier) {
        toast.success('Produto publicado com sucesso!');
        resetPublishState();
        setSending(false);
        resetImagePreviews();
        setForm(baseForm);
        setShowFieldErrors(false);
        navigate('/dashboard');
        return;
      }

      setJobId(jobIdentifier);
      setPublishStage('processing');
      setServerStep('Aguardando confirmação...');
      setServerStatus('queued');
    } catch (error) {
      console.error(error);
      const serverMessage = error?.response?.data?.message;
      toast.error(serverMessage || 'Erro ao publicar produto.');
      setSending(false);
      resetPublishState();
    }
  };

  return (
    <section className="relative min-h-screen bg-[var(--ts-bg)] py-10 px-4 text-[var(--ts-surface)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-[rgba(31,143,95,0.18)] blur-3xl" />
        <div className="absolute -bottom-36 -left-24 h-72 w-72 rounded-full bg-[rgba(200,178,106,0.2)] blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-[28px] border border-[rgba(200,178,106,0.35)] bg-white text-[var(--ts-text)] shadow-[0_45px_90px_-60px_rgba(0,0,0,0.85)]">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(200,178,106,0.1),rgba(31,143,95,0.5),rgba(200,178,106,0.1))]"
            aria-hidden="true"
          />
          <div className="relative p-6 sm:p-10">
            <CloseBackButton />
            <header className="text-center mb-8">
              <div
                className="mx-auto mb-3 h-1 w-14 rounded-full bg-[var(--ts-gold)] opacity-80"
                aria-hidden="true"
              />
              <h1 className="font-['Cinzel'] text-2xl sm:text-[30px] font-semibold text-[var(--ts-text)]">
                Publicar novo produto
              </h1>
              <p className="text-sm font-medium text-[var(--ts-muted)] mt-2">
                Compartilhe seu produto com a comunidade TempleSale em poucos passos.
              </p>
            </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
          noValidate
          onInvalid={(event) => {
            event.preventDefault();
          }}
        >
          {showMissingSummary && showFieldErrors && missingFields.length > 0 && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
              <p className="font-semibold">Complete os campos obrigatórios:</p>
              <p className="text-xs text-red-600">Clique no campo para ir direto ao local destacado.</p>
              <ul className="list-disc list-inside text-red-600 text-xs space-y-1">
                {missingFields.map((item) => (
                  <li key={item.name}>
                    <button
                      type="button"
                      onClick={() => scrollToField(item.name)}
                      className="text-red-700 underline-offset-2 hover:text-red-500 underline"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 rounded-2xl border border-[rgba(200,178,106,0.18)] bg-[rgba(14,17,22,0.02)] p-5 shadow-[0_18px_35px_-28px_rgba(0,0,0,0.4)]">
            <div className="grid md:grid-cols-2 gap-4">
            <label className={FIELD_LABEL_CLASS}>
              <span>Título*</span>
              <input
                name="title"
                placeholder="Ex: Notebook Dell XPS 13"
                value={form.title}
                onChange={handleChange}
                required
                maxLength={TITLE_MAX_LENGTH}
                className={`${FIELD_BASE_CLASS} bg-[var(--ts-surface)] text-base font-semibold shadow-[0_12px_22px_-18px_rgba(0,0,0,0.25)] ${hasFieldError('title') ? 'ring-2 ring-red-400' : ''}`}
                data-new-product-field="title"
                id={FIELD_SCROLL_IDS.title}
              />
              {hasFieldError('title') && (
                <span className="text-xs text-red-600">Informe um título.</span>
              )}
              <span className="text-[10px] text-[var(--ts-muted)] mt-1">
                {titleLength}/{TITLE_MAX_LENGTH} | restam {titleRemaining} letras
              </span>
            </label>

            <label className={`${FIELD_LABEL_CLASS} ${form.isFree ? 'opacity-60' : ''}`.trim()}>
              <span>Preço ({currencyInfo.symbol})</span>
              <input
                name="price"
                placeholder={form.isFree ? 'Anúncio marcado como grátis' : `Ex: ${currencyInfo.example}`}
                value={form.price}
                onChange={(e) => {
                  const sanitized = sanitizePriceInput(e.target.value, currencyCode);
                  setForm((prev) => ({ ...prev, price: sanitized }));
                }}
                disabled={form.isFree}
                inputMode="decimal"
                className={`${FIELD_BASE_CLASS} text-lg font-semibold shadow-[0_14px_26px_-20px_rgba(0,0,0,0.3)]`}
                data-new-product-field="price"
                id={FIELD_SCROLL_IDS.price}
              />
              <span className="text-xs text-[var(--ts-muted)]">
                {form.isFree ? (
                  'Este anúncio será exibido como “Grátis” em destaque.'
                ) : (
                  <>
                    Será exibido como:{' '}
                    <span className="text-[var(--ts-gold)] font-semibold">
                      {pricePreview || previewFallback}
                    </span>
                  </>
                )}
              </span>
            </label>

            <div className="md:col-span-2 mt-2">
              <div
                className="flex w-full flex-col gap-2 rounded-2xl border border-black/5 bg-[var(--ts-surface)] p-4"
                ref={freeHelpRef}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleFreeToggle(!form.isFree)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:ring focus-visible:ring-[rgba(200,178,106,0.4)] ${
                      form.isFree
                        ? 'bg-[var(--ts-cta)] border-[var(--ts-cta)] text-white'
                        : 'bg-white border-[rgba(31,143,95,0.35)] text-[var(--ts-cta)]'
                    }`}
                    aria-pressed={form.isFree}
                  >
                    Zona Free
                  </button>
                  <button
                    type="button"
                    onClick={() => setFreeHelpVisible((prev) => !prev)}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(200,178,106,0.45)] text-[var(--ts-gold)]"
                    aria-label={FREE_HELP_TITLE}
                    aria-expanded={freeHelpVisible}
                  >
                    ?
                  </button>
                  <span className="rounded-full border border-[rgba(31,143,95,0.35)] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--ts-cta)]">
                    {form.isFree ? 'Ativado' : 'Desativado'}
                  </span>
                </div>
                {freeHelpVisible && (
                  <div className="mt-1 w-full max-w-sm rounded-xl border border-[rgba(200,178,106,0.35)] bg-white p-3 text-xs text-[var(--ts-text)] shadow-lg">
                    <p className="font-semibold text-[var(--ts-text)]">{FREE_HELP_TITLE}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[var(--ts-muted)]">
                      {FREE_HELP_LINES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs text-[var(--ts-muted)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--ts-cta)]"
                    checked={form.pickupOnly}
                    onChange={handlePickupToggle}
                    disabled={form.isFree}
                  />
                  Apenas retirada em mãos {form.isFree ? '(obrigatório no modo grátis)' : ''}
                </label>
              </div>
            </div>

            <label className={FIELD_LABEL_CLASS}>
              <span>Categoria</span>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                className={`${FIELD_BASE_CLASS} ${hasFieldError('category') ? 'ring-2 ring-red-400' : ''}`}
                data-new-product-field="category"
                id={FIELD_SCROLL_IDS.category}
              >
                <option value="">Selecione uma categoria</option>
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {hasFieldError('category') && (
                <span className="text-xs text-red-600">Selecione uma categoria.</span>
              )}
            </label>
            <div className="flex flex-col gap-2 my-2">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-[var(--ts-muted)]">Detectar localização automática:</span>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={loadingLocation}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(31,143,95,0.55)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--ts-cta)] shadow-none transition hover:bg-[rgba(31,143,95,0.08)] disabled:opacity-60"
                >
                  <span aria-hidden="true">📍</span>
                  {loadingLocation ? 'Detectando...' : 'Usar minha localização'}
                </button>
              </div>
              <p className="text-xs text-[var(--ts-muted)]">
                País e cidade são obrigatórios; use o botão acima para preencher estes campos automaticamente e acelerar a publicação.
              </p>
            </div>
              <label className={FIELD_LABEL_CLASS}>
                <span>País (sigla)</span>
                <select name="country" value={form.country} onChange={handleChange} className={FIELD_BASE_CLASS}>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label} ({c.code})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* CEP/ZIP primeiro */}
          <div className="my-2 rounded-2xl border border-[rgba(200,178,106,0.2)] bg-[rgba(14,17,22,0.02)] p-4">
            <div className="flex gap-2">
              <input
                ref={zipInputRef}
                className={`flex-1 ${FIELD_BASE_CLASS} ${hasFieldError('zip') ? 'ring-2 ring-red-400' : ''}`}
                placeholder={form.country === 'US' ? 'ZIP (5 ou 9)' : 'CEP (8)'}
                name="zip"
                value={form.zip}
                onChange={(e) => {
                  const cleaned = cleanZip(e.target.value, (form.country || 'BR').toUpperCase());
                  setForm((prev) => ({ ...prev, zip: cleaned, lat: '', lng: '' }));
                }}
                onBlur={handleZipBlur}
                required
              />
              <button
                type="button"
                onClick={handleFillByZip}
                className="px-3 py-2 rounded bg-[var(--ts-cta)] text-white shadow-[0_10px_18px_-12px_rgba(31,143,95,0.55)] disabled:opacity-60"
                disabled={loadingZip}
                data-zip-autofill="true"
              >
                {loadingZip ? 'Buscando...' : 'Preencher pelo CEP'}
              </button>
            </div>
            {loadingZip && (
              <div className="mt-2 h-1 w-full overflow-hidden rounded bg-[rgba(200,178,106,0.2)]">
                <div className="h-full w-full animate-pulse bg-[var(--ts-gold)]" />
              </div>
            )}
            <p className="text-xs text-[var(--ts-muted)] mt-1">
              Dica: use “Preencher pelo CEP/ZIP” para localizar automaticamente.
            </p>
            {hasFieldError('zip') && (
              <span className="text-xs text-red-600">Informe o CEP/ZIP.</span>
            )}
          </div>

          {/* Endereço */}
          <div className="mt-2 grid grid-cols-2 gap-4 rounded-2xl border border-[rgba(200,178,106,0.2)] bg-[rgba(14,17,22,0.02)] p-4">
            {/* País como SELECT com siglas */}
            <label className="flex flex-col">
              <span className="text-sm font-medium text-[var(--ts-text)] mb-1">Cidade</span>
              <input
                className={FIELD_BASE_CLASS}
                placeholder="Localização do produto"
                name="city"
                value={form.city}
                onChange={handleChange}
                onBlur={scheduleAutoGeocode}
              />
            </label>

            <label className="flex flex-col">
              <span className="text-sm font-medium text-[var(--ts-text)] mb-1">Estado/UF</span>
              <input
                className={FIELD_BASE_CLASS}
                placeholder={form.country === 'US' ? 'Ex: CA' : 'Ex: SP'}
                name="state"
                value={form.state}
                onChange={handleChange}
                onBlur={scheduleAutoGeocode}
              />
            </label>

            <label className="flex flex-col">
              <span className="text-sm font-medium text-[var(--ts-text)] mb-1">Bairro</span>
              <input
              className={FIELD_BASE_CLASS}
              placeholder="Bairro"
              name="neighborhood"
              value={form.neighborhood}
              onChange={handleChange}
              onBlur={scheduleAutoGeocode}
            />
              </label>
              <label className="flex flex-col">
              <span className="text-sm font-medium text-[var(--ts-text)] mb-1">Rua</span>
              
            <input
              className={FIELD_BASE_CLASS}
              placeholder="Rua"
              name="street"
              value={form.street}
              onChange={handleChange}
              onBlur={scheduleAutoGeocode}
            />
             </label>
          </div>

          <div className="mt-4 rounded-2xl border border-[rgba(200,178,106,0.2)] bg-[rgba(14,17,22,0.02)] p-4">
            <h2 className="font-['Cinzel'] text-sm font-semibold text-[var(--ts-text)] mb-2">
              Detalhes do produto
            </h2>
            <div className="new-product__details-grid grid gap-2 md:grid-cols-2">
              {categoryDetails.map((field) => (
                <label key={field.name} className="flex flex-col">
                  <span className="text-xs text-[var(--ts-muted)] mb-1">{field.label}</span>
                  <input
                    className={FIELD_BASE_CLASS}
                    name={field.name}
                    placeholder={field.placeholder}
                    value={form[field.name] ?? ''}
                    onChange={handleChange}
                    inputMode={field.inputMode}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3" style={{ display: 'none' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-['Cinzel'] text-sm font-semibold text-[var(--ts-text)]">
                Imagem principal (opcional)
              </h2>
              {mainImageUploading && (
                <span className="text-[10px] text-[var(--ts-muted)]">Enviando...</span>
              )}
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-[rgba(200,178,106,0.25)] bg-[var(--ts-card)] p-4 shadow-[0_12px_40px_-25px_rgba(0,0,0,0.7)] md:flex-row">
              <div className="h-32 w-full overflow-hidden rounded-xl border border-[rgba(200,178,106,0.35)] bg-[var(--ts-surface)] text-[10px] text-[var(--ts-muted)] md:w-32">
                {form.image_url ? (
                  <img
                    src={form.image_url}
                    alt="Prévia da imagem principal"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center px-2 text-center text-xs uppercase tracking-[0.2em]">
                    Nenhuma imagem principal definida
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 text-xs text-[var(--ts-muted)]">
                <span>Envie um arquivo para o Cloudinary ou cole uma URL manual.</span>
                <label className="inline-flex w-full items-center justify-between rounded-full border border-[rgba(200,178,106,0.4)] bg-white pl-4 pr-2 text-[12px] font-semibold text-[var(--ts-cta)] shadow-sm transition hover:border-[rgba(200,178,106,0.6)]">
                  Selecionar imagem
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleMainImageFile}
                    disabled={mainImageUploading}
                  />
                </label>
                <p className="text-[10px] text-[var(--ts-muted)]">Máx. 5MB, apenas imagens.</p>
                <label className="flex flex-col gap-1 text-[11px]">
                  <span>Ou cole uma URL</span>
                  <input
                    type="url"
                    name="image_url"
                    value={form.image_url}
                    onChange={handleChange}
                    disabled={mainImageUploading}
                    placeholder="https://exemplo.com/minha-img.jpg"
                    className="w-full rounded-lg border border-[rgba(200,178,106,0.35)] bg-white px-3 py-2 text-[var(--ts-text)] shadow-sm focus:border-[rgba(200,178,106,0.7)] focus:outline-none focus:ring-2 focus:ring-[rgba(200,178,106,0.35)]"
                  />
                </label>
                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, image_url: '' }))}
                    className="inline-flex items-center text-[11px] font-semibold text-[var(--ts-cta)] underline-offset-2 hover:underline"
                  >
                    Remover imagem principal
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3 rounded-2xl border border-[rgba(200,178,106,0.2)] bg-[rgba(14,17,22,0.02)] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-['Cinzel'] text-sm font-semibold text-[var(--ts-text)]">Fotos do produto</h2>
              <span className="text-xs text-[var(--ts-muted)]">{images.length}/{MAX_PRODUCT_PHOTOS}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-[rgba(200,178,106,0.18)] shadow-[0_18px_30px_-18px_rgba(0,0,0,0.5)]"
                >
                  <img src={image.preview} alt="Pré-visualização da foto" className="h-full w-full object-cover" />
                  {image.kind === IMAGE_KIND.ILLUSTRATIVE && (
                    <span className="absolute left-2 top-2 rounded-full border border-[rgba(200,178,106,0.5)] bg-[rgba(14,17,22,0.6)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
                      {IMAGE_KIND_BADGE_LABEL}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(image.id)}
                    className="absolute top-1 right-1 bg-black/60 text-white text-xs rounded-full px-2 py-1 opacity-0 group-hover:opacity-100"
                  >
                    remover
                  </button>
                </div>
              ))}
              {images.length < MAX_PRODUCT_PHOTOS && (
                <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-[rgba(200,178,106,0.35)] text-xs text-[var(--ts-muted)] cursor-pointer hover:border-[rgba(200,178,106,0.6)] hover:text-[var(--ts-text)] transition bg-[var(--ts-card)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <span>Adicionar fotos</span>
                  <span className="mt-1 text-[10px] text-[var(--ts-muted)]">Máx. {MAX_PRODUCT_PHOTOS} imagens</span>
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
            <p className="text-xs text-[var(--ts-muted)]">
              Use fotos reais, bem iluminadas e mostre detalhes importantes. Aceitamos até {MAX_PRODUCT_PHOTOS} imagens (5MB cada).
            </p>
            <p className="text-xs text-[var(--ts-muted)]">{IMAGE_KIND_HELP_TEXT}</p>
          </div>

          {isFloorplanCategory && (
            <div className="mt-4 space-y-3 rounded-2xl border border-[rgba(200,178,106,0.2)] bg-[rgba(14,17,22,0.02)] p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-['Cinzel'] text-sm font-semibold text-[var(--ts-text)]">Planta do ambiente</h2>
                <span className="text-xs text-[var(--ts-muted)]">
                  {floorplanFiles.length}/{MAX_FLOORPLAN_FILES}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {floorplanFiles.map((item) => (
                  <div
                    key={item.id}
                    className="relative group aspect-square rounded-lg overflow-hidden border border-black/10 shadow-[0_14px_24px_-16px_rgba(0,0,0,0.45)]"
                  >
                    {item.isImage ? (
                      <img
                        src={item.preview}
                        alt="Pré-visualização da planta"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-[var(--ts-surface)] text-xs text-[var(--ts-muted)] px-2 text-center">
                        {item.name || 'Arquivo'}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveFloorplan(item.id)}
                      className="absolute top-1 right-1 bg-black/60 text-white text-xs rounded-full px-2 py-1 opacity-0 group-hover:opacity-100"
                    >
                      remover
                    </button>
                  </div>
                ))}
                {floorplanFiles.length < MAX_FLOORPLAN_FILES && (
                  <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-black/10 text-xs text-[var(--ts-muted)] cursor-pointer hover:border-[rgba(200,178,106,0.5)] hover:text-[var(--ts-text)] transition bg-[var(--ts-surface)]">
                    <span>Adicionar planta</span>
                    <span className="mt-1 text-[10px] text-[var(--ts-muted)]">
                      Máx. {MAX_FLOORPLAN_FILES} arquivos
                    </span>
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
              <p className="text-xs text-[var(--ts-muted)]">
                Você pode enviar até {MAX_FLOORPLAN_FILES} arquivos (imagem ou PDF) com a planta do ambiente.
              </p>
            </div>
          )}
          <div className="mt-4 space-y-4 rounded-2xl border border-[rgba(200,178,106,0.2)] bg-[rgba(14,17,22,0.02)] p-4">
            <LinkListEditor
              links={form.links}
              onChange={(links) => setForm((prev) => ({ ...prev, links }))}
            />

            <label className={FIELD_LABEL_CLASS}>
              <span>Descrição</span>
              <textarea
                name="description"
                placeholder="Detalhes importantes, estado do produto, acessórios inclusos..."
                value={form.description}
                onChange={handleChange}
                rows={5}
                required
                className={`${FIELD_BASE_CLASS} resize-none bg-[var(--ts-surface)] text-base leading-relaxed ${hasFieldError('description') ? 'ring-2 ring-red-400' : ''}`}
              />
              {hasFieldError('description') && (
                <span className="text-xs text-red-600">Informe uma descrição.</span>
              )}
            </label>
          </div>

          <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-[rgba(200,178,106,0.2)] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="bg-white text-[var(--ts-text)] font-semibold py-2.5 px-4 rounded-lg border border-[rgba(200,178,106,0.35)] hover:bg-[rgba(200,178,106,0.08)] disabled:opacity-50"
              onClick={() => {
                suppressFloorplanToastRef.current = true;
                resetImagePreviews();
                setForm(baseForm);
                setShowFieldErrors(false);
              }}
              disabled={sending}
            >
              Limpar
            </button>
            <button
              type="submit"
              className="bg-[var(--ts-cta)] hover:bg-[#1a7a51] text-white font-bold py-2.5 px-5 rounded-lg border border-[rgba(31,143,95,0.65)] shadow-[0_18px_32px_-20px_rgba(31,143,95,0.65)] disabled:opacity-70"
              disabled={sending}
            >
              {sending ? 'Publicando...' : 'Publicar produto'}
            </button>
          </footer>
        </form></div>
      </div>
      {isOverlayVisible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="status"
          aria-live="polite"
        >
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md text-center">
            {stageTitle.toLowerCase().includes('carregando') ? (
              <LoadingBar
                message={stageTitle}
                className="text-lg font-semibold text-[var(--ts-text)]"
                size="sm"
              />
            ) : (
              <p className="text-lg font-semibold text-[var(--ts-text)]">{stageTitle}</p>
            )}
            <p key={stageDetail} className="text-sm text-[var(--ts-muted)] mt-2">
              {stageDetail}
            </p>
            {(publishStage === 'uploading' && !hasUploadProgress) ||
            publishStage === 'processing' ? (
              <div className="new-product-publish-spinner" aria-hidden="true" />
            ) : null}
            <div className="h-2 rounded-full bg-[rgba(200,178,106,0.2)] overflow-hidden mt-4">
              <div
                className="h-full bg-[var(--ts-cta)] transition-all duration-500"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
            {publishStage === 'processing' && (
              <>
                <div className="h-2 rounded-full bg-[rgba(200,178,106,0.2)] overflow-hidden mt-4">
                  <div
                    className="h-full bg-[var(--ts-cta)] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, serverProgress))}%` }}
                  />
                </div>
                <div className="new-product-publish-step-list">
                  {PROCESSING_STEPS.map((step, index) => {
                    const isActive = index === processingActiveIndex;
                    const isComplete = index < processingActiveIndex;
                    const pillClasses = [
                      'new-product-publish-step',
                      isComplete ? 'is-complete' : '',
                      isActive ? 'is-active' : ''
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <span key={step} className={pillClasses}>
                        {step}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {activeImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <p className="text-sm font-semibold text-[var(--ts-text)]">{IMAGE_KIND_PROMPT}</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-xl border border-black/10">
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
                  className="w-full rounded-lg border border-[var(--ts-cta)] bg-[var(--ts-cta)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1a7a51]"
                >
                  {IMAGE_KIND_LABELS[IMAGE_KIND.REAL]}
                </button>
                <button
                  type="button"
                  onClick={() => setImageKind(activeImage.id, IMAGE_KIND.ILLUSTRATIVE)}
                  className="w-full rounded-lg border border-[rgba(200,178,106,0.6)] bg-[var(--ts-gold)] px-3 py-2 text-xs font-semibold text-[#1a1d21] shadow-sm transition hover:bg-[#d1bd78]"
                >
                  {IMAGE_KIND_LABELS[IMAGE_KIND.ILLUSTRATIVE]}
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-[var(--ts-muted)]">
              {IMAGE_KIND_HELP_TEXT}
            </p>
          </div>
        </div>
      )}
      </div>
    </section>
  );
}

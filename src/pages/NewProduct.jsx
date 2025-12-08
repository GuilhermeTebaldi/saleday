// frontend/src/pages/NewProduct.jsx
// Página de cadastro de um novo produto.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { toast } from 'react-hot-toast';
import { formatProductPrice, getCurrencySettings, resolveCurrencyFromCountry } from '../utils/currency.js';
import { COUNTRY_OPTIONS, normalizeCountryCode } from '../data/countries.js';

// bounds simples por país
const BOUNDS = {
  BR: { lat: [-34, 5], lng: [-74, -34] },
  US: { lat: [18, 72], lng: [-170, -66] },
  IT: { lat: [35, 47], lng: [6, 19] }
};

const MAX_PRODUCT_PHOTOS = 10;

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
  isFree: false,
  pickupOnly: false
};

const categories = [
  'Eletrônicos',
  'Informática',
  'Moda',
  'Casa e Jardim',
  'Esportes',
  'Veículos',
  'Outros'
];

const CATEGORY_DETAILS = {
  Veículos: [
    { name: 'brand', label: 'Marca', placeholder: 'Ex: Toyota' },
    { name: 'model', label: 'Modelo', placeholder: 'Ex: Corolla XEi' },
    { name: 'color', label: 'Cor', placeholder: 'Ex: Prata' },
    { name: 'year', label: 'Ano', placeholder: 'Ex: 2022', inputMode: 'numeric' }
  ],
  'Eletrônicos': [
    { name: 'brand', label: 'Marca', placeholder: 'Ex: Apple' },
    { name: 'model', label: 'Modelo', placeholder: 'Ex: iPhone 15' }
  ]
};

const DEFAULT_DETAILS = [
  { name: 'brand', label: 'Marca', placeholder: 'Ex: Nike' },
  { name: 'model', label: 'Modelo / variação', placeholder: 'Ex: Air Zoom' },
  { name: 'color', label: 'Cor', placeholder: 'Ex: Azul' }
];

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

/* ===== Parser de preço flexível (topo, antes do componente) ===== */
// Trata variações comuns de formatação de preço (pt-BR, en-US e mistos) sem penalizar erros pequenos.
const parsePriceFlexible = (v) => {
  if (v == null) return '';
  const s = String(v).trim();
  if (!s) return '';

  const normalized = s.replace(/[^\d.,]/g, '');
  if (!normalized) return '';

  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  const lastSepIndex = Math.max(lastDot, lastComma);
  let decimalSep = null;

  if (lastSepIndex !== -1) {
    const sepChar = normalized[lastSepIndex];
    const decimals = normalized.length - lastSepIndex - 1;
    const digitsAfter = normalized.slice(lastSepIndex + 1);
    const digitsOnlyAfter = /^\d+$/.test(digitsAfter);
    const hasBoth = lastDot !== -1 && lastComma !== -1;

    if (digitsOnlyAfter && decimals > 0) {
      if (decimals <= 2) {
        decimalSep = sepChar;
      } else if (decimals === 3 && hasBoth) {
        decimalSep = sepChar;
      }
    }

    if (decimals === 3 && !hasBoth) {
      decimalSep = null;
    }
  }

  let cleaned = normalized;
  const marker = '<<DECIMAL>>';

  if (decimalSep) {
    const decimalRegex = new RegExp(`\\${decimalSep}(?=[^\\${decimalSep}]*$)`);
    cleaned = cleaned.replace(decimalRegex, marker);
  }

  cleaned = cleaned.replace(/[.,]/g, '');
  if (decimalSep) cleaned = cleaned.replace(marker, '.');

  if (!cleaned) return '';

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : '';
};

// Aplica máscara monetária ao digitar, inserindo automaticamente milhar/ponto e centavos.
const sanitizePriceInput = (value, currency) => {
  if (value == null) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (/^0+$/.test(digits)) return '';

  const decimalSeparator = currency === 'USD' ? '.' : ',';
  const thousandSeparator = currency === 'USD' ? ',' : '.';
  const decimalPlaces = 2;
  const padded = digits.padStart(decimalPlaces + 1, '0');
  const integerDigits = padded.slice(0, -decimalPlaces);
  const decimalDigits = padded.slice(-decimalPlaces);
  const normalizedInteger = integerDigits.replace(/^0+(?=\d)/, '') || '0';
  const withThousands = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);

  return `${withThousands}${decimalSeparator}${decimalDigits}`;
};

// ===== Util para limpar e limitar CEP/ZIP (antes do componente) =====
const cleanZip = (z, country) => {
  const digits = String(z || '').replace(/\D/g, '');
  return country === 'US' ? digits.slice(0, 9) : digits.slice(0, 8);
};

const scrollToField = (field) => {
  if (!field || typeof document === 'undefined') return;
  requestAnimationFrame(() => {
    const target = document.querySelector(`[data-new-product-field="${field}"]`);
    if (target?.scrollIntoView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (target && typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
  });
};

export default function NewProduct() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const defaultCountry = useMemo(
    () => normalizeCountryCode(user?.country) || initialFormState.country,
    [user?.country]
  );
  const baseForm = useMemo(
    () => ({ ...initialFormState, country: defaultCountry }),
    [defaultCountry]
  );
  const [form, setForm] = useState(baseForm);
  const [images, setImages] = useState([]);
  const previewsRef = useRef(new Set());
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

  useEffect(() => {
    setForm(baseForm);
    setShowFieldErrors(false);
  }, [baseForm]);

  const isValid = useMemo(
    () => form.title && form.category && (form.isFree || form.price),
    [form.title, form.category, form.price, form.isFree]
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

  const missingFields = useMemo(() => {
    const missing = [];
    if (!form.title?.trim()) missing.push({ name: 'title', label: 'Título' });
    if (!form.category?.trim()) missing.push({ name: 'category', label: 'Categoria' });
    if (!form.isFree && !form.price?.trim()) missing.push({ name: 'price', label: 'Preço' });
    return missing;
  }, [form.title, form.category, form.price, form.isFree]);

  const hasFieldError = (field) =>
    showFieldErrors && missingFields.some((item) => item.name === field);

  useEffect(() => {
    setForm((prev) => {
      if (!prev.isFree) return prev;
      if (prev.price === '' && prev.pickupOnly) return prev;
      return { ...prev, price: '', pickupOnly: true };
    });
  }, [form.isFree]);
  const categoryDetails = useMemo(() => {
    const specific = CATEGORY_DETAILS[form.category] ?? [];
    const combined = [...specific, ...DEFAULT_DETAILS];
    const seen = new Set();
    const result = [];
    for (const field of combined) {
      if (seen.has(field.name)) continue;
      seen.add(field.name);
      result.push(field);
    }
    return result;
  }, [form.category]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === 'year') {
      const cleaned = value.replace(/\D/g, '').slice(0, 4);
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

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFreeToggle = (event) => {
    const checked = event?.target?.checked ?? false;
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

    setImages((prev) => {
      const available = MAX_PRODUCT_PHOTOS - prev.length;
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
          preview: previewUrl
        };
      });

      return [...prev, ...mapped];
    });

    if (hitLimit) {
      toast.error('Você já adicionou o máximo de 10 fotos.');
      return;
    }

    if (addedCount < imageFiles.length) {
      toast.error('Limite de 10 fotos por anúncio. Algumas imagens ficaram de fora.');
    }
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
              city: addr.city || f.city,
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

  // Valida e usa o CEP/ZIP higienizado no fetch
  async function handleFillByZip() {
    const country = (form.country || 'BR').toUpperCase();
    const cleaned = cleanZip(form.zip, country);
    if (!cleaned) return toast.error('Informe o CEP/ZIP.');
    if (country === 'BR' && cleaned.length !== 8) return toast.error('CEP deve ter 8 dígitos.');
    if (country === 'US' && !(cleaned.length === 5 || cleaned.length === 9)) {
      return toast.error('ZIP deve ter 5 ou 9 dígitos.');
    }

    setLoadingZip(true);
    try {
      const { data } = await api.get('/geo/cep', { params: { country, zip: cleaned } });
      if (!data.success || !data.data) return toast.error('CEP/ZIP não encontrado.');
      const a = data.data;
      let next = {
        ...form,
        country: normalizeCountryCode(a.country) || form.country,
        state: a.state || form.state,
        city: a.city || form.city,
        neighborhood: a.neighborhood ?? form.neighborhood,
        street: a.street ?? form.street,
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

      setForm(next);
      toast.success('Endereço preenchido pelo CEP.');
    } catch (err) {
      console.error(err?.response?.data || err.message);
      toast.error('Erro ao consultar CEP.');
    } finally {
      setLoadingZip(false);
    }
  }

  // normalização final antes de enviar
  function buildPayload() {
    const countryCode = normalizeCountryCode(form.country) || initialFormState.country;

    const stateCode = normalizeState(form.state, countryCode);
    const latNum =
      form.lat === '' || form.lat === null || form.lat === undefined
        ? null
        : Number(form.lat);
    const lngNum =
      form.lng === '' || form.lng === null || form.lng === undefined
        ? null
        : Number(form.lng);
    const latOk =
      Number.isFinite(latNum) &&
      Number.isFinite(lngNum) &&
      inBounds(countryCode, latNum, lngNum);
    const lat = latOk ? latNum : null;
    const lng = latOk ? lngNum : null;

    const payload = {
      title: form.title?.trim() || '',
      description: form.description?.trim() || null,
      category: form.category?.trim() || null,
      country: countryCode,
      state: stateCode || null,
      city: form.city?.trim() || null,
      neighborhood: form.neighborhood?.trim() || null,
      street: form.street?.trim() || null,
      zip: form.zip?.trim() || null,
      lat: lat !== null ? String(lat) : null,
      lng: lng !== null ? String(lng) : null,
      brand: form.brand?.trim() || null,
      model: form.model?.trim() || null,
      color: form.color?.trim() || null,
      year: form.year?.trim() || null,
      is_free: form.isFree ? 'true' : 'false',
      pickup_only: form.pickupOnly ? 'true' : 'false'
    };

    if (!form.isFree && form.price) {
      const parsedPrice = parsePriceFlexible(form.price);
      if (parsedPrice !== '' && parsedPrice !== null) {
        payload.price = Number(parsedPrice).toFixed(2);
      }
    }

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

    setPublishStage(images.length > 0 ? 'uploading' : 'processing');
    setUploadProgress(0);
    setHasUploadProgress(false);
    setJobId(null);
    setServerProgress(0);
    setServerStep('');
    setServerStatus('idle');
    setSending(true);

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

      images.forEach((image) => {
        formData.append('images', image.file);
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
      toast.error('Erro ao publicar produto.');
      setSending(false);
      resetPublishState();
    }
  };

  return (
    <section className="new-product-page">
      <div className="new-product-card">
        <header className="new-product-header">
          <h1>Publicar novo produto</h1>
          <p>Compartilhe seu produto com a comunidade SaleDay em poucos passos.</p>
        </header>

        <form onSubmit={handleSubmit} className="new-product-form">
          {showFieldErrors && missingFields.length > 0 && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
              <p className="font-semibold">Complete os campos obrigatórios:</p>
              <ul className="list-disc list-inside text-red-600 text-xs">
                {missingFields.map((item) => (
                  <li key={item.name}>{item.label}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 mb-4 space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600"
                checked={form.isFree}
                onChange={handleFreeToggle}
              />
              Ativar modo grátis (Zona Free)
            </label>
            <p className="text-xs text-emerald-700">
              Produtos grátis aparecem com destaque em verde na Home e ficam disponíveis para retirada rápida.
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

          <div className="form-grid">
            <label>
              Título*
              <input
                name="title"
                placeholder="Ex: Notebook Dell XPS 13"
                value={form.title}
                onChange={handleChange}
                required
                className={`${
                  hasFieldError('title') ? 'ring-2 ring-red-400' : ''
                }`}
                data-new-product-field="title"
              />
              {hasFieldError('title') && (
                <span className="text-xs text-red-600">Informe um título.</span>
              )}
            </label>

            <label className={form.isFree ? 'opacity-60' : ''}>
              Preço ({currencyInfo.symbol})
              <input
                name="price"
                placeholder={form.isFree ? 'Anúncio marcado como grátis' : `Ex: ${currencyInfo.example}`}
                value={form.price}
                onChange={(e) => {
                  const sanitized = sanitizePriceInput(e.target.value, currencyCode);
                  setForm((prev) => ({ ...prev, price: sanitized }));
                }}
                disabled={form.isFree}
                required={!form.isFree}
                inputMode="decimal"
                className={`${
                  hasFieldError('price') ? 'ring-2 ring-red-400' : ''
                }`}
                data-new-product-field="price"
              />
              <span className="text-xs text-gray-500">
                {form.isFree
                  ? 'Este anúncio será exibido como “Grátis” em destaque.'
                  : `Será exibido como: ${pricePreview || previewFallback}`}
              </span>
              {hasFieldError('price') && !form.isFree && (
                <span className="text-xs text-red-600">Informe o preço do produto.</span>
              )}
            </label>

            <label>
              Categoria
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                className={`${
                  hasFieldError('category') ? 'ring-2 ring-red-400' : ''
                }`}
                data-new-product-field="category"
              >
                <option value="">Selecione uma categoria</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              {hasFieldError('category') && (
                <span className="text-xs text-red-600">Selecione uma categoria.</span>
              )}
            </label>
            <label>
              País (sigla)
              <select name="country" value={form.country} onChange={handleChange}>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label} ({c.code})
                  </option>
                ))}
              </select>
            </label>

          </div>

          {/* CEP/ZIP primeiro */}
          <div className="my-2">
            <div className="flex gap-2">
              <input
                className="border p-2 rounded flex-1"
                placeholder={form.country === 'US' ? 'ZIP (5 ou 9)' : 'CEP (8)'}
                name="zip"
                value={form.zip}
                onChange={(e) => {
                  const cleaned = cleanZip(e.target.value, (form.country || 'BR').toUpperCase());
                  setForm((prev) => ({ ...prev, zip: cleaned }));
                }}
              />
              <button
                type="button"
                onClick={handleFillByZip}
                className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
                disabled={loadingZip}
              >
                {loadingZip ? 'Buscando...' : 'Preencher pelo CEP'}
              </button>
            </div>
            {loadingZip && (
              <div className="mt-2 h-1 w-full overflow-hidden rounded bg-blue-100">
                <div className="h-full w-full animate-pulse bg-blue-500" />
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Dica: use “Preencher pelo CEP/ZIP” para localizar automaticamente.
            </p>
          </div>

          <div className="flex items-center justify-between my-2">
            <span className="text-sm text-gray-600">Detectar localização automática:</span>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={loadingLocation}
              className="bg-blue-600 text-white px-3 py-1 rounded"
            >
              {loadingLocation ? 'Detectando...' : 'Usar minha localização'}
            </button>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-2 gap-2">
            {/* País como SELECT com siglas */}
            <label className="flex flex-col">
              <span className="text-sm mb-1">Cidade</span>
              <input
                className="border p-2 rounded"
                placeholder="Localização do produto"
                name="city"
                value={form.city}
                onChange={handleChange}
              />
            </label>

            <label className="flex flex-col">
              <span className="text-sm mb-1">Estado/UF</span>
              <input
                className="border p-2 rounded"
                placeholder={form.country === 'US' ? 'Ex: CA' : 'Ex: SP'}
                name="state"
                value={form.state}
                onChange={handleChange}
              />
            </label>

            <input className="border p-2 rounded" placeholder="Bairro" name="neighborhood" value={form.neighborhood} onChange={handleChange} />
            <input className="border p-2 rounded" placeholder="Rua" name="street" value={form.street} onChange={handleChange} />
          </div>

          <div className="mt-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Detalhes do produto</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {categoryDetails.map((field) => (
                <label key={field.name} className="flex flex-col">
                  <span className="text-xs text-gray-600 mb-1">{field.label}</span>
                  <input
                    className="border p-2 rounded"
                    name={field.name}
                    placeholder={field.placeholder}
                    value={form[field.name]}
                    onChange={handleChange}
                    inputMode={field.inputMode}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Fotos do produto</h2>
              <span className="text-xs text-gray-500">{images.length}/{MAX_PRODUCT_PHOTOS}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {images.map((image) => (
                <div key={image.id} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                  <img src={image.preview} alt="Pré-visualização da foto" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(image.id)}
                    className="absolute top-1 right-1 rounded-full bg-black/70 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    remover
                  </button>
                </div>
              ))}
              {images.length < MAX_PRODUCT_PHOTOS && (
                <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 cursor-pointer hover:border-emerald-400 hover:text-emerald-600 transition bg-gray-50">
                  <span>Adicionar fotos</span>
                  <span className="mt-1 text-[10px] text-gray-400">Máx. {MAX_PRODUCT_PHOTOS} imagens</span>
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
              Use fotos reais, bem iluminadas e mostre detalhes importantes. Aceitamos até {MAX_PRODUCT_PHOTOS} imagens (5MB cada).
            </p>
          </div>

          <label>
            Descrição
            <textarea
              name="description"
              placeholder="Detalhes importantes, estado do produto, acessórios inclusos..."
              value={form.description}
              onChange={handleChange}
              rows={5}
            />
          </label>

          <footer className="new-product-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                resetImagePreviews();
                setForm(baseForm);
                setShowFieldErrors(false);
              }}
              disabled={sending}
            >
              Limpar
            </button>
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? 'Publicando...' : 'Publicar produto'}
            </button>
          </footer>
        </form>
      </div>
      {isOverlayVisible && (
        <div className="new-product-publish-overlay" role="status" aria-live="polite">
          <div className="new-product-publish-card">
            <p className="new-product-publish-card__title">{stageTitle}</p>
            <p
              key={stageDetail}
              className="new-product-publish-card__detail"
            >
              {stageDetail}
            </p>
            {(publishStage === 'uploading' && !hasUploadProgress) ||
            publishStage === 'processing' ? (
              <div className="new-product-publish-spinner" aria-hidden="true" />
            ) : null}
            <div
              className={`new-product-publish-progress ${
                publishStage === 'processing' ? 'is-processing' : ''
              }`}
            >
              <div
                className="new-product-publish-progress__fill"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
            {publishStage === 'processing' && (
              <>
                <div className="new-product-publish-progress--detail">
                  <div
                    className="new-product-publish-progress__fill--inner"
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
    </section>
  );
}

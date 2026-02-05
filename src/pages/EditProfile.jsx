// frontend/src/pages/EditProfile.jsx
// Página para atualizar dados pessoais e senha do usuário.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { COUNTRY_OPTIONS, normalizeCountryCode, getCountryLabel } from '../data/countries.js';
import {
  BASE_PHONE_COUNTRIES,
  DEFAULT_PHONE_COUNTRY_CODE,
  mergePhoneCountries,
  buildPhoneCountryIndex
} from '../data/phoneCountries.js';
import {
  onlyDigits,
  limitDigits,
  normalizeDialCode,
  normalizePhoneNumber,
  parsePhoneNumber,
  formatLocalWithExample
} from '../utils/phone.js';
import CloseBackButton from '../components/CloseBackButton.jsx';
import ImageViewerModal from '../components/ImageViewerModal.jsx';
import useImageViewer from '../hooks/useImageViewer.js';
// Compressão segura de imagem para no máximo ~2MB
const compressImageToMaxSize = (file, maxBytes = 2 * 1024 * 1024, minQuality = 0.4) =>
  new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error('Falha ao ler o arquivo de imagem.'));
      };

      reader.onload = () => {
        const img = new Image();

        img.onerror = () => {
          reject(new Error('Falha ao carregar a imagem.'));
        };

        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Contexto de canvas indisponível.'));
            return;
          }

          let width = img.width;
          let height = img.height;
          const maxDimension = 2000; // limite de segurança para dimensões muito grandes

          if (width > maxDimension || height > maxDimension) {
            const scale = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.9;

          const mimeType = file.type === 'image/png' ? 'image/jpeg' : file.type || 'image/jpeg';

          const attemptCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Falha ao gerar blob da imagem.'));
                  return;
                }

                // Se atingiu o tamanho desejado ou o limite mínimo de qualidade, retorna
                if (blob.size <= maxBytes || quality <= minQuality) {
                  const resultFile = new File([blob], file.name, {
                    type: mimeType,
                    lastModified: Date.now()
                  });
                  resolve(resultFile);
                  return;
                }

                // Reduz qualidade e tenta de novo
                quality -= 0.1;
                attemptCompress();
              },
              mimeType,
              quality
            );
          };

          attemptCompress();
        };

        img.src = reader.result;
      };

      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });

const FALLBACK_PHONE_MAX_DIGITS = 15;
const COMPANY_DEFAULT_CENTER = [-23.5505, -46.6333];
const ZIP_AUTO_DEBOUNCE_MS = 5000;

const cleanZip = (value, country = 'BR') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (country === 'BR') return digits.slice(0, 8);
  if (country === 'US') return digits.slice(0, 9);
  return digits.slice(0, 12);
};

const getCountryMaxLocalDigits = (country) => {
  if (!country) return FALLBACK_PHONE_MAX_DIGITS;
  const parsed = Number.parseInt(country.localMaxDigits ?? country.maxDigits, 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const exampleDigits = onlyDigits(country.example);
  if (exampleDigits.length) return exampleDigits.length;
  return FALLBACK_PHONE_MAX_DIGITS;
};

const getCountryExample = (country) => {
  if (country?.example) return country.example;
  const max = getCountryMaxLocalDigits(country);
  const exampleLength = Math.min(Math.max(max, 6), 11);
  return '9'.repeat(exampleLength) || '991234567';
};

const limitPhoneDigitsForCountry = (value, country) =>
  limitDigits(value, getCountryMaxLocalDigits(country));

export default function EditProfile() {
  const { token, user, login } = useContext(AuthContext);
  const loadedTokenRef = useRef(null);
  const initialFormState = useMemo(
    () => ({
      username: user?.username ?? '',
      phone: user?.phone ?? '',
      country: normalizeCountryCode(user?.country) ?? '',
      state: user?.state ?? '',
      city: user?.city ?? '',
      district: user?.district ?? '',
      street: user?.street ?? '',
      zip: user?.zip ?? '',
      company_name: user?.company_name ?? '',
      company_description: user?.company_description ?? '',
      company_address: user?.company_address ?? '',
      company_city: user?.company_city ?? '',
      company_state: user?.company_state ?? '',
      company_country: normalizeCountryCode(user?.company_country) ?? '',
      company_lat: user?.company_lat ?? '',
      company_lng: user?.company_lng ?? ''
    }),
    [user]
  );
  const [phoneCountries, setPhoneCountries] = useState(BASE_PHONE_COUNTRIES);
  const [selectedPhoneCountryCode, setSelectedPhoneCountryCode] = useState(
    normalizeCountryCode(user?.country) || DEFAULT_PHONE_COUNTRY_CODE
  );
  const [phoneLocalDigits, setPhoneLocalDigits] = useState('');
  const userSelectedPhoneCountryRef = useRef(false);
  const [form, setForm] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);
  const [companyLocating, setCompanyLocating] = useState(false);
  const [companyMapOpen, setCompanyMapOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [companySearchLoading, setCompanySearchLoading] = useState(false);
  const [companySearchResults, setCompanySearchResults] = useState([]);
  const [companyMapCenter, setCompanyMapCenter] = useState(() => {
    const lat = Number(initialFormState.company_lat);
    const lng = Number(initialFormState.company_lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : COMPANY_DEFAULT_CENTER;
  });
  const companyMapRef = useRef(null);
  const pendingCompanyCenterRef = useRef(null);
  const zipInputRef = useRef(null);
  const lastZipAutoFillRef = useRef({ zip: '', at: 0 });
  const focusCompanyMap = useCallback(
    (lat, lng, zoom = 16, animate = true) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const map = companyMapRef.current;
      if (map) {
        map.invalidateSize();
        setTimeout(() => {
          map.flyTo([lat, lng], zoom, { animate });
        }, 20);
      } else {
        pendingCompanyCenterRef.current = [lat, lng];
      }
    },
    []
  );
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.profile_image_url ?? '');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const avatarObjectUrlRef = useRef(null);
  const {
    isOpen: isAvatarViewerOpen,
    src: avatarViewerSrc,
    alt: avatarViewerAlt,
    openViewer: openAvatarViewer,
    closeViewer: closeAvatarViewer
  } = useImageViewer();
  const phoneCountryIndex = useMemo(() => buildPhoneCountryIndex(phoneCountries), [phoneCountries]);
  const sortedPhoneCountries = useMemo(
    () => [...phoneCountries].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [phoneCountries]
  );
  const selectedPhoneCountry =
    sortedPhoneCountries.find(
      (country) => normalizeCountryCode(country.code) === normalizeCountryCode(selectedPhoneCountryCode)
    ) ||
    phoneCountryIndex.byCode[DEFAULT_PHONE_COUNTRY_CODE] ||
    sortedPhoneCountries[0] ||
    null;
  const hasCompanyName = (form.company_name || '').trim().length > 0;
  const hasCompanyCoords = (() => {
    const latStr = String(form.company_lat ?? '').trim();
    const lngStr = String(form.company_lng ?? '').trim();
    if (!latStr || !lngStr) return false;
    const lat = Number(latStr);
    const lng = Number(lngStr);
    return Number.isFinite(lat) && Number.isFinite(lng);
  })();
  const shouldShowCompanyHint = hasCompanyName || hasCompanyCoords;
  const missingCompanyFields = [];
  if (!hasCompanyName) missingCompanyFields.push('Nome da empresa');
  if (!hasCompanyCoords) missingCompanyFields.push('Local da empresa');

  const applyInitialPhoneState = useCallback(
    (sourcePhone) => {
      userSelectedPhoneCountryRef.current = false;
      const parsed = parsePhoneNumber(sourcePhone ?? user?.phone ?? '', phoneCountries);
      const fallbackCountry =
        phoneCountries.find(
          (country) =>
            normalizeCountryCode(country.code) ===
            (normalizeCountryCode(initialFormState.country) || DEFAULT_PHONE_COUNTRY_CODE)
        ) ||
        phoneCountries.find((country) => normalizeCountryCode(country.code) === DEFAULT_PHONE_COUNTRY_CODE) ||
        phoneCountries[0] ||
        null;

      const countryToUse = parsed.matchedCountry || fallbackCountry;
      const dialToUse = countryToUse?.dialCode || parsed.dialCode || fallbackCountry?.dialCode || '';
      const limitedLocal = limitPhoneDigitsForCountry(parsed.localNumber, countryToUse);
      const nextCode = normalizeCountryCode(countryToUse?.code) || DEFAULT_PHONE_COUNTRY_CODE;

      setSelectedPhoneCountryCode(nextCode);
      setPhoneLocalDigits(limitedLocal);
      setForm((prev) => ({
        ...prev,
        phone: normalizePhoneNumber(dialToUse, limitedLocal)
      }));
    },
    [initialFormState.country, phoneCountries, user?.phone]
  );

  useEffect(() => {
    setForm(initialFormState);
    setAvatarFile(null);
    setRemoveAvatar(false);
    setAvatarPreview(user?.profile_image_url ?? '');
    applyInitialPhoneState(initialFormState.phone);
    const lat = Number(initialFormState.company_lat);
    const lng = Number(initialFormState.company_lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setCompanyMapCenter([lat, lng]);
    }
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
  }, [applyInitialPhoneState, initialFormState]);

  useEffect(() => {
    if (!token) {
      loadedTokenRef.current = null;
      return;
    }
    if (loadedTokenRef.current === token) return;
    loadedTokenRef.current = token;
    let isActive = true;
    api
      .get('/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!isActive) return;
        const profile = response.data?.data;
        if (profile) {
          login({ user: profile, token });
        }
      })
      .catch((error) => {
        if (!isActive) return;
        console.warn('Falha ao carregar perfil:', error);
      });
    return () => {
      isActive = false;
    };
  }, [login, token]);

  useEffect(
    () => () => {
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const normalized = normalizePhoneNumber(selectedPhoneCountry?.dialCode, phoneLocalDigits);
    setForm((prev) => (prev.phone === normalized ? prev : { ...prev, phone: normalized }));
  }, [phoneLocalDigits, selectedPhoneCountry?.dialCode]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const loadRemoteCountries = async () => {
      try {
        const response = await fetch('https://api-paises.pages.dev/paises.json', { signal: controller.signal });
        if (!response?.ok) return;
        const data = await response.json();
        const payload = Array.isArray(data) ? data : data?.paises || data?.countries || [];
        const merged = mergePhoneCountries(payload);
        if (active && Array.isArray(merged) && merged.length) {
          setPhoneCountries(merged);
        }
      } catch {
        // Mantém lista local silenciosamente
      }
    };
    loadRemoteCountries();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const controller = new AbortController();

    const applyDetectedCountry = (isoCode, dialCode) => {
      if (cancelled || userSelectedPhoneCountryRef.current) return;
      const normalizedIso = normalizeCountryCode(isoCode);
      const normalizedDial = normalizeDialCode(dialCode);
      let candidate = null;
      if (normalizedIso && phoneCountryIndex.byCode[normalizedIso]) {
        candidate = phoneCountryIndex.byCode[normalizedIso];
      }
      if (!candidate && normalizedDial) {
        const dialKey = normalizedDial.replace('+', '');
        candidate = phoneCountryIndex.byDial[dialKey] || null;
      }
      if (!candidate) return;
      setSelectedPhoneCountryCode(candidate.code);
      setPhoneLocalDigits((prev) => limitPhoneDigitsForCountry(prev, candidate));
    };

    const tryIpFallback = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        if (!res?.ok) return;
        const data = await res.json();
        applyDetectedCountry(data?.country, data?.country_calling_code || data?.calling_code);
      } catch {
        // ignora
      }
    };

    if (!navigator?.geolocation) {
      tryIpFallback();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled || userSelectedPhoneCountryRef.current) return;
        const { latitude, longitude } = position.coords || {};
        if (latitude == null || longitude == null) {
          await tryIpFallback();
          return;
        }
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`,
            { signal: controller.signal }
          );
          if (res?.ok) {
            const data = await res.json();
            applyDetectedCountry(data?.countryCode || data?.country_code, data?.callingCode || data?.countryCallingCode);
          } else {
            await tryIpFallback();
          }
        } catch {
          await tryIpFallback();
        }
      },
      async () => {
        await tryIpFallback();
      },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 5000 }
    );

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [phoneCountryIndex]);

  const handleCompanySearch = useCallback(
    async (query) => {
      const trimmed = query.trim();
      if (trimmed.length < 3) {
        setCompanySearchResults([]);
        return;
      }
      setCompanySearchLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
          trimmed
        )}&limit=5&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,en' } });
        const data = await res.json();
        if (Array.isArray(data)) {
          setCompanySearchResults(
            data.map((item) => ({
              label: item.display_name,
              lat: Number(item.lat),
              lng: Number(item.lon),
              address: item.address || {}
            }))
          );
        }
      } catch (err) {
        console.warn('Busca de endereço falhou', err);
        setCompanySearchResults([]);
      } finally {
        setCompanySearchLoading(false);
      }
    },
    []
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'phone') return;
    const isCountryField = name === 'country' || name === 'company_country';
    const nextValue = isCountryField ? normalizeCountryCode(value) : value;
    setForm({ ...form, [name]: nextValue });
  };

  const handleDetectLocation = async () => {
    if (loadingLocation) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocalização indisponível no dispositivo.');
      return;
    }
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords || {};
        try {
          const res = await api.get('/geo/reverse', { params: { lat: latitude, lng: longitude } });
          const geo = res.data?.data || {};
          setForm((prev) => ({
            ...prev,
            country: normalizeCountryCode(geo.country) || prev.country,
            state: geo.state || prev.state,
            city: geo.city || prev.city,
            district: geo.neighborhood || prev.district,
            street: geo.street || prev.street,
            zip: geo.zip || prev.zip
          }));
          toast.success('Localização detectada com sucesso.');
        } catch {
          toast.error('Erro ao consultar localização.');
        } finally {
          setLoadingLocation(false);
        }
      },
      () => {
        toast.error('Não foi possível obter sua localização.');
        setLoadingLocation(false);
      },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 7000 }
    );
  };

  const applyZipLookup = async ({ showSuccessToast = true, mode = 'auto' } = {}) => {
    if (loadingZip) return { success: false };
    const country = normalizeCountryCode(form.country) || 'BR';
    const cleaned = cleanZip(form.zip, country);
    const isAuto = mode === 'auto';
    if (!cleaned) {
      if (!isAuto) toast.error('Informe o CEP/ZIP.');
      return { success: false };
    }
    if (country === 'BR' && cleaned.length !== 8) {
      if (!isAuto) toast.error('CEP deve ter 8 dígitos.');
      return { success: false };
    }
    if (country === 'US' && !(cleaned.length === 5 || cleaned.length === 9)) {
      if (!isAuto) toast.error('ZIP deve ter 5 ou 9 dígitos.');
      return { success: false };
    }
    setLoadingZip(true);
    try {
      const { data } = await api.get('/geo/cep', { params: { country, zip: cleaned } });
      if (!data.success || !data.data) {
        if (!isAuto) toast.error('CEP/ZIP não encontrado.');
        return { success: false };
      }
      const a = data.data;
      const nextCountry = normalizeCountryCode(a.country) || country;
      const allowOverwrite = mode === 'manual';
      setForm((prev) => {
        if (allowOverwrite) {
          return {
            ...prev,
            country: nextCountry,
            state: a.state || '',
            city: a.city || '',
            district: a.neighborhood || '',
            street: a.street || '',
            zip: a.zip || cleaned
          };
        }
        return {
          ...prev,
          country: nextCountry || prev.country,
          state: prev.state || a.state || '',
          city: prev.city || a.city || '',
          district: prev.district || a.neighborhood || '',
          street: prev.street || a.street || '',
          zip: a.zip || cleaned
        };
      });
      if (showSuccessToast) {
        toast.success('Endereço preenchido pelo CEP.');
      }
      return { success: true };
    } catch (err) {
      console.error(err?.response?.data || err.message);
      if (!isAuto) toast.error('Erro ao consultar CEP.');
      return { success: false };
    } finally {
      setLoadingZip(false);
    }
  };

  const handleZipBlur = (event) => {
    if (event?.relatedTarget?.dataset?.zipAutofill === 'true') return;
    const country = normalizeCountryCode(form.country) || 'BR';
    const cleaned = cleanZip(form.zip, country);
    if (!cleaned) return;
    if (country === 'BR' && cleaned.length !== 8) return;
    if (country === 'US' && !(cleaned.length === 5 || cleaned.length === 9)) return;
    const now = Date.now();
    const last = lastZipAutoFillRef.current;
    if (last.zip === cleaned && now - last.at < ZIP_AUTO_DEBOUNCE_MS) return;
    lastZipAutoFillRef.current = { zip: cleaned, at: now };
    applyZipLookup({ showSuccessToast: true, mode: 'auto' });
  };

  const handlePhoneInput = (event) => {
    const limited = limitPhoneDigitsForCountry(event.target.value, selectedPhoneCountry);
    setPhoneLocalDigits(limited);
  };

  const handlePhoneCountryChange = (event) => {
    const nextCode = normalizeCountryCode(event.target.value);
    const countryCandidate =
      sortedPhoneCountries.find((country) => normalizeCountryCode(country.code) === nextCode) ||
      selectedPhoneCountry ||
      sortedPhoneCountries[0] ||
      null;
    userSelectedPhoneCountryRef.current = true;
    if (!countryCandidate) return;
    setSelectedPhoneCountryCode(countryCandidate.code);
    setPhoneLocalDigits((prev) => limitPhoneDigitsForCountry(prev, countryCandidate));
  };

  const applyCompanyLocation = useCallback(
    (lat, lng, extras = {}) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setCompanyMapCenter([lat, lng]);
      focusCompanyMap(lat, lng, 16, true);
      setForm((prev) => ({
        ...prev,
        company_lat: lat,
        company_lng: lng,
        company_city: extras.city || prev.company_city,
        company_state: extras.state || prev.company_state,
        company_country: normalizeCountryCode(extras.country) || prev.company_country,
        company_address: extras.address || prev.company_address
      }));
    },
    [focusCompanyMap]
  );

  const reverseGeocodeCompany = useCallback(
    async (lat, lng) => {
      try {
        const res = await api.get('/geo/reverse', { params: { lat, lng } });
        const geo = res.data?.data || {};
        applyCompanyLocation(lat, lng, {
          city: geo.city,
          state: geo.state,
          country: geo.country,
          address: geo.street
        });
      } catch (err) {
        console.warn('Falha no reverse geocode da empresa', err);
        applyCompanyLocation(lat, lng);
      }
    },
    [applyCompanyLocation]
  );

  // Configuração do marcador padrão do Leaflet (corrige assets em bundlers)
  useEffect(() => {
    const DefaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = DefaultIcon;
  }, []);

  // Aplica centro pendente quando o mapa já existe
  useEffect(() => {
    if (companyMapRef.current && pendingCompanyCenterRef.current) {
      companyMapRef.current.invalidateSize();
      setTimeout(() => {
        if (companyMapRef.current) {
          companyMapRef.current.flyTo(pendingCompanyCenterRef.current, 16, { animate: true });
        }
        pendingCompanyCenterRef.current = null;
      }, 20);
    }
  }, [companyMapCenter]);

  const handleReset = () => {
    userSelectedPhoneCountryRef.current = false;
    setForm(initialFormState);
    applyInitialPhoneState(initialFormState.phone);
    setAvatarFile(null);
    setRemoveAvatar(false);
    setAvatarPreview(user?.profile_image_url ?? '');
    setCompanyMapCenter(COMPANY_DEFAULT_CENTER);
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
  };

  const handleCompanyGeolocate = () => {
    if (companyLocating) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocalização indisponível no dispositivo.');
      return;
    }
    setCompanyLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords || {};
        await reverseGeocodeCompany(latitude, longitude);
        focusCompanyMap(latitude, longitude, 16, true);
        setCompanyLocating(false);
      },
      () => {
        toast.error('Não foi possível obter sua localização.');
        setCompanyLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 7000 }
    );
  };

  const handleClearCompanyLocation = () => {
    pendingCompanyCenterRef.current = null;
    setForm((prev) => ({
      ...prev,
      company_address: '',
      company_city: '',
      company_state: '',
      company_country: '',
      company_lat: '',
      company_lng: ''
    }));
    setCompanyMapCenter(COMPANY_DEFAULT_CENTER);
    if (companyMapRef.current) {
      companyMapRef.current.setView(COMPANY_DEFAULT_CENTER, 14, { animate: true });
      companyMapRef.current.invalidateSize();
    }
  };

  // Ao abrir modal do mapa: centralizar no ponto salvo ou geolocalizar primeiro
  useEffect(() => {
    if (!companyMapOpen) return;
    const map = companyMapRef.current;
    if (map) {
      map.invalidateSize();
    }
    if (form.company_lat && form.company_lng) {
      const lat = Number(form.company_lat);
      const lng = Number(form.company_lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        focusCompanyMap(lat, lng, 16, false);
        return;
      }
    }
    // se não há ponto salvo, tenta geolocalizar automaticamente
    handleCompanyGeolocate();
  }, [companyMapOpen, form.company_lat, form.company_lng, focusCompanyMap, handleCompanyGeolocate]);

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido.');
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    let processedFile = file;

    // Se a imagem for maior que 2MB, tenta comprimir automaticamente
    if (file.size > maxBytes) {
      try {
        processedFile = await compressImageToMaxSize(file, maxBytes);

        // Em caso extremo, se ainda ficar maior, falha de forma segura
        if (processedFile.size > maxBytes) {
          toast.error('Não foi possível reduzir a foto para 2MB. Tente usar uma imagem menor.');
          return;
        }
      } catch (error) {
        console.error(error);
        toast.error('Erro ao processar a imagem. Tente outra foto.');
        return;
      }
    }

    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(processedFile);
    avatarObjectUrlRef.current = objectUrl;
    setAvatarFile(processedFile);
    setAvatarPreview(objectUrl);
    setRemoveAvatar(false);
  };


  const handleRemoveAvatar = () => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
    setAvatarFile(null);
    setAvatarPreview('');
    setRemoveAvatar(true);
  };
  const avatarPreviewLabel = user?.username ? `Foto de ${user.username}` : 'Foto do perfil';
  const handleAvatarPreview = (event) => {
    if (!avatarPreview) return;
    if (event?.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    if (event?.preventDefault) event.preventDefault();
    openAvatarViewer(avatarPreview, avatarPreviewLabel);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (companyMapOpen) {
      toast.error('Feche o mapa antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      const normalizedPhone = normalizePhoneNumber(selectedPhoneCountry?.dialCode, phoneLocalDigits);
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'country' || key === 'company_country') {
          payload.append(key, normalizeCountryCode(value) || '');
        } else if (key === 'phone') {
          payload.append('phone', normalizedPhone || '');
        } else {
          payload.append(key, value ?? '');
        }
      });
      if (avatarFile) {
        payload.append('avatar', avatarFile);
      } else if (removeAvatar) {
        payload.append('removeAvatar', 'true');
      }
      const response = await api.put('/users/me', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const updatedUser = response.data?.data;
      if (updatedUser) {
        login({ user: updatedUser, token });
        setAvatarFile(null);
        setRemoveAvatar(false);
        setAvatarPreview(updatedUser.profile_image_url ?? '');
        if (avatarObjectUrlRef.current) {
          URL.revokeObjectURL(avatarObjectUrlRef.current);
          avatarObjectUrlRef.current = null;
        }
      }

      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar perfil. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const overlayLabel = 'Salvando perfil';

  return (
    <section className="edit-profile-page">
      <ImageViewerModal
        isOpen={isAvatarViewerOpen}
        src={avatarViewerSrc}
        alt={avatarViewerAlt}
        onClose={closeAvatarViewer}
      />
      <CloseBackButton />
      {saving && (
        <div
          className="edit-profile-page__overlay"
          role="status"
          aria-live="polite"
          aria-label={overlayLabel}
        >
          <span className="edit-profile-page__spinner" aria-hidden="true" />
          <span className="sr-only">{overlayLabel}</span>
        </div>
      )}
      <div className="edit-profile-card">
        <header className="edit-profile-header">
          <h1>Atualize seus dados</h1>
          <p>Personalize suas informações de contato para facilitar a negociação com outros usuários.</p>
        </header>

        <form onSubmit={handleSubmit} className="edit-profile-form">
          <section className="edit-profile-section">
            <section className="edit-profile-avatar">
              <div
                className="edit-profile-avatar__preview"
                role={avatarPreview ? 'button' : undefined}
                tabIndex={avatarPreview ? 0 : undefined}
                aria-label={avatarPreview ? 'Ver foto do perfil' : undefined}
                onClick={handleAvatarPreview}
                onKeyDown={handleAvatarPreview}
                style={avatarPreview ? { cursor: 'zoom-in' } : undefined}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Foto do perfil" />
                ) : (
                  <span className="edit-profile-avatar__placeholder">Sem foto</span>
                )}
              </div>
              <div className="edit-profile-avatar__actions">
                <label className="btn-secondary edit-profile-avatar__upload">
                  Trocar foto
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    disabled={saving}
                  />
                </label>
                {(avatarPreview || user?.profile_image_url) && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={handleRemoveAvatar}
                    disabled={saving}
                  >
                    Remover foto
                  </button>
                )}
                <p className="edit-profile-avatar__hint">Formatos JPG ou PNG até 2MB.</p>
              </div>
            </section>

            <label>
              Nome completo
              <input name="username" value={form.username} onChange={handleChange} placeholder="Seu nome" />
            </label>
          </section>

          <section className="edit-profile-section edit-profile-contact">
            <label>
              Telefone celular
              <div className="phone-input">
                <div className="phone-input__country">
                  <div className="phone-input__flag" aria-hidden="true">
                    {selectedPhoneCountry?.flagUrl ? (
                      <img
                        src={selectedPhoneCountry.flagUrl}
                        alt={`Bandeira de ${selectedPhoneCountry.name}`}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="phone-input__flag-fallback">
                        {selectedPhoneCountry?.dialCode || '+00'}
                      </span>
                    )}
                  </div>
                  <span className="phone-input__dial">{selectedPhoneCountry?.dialCode || '+00'}</span>
                  <span className="phone-input__chevron" aria-hidden="true">
                    ▾
                  </span>
                  <select
                    id="phone-country"
                    className="phone-input__select"
                    value={selectedPhoneCountry?.code || DEFAULT_PHONE_COUNTRY_CODE}
                    onChange={handlePhoneCountryChange}
                    aria-label="Selecione o país do telefone"
                  >
                    {sortedPhoneCountries.map((country) => (
                      <option key={`${country.code}-${country.dialCode}`} value={country.code}>
                        {country.name} {country.dialCode}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="phone-input__field"
                  inputMode="tel"
                  placeholder={getCountryExample(selectedPhoneCountry)}
                  maxLength={getCountryMaxLocalDigits(selectedPhoneCountry) + 8}
                  value={formatLocalWithExample(phoneLocalDigits, selectedPhoneCountry?.example)}
                  onInput={handlePhoneInput}
                  autoComplete="tel"
                />
              </div>
              <p className="phone-input__hint">
                Exemplo: {selectedPhoneCountry?.dialCode || ''} {getCountryExample(selectedPhoneCountry)}
              </p>
            </label>

            <div className="edit-profile-contact__row">
              <div className="edit-profile-contact__auto">
                <span className="edit-profile-contact__label">Localização automática</span>
                <button
                  type="button"
                  className="btn-primary edit-profile-btn--compact"
                  onClick={handleDetectLocation}
                  disabled={loadingLocation}
                >
                  {loadingLocation ? 'Detectando...' : 'Usar minha localização'}
                </button>
              </div>

              <label className="edit-profile-contact__zip">
                CEP
                <div className="edit-profile-zip-row">
                  <input
                    ref={zipInputRef}
                    name="zip"
                    className="edit-profile-zip-input"
                    value={form.zip}
                    onChange={(event) => {
                      const cleaned = cleanZip(event.target.value, normalizeCountryCode(form.country) || 'BR');
                      setForm((prev) => ({ ...prev, zip: cleaned }));
                    }}
                    onBlur={handleZipBlur}
                    placeholder="00000-000"
                  />
                  <button
                    type="button"
                    className="btn-primary edit-profile-btn--compact edit-profile-zip-btn"
                    onClick={() => applyZipLookup({ showSuccessToast: true, mode: 'manual' })}
                    disabled={loadingZip}
                    data-zip-autofill="true"
                  >
                    {loadingZip ? 'Buscando...' : 'Preencher pelo CEP'}
                  </button>
                </div>
              </label>
            </div>
          </section>

          <section className="edit-profile-section">
            <div className="edit-profile-grid">
              <label>
                País
                <select name="country" value={form.country} onChange={handleChange}>
                  <option value="">Selecione o país</option>
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {form.country && (
                  <p className="edit-profile-country__hint">
                    País selecionado: {getCountryLabel(form.country)}
                  </p>
                )}
              </label>
              <label>
                Estado
                <input name="state" value={form.state} onChange={handleChange} placeholder="São Paulo" />
              </label>
              <label>
                Cidade
                <input name="city" value={form.city} onChange={handleChange} placeholder="São Paulo" />
              </label>
            </div>

            <div className="edit-profile-grid">
              <label>
                Bairro
                <input name="district" value={form.district} onChange={handleChange} placeholder="Centro" />
              </label>
              <label>
                Rua
                <input name="street" value={form.street} onChange={handleChange} placeholder="Rua Principal" />
              </label>
            </div>
          </section>

          <section className="edit-profile-section edit-profile-section--company rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Minha empresa</p>
                <h3 className="text-base font-semibold text-slate-900">Dados públicos da loja</h3>
              </div>
            </div>
            {shouldShowCompanyHint && missingCompanyFields.length > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                Para exibir sua loja no perfil público, falta preencher: <strong>{missingCompanyFields.join(' e ')}</strong>.
              </p>
            )}

            <div className="edit-profile-grid">
              <label>
                Nome da empresa
                <input
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                  placeholder="Ex.: Loja Exemplo Ltda"
                />
              </label>
            </div>

            <label>
              Descrição (opcional)
              <textarea
                name="company_description"
                value={form.company_description}
                onChange={handleChange}
                placeholder="Resumo da empresa, serviços, horário de atendimento..."
                rows={3}
                className="edit-profile-textarea"
              />
            </label>

            <div className="space-y-1 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-semibold text-slate-900">Local da empresa</p>
                <button
                  type="button"
                  className="btn-primary text-[11px] px-3 py-1"
                  onClick={() => setCompanyMapOpen(true)}
                >
                  Selecionar no mapa
                </button>
              </div>
              <p className="text-slate-600 text-sm">
                {form.company_address || form.company_city || form.company_state || form.company_country
                  ? [form.company_address, form.company_city, form.company_state, getCountryLabel(form.company_country)]
                      .filter(Boolean)
                      .join(', ')
                  : 'Nenhum local definido. Clique em "Selecionar no mapa".'}
              </p>
              {form.company_lat && form.company_lng && (
                <>
                  <p className="text-xs text-slate-500">
                    {Number(form.company_lat).toFixed(5)}, {Number(form.company_lng).toFixed(5)}
                  </p>
                  <button
                    type="button"
                    className="btn-secondary text-[9px] px-1 py-0.25 rounded-sm mt-1 inline-flex items-center gap-1"
                    style={{ minWidth: '34px' }}
                    onClick={handleClearCompanyLocation}
                  >
                    Limpar
                  </button>
                </>
              )}
            </div>
          </section>

          <div className="edit-profile-actions">
            <button type="button" className="btn-secondary" onClick={handleReset} disabled={saving}>
              Restaurar dados
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>

      {companyMapOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-6"
            onClick={() => setCompanyMapOpen(false)}
          >
            <div
              className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Local da empresa</p>
                  <p className="text-sm font-semibold text-slate-900">
                    Clique no mapa ou pesquise um endereço para marcar.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-sky-700 hover:text-sky-800"
                    onClick={handleCompanyGeolocate}
                    disabled={companyLocating}
                  >
                    {companyLocating ? 'Localizando...' : 'Usar minha posição'}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    onClick={() => setCompanyMapOpen(false)}
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="p-3">
                <div className="company-map-search">
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      handleCompanySearch(e.target.value);
                    }}
                    placeholder="Buscar endereço, cidade, ponto de referência..."
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleCompanySearch(companySearch)}
                    disabled={companySearchLoading}
                  >
                    {companySearchLoading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                {companySearchResults.length > 0 && (
                  <div className="company-search-results mb-3">
                    {companySearchResults.map((item) => (
                      <button
                        key={`${item.lat}-${item.lng}-${item.label}`}
                        type="button"
                        onClick={() => {
                          setCompanySearchResults([]);
                          setCompanySearch(item.label);
                          setCompanyMapCenter([item.lat, item.lng]);
                          const addr = item.address || {};
                          applyCompanyLocation(item.lat, item.lng, {
                            city: addr.city || addr.town || addr.village || '',
                            state: addr.state || '',
                            country: addr.country_code ? addr.country_code.toUpperCase() : '',
                            address: item.label
                          });
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="h-[420px] rounded-xl overflow-hidden border border-slate-200 relative">
                  <button
                    type="button"
                    className="map-cancel-btn absolute right-3 bottom-3 px-3 py-1 text-xs"
                    onClick={() => {
                      pendingCompanyCenterRef.current = null;
                      setCompanyMapOpen(false);
                    }}
                  >
                    Confirmar Ponto
                  </button>
                  <MapContainer
                    center={companyMapCenter}
                    zoom={14}
                    style={{ height: '100%', width: '100%' }}
                    whenCreated={(map) => {
                      companyMapRef.current = map;
                      map.invalidateSize();
                      setTimeout(() => {
                        map.invalidateSize();
                        const target = pendingCompanyCenterRef.current || companyMapCenter;
                        if (Array.isArray(target)) {
                          map.flyTo(target, 16, { animate: true });
                          pendingCompanyCenterRef.current = null;
                        }
                      }, 50);
                    }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <CompanyMapClick
                      onClick={(lat, lng) => {
                        focusCompanyMap(lat, lng, 16, true);
                        reverseGeocodeCompany(lat, lng);
                      }}
                    />
                    <CompanyMapViewSync center={companyMapCenter} />
                    {Number.isFinite(Number(form.company_lat)) && Number.isFinite(Number(form.company_lng)) && (
                      <Marker position={[Number(form.company_lat), Number(form.company_lng)]}>
                        <Popup>Local da empresa</Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>

                <div className="mt-2 text-xs text-slate-600">
                  Ponto selecionado: {form.company_lat && form.company_lng
                    ? `${Number(form.company_lat).toFixed(5)}, ${Number(form.company_lng).toFixed(5)}`
                    : 'nenhum ponto marcado'}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}

function CompanyMapClick({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function CompanyMapViewSync({ center }) {
  const map = useMap();
  useEffect(() => {
    if (!Array.isArray(center)) return;
    if (!Number.isFinite(center[0]) || !Number.isFinite(center[1])) return;
    map.flyTo(center, 16, { animate: true });
    map.invalidateSize();
    setTimeout(() => map.invalidateSize(), 50);
  }, [center, map]);
  return null;
}

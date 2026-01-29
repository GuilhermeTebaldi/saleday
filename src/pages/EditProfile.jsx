// frontend/src/pages/EditProfile.jsx
// Página para atualizar dados pessoais e senha do usuário.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
      zip: user?.zip ?? ''
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'phone') return;
    const nextValue = name === 'country' ? normalizeCountryCode(value) : value;
    setForm({ ...form, [name]: nextValue });
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

  const handleReset = () => {
    userSelectedPhoneCountryRef.current = false;
    setForm(initialFormState);
    applyInitialPhoneState(initialFormState.phone);
    setAvatarFile(null);
    setRemoveAvatar(false);
    setAvatarPreview(user?.profile_image_url ?? '');
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
  };

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
    setSaving(true);
    try {
      const normalizedPhone = normalizePhoneNumber(selectedPhoneCountry?.dialCode, phoneLocalDigits);
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'country') {
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

          <div className="edit-profile-grid">
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
            <label>
              CEP
              <input name="zip" value={form.zip} onChange={handleChange} placeholder="00000-000" />
            </label>
          </div>

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
    </section>
  );
}

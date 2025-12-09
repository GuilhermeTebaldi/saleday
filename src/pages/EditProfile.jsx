// frontend/src/pages/EditProfile.jsx
// Página para atualizar dados pessoais e senha do usuário.
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { COUNTRY_OPTIONS, normalizeCountryCode, getCountryLabel } from '../data/countries.js';
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

export default function EditProfile() {
  const { token, user, login } = useContext(AuthContext);
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
  const [form, setForm] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.profile_image_url ?? '');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const avatarObjectUrlRef = useRef(null);

  useEffect(() => {
    setForm(initialFormState);
    setAvatarFile(null);
    setRemoveAvatar(false);
    setAvatarPreview(user?.profile_image_url ?? '');
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
  }, [initialFormState]);

  useEffect(
    () => () => {
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
      }
    },
    []
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'country' ? normalizeCountryCode(value) : value;
    setForm({ ...form, [name]: nextValue });
  };

  const handleReset = () => {
    setForm(initialFormState);
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'country') {
          payload.append(key, normalizeCountryCode(value) || '');
        } else {
          payload.append(key, value ?? '');
        }
      });
      if (avatarFile) {
        payload.append('avatar', avatarFile);
      } else if (removeAvatar) {
        payload.append('removeAvatar', 'true');
      }
      const response = await api.put('/auth/update', payload, {
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
            <div className="edit-profile-avatar__preview">
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
              Telefone
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
              />
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

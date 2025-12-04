// frontend/src/pages/EditProfile.jsx
// Página para atualizar dados pessoais e senha do usuário.
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { COUNTRY_OPTIONS, normalizeCountryCode, getCountryLabel } from '../data/countries.js';

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

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A foto deve ter no máximo 2MB.');
      return;
    }
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = objectUrl;
    setAvatarFile(file);
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

  return (
    <section className="edit-profile-page">
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

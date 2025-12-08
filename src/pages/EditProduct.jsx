// frontend/src/pages/EditProduct.jsx
// Página para edição completa de um anúncio existente.
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { toast } from 'react-hot-toast';

const MAX_PRODUCT_PHOTOS = 10;

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
  isFree: false,
  pickupOnly: false
};

const sanitizeYear = (value) => value.replace(/\D/g, '').slice(0, 4);

const collectExistingImages = (primary, list) => {
  const images = [];
  const append = (value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!images.includes(trimmed)) images.push(trimmed);
  };
  append(primary);
  if (Array.isArray(list)) {
    list.forEach(append);
  }
  return images;
};

export default function EditProduct() {
  const { id } = useParams();
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState(initialFormState);
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const previewsRef = useRef(new Set());
  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalImages = existingImages.length + newImages.length;
  const isActionLoading = isSubmitting || isDeleting;
  const overlayLabel = isSubmitting ? 'Salvando produto' : 'Excluindo produto';

  const cleanupPreviews = () => {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current.clear();
  };

  const resetUploads = () => {
    cleanupPreviews();
    setNewImages([]);
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
        const images = collectExistingImages(data.image_url, data.image_urls);
        const isFree = Boolean(data.is_free) || data.price === null || Number(data.price) === 0;
        setExistingImages(images);
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          price:
            isFree || data.price === null || data.price === undefined
              ? ''
              : String(data.price),
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

  const isValid = useMemo(
    () => form.title && (form.isFree || form.price),
    [form.title, form.isFree, form.price]
  );

  useEffect(() => {
    setForm((prev) => {
      if (!prev.isFree) return prev;
      if (prev.price === '' && prev.pickupOnly) return prev;
      return { ...prev, price: '', pickupOnly: true };
    });
  }, [form.isFree]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'year') {
      setForm((prev) => ({ ...prev, year: sanitizeYear(value) }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFreeToggle = (event) => {
    const { checked } = event.target;
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
          preview: previewUrl
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
    setExistingImages((prev) => prev.filter((imageUrl) => imageUrl !== url));
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

  const buildPayload = () => {
    const latNum = form.lat === '' ? null : Number(form.lat);
    const lngNum = form.lng === '' ? null : Number(form.lng);
    const lat = Number.isFinite(latNum) ? latNum : null;
    const lng = Number.isFinite(lngNum) ? lngNum : null;

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
      year: form.year?.trim() || null,
      is_free: form.isFree ? 'true' : 'false',
      pickup_only: form.pickupOnly ? 'true' : 'false'
    };

    if (!form.isFree && form.price) {
      payload.price = form.price;
    }

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
      toast.error('Informe um título e o valor ou marque como grátis.');
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
      newImages.forEach((image) => {
        formData.append('images', image.file);
      });

      await api.put(`/products/${id}`, formData);
      toast.success('Produto atualizado.');
      resetUploads();
      navigate('/my-products');
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
      toast.success('Produto excluído.');
      resetUploads();
      navigate('/my-products');
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
      <h2>Editar Produto</h2>
      <form onSubmit={handleSubmit} className="edit-product-form space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-600"
              checked={form.isFree}
              onChange={handleFreeToggle}
            />
            Modo grátis (Zona Free)
          </label>
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

        <input name="title" value={form.title} onChange={handleChange} placeholder="Título" required />

        <div className="flex flex-col gap-1">
          <input
            name="price"
            value={form.price}
            onChange={handleChange}
            placeholder="Preço"
            type="number"
            min="0"
            step="0.01"
            disabled={form.isFree}
            required={!form.isFree}
          />
          <span className="text-xs text-gray-500">
            {form.isFree ? 'Este anúncio será exibido como “Grátis”.' : 'Use ponto para separar os centavos (ex: 1999.99).'}
          </span>
        </div>

        <input name="category" value={form.category} onChange={handleChange} placeholder="Categoria" />
        <input name="brand" value={form.brand} onChange={handleChange} placeholder="Marca" />
        <input name="model" value={form.model} onChange={handleChange} placeholder="Modelo" />
        <input name="color" value={form.color} onChange={handleChange} placeholder="Cor" />
        <input
          name="year"
          value={form.year}
          onChange={handleChange}
          placeholder="Ano"
          inputMode="numeric"
        />
        <input name="city" value={form.city} onChange={handleChange} placeholder="Cidade" />

        <div className="flex items-center justify-between w-full">
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
        </div>

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
    </div>
  );
}

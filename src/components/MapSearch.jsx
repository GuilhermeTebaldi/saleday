// frontend/src/components/MapSearch.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Map as MapIcon, X } from 'lucide-react';
import api from '../api/api.js';
import { toast } from 'react-hot-toast';
import { getProductKey, mergeProductLists } from '../utils/productCollections.js';

const DEFAULT_CENTER = [-23.55, -46.63];
const DEFAULT_ZOOM = 12;
const normalizeQueryValue = (value) => (value || '').trim().toLowerCase();

const regionDisplay =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['pt-BR', 'en'], { type: 'region' })
    : null;

const buildLocationLabel = (geo) => {
  if (!geo) return '';
  const parts = [];
  if (geo.city) parts.push(geo.city);
  if (geo.state && geo.state !== geo.city) parts.push(geo.state);
  if (geo.country) {
    const countryName = regionDisplay?.of(geo.country) || geo.country;
    parts.push(countryName);
  }
  return parts.filter(Boolean).join(', ');
};

const hasValidCoords = (product) => {
  if (!product) return false;
  const lat = Number(product.lat ?? product.latitude ?? product.geo_lat);
  const lng = Number(product.lng ?? product.longitude ?? product.geo_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
};

const resolveBoundsLocation = async (bounds) => {
  if (!bounds) return null;
  const lat = (Number(bounds.minLat) + Number(bounds.maxLat)) / 2;
  const lng = (Number(bounds.minLng) + Number(bounds.maxLng)) / 2;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    const { data } = await api.get('/geo/reverse', { params: { lat, lng } });
    if (!data.success || !data.data) return null;
    const { city, state, country } = data.data;
    return {
      city,
      state,
      country: (country || '').toUpperCase(),
      label: buildLocationLabel(data.data)
    };
  } catch (err) {
    console.error('reverse geocode failed', err);
    return null;
  }
};

function MapEvents({ onBoundsChange, onViewportChange }) {
  useMapEvents({
    moveend(e) {
      const map = e.target;
      const b = map.getBounds();
      onBoundsChange({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      });
      if (typeof onViewportChange === 'function') {
        const center = map.getCenter();
        onViewportChange({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
      }
    },
    zoomend(e) {
      const map = e.target;
      if (typeof onViewportChange === 'function') {
        const center = map.getCenter();
        onViewportChange({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
      }
    }
  });
  return null;
}

export default function MapSearch({
  onProductsLoaded,
  onRegionApplied,
  resetSignal,
  onRegisterOpenMap,
  initialCenter,
  initialZoom,
  onLocateUser
}) {
  const [showMap, setShowMap] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(initialZoom ?? DEFAULT_ZOOM);
  const [mapCenter, setMapCenter] = useState(() =>
    initialCenter ? [initialCenter.lat, initialCenter.lng] : DEFAULT_CENTER
  );
  const [bbox, setBbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geoRequested, setGeoRequested] = useState(false);
  const mapRef = useRef(null);
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const [locationQuery, setLocationQuery] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);
  const pendingCenterRef = useRef(null);
  const applyBoundsFromPoint = useCallback((lat, lng, delta = 0.05) => {
    setBbox({
      minLat: lat - delta,
      maxLat: lat + delta,
      minLng: lng - delta,
      maxLng: lng + delta
    });
  }, []);

  const buildBoundsFromMap = useCallback((mapInstance) => {
    if (!mapInstance) return null;
    const b = mapInstance.getBounds?.();
    if (b) {
      return {
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      };
    }
    const c = mapInstance.getCenter?.();
    if (c) {
      const range = 0.05;
      return {
        minLat: c.lat - range,
        maxLat: c.lat + range,
        minLng: c.lng - range,
        maxLng: c.lng + range,
      };
    }
    return null;
  }, []);

  const closeModal = useCallback(() => {
    setMapReady(false);
    setShowMap(false);
  }, []);
  const openModal = useCallback(() => setShowMap(true), []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') closeModal();
    }
    if (showMap) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showMap, closeModal]);

  useEffect(() => {
    if (!showMap || typeof document === 'undefined') return undefined;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [showMap]);

  useEffect(() => {
    if (resetSignal === undefined) return;
    setBbox(null);
  }, [resetSignal]);

  useEffect(() => {
    if (typeof initialZoom === 'number') {
      setMapZoom(initialZoom);
    }
  }, [initialZoom]);

  useEffect(() => {
    if (!initialCenter) return;
    setMapCenter([initialCenter.lat, initialCenter.lng]);
  }, [initialCenter]);

  useEffect(() => {
    if (!showMap || !mapRef.current) return;
    mapRef.current.setView(mapCenter, mapZoom);
  }, [showMap, mapCenter, mapZoom]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const payload = pendingCenterRef.current;
    if (!payload) return;
    pendingCenterRef.current = null;
    mapRef.current.setView(payload.center, payload.zoom ?? mapZoom ?? DEFAULT_ZOOM);
  }, [mapReady, mapZoom]);

  const searchLocation = useCallback(
    async (rawQuery, { showSuccessToast = false, showErrors = true, updateInput = false } = {}) => {
      const trimmed = rawQuery?.trim();
      if (!trimmed) {
        if (showErrors) {
          toast.error('Digite um endereço ou cidade para localizar.');
        }
        return false;
      }
      try {
        const { data } = await api.get('/geo/forward', { params: { q: trimmed } });
        if (!data.success || !data.data) {
          if (showErrors) toast.error('Local não encontrado.');
          return false;
        }
        const { lat, lng } = data.data;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          if (showErrors) toast.error('Coordenadas inválidas.');
          return false;
        }
        const center = [lat, lng];
        setMapCenter(center);
        const zoomTarget = Number.isFinite(mapZoom) ? mapZoom : DEFAULT_ZOOM;
        pendingCenterRef.current = { center, zoom: zoomTarget };
        if (mapReady && mapRef.current) {
          mapRef.current.setView(center, zoomTarget);
          pendingCenterRef.current = null;
        }
        const delta = Math.max(0.02, zoomTarget * 0.003);
        const bounds = {
          minLat: lat - delta,
          maxLat: lat + delta,
          minLng: lng - delta,
          maxLng: lng + delta
        };
        applyBoundsFromPoint(lat, lng, delta);
        await fetchProductsByBbox(bounds, { keepExisting: false });
        const formattedLabel = buildLocationLabel(data.data);
        if (updateInput && formattedLabel) {
          setLocationQuery(formattedLabel);
        }
        if (showSuccessToast) {
          toast.success('Localização aplicada no mapa.');
        }
        return true;
      } catch (err) {
        console.error(err);
        if (showErrors) {
          toast.error('Erro ao buscar localização.');
        }
        return false;
      }
    },
    [mapZoom, applyBoundsFromPoint, mapReady, fetchProductsByBbox]
  );

  const handleLocationSearch = useCallback(async () => {
    setSearchingLocation(true);
    try {
      await searchLocation(locationQuery, {
        showSuccessToast: true,
        updateInput: true
      });
    } finally {
      setSearchingLocation(false);
    }
  }, [locationQuery, searchLocation]);

  const handleViewportChange = useCallback(
    ({ lat, lng, zoom }) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setMapCenter([lat, lng]);
      if (Number.isFinite(zoom)) {
        setMapZoom(zoom);
      }
      if (typeof onLocateUser === 'function') {
        onLocateUser({ lat, lng, zoom: Number.isFinite(zoom) ? zoom : undefined });
      }
    },
    [onLocateUser]
  );

  useEffect(() => {
    if (!showMap || geoRequested) return;
    if (initialCenter) return;
    if (!navigator.geolocation) return;
    setGeoRequested(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setMapCenter([lat, lng]);
          if (typeof onLocateUser === 'function') {
            onLocateUser({ lat, lng });
          }
        }
      },
      () => {},
      { timeout: 8000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false }
    );
  }, [showMap, geoRequested, initialCenter, onLocateUser]);

  async function fetchProductsByBbox(bounds, { keepExisting = true } = {}) {
    setLoading(true);
    const locationPromise = resolveBoundsLocation(bounds);
    try {
      const params = {
        minLat: bounds?.minLat,
        maxLat: bounds?.maxLat,
        minLng: bounds?.minLng,
        maxLng: bounds?.maxLng,
        sort: 'rank'
      };
      const { data } = await api.get('/products', { params });
      if (!data.success) {
        toast.error('Nenhum produto encontrado.');
        return;
      }

      const regionProducts = Array.isArray(data?.data) ? data.data.slice() : [];
      const priorityKeys = regionProducts.map(getProductKey).filter(Boolean);
      let nextList = regionProducts;
      const locationInfo = await locationPromise;

      let countryProducts = [];
      if (locationInfo?.country) {
        try {
          const fallback = await api.get('/products', {
            params: { sort: 'rank', country: locationInfo.country }
          });
          if (fallback.data?.success) {
            countryProducts = Array.isArray(fallback.data.data) ? fallback.data.data : [];
            if (nextList.length === 0 && countryProducts.length) {
              nextList = countryProducts;
            } else {
              const missingCoords = countryProducts.filter((item) => !hasValidCoords(item));
              if (missingCoords.length) {
                nextList = mergeProductLists(nextList, missingCoords);
              }
            }
          }
        } catch (fallbackErr) {
          console.error('fallback country fetch failed', fallbackErr);
        }
      }

      onProductsLoaded?.(nextList, { keepExisting, priorityKeys });
      if (bounds?.minLat != null) toast.success('Produtos atualizados para a região selecionada.');
      const mapInstance = mapRef.current;
      const centerPoint = mapInstance?.getCenter?.();
      const zoomLevel = mapInstance?.getZoom?.();
      const applied = {
        bounds,
        label: locationInfo?.label || 'Região selecionada no mapa',
        country: locationInfo?.country || '',
        center: centerPoint
          ? {
              lat: Number(centerPoint.lat),
              lng: Number(centerPoint.lng),
              zoom: Number.isFinite(zoomLevel) ? zoomLevel : null
            }
          : null
      };
      onRegionApplied?.(applied);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmRegion() {
    let selectedBounds = bbox;

    if (!selectedBounds && mapRef.current) {
      selectedBounds = buildBoundsFromMap(mapRef.current);
      if (selectedBounds) setBbox(selectedBounds);
    }

    if (!selectedBounds) return toast.error('Selecione uma região no mapa.');
    fetchProductsByBbox(selectedBounds);
    closeModal();
  }

  useEffect(() => {
    function openFromBar() {
      openModal();
    }
    window.addEventListener('saleday:open-map', openFromBar);
    return () => window.removeEventListener('saleday:open-map', openFromBar);
  }, [openModal]);

  useEffect(() => {
    if (typeof onRegisterOpenMap === 'function') {
      onRegisterOpenMap(() => {
        openModal();
        return true;
      });
      return () => onRegisterOpenMap(null);
    }
    return undefined;
  }, [onRegisterOpenMap, openModal]);

  // Ao abrir o modal, espere o mapa hidratar e garante um bbox inicial mesmo que o usuário não mova.
  useEffect(() => {
    if (!showMap) return;
    const t = setTimeout(() => {
      if (!mapRef.current) return;
      const initial = buildBoundsFromMap(mapRef.current);
      if (initial) setBbox(initial);
    }, 250);
    return () => clearTimeout(t);
  }, [showMap, buildBoundsFromMap]);

  return (
    <div className="flex items-center">
      {portalTarget &&
        // Render modal outside local layout so transforms on ancestors do not clip the overlay
        createPortal(
          <AnimatePresence>
            {showMap && (
              <motion.div
                className="fixed inset-0"
                style={{ zIndex: 8000 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-black/60" onClick={closeModal} />

                <motion.div
                  className="relative h-full w-full bg-white shadow-2xl overflow-hidden"
                  initial={{ scale: 0.98, y: 8 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.98, y: 8 }}
                >
                  <div className="flex h-full flex-col">
                    <div className="flex flex-col gap-3 px-4 py-3 border-b bg-white/95 backdrop-blur">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white">
                          <MapIcon size={16} />
                        </span>
                        <h3 className="font-semibold text-sm">Selecione a região no mapa</h3>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            value={locationQuery}
                            onChange={(e) => setLocationQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                            placeholder="Buscar cidade ou endereço"
                            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={handleLocationSearch}
                            disabled={searchingLocation}
                            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-60"
                          >
                            {searchingLocation ? 'Buscando...' : 'Ir'}
                          </button>
                        </div>
                        <button
                          onClick={closeModal}
                          aria-label="Fechar"
                          className="p-2 rounded hover:bg-gray-100"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="relative flex-1 min-h-0">
                      <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%', zIndex: 0 }}
                        whenCreated={(map) => {
                          mapRef.current = map;
                          map.whenReady(() => {
                            setMapReady(true);
                            const initial = buildBoundsFromMap(map);
                            if (initial) setBbox(initial);
                          });
                        }}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapEvents onBoundsChange={setBbox} onViewportChange={handleViewportChange} />
                      </MapContainer>

                      {/* sobreposição com círculo amarelo */}
                      <div
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        style={{ zIndex: 999 }}
                      >
                        <div className="relative flex items-center justify-center">
                          <div
                            className="rounded-full"
                            style={{
                              width: '240px',
                              height: '240px',
                              backgroundColor: 'rgba(255, 223, 0, 0.25)',
                              border: '2px solid rgba(255, 215, 0, 0.7)',
                              boxShadow: '0 0 15px rgba(255, 200, 0, 0.4)',
                            }}
                          />
                          <div className="absolute">
                            <div className="w-4 h-4 rounded-full border-2 border-blue-600 bg-white shadow" />
                            <span className="absolute inset-0 rounded-full animate-ping border-2 border-blue-300" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 border-t bg-white/95 backdrop-blur flex justify-end gap-2">
                      <button
                        onClick={closeModal}
                        className="px-3 py-1.5 rounded border hover:bg-gray-50"
                        type="button"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmRegion}
                        disabled={loading}
                        className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        type="button"
                      >
                        {loading ? 'Carregando...' : 'Confirmar região'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}
    </div>
  );
}

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

  async function fetchProductsByBbox(bounds) {
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

      if (locationInfo?.country) {
        try {
          const fallback = await api.get('/products', {
            params: { sort: 'rank', country: locationInfo.country }
          });
          if (fallback.data?.success) {
            const missingCoords = (fallback.data.data ?? []).filter((item) => !hasValidCoords(item));
            if (missingCoords.length) {
              nextList = mergeProductLists(nextList, missingCoords);
            }
          }
        } catch (fallbackErr) {
          console.error('fallback country fetch failed', fallbackErr);
        }
      }

      onProductsLoaded?.(nextList, { keepExisting: true, priorityKeys });
      if (bounds?.minLat != null) toast.success('Produtos atualizados para a região selecionada.');
      const applied = {
        bounds,
        label: locationInfo?.label || 'Região selecionada no mapa',
        country: locationInfo?.country || ''
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
                className="fixed inset-0 z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-black/60" onClick={closeModal} />

                <motion.div
                  className="relative mx-auto mt-[6vh] w-[92%] max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden"
                  initial={{ scale: 0.95, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 10 }}
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white">
                        <MapIcon size={16} />
                      </span>
                      <h3 className="font-semibold text-sm">Selecione a região no mapa</h3>
                    </div>
                    <button
                      onClick={closeModal}
                      aria-label="Fechar"
                      className="p-2 rounded hover:bg-gray-100"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="relative h-[420px]">
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
                            width: '200px',
                            height: '200px',
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

                  <div className="p-3 border-t flex justify-end gap-2">
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
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}
    </div>
  );
}

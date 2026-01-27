import { useCallback, useEffect, useRef, useState } from 'react';
import { IMAGE_KIND, IMAGE_KIND_BADGE_LABEL } from '../utils/imageKinds.js';
import { IMG_PLACEHOLDER } from '../utils/placeholders.js';

export default function ProductImageGallery({
  images = [],
  imageKinds = [],
  alt = '',
  productId,
  galleryKey
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const pointerStartX = useRef(null);
  const clickBlocked = useRef(false);

  const imageSources = images.length ? images : [IMG_PLACEHOLDER];
  const totalImages = imageSources.length;
  const currentImage = imageSources[currentIndex] ?? IMG_PLACEHOLDER;
  const currentKind = imageKinds[currentIndex] ?? null;

  useEffect(() => {
    setCurrentIndex(0);
  }, [productId, galleryKey]);

  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, totalImages - 1));
  }, [totalImages]);

  const wrapIndex = useCallback(
    (value) => {
      if (!totalImages) return 0;
      const next = value % totalImages;
      return next < 0 ? next + totalImages : next;
    },
    [totalImages]
  );

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => wrapIndex(prev + 1));
  }, [wrapIndex]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => wrapIndex(prev - 1));
  }, [wrapIndex]);

  const captureStart = useCallback((clientX) => {
    if (clientX === null || clientX === undefined) return;
    pointerStartX.current = clientX;
  }, []);

  const handleSwipeEnd = useCallback(
    (clientX) => {
      if (pointerStartX.current === null || clientX === null || clientX === undefined) {
        return;
      }
      const delta = clientX - pointerStartX.current;
      pointerStartX.current = null;
      if (Math.abs(delta) < 25) return;
      clickBlocked.current = true;
      if (delta < 0) {
        goNext();
      } else {
        goPrev();
      }
    },
    [goNext, goPrev]
  );

  const handlePointerDown = useCallback(
    (event) => {
      if (event?.pointerType === 'mouse' || event?.pointerType === 'pen') {
        event.preventDefault();
      }
      captureStart(event.clientX);
    },
    [captureStart]
  );

  const handlePointerUp = useCallback(
    (event) => {
      handleSwipeEnd(event.clientX);
    },
    [handleSwipeEnd]
  );

  const handleTouchStart = useCallback(
    (event) => {
      const touch = event.touches?.[0];
      if (touch) {
        captureStart(touch.clientX);
      }
    },
    [captureStart]
  );

  const handleTouchEnd = useCallback(
    (event) => {
      const touch = event.changedTouches?.[0];
      if (touch) {
        handleSwipeEnd(touch.clientX);
      }
    },
    [handleSwipeEnd]
  );

  const handlePointerLeave = useCallback(() => {
    pointerStartX.current = null;
  }, []);

  const handleClick = useCallback((event) => {
    if (!clickBlocked.current) return;
    event.preventDefault();
    event.stopPropagation();
    clickBlocked.current = false;
  }, []);

  return (
    <div
      className="home-card__media-gallery prevent-drag"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <div
        key={currentImage}
        role="img"
        aria-label={alt || 'Foto do anúncio'}
        className="home-card__image w-full h-full object-cover home-card__image-bg"
        style={{
          backgroundImage: `url(${JSON.stringify(currentImage)})`
        }}
      />
      {currentKind === IMAGE_KIND.ILLUSTRATIVE && (
        <span className="home-card__illustrative-badge">
          {IMAGE_KIND_BADGE_LABEL}
        </span>
      )}

      {totalImages > 1 && (
        <>
          <button
            type="button"
            className="home-card__media-arrow home-card__media-arrow--left"
            aria-label="Foto anterior"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goPrev();
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="home-card__media-arrow home-card__media-arrow--right"
            aria-label="Próxima foto"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goNext();
            }}
          >
            ›
          </button>
          <div className="home-card__media-indicator" aria-hidden="true">
            {imageSources.map((_, index) => (
              <span
                key={index}
                className={`home-card__media-indicator-dot ${
                  index === currentIndex ? 'is-active' : ''
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

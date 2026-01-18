import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X as CloseIcon } from 'lucide-react';

export default function ImageViewerModal({
  isOpen,
  src,
  alt = 'Imagem',
  onClose,
  zIndex = 8000
}) {
  const portalRoot = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const node = document.createElement('div');
    node.setAttribute('data-templesale-image-viewer', 'true');
    return node;
  }, []);

  const canRender = Boolean(isOpen && src && portalRoot);

  useEffect(() => {
    if (!portalRoot || typeof document === 'undefined') return undefined;
    document.body.appendChild(portalRoot);
    return () => {
      if (portalRoot.parentNode) {
        portalRoot.parentNode.removeChild(portalRoot);
      }
    };
  }, [portalRoot]);

  useEffect(() => {
    if (!canRender) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [canRender, onClose]);

  useEffect(() => {
    if (!canRender || typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [canRender]);

  if (!canRender) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black/95 backdrop-blur-sm"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label="Visualizar imagem"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Fechar"
          title="Fechar"
          className="fixed z-[60] rounded-full border border-red-300 bg-red-600 p-3 text-white shadow-lg transition hover:bg-red-500 focus-visible:outline-none focus-visible:ring focus-visible:ring-red-200"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
            right: 'calc(env(safe-area-inset-right, 0px) + 1rem)'
          }}
          onClick={(event) => {
            event.stopPropagation();
            onClose?.();
          }}
        >
          <CloseIcon size={26} />
        </button>

        <img src={src} alt={alt} className="z-10 max-h-full max-w-full object-contain" />
      </div>
    </div>,
    portalRoot
  );
}

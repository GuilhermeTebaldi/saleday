import { useRef } from 'react';
import { Menu } from 'lucide-react';

export default function OwnerProductMenu({
  onDelete,
  disabled = false,
  className = '',
  confirmMessage = 'Deseja realmente excluir este anúncio?',
  panelPlacement = 'bottom',
  panelAlign = 'right'
}) {
  const detailsRef = useRef(null);
  const rootClass = [
    className?.includes('absolute') ? '' : 'relative',
    className
  ]
    .filter(Boolean)
    .join(' ');
  const panelPositionClass =
    panelPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
  const panelAlignClass = panelAlign === 'left' ? 'left-0' : 'right-0';

  const handleToggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!detailsRef.current) return;
    detailsRef.current.open = !detailsRef.current.open;
  };

  const handleSummaryKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleToggle(event);
      return;
    }
    event.stopPropagation();
  };

  const handleDeleteClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    if (typeof window !== 'undefined') {
      const confirmDelete = window.confirm(confirmMessage);
      if (!confirmDelete) return;
    }
    try {
      const result = onDelete?.();
      if (result && typeof result.then === 'function') {
        await result;
      }
    } finally {
      if (detailsRef.current) {
        detailsRef.current.removeAttribute('open');
      }
    }
  };

  return (
    <details ref={detailsRef} className={rootClass}>
      <summary
        className="list-none inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
        aria-label="Configurações do anúncio"
        title="Configurações"
        onClick={handleToggle}
        onKeyDown={handleSummaryKeyDown}
      >
        <Menu size={16} />
      </summary>
      <div
        className={`absolute ${panelAlignClass} ${panelPositionClass} w-48 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-lg z-40`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Excluir anúncio
        </button>
      </div>
    </details>
  );
}

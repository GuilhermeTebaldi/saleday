import { useRef, useState } from 'react';
import { Menu } from 'lucide-react';

export default function OwnerProductMenu({
  onDelete,
  onEdit,
  disabled = false,
  className = '',
  editLabel = 'Editar anúncio',
  confirmMessage = 'Deseja realmente excluir este anúncio?',
  panelPlacement = 'bottom',
  panelAlign = 'right'
}) {
  const detailsRef = useRef(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasEditAction = typeof onEdit === 'function';
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
    setConfirmingDelete(false);
    detailsRef.current.open = !detailsRef.current.open;
  };

  const handleSummaryKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleToggle(event);
      return;
    }
    event.stopPropagation();
  };

  const closeMenu = () => {
    if (detailsRef.current) {
      detailsRef.current.removeAttribute('open');
    }
    setConfirmingDelete(false);
  };

  const handleEditClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    try {
      const result = onEdit?.();
      if (result && typeof result.then === 'function') {
        await result;
      }
    } finally {
      closeMenu();
    }
  };

  const handleDeleteRequest = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    setConfirmingDelete(true);
  };

  const handleDeleteConfirm = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    try {
      const result = onDelete?.();
      if (result && typeof result.then === 'function') {
        await result;
      }
    } finally {
      closeMenu();
    }
  };

  const handleDeleteCancel = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setConfirmingDelete(false);
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
        {confirmingDelete ? (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
            <p className="font-semibold">Confirmar exclusão?</p>
            <p className="mt-1 text-rose-600/90">{confirmMessage}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleDeleteCancel}
                disabled={disabled}
                className="flex-1 rounded-md border border-rose-100 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={disabled}
                className="flex-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Excluir
              </button>
            </div>
          </div>
        ) : (
          <>
            {hasEditAction && (
              <button
                type="button"
                onClick={handleEditClick}
                disabled={disabled}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editLabel}
              </button>
            )}
            <button
              type="button"
              onClick={handleDeleteRequest}
              disabled={disabled}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Excluir anúncio
            </button>
          </>
        )}
      </div>
    </details>
  );
}

import { clearBanReason } from '../utils/banNotice.js';

export default function BanBanner({ message }) {
  if (!message) return null;

  return (
    <div className="relative z-50 w-full bg-rose-900/95 border-b border-rose-500/60 px-4 py-3 text-rose-50 shadow-lg shadow-black/50">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-rose-200">Conta banida</p>
          <p className="mt-1 text-sm font-semibold leading-snug">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => clearBanReason()}
          className="self-start rounded-full border border-rose-500/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-100 transition hover:bg-rose-500/20"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

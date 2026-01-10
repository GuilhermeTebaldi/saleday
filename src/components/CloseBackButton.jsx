import useReturnNavigation from '../hooks/useReturnNavigation.js';

export default function CloseBackButton({ className = '', ...props }) {
  const handleGoBack = useReturnNavigation();

  return (
    <button
      type="button"
      onClick={handleGoBack}
      className={`fixed left-40 top-[calc(var(--home-header-height,64px)+0.35rem)] z-40 inline-flex items-center justify-center rounded-full border border-slate-400 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-700 shadow-xl shadow-slate-400/60 transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring focus-visible:ring-slate-300 ${className}`}
      aria-label="Voltar para a página anterior"
      {...props}
    >
      Voltar
    </button>
  );
}

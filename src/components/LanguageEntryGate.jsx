import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LocaleContext } from '../context/LocaleContext.jsx';
import { ENTRY_LOCALE_OPTIONS } from '../i18n/localeOptions.js';

const LOCALE_STORAGE_KEY = 'templesale.locale';
const PROMPT_STORAGE_KEY = 'templesale.locale.pre-entry.seen';

const readStorageValue = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorageValue = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
};

const shouldSkipPath = (pathname = '') => String(pathname).startsWith('/admin');

export default function LanguageEntryGate({ enabled = true }) {
  const { locale, setLocale } = useContext(LocaleContext);
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const activeLocaleLabel = useMemo(() => {
    return ENTRY_LOCALE_OPTIONS.find((option) => option.value === locale)?.label || 'idioma atual';
  }, [locale]);

  const closePrompt = useCallback(() => {
    writeStorageValue(PROMPT_STORAGE_KEY, '1');
    setIsOpen(false);
  }, []);

  const chooseLocale = useCallback(
    (nextLocale) => {
      setLocale(nextLocale);
      closePrompt();
    },
    [closePrompt, setLocale]
  );

  useEffect(() => {
    if (!enabled || shouldSkipPath(location.pathname)) {
      setIsOpen(false);
      return;
    }
    const hasSeenPrompt = readStorageValue(PROMPT_STORAGE_KEY) === '1';
    const savedLocale = readStorageValue(LOCALE_STORAGE_KEY);
    setIsOpen(!hasSeenPrompt && !savedLocale);
  }, [enabled, location.pathname]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_35px_80px_-35px_rgba(2,6,23,0.65)] sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-label="Seleção inicial de idioma"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          Bem-vindo ao TempleSale
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
          Escolha seu idioma
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Antes de entrar, selecione o idioma principal. Você pode alterar depois no seu painel.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {ENTRY_LOCALE_OPTIONS.map((option) => {
            const isActive = option.value === locale;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => chooseLocale(option.value)}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-2xl" aria-hidden="true">
                  {option.flag}
                </span>
                <span className="flex-1 px-3 text-sm font-semibold">{option.label}</span>
                {isActive && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Atual</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={closePrompt}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Continuar com {activeLocaleLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

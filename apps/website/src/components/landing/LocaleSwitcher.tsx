import { useEffect, useRef, useState } from 'react';

interface Props {
  locale: string;
}

const locales = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'pt', label: 'PT' },
  { code: 'ja', label: 'JA' },
  { code: 'ko', label: 'KO' },
  { code: 'zh', label: 'ZH' },
  { code: 'it', label: 'IT' },
  { code: 'ru', label: 'RU' },
];

export default function LocaleSwitcher({ locale }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape. Only attach listeners while open.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-[#9b9b97] hover:text-[#e5e5e3] transition-colors px-2 py-1 rounded border border-white/6"
      >
        {locale.toUpperCase()}
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 bg-[#161615] border border-white/6 rounded-lg shadow-xl py-1 min-w-[80px] z-50"
        >
          {locales.map((l) => (
            <a
              key={l.code}
              href={l.code === 'en' ? '/' : `/${l.code}/`}
              role="option"
              aria-selected={l.code === locale}
              className={`block px-3 py-1.5 text-sm transition-colors ${
                l.code === locale
                  ? 'text-accent-400 bg-accent-950/50'
                  : 'text-[#9b9b97] hover:text-[#e5e5e3] hover:bg-white/4'
              }`}
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

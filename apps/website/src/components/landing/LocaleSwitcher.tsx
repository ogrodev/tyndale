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
  return (
    <div className="relative group">
      <button className="text-sm text-[#9b9b97] hover:text-[#e5e5e3] transition-colors px-2 py-1 rounded border border-white/6">
        {locale.toUpperCase()}
      </button>
      <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-[#161615] border border-white/6 rounded-lg shadow-xl py-1 min-w-[80px] z-50">
        {locales.map((l) => (
          <a
            key={l.code}
            href={l.code === 'en' ? '/' : `/${l.code}/`}
            className={`block px-3 py-1.5 text-sm transition-colors ${
              l.code === locale ? 'text-accent-400 bg-accent-950/50' : 'text-[#9b9b97] hover:text-[#e5e5e3] hover:bg-white/4'
            }`}
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

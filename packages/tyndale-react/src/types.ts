/**
 * User-facing config file schema (`tyndale.config.json`).
 */
export interface TyndaleConfig {
  /** Source locale the app is written in. */
  defaultLocale: string;
  /** Target locales to translate into (does NOT include defaultLocale). */
  locales: string[];
  /** Glob patterns for source files to extract translations from. Defaults to ["src"]. */
  include?: string[];
  /** Glob patterns to exclude from extraction. */
  exclude?: string[];
  /** File extensions to scan. Defaults to [".ts", ".tsx", ".js", ".jsx"]. */
  extensions?: string[];
  /** Source directories for extraction. Overrides `include` when set. */
  source?: string[];
  /** Output directory for generated locale files. Defaults to "public/_tyndale". */
  output?: string;
  /** Number of entries per translation batch. Defaults to 50. */
  batchSize?: number;
  /** Map locale codes to aliases (e.g. { "pt": "pt-BR" }). */
  localeAliases?: Record<string, string>;
  /** Pi model configuration. */
  pi?: {
    model?: string;
    thinkingLevel?: string;
  };
  /** Dictionary configuration. */
  dictionaries?: {
    /** Glob patterns for dictionary JSON files. */
    include: string[];
    /** Format of dictionary files. */
    format?: string;
  };
}

/**
 * A locale data file: hash → translated string.
 * Stored at `public/_tyndale/{locale}.json`.
 */
export type LocaleData = Record<string, string>;

/**
 * Type of an extracted translation entry.
 * - "jsx": from `<T>` component
 * - "string": from `useTranslation()` / `getTranslation()` / `msg()`
 * - "dictionary": from dictionary JSON files
 */
export type EntryType = "jsx" | "string" | "dictionary";

/**
 * Metadata for a single extracted translation entry in the manifest.
 */
export interface ManifestEntry {
  /** What kind of source produced this entry. */
  type: EntryType;
  /** Human-readable location: "file.tsx:T@line" or "file.tsx:useTranslation@line". */
  context: string;
  /** For dictionary entries: the key within the dictionary file. */
  dictKey?: string;
  /** For dictionary entries: the filename key (relative path, no extension). */
  dictFile?: string;
}

/**
 * The manifest file at `public/_tyndale/manifest.json`.
 */
export interface Manifest {
  version: 1;
  defaultLocale: string;
  locales: string[];
  /** Map from content hash → entry metadata. */
  entries: Record<string, ManifestEntry>;
}

/**
 * Internal context value exposed by TyndaleProvider.
 */
export interface TyndaleContextValue {
  /** Current active locale. */
  locale: string;
  /** The source/default locale. */
  defaultLocale: string;
  /** Hash → translated string for the current locale. */
  translations: LocaleData;
  /** The loaded manifest (for dictionary lookups). */
  manifest: Manifest | null;
  /** Whether locale data is still loading. */
  isLoading: boolean;
  /** Change the active locale (plain React: state update; Next.js: navigation). */
  changeLocale: (locale: string) => void;
  /** Callback when locale changes (for controlled mode). */
  onLocaleChange?: (locale: string) => void;
}


/** Props shared by all variable components when used inside <T>. */
export interface TyndaleVarBaseProps {
  /** Placeholder name in wire format. Required when inside <T>. */
  name?: string;
}

export interface VarProps extends TyndaleVarBaseProps {
  name: string;
  children: React.ReactNode;
}

export interface NumProps extends TyndaleVarBaseProps {
  value: number;
  options?: Intl.NumberFormatOptions;
}

export interface CurrencyProps extends TyndaleVarBaseProps {
  value: number;
  currency: string;
  options?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>;
}

export interface DateTimeProps extends TyndaleVarBaseProps {
  value: Date | number | string;
  options?: Intl.DateTimeFormatOptions;
}

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export interface PluralProps {
  count: number;
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}
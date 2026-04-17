// Phase 1 exports
export { TyndaleProvider } from './provider.js';
export type { TyndaleProviderProps } from './provider.js';
export { TyndaleContext, useTyndaleContext } from './context.js';
export type {
  TyndaleContextValue,
  TyndaleManifest,
  ManifestEntry,
} from './context.js';
export type {
  TyndaleConfig,
  LocaleData,
  EntryType,
  Manifest,
} from './types.js';
export { useLocale } from './use-locale.js';
export { computeHash, hash } from './hash.js';
export { T } from './t.js';
export { escapeWireFormat, unescapeWireFormat } from './escape.js';

// Phase 2A: Variable components
export { Var } from './var.js';
export { Num } from './num.js';
export { Currency } from './currency.js';
export { DateTime } from './date-time.js';
export { Plural } from './plural.js';

// Phase 2A: Types
export type {
  VarProps,
  NumProps,
  CurrencyProps,
  DateTimeProps,
  PluralProps,
  PluralCategory,
} from './types.js';

// Phase 2A: Hooks and functions
export { useTranslation, interpolate } from './use-translation.js';
export { msg } from './msg.js';
export { msgString } from './msg-string.js';
export { useChangeLocale } from './use-change-locale.js';
export { useDictionary } from './use-dictionary.js';
// Note: `getTranslation` is server-only (imports `node:fs/promises`). It lives
// at `tyndale-react/server` so client bundles don't pull it in.

// Phase 2A: Wire format (for advanced usage / CLI shared code)
export {
  serializeChildren,
  deserializeWireFormat,
  parseIcuPlural,
} from './wire-format.js';
export type {
  ElementInfo,
  ElementEntry,
  SerializeResult,
  VariableMap,
  IcuPluralResult,
} from './wire-format.js';

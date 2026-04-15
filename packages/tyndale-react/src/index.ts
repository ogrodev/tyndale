// Phase 1 exports
export { TyndaleProvider } from './provider';
export type { TyndaleProviderProps } from './provider';
export { TyndaleContext, useTyndaleContext } from './context';
export type {
  TyndaleContextValue,
  TyndaleManifest,
  ManifestEntry,
} from './context';
export type {
  TyndaleConfig,
  LocaleData,
  EntryType,
  Manifest,
} from './types';
export { useLocale } from './use-locale';
export { computeHash, hash } from './hash';
export { T } from './t';
export { escapeWireFormat, unescapeWireFormat } from './escape';

// Phase 2A: Variable components
export { Var } from './var';
export { Num } from './num';
export { Currency } from './currency';
export { DateTime } from './date-time';
export { Plural } from './plural';

// Phase 2A: Types
export type {
  VarProps,
  NumProps,
  CurrencyProps,
  DateTimeProps,
  PluralProps,
  PluralCategory,
} from './types';

// Phase 2A: Hooks and functions
export { useTranslation, interpolate } from './use-translation';
export { msg } from './msg';
export { msgString } from './msg-string';
export { useChangeLocale } from './use-change-locale';
export { useDictionary } from './use-dictionary';
export { getTranslation } from './get-translation';
export type { GetTranslationOptions } from './get-translation';

// Phase 2A: Wire format (for advanced usage / CLI shared code)
export {
  serializeChildren,
  deserializeWireFormat,
  parseIcuPlural,
} from './wire-format';
export type {
  ElementInfo,
  ElementEntry,
  SerializeResult,
  VariableMap,
  IcuPluralResult,
} from './wire-format';

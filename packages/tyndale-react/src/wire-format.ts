import {
  type ReactNode,
  type ReactElement,
  isValidElement,
  Children,
  createElement,
} from 'react';
import type React from 'react';
import { Var } from './var';
import { Num } from './num';
import { Currency } from './currency';
import { DateTime } from './date-time';
import { Plural } from './plural';
import { escapeWireFormat, unescapeWireFormat } from './escape';
import { interpolatePluralBranch } from './plural';

// --- Types ---

export interface ElementInfo {
  type: string | React.ComponentType;
  props: Record<string, unknown>;
}

/** Backward-compatible alias. */
export type ElementEntry = ElementInfo;

/** Maps variable placeholder name → rendered ReactNode (string or element). */
export type VariableMap = Map<string, ReactNode>;

export interface SerializeResult {
  wire: string;
  /** @deprecated Use `wire` instead. */
  wireFormat: string;
  elementMap: ElementInfo[];
  variableMap: VariableMap;
}

// --- Variable component detection ---

const VARIABLE_COMPONENTS = new Set<React.ComponentType>([
  Var,
  Num,
  Currency,
  DateTime,
]);

function isVariableComponent(
  type: unknown,
): type is typeof Var | typeof Num | typeof Currency | typeof DateTime {
  return VARIABLE_COMPONENTS.has(type as React.ComponentType);
}

function isPluralComponent(type: unknown): type is typeof Plural {
  return type === Plural;
}

// --- Serialization ---

/**
 * Serializes React children into wire format.
 * - Regular elements → numbered tags <0>, <1>, etc.
 * - Var/Num/Currency/DateTime → {name} placeholders
 * - Plural → ICU format block
 */
export function serializeChildren(children: ReactNode): SerializeResult {
  const elementMap: ElementInfo[] = [];
  const variableMap: VariableMap = new Map();
  let tagCounter = 0;

  function serialize(node: ReactNode): string {
    if (node === null || node === undefined || typeof node === 'boolean') {
      return '';
    }

    if (typeof node === 'string') {
      return escapeWireFormat(node);
    }

    if (typeof node === 'number') {
      return String(node);
    }

    if (Array.isArray(node)) {
      return node.map(serialize).join('');
    }

    if (isValidElement(node)) {
      const element = node as ReactElement;
      const type = element.type;

      // Variable components → {name} placeholder
      if (isVariableComponent(type)) {
        const name = element.props.name as string;
        if (!name) {
          throw new Error(
            `Variable component <${(type as Function).name}> inside <T> requires a "name" prop`,
          );
        }
        // Store the original element for rendering at deserialization
        if (type === Var) {
          variableMap.set(name, element.props.children);
        } else {
          // For Num/Currency/DateTime, store the element itself to render with locale
          variableMap.set(name, element);
        }
        return `{${name}}`;
      }

      // Plural → ICU format block
      if (isPluralComponent(type)) {
        const props = element.props as React.ComponentProps<typeof Plural>;
        return serializePluralToIcu(props);
      }

      // Regular element → numbered tag
      const tagIndex = tagCounter++;
      const { children: childContent, ...restProps } = element.props;
      elementMap[tagIndex] = {
        type: typeof type === 'string' ? type : type,
        props: restProps,
      };

      const inner = Children.toArray(childContent as ReactNode)
        .map(serialize)
        .join('');
      if (inner === '') {
        return `<${tagIndex}></${tagIndex}>`;
      }
      return `<${tagIndex}>${inner}</${tagIndex}>`;
    }

    return String(node);
  }

  const wire = serialize(children);
  return { wire, wireFormat: wire, elementMap, variableMap };
}

/**
 * Serializes Plural props to ICU MessageFormat syntax.
 * Format: {plural, count, zero {text} one {text} other {text}}
 */
function serializePluralToIcu(props: React.ComponentProps<typeof Plural>): string {
  const categories: Array<[string, string]> = [];
  if (props.zero !== undefined) categories.push(['zero', props.zero]);
  if (props.one !== undefined) categories.push(['one', props.one]);
  if (props.two !== undefined) categories.push(['two', props.two]);
  if (props.few !== undefined) categories.push(['few', props.few]);
  if (props.many !== undefined) categories.push(['many', props.many]);
  categories.push(['other', props.other]);

  const branches = categories
    .map(([cat, text]) => `${cat} {${text}}`)
    .join(' ');
  return `{plural, count, ${branches}}`;
}

// --- ICU Plural Parsing ---

export interface IcuPluralResult {
  variable: string;
  branches: Record<string, string>;
}

/**
 * Parses an ICU plural block string.
 * Format: {plural, variable, category {content} ...}
 * Returns null if the string is not a plural block.
 */
export function parseIcuPlural(input: string): IcuPluralResult | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('{plural,')) return null;

  // Remove outer braces
  const inner = trimmed.slice(1, -1).trim(); // plural, count, zero {text} ...
  // Split: "plural" "," "count" "," rest...
  const firstComma = inner.indexOf(',');
  if (firstComma === -1) return null;

  const afterPlural = inner.slice(firstComma + 1).trim();
  const secondComma = afterPlural.indexOf(',');
  if (secondComma === -1) return null;

  const variable = afterPlural.slice(0, secondComma).trim();
  const branchesStr = afterPlural.slice(secondComma + 1).trim();

  const branches: Record<string, string> = {};
  let pos = 0;

  while (pos < branchesStr.length) {
    // Skip whitespace
    while (pos < branchesStr.length && /\s/.test(branchesStr[pos])) pos++;
    if (pos >= branchesStr.length) break;

    // Read category name (zero, one, two, few, many, other)
    const catStart = pos;
    while (pos < branchesStr.length && /[a-z]/.test(branchesStr[pos])) pos++;
    const category = branchesStr.slice(catStart, pos);
    if (!category) break;

    // Skip whitespace
    while (pos < branchesStr.length && /\s/.test(branchesStr[pos])) pos++;

    // Expect opening brace for branch content
    if (branchesStr[pos] !== '{') break;
    pos++; // skip {

    // Read content until matching closing brace (handle nested braces)
    let depth = 1;
    const contentStart = pos;
    while (pos < branchesStr.length && depth > 0) {
      if (branchesStr[pos] === '{') depth++;
      else if (branchesStr[pos] === '}') depth--;
      if (depth > 0) pos++;
    }
    branches[category] = branchesStr.slice(contentStart, pos);
    pos++; // skip closing }
  }

  if (Object.keys(branches).length === 0) return null;
  return { variable, branches };
}

// --- Deserialization ---

/**
 * Deserializes a wire format string back to React elements.
 * Handles numbered tags, {name} variable placeholders, and ICU plural blocks.
 *
 * Overloaded: can be called with the Phase 1 signature (wire, Map) or
 * the Phase 2A signature (wire, array, variableMap, locale, pluralCount).
 */
export function deserializeWireFormat(
  wire: string,
  elementMap: ElementInfo[] | Map<number, ElementInfo>,
  variableMap?: VariableMap,
  locale?: string,
  pluralCount?: number,
): ReactNode {
  // Normalize Map to array for backward compatibility
  const elArray: ElementInfo[] = elementMap instanceof Map
    ? mapToArray(elementMap)
    : elementMap;
  const vars = variableMap ?? new Map();
  const loc = locale ?? 'en';
  return parseWire(wire, elArray, vars, loc, pluralCount);
}

function mapToArray(map: Map<number, ElementInfo>): ElementInfo[] {
  const arr: ElementInfo[] = [];
  for (const [index, entry] of map) {
    arr[index] = entry;
  }
  return arr;
}

function parseWire(
  input: string,
  elementMap: ElementInfo[],
  variableMap: VariableMap,
  locale: string,
  pluralCount?: number,
): ReactNode {
  const nodes: ReactNode[] = [];
  let pos = 0;

  while (pos < input.length) {
    // Check for ICU plural block: {plural, ...}
    if (input.startsWith('{plural,', pos)) {
      const braceStart = pos;
      let depth = 0;
      let braceEnd = pos;
      for (let i = pos; i < input.length; i++) {
        if (input[i] === '{') depth++;
        else if (input[i] === '}') {
          depth--;
          if (depth === 0) {
            braceEnd = i + 1;
            break;
          }
        }
      }
      const pluralBlock = input.slice(braceStart, braceEnd);
      const parsed = parseIcuPlural(pluralBlock);
      if (parsed && pluralCount !== undefined) {
        const branch = selectIcuBranch(parsed, pluralCount, locale);
        const interpolated = interpolatePluralBranch(branch, pluralCount);
        nodes.push(interpolated);
      } else if (parsed) {
        // No count provided — render the 'other' branch with 0
        nodes.push(parsed.branches.other ?? '');
      }
      pos = braceEnd;
      continue;
    }

    // Check for variable placeholder: {name} (skip escaped braces \{)
    if (input[pos] === '{' && (pos === 0 || input[pos - 1] !== '\\')) {
      const closeBrace = input.indexOf('}', pos);
      if (closeBrace !== -1) {
        const name = input.slice(pos + 1, closeBrace);
        // Only match if name is a simple identifier (no spaces/braces)
        if (/^\w+$/.test(name) && variableMap.has(name)) {
          nodes.push(variableMap.get(name));
          pos = closeBrace + 1;
          continue;
        }
      }
    }

    // Check for numbered tag: <N>...</N>
    const tagMatch = input.slice(pos).match(/^<(\d+)>/);
    if (tagMatch) {
      const tagIndex = parseInt(tagMatch[1], 10);
      const tagOpen = `<${tagIndex}>`;
      const tagClose = `</${tagIndex}>`;
      pos += tagOpen.length;

      // Find matching close tag
      const closePos = findMatchingClose(input, pos, tagIndex);
      const inner = input.slice(pos, closePos);
      pos = closePos + tagClose.length;

      const info = elementMap[tagIndex];
      if (!info) {
        // Unknown tag — render inner content as-is
        nodes.push(parseWire(inner, elementMap, variableMap, locale, pluralCount));
        continue;
      }

      const children = parseWire(inner, elementMap, variableMap, locale, pluralCount);
      nodes.push(createElement(info.type as any, { ...info.props, key: tagIndex }, children));
      continue;
    }

    // Check for closing tag (stop recursion)
    const closeMatch = input.slice(pos).match(/^<\/(\d+)>/);
    if (closeMatch) {
      // This shouldn't happen at top level but handle gracefully
      break;
    }

    // Plain text — read until next special character
    let textEnd = pos;
    while (textEnd < input.length) {
      if (input[textEnd] === '<' && /\d|\//.test(input[textEnd + 1] ?? '')) break;
      // Stop at unescaped { only (\{ is escaped)
      if (input[textEnd] === '{' && input[textEnd - 1] !== '\\') break;
      textEnd++;
    }

    if (textEnd > pos) {
      nodes.push(unescapeWireFormat(input.slice(pos, textEnd)));
      pos = textEnd;
    } else {
      // Unrecognized character — advance
      nodes.push(input[pos]);
      pos++;
    }
  }

  if (nodes.length === 0) return null;
  if (nodes.length === 1 && typeof nodes[0] === 'string') return nodes[0];
  if (nodes.length === 1) return nodes[0];
  return nodes;
}

/**
 * Finds the position of the matching close tag </N> for an open tag <N>.
 */
function findMatchingClose(
  input: string,
  startPos: number,
  tagIndex: number,
): number {
  const tagOpen = `<${tagIndex}>`;
  const tagClose = `</${tagIndex}>`;
  let depth = 1;
  let pos = startPos;

  while (pos < input.length && depth > 0) {
    if (input.startsWith(tagClose, pos)) {
      depth--;
      if (depth === 0) return pos;
      pos += tagClose.length;
    } else if (input.startsWith(tagOpen, pos)) {
      depth++;
      pos += tagOpen.length;
    } else {
      pos++;
    }
  }

  return pos; // Fallback: end of string
}

/**
 * Selects the correct ICU plural branch using Intl.PluralRules.
 */
function selectIcuBranch(
  parsed: IcuPluralResult,
  count: number,
  locale: string,
): string {
  // Explicit zero check
  if (count === 0 && parsed.branches.zero !== undefined) {
    return parsed.branches.zero;
  }

  const rules = new Intl.PluralRules(locale);
  const category = rules.select(count);
  return parsed.branches[category] ?? parsed.branches.other ?? '';
}

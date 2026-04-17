/**
 * Serializes the children of a `<T>` Astro element into the canonical wire
 * format. Output must match `jsx-serializer.ts` byte-for-byte for equivalent
 * inputs.
 *
 * The serializer collects structural errors (unsupported tags inside `<T>`,
 * missing `name=` on variable components, non-literal expressions) alongside
 * the wire output so the orchestrator can report them.
 */
import type {
  AttributeNode,
  Node,
  TagLikeNode,
} from '@astrojs/compiler/types';
import { normalizeJSXText, escapeText, VARIABLE_COMPONENTS, PLURAL_CATEGORIES } from '../shared/wire-helpers.js';

export interface SerializerError {
  line: number;
  message: string;
}

export interface SerializeAstroTResult {
  wire: string;
  errors: SerializerError[];
}

/** Serialize an Astro `<T>` element's children into the wire format. */
export function serializeAstroT(tNode: TagLikeNode): SerializeAstroTResult {
  const counter = { value: 0 };
  const errors: SerializerError[] = [];
  const wire = serializeChildren(tNode.children ?? [], counter, errors).trim();
  return { wire, errors };
}

function serializeChildren(
  children: Node[],
  counter: { value: number },
  errors: SerializerError[],
): string {
  let result = '';

  for (const child of children) {
    switch (child.type) {
      case 'text':
        result += normalizeJSXText(decodeHtmlEntities((child as { value: string }).value));
        break;

      case 'expression': {
        const literal = tryReadStringLiteral(child);
        if (literal !== null) {
          result += escapeText(literal);
        } else {
          // Mirror JSX serializer: emit nothing for non-literal expressions.
          // Record the error for orchestration-level reporting.
          errors.push({
            line: child.position?.start.line ?? 0,
            message:
              'non-literal expression in <T> (wrap in <Var>, <Num>, <Currency>, or <DateTime>)',
          });
        }
        break;
      }

      case 'element':
      case 'component':
      case 'custom-element': {
        const tag = child as TagLikeNode;
        const name = tag.name;

        if (name === 'slot') {
          errors.push({
            line: tag.position?.start.line ?? 0,
            message: '<slot> is not supported inside <T>',
          });
          break;
        }

        if (name === 'Fragment') {
          errors.push({
            line: tag.position?.start.line ?? 0,
            message: '<Fragment> is not supported inside <T>',
          });
          break;
        }

        if (name === 'style' || name === 'script') {
          errors.push({
            line: tag.position?.start.line ?? 0,
            message: `<${name}> is not supported inside <T>`,
          });
          break;
        }

        if (VARIABLE_COMPONENTS.has(name)) {
          result += serializeVariableComponent(tag, name, errors);
        } else if (name === 'Plural') {
          result += serializePlural(tag);
        } else {
          const index = counter.value++;
          const inner = serializeChildren(tag.children ?? [], counter, errors);
          result += `<${index}>${inner}</${index}>`;
        }
        break;
      }

      case 'fragment': {
        const frag = child as TagLikeNode;
        if (frag.name === 'Fragment') {
          errors.push({
            line: frag.position?.start.line ?? 0,
            message: '<Fragment> is not supported inside <T>',
          });
          break;
        }
        // Shorthand `<></>` (empty name) — serialize children transparently, matching JSX `<></>`.
        result += serializeChildren(frag.children ?? [], counter, errors);
        break;
      }

      default:
        // Comments, doctypes, etc. — ignore.
        break;
    }
  }

  return result;
}

function serializeVariableComponent(
  tag: TagLikeNode,
  name: string,
  errors: SerializerError[],
): string {
  if (name === 'Var') {
    const attr = findAttribute(tag, 'name');
    if (!attr || attr.kind !== 'quoted') {
      errors.push({
        line: tag.position?.start.line ?? 0,
        message: '<Var> requires a literal string `name` attribute',
      });
      return '{?}';
    }
    return `{${attr.value}}`;
  }

  // Num | Currency | DateTime — placeholder uses the `value={…}` expression source.
  const attr = findAttribute(tag, 'value');
  if (!attr) return '{?}';
  if (attr.kind === 'expression' || attr.kind === 'shorthand') {
    return `{${attr.value}}`;
  }
  // Quoted literal as a value is unusual but treat it as the placeholder name.
  if (attr.kind === 'quoted') {
    return `{${attr.value}}`;
  }
  return '{?}';
}

function serializePlural(tag: TagLikeNode): string {
  const countAttr = findAttribute(tag, 'count');
  const countName =
    countAttr && (countAttr.kind === 'expression' || countAttr.kind === 'shorthand')
      ? countAttr.value
      : countAttr?.kind === 'quoted'
        ? countAttr.value
        : 'count';

  const branches: string[] = [];
  for (const cat of PLURAL_CATEGORIES) {
    const attr = findAttribute(tag, cat);
    if (attr && attr.kind === 'quoted') {
      branches.push(`${cat} {${attr.value}}`);
    }
  }

  return `{plural, ${countName}, ${branches.join(' ')}}`;
}

function findAttribute(tag: TagLikeNode, name: string): AttributeNode | undefined {
  return tag.attributes.find((a) => a.name === name);
}

/**
 * Try to read an Astro expression node as a plain string literal. Returns the
 * unescaped string value, or null if the expression is any other shape.
 */
function tryReadStringLiteral(node: Node): string | null {
  const children = (node as { children?: Node[] }).children ?? [];
  let raw = '';
  for (const c of children) {
    if (c.type === 'text' && typeof (c as { value?: string }).value === 'string') {
      raw += (c as { value: string }).value;
    } else {
      return null;
    }
  }
  const trimmed = raw.trim();
  if (trimmed.length < 2) return null;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "'" || first === '"') && first === last) {
    const inner = trimmed.slice(1, -1);
    // Reject if the inner content contains an unescaped same-type quote.
    if (inner.includes(first) && !inner.includes(`\\${first}`)) return null;
    return decodeSimpleEscapes(inner);
  }
  // Template literal without interpolation: `plain text`
  if (first === '`' && last === '`') {
    const inner = trimmed.slice(1, -1);
    if (inner.includes('${')) return null;
    return inner;
  }
  return null;
}

function decodeSimpleEscapes(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}


/**
 * Decode the small set of HTML entities Babel's JSX text path also decodes,
 * so Astro text nodes serialize byte-identically to JSXText values.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
};

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const cp = parseInt(body.slice(2), 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    if (body.startsWith('#')) {
      const cp = parseInt(body.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    const decoded = NAMED_ENTITIES[body];
    return decoded !== undefined ? decoded : match;
  });
}
import type {
  JSXElement,
  JSXFragment,
  JSXText,
  JSXExpressionContainer,
  JSXSpreadChild,
  StringLiteral,
  JSXAttribute,
  JSXIdentifier,
} from '@babel/types';

import { normalizeJSXText, escapeText, VARIABLE_COMPONENTS, PLURAL_CATEGORIES } from '../shared/wire-helpers';

type JSXChild = JSXElement | JSXFragment | JSXText | JSXExpressionContainer | JSXSpreadChild;

/**
 * Serializes the children of a `<T>` JSX element (Babel AST) into the
 * canonical wire format. Must produce output identical to the runtime
 * serializer in `tyndale-react/src/wire-format.ts`.
 */
export function serializeJSXToWireFormat(tElement: JSXElement | JSXFragment): string {
  const counter = { value: 0 };
  return serializeChildren(tElement.children as JSXChild[], counter).trim();
}

function serializeChildren(children: JSXChild[], counter: { value: number }): string {
  let result = '';

  for (const child of children) {
    switch (child.type) {
      case 'JSXText':
        result += normalizeJSXText(child.value);
        break;

      case 'JSXExpressionContainer':
        // String literal expressions like {'text'}
        if (child.expression.type === 'StringLiteral') {
          result += escapeText(child.expression.value);
        }
        // Other expressions are handled by validation (should be wrapped)
        break;

      case 'JSXElement': {
        const tagName = getElementName(child);

        if (VARIABLE_COMPONENTS.has(tagName)) {
          result += serializeVariableComponent(child, tagName);
        } else if (tagName === 'Plural') {
          result += serializePlural(child);
        } else {
          const index = counter.value++;
          const inner = serializeChildren(child.children as JSXChild[], counter);
          result += `<${index}>${inner}</${index}>`;
        }
        break;
      }

      case 'JSXFragment':
        result += serializeChildren(child.children as JSXChild[], counter);
        break;

      default:
        break;
    }
  }

  return result;
}

function getElementName(element: JSXElement): string {
  const name = element.openingElement.name;
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') {
    // e.g., Foo.Bar — return the full dotted name
    return `${(name.object as JSXIdentifier).name}.${name.property.name}`;
  }
  return '';
}

function serializeVariableComponent(element: JSXElement, tagName: string): string {
  if (tagName === 'Var') {
    const nameAttr = getStringAttribute(element, 'name');
    return nameAttr ? `{${nameAttr}}` : '{?}';
  }

  // Num, Currency, DateTime — use the value prop's source name as placeholder
  const valueAttr = getAttributeExpression(element, 'value');
  return valueAttr ? `{${valueAttr}}` : '{?}';
}

function serializePlural(element: JSXElement): string {
  const countAttr = getAttributeExpression(element, 'count');
  const countName = countAttr ?? 'count';

  const branches: string[] = [];
  for (const cat of PLURAL_CATEGORIES) {
    const value = getStringAttribute(element, cat);
    if (value !== null) {
      branches.push(`${cat} {${value}}`);
    }
  }

  return `{plural, ${countName}, ${branches.join(' ')}}`;
}

/**
 * Gets a string-valued JSX attribute. Returns the string value or null.
 */
function getStringAttribute(element: JSXElement, name: string): string | null {
  for (const attr of element.openingElement.attributes) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === name
    ) {
      if (attr.value?.type === 'StringLiteral') {
        return attr.value.value;
      }
      if (
        attr.value?.type === 'JSXExpressionContainer' &&
        attr.value.expression.type === 'StringLiteral'
      ) {
        return attr.value.expression.value;
      }
    }
  }
  return null;
}

/**
 * Gets the source-code name of an expression attribute.
 * For `value={count}` returns "count".
 * For `value={obj.field}` returns "obj.field".
 */
function getAttributeExpression(element: JSXElement, name: string): string | null {
  for (const attr of element.openingElement.attributes) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === name
    ) {
      if (attr.value?.type === 'JSXExpressionContainer') {
        const expr = attr.value.expression;
        if (expr.type === 'Identifier') return expr.name;
        if (expr.type === 'MemberExpression') {
          const obj = expr.object.type === 'Identifier' ? expr.object.name : '?';
          const prop = expr.property.type === 'Identifier' ? expr.property.name : '?';
          return `${obj}.${prop}`;
        }
      }
    }
  }
  return null;
}



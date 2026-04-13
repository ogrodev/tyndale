import { Tiktoken } from 'js-tiktoken/lite';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';

let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!encoder) encoder = new Tiktoken(cl100k_base);
  return encoder;
}

export function countTokens(text: string): number {
  return getEncoder().encode(text).length;
}

export function countEntryTokens(hash: string, source: string): number {
  return countTokens(`  "${hash}": "${source}"`);
}

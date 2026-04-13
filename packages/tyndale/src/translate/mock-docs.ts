import type { TranslationSession } from './batch-translator';

/**
 * Mock doc translator for testing. Prefixes each prose line with "[{locale}] "
 * while preserving code blocks, frontmatter, and MDX syntax.
 */
export function createMockDocSession(): TranslationSession {
  return {
    async sendPrompt(prompt: string): Promise<unknown> {
      // Extract locale from prompt
      const localeMatch = prompt.match(/\((\w{2})\)\.\s*$/m) ?? prompt.match(/to \w+ \((\w+)\)/);
      const locale = localeMatch?.[1] ?? 'mock';

      // Extract content after "CONTENT:\n"
      const contentMatch = prompt.match(/CONTENT:\n([\s\S]+?)\nRespond with ONLY/);
      if (!contentMatch) return '';

      const content = contentMatch[1].trim();
      const lines = content.split('\n');
      const result: string[] = [];

      let inFrontmatter = false;
      let inCodeBlock = false;

      for (const line of lines) {
        // Track frontmatter
        if (line.trim() === '---') {
          inFrontmatter = !inFrontmatter;
          result.push(line);
          continue;
        }

        // Track code blocks
        if (line.trim().startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          result.push(line);
          continue;
        }

        // Preserve code blocks
        if (inCodeBlock) {
          result.push(line);
          continue;
        }

        // Handle frontmatter — translate title and description values
        if (inFrontmatter) {
          if (line.match(/^(title|description|tagline):\s*.+/)) {
            const [key, ...valueParts] = line.split(': ');
            const value = valueParts.join(': ');
            result.push(`${key}: [${locale}] ${value}`);
          } else if (line.match(/^\s+- text:\s*.+/)) {
            const indent = line.match(/^(\s+)/)?.[1] ?? '';
            const value = line.replace(/^\s+- text:\s*/, '');
            result.push(`${indent}- text: [${locale}] ${value}`);
          } else {
            result.push(line);
          }
          continue;
        }

        // Preserve import lines and empty lines
        if (line.startsWith('import ') || line.trim() === '') {
          result.push(line);
          continue;
        }

        // Preserve MDX component lines (opening/closing tags)
        if (line.trim().startsWith('<') && !line.trim().startsWith('<!')) {
          // Translate Card title attributes
          const cardMatch = line.match(/^(\s*<Card title=")(.+?)(".*>)$/);
          if (cardMatch) {
            result.push(`${cardMatch[1]}[${locale}] ${cardMatch[2]}${cardMatch[3]}`);
          } else {
            result.push(line);
          }
          continue;
        }

        // Translate prose lines
        if (line.trim().length > 0) {
          result.push(`[${locale}] ${line}`);
        } else {
          result.push(line);
        }
      }

      return result.join('\n');
    },
  };
}

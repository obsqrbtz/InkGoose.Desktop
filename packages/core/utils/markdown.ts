// packages/core/utils/markdown.ts

export interface ParsedMarkdown {
  frontMatter: Record<string, unknown>;
  body: string;
}

/**
 * Parse frontmatter (--- or +++) and return { frontMatter, body }.
 * NOTE: this is a simple parser for common frontmatter shapes (key: value).
 * For full YAML support use `gray-matter` / `js-yaml`.
 */
export function parseMarkdownFile(content: string): ParsedMarkdown {
  // frontmatter at start: ---\n ... \n---\n or +++ ... +++
  const fmRegex = /^(?:---|\+\+\+)\s*\r?\n([\s\S]*?)\r?\n(?:---|\+\+\+)\s*\r?\n?/;
  const match = content.match(fmRegex);

  if (!match) {
    return { frontMatter: {}, body: content };
  }

  const fmText = match[1];
  const frontMatter: Record<string, unknown> = {};

  // naive line-based parser: "key: value"
  // handles quoted strings, numbers, booleans, and JSON arrays/objects if provided on single line
  for (const line of fmText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue; // ignore empty/comment lines
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      // no colon — treat as flag = true or skip
      const key = trimmed;
      frontMatter[key] = true;
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let rawVal = trimmed.slice(colonIndex + 1).trim();

    // strip surrounding quotes
    if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
      frontMatter[key] = rawVal.slice(1, -1);
      continue;
    }

    // boolean
    if (/^(true|false)$/i.test(rawVal)) {
      frontMatter[key] = rawVal.toLowerCase() === 'true';
      continue;
    }

    // number
    if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
      frontMatter[key] = Number(rawVal);
      continue;
    }

    // try JSON parse (arrays/objects)
    try {
      frontMatter[key] = JSON.parse(rawVal);
      continue;
    } catch {
      // fallback to string
    }

    frontMatter[key] = rawVal;
  }

  const body = content.slice(match[0].length);
  return { frontMatter, body };
}

/**
 * Extracts wiki links of form [[Page Name]] and markdown links [text](url).
 * Returns unique strings (wiki targets and link URLs).
 * If you want only internal/wiki targets, filter the results (e.g. remove http(s)://).
 */
export function extractLinks(content: string): string[] {
  const results = new Set<string>();
  let m: RegExpExecArray | null;

  const wikiRe = /\[\[([^\]]+)\]\]/g;
  while ((m = wikiRe.exec(content)) !== null) {
    results.add(m[1].trim());
  }

  const mdRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((m = mdRe.exec(content)) !== null) {
    const url = m[2].trim();
    results.add(url);
  }

  return Array.from(results);
}

/**
 * Extract tags like #tag and return unique list without the leading '#'.
 * Avoid matching hashes in URLs by requiring a word boundary before the hash.
 */
export function extractTags(content: string): string[] {
  const tagRe = /(^|\s)#([a-zA-Z0-9_-]+)/g;
  const tags = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(content)) !== null) {
    tags.add(m[2]);
  }
  return Array.from(tags);
}

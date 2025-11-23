export interface ParsedMarkdown {
  frontMatter: Record<string, unknown>;
  body: string;
}

export function parseMarkdownFile(content: string): ParsedMarkdown {
  const fmRegex = /^(?:---|\+\+\+)\s*\r?\n([\s\S]*?)\r?\n(?:---|\+\+\+)\s*\r?\n?/;
  const match = content.match(fmRegex);

  if (!match) {
    return { frontMatter: {}, body: content };
  }

  const fmText = match[1];
  const frontMatter: Record<string, unknown> = {};

  for (const line of fmText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      // no colon — treat as flag = true or skip
      const key = trimmed;
      frontMatter[key] = true;
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let rawVal = trimmed.slice(colonIndex + 1).trim();

    if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
      frontMatter[key] = rawVal.slice(1, -1);
      continue;
    }

    if (/^(true|false)$/i.test(rawVal)) {
      frontMatter[key] = rawVal.toLowerCase() === 'true';
      continue;
    }

    if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
      frontMatter[key] = Number(rawVal);
      continue;
    }

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

export function extractLinks(content: string): string[] {
  const results = new Set<string>();
  let m: RegExpExecArray | null;

  const mdRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((m = mdRe.exec(content)) !== null) {
    const url = m[2].trim();
    results.add(url);
  }

  return Array.from(results);
}
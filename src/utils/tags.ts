// Tag extractor
// - Supports YAML frontmatter tags
// - Skips fenced code, inline code, HTML, links, and autolinks
// - Requires a separator before '#', allows hierarchical tags with '/'
// - Excludes hex colors like #fff, #ffffff, #ffffffff

export type Tag = string;

const FENCE_RE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const INLINE_CODE_RE = /`[^`]*`/g;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const HTML_TAG_RE = /<[^>]+>/g;
const LINK_RE = /\[[^\]]*\]\([^)]*\)/g;
const AUTOLINK_RE = /https?:\/\/\S+/gi;

const YAML_FRONTMATTER_CAPTURE_RE = /^(?:\uFEFF)?\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const HASH_TAG_RE = /(^|[\s(])#([A-Za-z0-9][\w-]*(?:\/[A-Za-z0-9][\w-]*)*)\b/g;
const HEX_COLOR_RE = /^([A-Fa-f0-9]{3}|[A-Fa-f0-9]{4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;

function parseFrontmatterTags(frontmatter: string): Tag[] {
    const out: Tag[] = [];
    if (!frontmatter) return out;

    const lines = frontmatter.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const mKey = line.match(/^\s*tags\s*:\s*(.*)$/);
        if (!mKey) continue;
        const rest = mKey[1].trim();

        // inline bracket list: tags: [a, b, "c d"]
        if (rest.startsWith('[') && rest.includes(']')) {
            const inner = rest.slice(1, rest.indexOf(']'));
            inner.split(',').forEach(item => {
                const t = item.trim().replace(/^['"]|['"]$/g, '');
                if (t) out.push(t.toLowerCase());
            });
            break;
        }

        // inline scalar: tags: a b c  or tags: a, b, c
        if (rest && !rest.startsWith('-')) {
            rest
                .split(/[\s,]+/)
                .map(s => s.trim())
                .filter(Boolean)
                .forEach(t => out.push(t.toLowerCase()));
            break;
        }

        // list block starting on next lines
        if (rest === '' || rest.startsWith('-')) {
            if (rest.startsWith('-')) {
                const m = rest.match(/^-\s*(.+)\s*$/);
                if (m) {
                    const t = m[1].trim().replace(/^['"]|['"]$/g, '');
                    if (t) out.push(t.toLowerCase());
                }
            }
            for (let j = i + 1; j < lines.length; j++) {
                const l = lines[j];
                const m = l.match(/^\s*-\s*(.+)\s*$/);
                if (!m) break;
                const t = m[1].trim().replace(/^['"]|['"]$/g, '');
                if (t) out.push(t.toLowerCase());
            }
            break;
        }
    }

    return Array.from(new Set(out));
}

export function extractTags(markdown: string): Tag[] {
    if (!markdown) return [];

    // Frontmatter
    let fmTags: Tag[] = [];
    const fmMatch = markdown.match(YAML_FRONTMATTER_CAPTURE_RE);
    if (fmMatch) {
        fmTags = parseFrontmatterTags(fmMatch[1]);
    }

    // Remove frontmatter from scan area
    let scan = markdown.replace(YAML_FRONTMATTER_CAPTURE_RE, '');

    scan = scan
        .replace(FENCE_RE, ' ')
        .replace(INLINE_CODE_RE, ' ')
        .replace(HTML_COMMENT_RE, ' ')
        .replace(HTML_TAG_RE, ' ')
        .replace(LINK_RE, ' ')
        .replace(AUTOLINK_RE, ' ');

    const found = new Set<Tag>(fmTags);
    let m: RegExpExecArray | null;
    while ((m = HASH_TAG_RE.exec(scan)) !== null) {
        const candidate = m[2];
        if (HEX_COLOR_RE.test(candidate)) continue;
        found.add(candidate.toLowerCase());
    }
    return Array.from(found);
}

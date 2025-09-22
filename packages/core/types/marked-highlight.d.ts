declare module 'marked-highlight' {
  import type { MarkedExtension } from 'marked';

  export interface MarkedHighlightOptions {
    langPrefix?: string;
    highlight?: (code: string, lang: string) => string;
  }

  export function markedHighlight(options?: MarkedHighlightOptions): MarkedExtension;
}

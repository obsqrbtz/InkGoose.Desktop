import { Document } from 'flexsearch';
import { FileNode, SearchResult } from '../types';
import { FileSystemAPI } from '../api/fileSystemAPI';

interface IndexedNote {
    id: string;
    path: string;
    name: string;
    content: string;
    title: string;
    tags: string[];
    [key: string]: string | string[]; // Index signature for FlexSearch compatibility
}

export class SearchService {
    private index: Document<IndexedNote>;
    private notes: Map<string, IndexedNote> = new Map();
    private isIndexing = false;

    constructor() {
        this.index = new Document<IndexedNote>({
            document: {
                id: "id",
                index: [
                    "title",
                    "content",
                    "tags"
                ],
                store: [
                    "path",
                    "name",
                    "title",
                    "tags"
                ]
            },
            tokenize: "forward",
            resolution: 9
        });
    }

    async buildIndex(files: FileNode[]): Promise<void> {
        if (this.isIndexing) {
            return;
        }

        this.isIndexing = true;

        try {
            this.notes.clear();

            const markdownFiles = this.getAllMarkdownFiles(files);

            for (const file of markdownFiles) {
                try {
                    await this.indexFile(file);
                } catch (error) {
                    console.warn(`Failed to index file ${file.path}:`, error);
                }
            }
            
        } finally {
            this.isIndexing = false;
        }
    }

    private getAllMarkdownFiles(files: FileNode[]): FileNode[] {
        const markdownFiles: FileNode[] = [];

        const walk = (nodes: FileNode[]) => {
            for (const node of nodes) {
                if (node.type === 'directory' && node.children) {
                    walk(node.children);
                } else if (node.type === 'file' && node.extension === '.md') {
                    markdownFiles.push(node);
                }
            }
        };

        walk(files);
        return markdownFiles;
    }

    private async indexFile(file: FileNode): Promise<void> {
        try {
            const content = await FileSystemAPI.readFile(file.path);
            const title = this.extractTitle(content, file.name);
            const tags = this.extractTags(content);

            const indexedNote: IndexedNote = {
                id: file.path,
                path: file.path,
                name: file.name,
                content: this.cleanContent(content),
                title,
                tags
            };

            this.notes.set(file.path, indexedNote);
            await this.index.add(indexedNote);
        } catch (error) {
            console.warn(`Failed to index file ${file.path}:`, error);
        }
    }

    private extractTitle(content: string, fileName: string): string {
        const headingMatch = content.match(/^#\s+(.+)$/m);
        if (headingMatch) {
            return headingMatch[1].trim();
        }

        return fileName.replace(/\.md$/, '');
    }

    private extractTags(content: string): string[] {
        const tagMatches = content.match(/#[\w\-_]+/g);
        return tagMatches ? tagMatches.map(tag => tag.slice(1)) : [];
    }

    private cleanContent(content: string): string {
        const withoutFrontMatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');

        return withoutFrontMatter
            .replace(/!\[.*?\]\(.*?\)/g, '') // Images
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
            .replace(/`([^`]+)`/g, '$1') // Inline code
            .replace(/```[\s\S]*?```/g, '') // Code blocks
            .replace(/^#{1,6}\s+/gm, '') // Headings
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1') // Italic
            .replace(/^\s*[-*+]\s+/gm, '') // List items
            .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
            .replace(/^\s*>\s+/gm, '') // Blockquotes
            .trim();
    }

    async search(query: string): Promise<SearchResult[]> {
        if (!query.trim()) {
            return [];
        }

        try {
            const results = await this.index.search(query, {});
            const searchResults: Map<string, SearchResult> = new Map();

            for (const result of results) {
                if (typeof result === 'object' && 'result' in result) {
                    for (const docId of result.result) {
                        const note = this.notes.get(docId as string);
                        if (note && !searchResults.has(note.path)) {
                            const excerpt = this.generateExcerpt(note.content, query);
                            const matches = this.countMatches(note.content + ' ' + note.title, query);

                            searchResults.set(note.path, {
                                file: {
                                    name: note.name,
                                    path: note.path,
                                    type: 'file',
                                    extension: '.md'
                                } as FileNode,
                                excerpt,
                                matches,
                                score: matches
                            });
                        }
                    }
                }
            }

            return Array.from(searchResults.values())
                .sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }

    private generateExcerpt(content: string, query: string): string {
        const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

        for (const sentence of sentences) {
            const lowerSentence = sentence.toLowerCase();
            if (queryTerms.some(term => lowerSentence.includes(term))) {
                let excerpt = sentence.trim();

                for (const term of queryTerms) {
                    const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
                    excerpt = excerpt.replace(regex, '<mark>$1</mark>');
                }

                if (excerpt.length > 200) {
                    excerpt = excerpt.substring(0, 197) + '...';
                }

                return excerpt;
            }
        }

        let excerpt = content.substring(0, 150).trim();
        if (content.length > 150) {
            excerpt += '...';
        }

        return excerpt;
    }

    private countMatches(text: string, query: string): number {
        const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        const lowerText = text.toLowerCase();

        return queryTerms.reduce((count, term) => {
            const matches = lowerText.split(term).length - 1;
            return count + matches;
        }, 0);
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async updateNote(filePath: string, content: string, fileName: string): Promise<void> {
        const title = this.extractTitle(content, fileName);
        const tags = this.extractTags(content);

        const indexedNote: IndexedNote = {
            id: filePath,
            path: filePath,
            name: fileName,
            content: this.cleanContent(content),
            title,
            tags
        };

        if (this.notes.has(filePath)) {
            await this.index.remove(filePath);
        }

        this.notes.set(filePath, indexedNote);
        await this.index.add(indexedNote);
    }

    async removeNote(filePath: string): Promise<void> {
        if (this.notes.has(filePath)) {
            await this.index.remove(filePath);
            this.notes.delete(filePath);
        }
    }

    getIndexSize(): number {
        return this.notes.size;
    }

    isReady(): boolean {
        return !this.isIndexing && this.notes.size > 0;
    }
}

export const searchService = new SearchService();

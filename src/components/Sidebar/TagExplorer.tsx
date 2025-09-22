import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store';
import NoteIcon from '../icons/NoteIcon';
import { extractTags } from '../../../packages/core/utils/tags';
import { TagFileRef } from '../../../packages/core/types';
import { ElectronFileSystem } from '../../adapters/electronfileSystem';
import { parseMarkdownFile, extractLinks } from '../../../packages/core/utils/markdown';

const TagExplorer: React.FC = () => {
    const { tagsByName, setCurrentFile, addTab } = useAppStore();
    const [query, setQuery] = useState('');

    const openFile = async (path: string, name: string) => {
        try {
            const fileSystem = new ElectronFileSystem();
            const content = await fileSystem.readFile(path);
            const { frontMatter, body } = parseMarkdownFile(content);
            const links = extractLinks(body);
            const tags = extractTags(content);
            const note = {
                path,
                name,
                content: content,
                frontMatter,
                tags,
                links,
                backlinks: [],
                lastModified: new Date(),
                created: new Date(),
            };
            setCurrentFile(note);
            addTab(note);
        } catch (e) {
            console.error('Open note failed:', e);
        }
    };

    const entries = useMemo(() => {
        const base = Object.entries(tagsByName).sort((a, b) => a[0].localeCompare(b[0]));
        const q = query.trim().toLowerCase();
        return base
            .filter(([tag]) => !q || tag.toLowerCase().includes(q))
            .map(([tag, data]) => ({ tag, files: data.files as TagFileRef[] }));
    }, [tagsByName, query]);

    const showEmpty = entries.length === 0;

    return (
        <>
            <div className="search-input-container" style={{ marginBottom: 12 }}>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Filter tags or files..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
            {showEmpty ? (
                <div className="tags-empty">No tags found{query.trim() ? ` for "${query.trim()}"` : ''}. Add #tags in your notes.</div>
            ) : (
                <div className="tags-list">
                    {entries.map(({ tag, files }) => (
                        <div key={tag} className="tag-group">
                            <div className="tag-header">
                                <span className="tag-name">#{tag}</span>
                                <span className="tag-count">{files.length}</span>
                            </div>
                            <ul className="tag-files">
                                {files.map(file => (
                                    <li key={file.path} className="tag-file" onClick={() => openFile(file.path, file.name)}>
                                        <span className="file-icon"><NoteIcon /></span>
                                        <span className="file-name">{file.name}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default TagExplorer;

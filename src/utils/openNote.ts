import { ElectronFileSystem } from '../adapters/electronfileSystem';
import { useAppStore } from '../store';
import { parseMarkdownFile, extractLinks } from '../../packages/core/utils/markdown';
import { extractTags } from '../../packages/core/utils/tags';

export async function openNote(path: string) {
  const fileSystem = new ElectronFileSystem();
  const { setCurrentFile, addTab, updateNoteTags } = useAppStore.getState();

  const content = await fileSystem.readFile(path);

  const { frontMatter, body } = parseMarkdownFile(content);

  const tags = extractTags(content);
  const links = extractLinks(body);

  const now = new Date();
  const name = path.split(/[/\\]/).pop() || path;

  const note = {
    path,
    name,
    content,
    frontMatter,
    tags,
    links,
    backlinks: [],
    lastModified: now,
    created: now,
  };

  setCurrentFile(note);
  updateNoteTags(path, name, content);
  addTab(note);
}
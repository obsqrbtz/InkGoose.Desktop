import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState, Transaction } from '@codemirror/state';
import { marked, Tokens } from 'marked';
import { markedHighlight } from 'marked-highlight';
// eslint-disable-next-line import/no-unresolved
import hljs from 'highlight.js/lib/common';
import { useAppStore } from '../../store';
import './Editor.css';
import EyeIcon from '../icons/EyeIcon';
import EditIcon from '../icons/EditIcon';
import SplitIcon from '../icons/SplitIcon';
import SaveIcon from '../icons/SaveIcon';
import WarningIcon from '../icons/WarningIcon';
import { inkGooseDark, inkGooseLight } from '../../styles/codemirrorTheme';
import { formatFileSize } from '../../../packages/core/utils/fileUtils';
import ResizableSplitter from './ResizableSplitter';
import { useScrollSync } from '../../hooks/useScrollSync';
import { parseMarkdownFile } from '../../../packages/core/utils/markdown';
import { ElectronFileSystem } from '../../adapters/electronfileSystem';

marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (code.length > 10000) {
        return code;
      }

      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (err) {
          console.error('Syntax highlighting error:', err);
        }
      }

      if (code.length < 5000) {
        try {
          return hljs.highlightAuto(code).value;
        } catch (err) {
          console.error('Auto syntax highlighting error:', err);
        }
      }

      return code;
    }
  })
);

const renderer = new marked.Renderer();

renderer.image = function ({ href, title, text }: Tokens.Image): string {
  const src = href.startsWith('http') ? href : `file://${href}`;

  return `
    <img src="${src}" 
         alt="${text || ''}" 
         ${title ? `title="${title}"` : ''}
         class="markdown-image"
         loading="lazy"
         data-preview-src="${src.replace(/"/g, '&quot;')}">
  `;
};

marked.setOptions({
  breaks: true,
  gfm: true,
  renderer: renderer
});

let isDragging = false;
let startX = 0, startY = 0, translateX = 0, translateY = 0;

function createImagePreviewOverlay(): void {
  const overlay = document.createElement('div');
  overlay.id = 'image-preview-overlay';
  overlay.innerHTML = `
    <div class="preview-container">
      <img id="preview-image" src="" alt="Preview" draggable="false">
      <button class="close-btn" id="close-preview-btn">&times;</button>
      <div class="zoom-controls">
        <button id="zoom-in-btn">+</button>
        <button id="zoom-out-btn">-</button>
        <button id="reset-zoom-btn">↺</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const previewImg = document.getElementById('preview-image') as HTMLImageElement;

  const closeBtn = document.getElementById('close-preview-btn');
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const resetBtn = document.getElementById('reset-zoom-btn');

  if (closeBtn) closeBtn.addEventListener('click', closeImagePreview);
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoomImage(1.2));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoomImage(0.8));
  if (resetBtn) resetBtn.addEventListener('click', resetZoom);

  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) {
      closeImagePreview();
    }
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeImagePreview();
    }
  });

  if (previewImg) {
    previewImg.addEventListener('dragstart', (e: DragEvent) => {
      e.preventDefault();
    });

    previewImg.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoomImage(delta);
    });

    previewImg.addEventListener('mousedown', (e: MouseEvent) => {
      if (currentZoom > 1) {
        e.preventDefault(); // Prevent default drag
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        previewImg.style.cursor = 'grabbing';
      }
    });
  }
}

function constrainTranslation(tx: number, ty: number): { x: number; y: number } {
  const previewImg = document.getElementById('preview-image') as HTMLImageElement;
  if (!previewImg) return { x: tx, y: ty };

  const container = previewImg.parentElement;
  if (!container) return { x: tx, y: ty };

  const imgWidth = previewImg.naturalWidth || previewImg.width;
  const imgHeight = previewImg.naturalHeight || previewImg.height;

  const scaledWidth = imgWidth * currentZoom;
  const scaledHeight = imgHeight * currentZoom;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  const maxTranslateX = (scaledWidth - containerWidth) / 2 / currentZoom;
  const maxTranslateY = (scaledHeight - containerHeight) / 2 / currentZoom;

  if (scaledWidth > containerWidth) {
    tx = Math.max(-maxTranslateX, Math.min(maxTranslateX, tx));
  } else {
    tx = 0;
  }

  if (scaledHeight > containerHeight) {
    ty = Math.max(-maxTranslateY, Math.min(maxTranslateY, ty));
  } else {
    ty = 0;
  }

  return { x: tx, y: ty };
}

document.addEventListener('mousemove', (e: MouseEvent) => {
  if (isDragging) {
    e.preventDefault();
    const previewImg = document.getElementById('preview-image') as HTMLImageElement;
    if (previewImg) {
      let newTranslateX = (e.clientX - startX) / currentZoom;
      let newTranslateY = (e.clientY - startY) / currentZoom;

      const constrained = constrainTranslation(newTranslateX, newTranslateY);
      translateX = constrained.x * currentZoom;
      translateY = constrained.y * currentZoom;

      previewImg.style.transform = `scale(${currentZoom}) translate(${constrained.x}px, ${constrained.y}px)`;
    }
  }
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    startX = 0;
    startY = 0;
    translateX = 0;
    translateY = 0;
    const previewImg = document.getElementById('preview-image') as HTMLImageElement;
    if (previewImg && currentZoom > 1) {
      previewImg.style.cursor = 'grab';
    }
  }
});

let currentZoom = 1;

function openImagePreview(src: string): void {
  let overlay = document.getElementById('image-preview-overlay');
  if (!overlay) {
    createImagePreviewOverlay();
    overlay = document.getElementById('image-preview-overlay');
  }

  if (!overlay) return;

  const previewImg = document.getElementById('preview-image') as HTMLImageElement;
  if (!previewImg) return;

  previewImg.src = src;
  currentZoom = 1;
  previewImg.style.transform = 'scale(1)';
  overlay.classList.add('active');
}

function closeImagePreview(): void {
  const overlay = document.getElementById('image-preview-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

function zoomImage(factor: number): void {
  currentZoom *= factor;
  currentZoom = Math.max(0.5, Math.min(currentZoom, 5));
  const previewImg = document.getElementById('preview-image') as HTMLImageElement;
  if (previewImg) {
    translateX = 0;
    translateY = 0;
    previewImg.style.transform = `scale(${currentZoom}) translate(${translateX}px, ${translateY}px)`;
    previewImg.style.cursor = currentZoom > 1 ? 'grab' : 'normal';
  }
}

function resetZoom(): void {
  currentZoom = 1;
  translateX = 0;
  translateY = 0;
  const previewImg = document.getElementById('preview-image') as HTMLImageElement;
  if (previewImg) {
    previewImg.style.transform = 'scale(1) translate(0px, 0px)';
    previewImg.style.cursor = 'normal';
  }
}

function setupImagePreview(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && target.classList.contains('markdown-image')) {
      const src = target.getAttribute('data-preview-src');
      if (src) {
        openImagePreview(src);
      }
    }
  });
}

setupImagePreview();

const LARGE_FILE_THRESHOLD = 100000; // 100KB
const CHUNK_SIZE = 50000; // 50KB
const RENDER_DELAY = 16;

const fileSystem = new ElectronFileSystem();

interface VirtualPreviewProps {
  content: string;
  isLargeFile: boolean;
}

const VirtualPreview: React.FC<VirtualPreviewProps> = ({ content, isLargeFile }) => {
  const [renderedContent, setRenderedContent] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const processContent = useCallback(async (fullContent: string) => {

    if (!isLargeFile) {
      const { body } = parseMarkdownFile(fullContent);
      const html = marked.parse(body || '') as string;
      setRenderedContent(html);
      return;
    }

    setIsRendering(true);
    setRenderProgress(0);

    try {
      const { body } = parseMarkdownFile(fullContent);
      const chunks = [];

      const paragraphs = body.split(/\n\s*\n/);
      let currentChunk = '';
      let currentSize = 0;

      for (const paragraph of paragraphs) {
        const paragraphSize = paragraph.length;

        if (currentSize + paragraphSize > CHUNK_SIZE && currentChunk) {
          chunks.push(currentChunk);
          currentChunk = paragraph;
          currentSize = paragraphSize;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          currentSize += paragraphSize;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      let accumulatedHtml = '';

      for (let i = 0; i < chunks.length; i++) {
        await new Promise(resolve => setTimeout(resolve, RENDER_DELAY));

        const chunkHtml = marked.parse(chunks[i]) as string;
        accumulatedHtml += chunkHtml;

        setRenderedContent(accumulatedHtml);
        setRenderProgress(((i + 1) / chunks.length) * 100);
      }

    } catch (error) {
      console.error('Preview rendering error:', error);
      setRenderedContent(`<pre>${content}</pre>`);
    } finally {
      setIsRendering(false);
    }
  }, [isLargeFile]);

  useEffect(() => {
    processContent(content);
  }, [content, processContent]);

  return (
    <div className="virtual-preview" ref={containerRef}>
      {isRendering && (
        <div className="rendering-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
          <span>Rendering preview... {Math.round(renderProgress)}%</span>
        </div>
      )}
      <div
        className="markdown-preview"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
    </div>
  );
};

const Editor: React.FC = () => {
  const { currentFile, theme, editorMode, setEditorMode, setCurrentFile, updateNoteTags } = useAppStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useScrollSync({
    enabled: editorMode === 'split',
    editorRef,
    previewRef,
    currentFile,
  });

  const isLargeFile = useMemo(() => {
    const contentLength = currentFile?.content?.length || 0;
    return contentLength > LARGE_FILE_THRESHOLD;
  }, [currentFile?.content]);

  useEffect(() => {
    if (editorRef.current && (editorMode === 'source' || editorMode === 'split') && currentFile) {
      editorRef.current.innerHTML = '';

      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }

      const extensions = [
        basicSetup,
        markdown(),
        ...(theme === 'dark' ? inkGooseDark : inkGooseLight),
      ];

      const initialContent = currentFile.content || '';

      if (isLargeFile) {
        console.warn(`Large file detected: ${initialContent.length} characters. Performance may be impacted.`);
      }

      const state = EditorState.create({
        doc: initialContent,
        extensions,
      });

      viewRef.current = new EditorView({
        state,
        parent: editorRef.current,
        dispatch: (tr: Transaction) => {
          if (viewRef.current) {
            viewRef.current.update([tr]);
            if (tr.docChanged) {
              const newContent = viewRef.current.state.doc.toString();
              setHasUnsavedChanges(newContent !== currentFile?.content);

              if (currentFile) {
                setCurrentFile({
                  ...currentFile,
                  content: newContent
                });
              }
            }
          }
        },
      });

    } else if ((editorMode === 'preview') && viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [theme, editorMode, currentFile?.path, isLargeFile]);

  const handleSave = async () => {
    if (currentFile && viewRef.current && hasUnsavedChanges) {
      try {
        const content = viewRef.current.state.doc.toString();
        await fileSystem.writeFile(currentFile.path, content);
        updateNoteTags(currentFile.path, currentFile.name, content);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Failed to save file: ' + currentFile.name + ': ' + error);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (editorMode === 'source') {
          setEditorMode('preview');
        } else if (editorMode === 'preview') {
          setEditorMode('split');
        } else {
          setEditorMode('source');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFile, hasUnsavedChanges, editorMode]);

  if (!currentFile) {
    return (
      <div className="editor-placeholder">
        <div className="placeholder-content">
          <h2>Welcome to Ink Goose</h2>
          <p>Select a file from the sidebar to start editing</p>
          <div className="placeholder-tips">
            <h3>Quick Tips:</h3>
            <ul>
              <li>Add <code>#tags</code> to organize your notes</li>
              <li>Use <code>Ctrl/Cmd + S</code> to save</li>
              <li>Cycle editor modes with <code>Ctrl/Cmd + P</code></li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="file-info">
          <h3 className="file-title">
            {currentFile.name}
            {hasUnsavedChanges && <span className="unsaved-indicator"> •</span>}
          </h3>
          <span className="file-path">{currentFile.path}</span>
        </div>

        <div className="editor-actions">
          <div className="editor-mode-buttons">
            <button
              className={`mode-btn ${editorMode === 'source' ? 'active' : ''}`}
              onClick={() => setEditorMode('source')}
              title="Source Mode"
            >
              <EditIcon />
            </button>
            <button
              className={`mode-btn ${editorMode === 'split' ? 'active' : ''}`}
              onClick={() => setEditorMode('split')}
              title="Split Mode"
            >
              <SplitIcon />
            </button>
            <button
              className={`mode-btn ${editorMode === 'preview' ? 'active' : ''}`}
              onClick={() => setEditorMode('preview')}
              title="Preview Mode"
            >
              <EyeIcon />
            </button>
          </div>

          <button
            className={`save-btn ${hasUnsavedChanges ? 'has-changes' : ''}`}
            onClick={handleSave}
            title="Save (Ctrl+S)"
            disabled={!hasUnsavedChanges}
          >
            <SaveIcon />
          </button>
        </div>
      </div>

      <div className={`editor-content ${editorMode === 'split' ? 'split-mode' : ''}`}>
        {editorMode === 'source' && (
          <div className="editor-pane">
            {isLargeFile && (
              <div className="performance-warning">
                <span className="warning-icon"><WarningIcon size={16} /></span>
                Large file ({formatFileSize(currentFile?.content?.length || 0)}) may impact editor performance
              </div>
            )}
            <div ref={editorRef} className="codemirror-editor" />
          </div>
        )}

        {editorMode === 'preview' && (
          <div className="preview-pane">
            {isLargeFile && (
              <div className="performance-warning">
                <span className="warning-icon"><WarningIcon size={16} /></span>
                Large file ({formatFileSize(currentFile?.content?.length || 0)}) may impact editor performance
              </div>
            )}
            <VirtualPreview
              content={currentFile.content || ''}
              isLargeFile={isLargeFile}
            />
          </div>
        )}

        {editorMode === 'split' && (
          <ResizableSplitter
            leftPane={
              <div className="editor-pane">
                {isLargeFile && (
                  <div className="performance-warning">
                    <span className="warning-icon"><WarningIcon size={16} /></span>
                    Large file ({formatFileSize(currentFile?.content?.length || 0)}) may impact editor performance
                  </div>
                )}
                <div ref={editorRef} className="codemirror-editor" />
              </div>
            }
            rightPane={
              <div className="preview-pane" ref={previewRef}>
                {isLargeFile && (
                  <div className="performance-warning">
                    <span className="warning-icon"><WarningIcon size={16} /></span>
                    Large file ({formatFileSize(currentFile?.content?.length || 0)}) may impact editor performance
                  </div>
                )}
                <VirtualPreview
                  content={currentFile.content || ''}
                  isLargeFile={isLargeFile}
                />
              </div>
            }
            defaultSplitPercentage={50}
            minLeftWidth={300}
            minRightWidth={300}
          />
        )}
      </div>
    </div>
  );
};

export default Editor;

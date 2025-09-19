import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState, Transaction } from '@codemirror/state';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
// eslint-disable-next-line import/no-unresolved
import hljs from 'highlight.js/lib/common';
import { useAppStore } from '../../store/appStore';
import { FileSystemAPI } from '../../api/fileSystemAPI';
import './Editor.css';
import EyeIcon from '../icons/EyeIcon';
import EditIcon from '../icons/EditIcon';
import SplitIcon from '../icons/SplitIcon';
import SaveIcon from '../icons/SaveIcon';
import WarningIcon from '../icons/WarningIcon';
import { inkGooseDark, inkGooseLight } from '../../styles/codemirrorTheme';
import { formatFileSize } from '../../utils/fileUtils';
import ResizableSplitter from './ResizableSplitter';
import { useScrollSync } from '../../hooks/useScrollSync';

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
marked.setOptions({
  breaks: true,
  gfm: true,
});

const LARGE_FILE_THRESHOLD = 100000; // 100KB
const CHUNK_SIZE = 50000; // 50KB
const RENDER_DELAY = 16;

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
      const { body } = FileSystemAPI.parseMarkdownFile(fullContent);
      const html = marked.parse(body || '') as string;
      setRenderedContent(html);
      return;
    }

    setIsRendering(true);
    setRenderProgress(0);

    try {
      const { body } = FileSystemAPI.parseMarkdownFile(fullContent);
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
        await FileSystemAPI.writeFile(currentFile.path, content);
        updateNoteTags(currentFile.path, currentFile.name, content);
        setHasUnsavedChanges(false);
        console.log('File ' + currentFile.name + ' saved successfully');
      } catch (error) {
        console.error('Failed to save file: ' + currentFile.name + ': ' + error);
        alert('Failed to save file: ' + error);
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
              <li>Use <code>[[Link Name]]</code> to create wiki-style links</li>
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

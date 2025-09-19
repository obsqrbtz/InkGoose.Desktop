import { useEffect, useRef, useCallback } from 'react';

interface UseScrollSyncOptions {
    enabled: boolean;
    editorRef: React.RefObject<HTMLDivElement | null>;
    previewRef: React.RefObject<HTMLDivElement | null>;
    currentFile?: { path: string } | null;
}

export const useScrollSync = ({ enabled, editorRef, previewRef, currentFile }: UseScrollSyncOptions) => {
    const syncingRef = useRef<'editor' | 'preview' | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const resetSyncFlag = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            syncingRef.current = null;
        }, 50);
    }, []);

    const syncScrollPosition = useCallback((
        source: HTMLElement,
        target: HTMLElement,
        sourceType: 'editor' | 'preview'
    ) => {
        if (!enabled || syncingRef.current === sourceType) return;

        syncingRef.current = sourceType;

        const sourceScrollPercentage = source.scrollHeight > source.clientHeight
            ? source.scrollTop / (source.scrollHeight - source.clientHeight)
            : 0;

        const targetMaxScroll = Math.max(0, target.scrollHeight - target.clientHeight);

        if (targetMaxScroll > 0) {
            const targetScrollTop = sourceScrollPercentage * targetMaxScroll;
            target.scrollTop = targetScrollTop;
        }

        resetSyncFlag();
    }, [enabled, resetSyncFlag]);

    useEffect(() => {
        if (!enabled || !editorRef.current || !previewRef.current) return; const setupTimeout = setTimeout(() => {
            const editorElement = editorRef.current?.querySelector('.cm-scroller') as HTMLElement;
            const previewElement = previewRef.current;

            if (!editorElement || !previewElement) {
                console.warn('Scroll sync: Could not find editor or preview elements', {
                    editorElement: !!editorElement,
                    previewElement: !!previewElement,
                    editorRef: editorRef.current,
                    previewRef: previewRef.current
                });
                return;
            }

            const handleEditorScroll = () => {
                if (syncingRef.current === 'editor') return;
                syncScrollPosition(editorElement, previewElement, 'editor');
            };

            const handlePreviewScroll = () => {
                if (syncingRef.current === 'preview') return;
                syncScrollPosition(previewElement, editorElement, 'preview');
            };

            editorElement.addEventListener('scroll', handleEditorScroll, { passive: true });
            previewElement.addEventListener('scroll', handlePreviewScroll, { passive: true });

            return () => {
                editorElement.removeEventListener('scroll', handleEditorScroll);
                previewElement.removeEventListener('scroll', handlePreviewScroll);
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
            };
        }, 200);

        return () => {
            clearTimeout(setupTimeout);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [enabled, editorRef, previewRef, syncScrollPosition, currentFile]);

    return { syncingRef };
};

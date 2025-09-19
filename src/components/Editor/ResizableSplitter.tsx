import React, { useState, useCallback, useRef, useEffect } from 'react';
import './ResizableSplitter.css';

interface ResizableSplitterProps {
    leftPane: React.ReactNode;
    rightPane: React.ReactNode;
    defaultSplitPercentage?: number;
    minLeftWidth?: number;
    minRightWidth?: number;
    leftPaneRef?: React.RefObject<HTMLDivElement | null>;
    rightPaneRef?: React.RefObject<HTMLDivElement | null>;
    onSplitChange?: (percentage: number) => void;
}

const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
    leftPane,
    rightPane,
    defaultSplitPercentage = 50,
    minLeftWidth = 200,
    minRightWidth = 200,
    leftPaneRef,
    rightPaneRef,
    onSplitChange,
}) => {
    const [splitPercentage, setSplitPercentage] = useState(defaultSplitPercentage);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const mouseX = e.clientX - containerRect.left;

        let newPercentage = (mouseX / containerWidth) * 100;

        const minLeftPercentage = (minLeftWidth / containerWidth) * 100;
        const minRightPercentage = (minRightWidth / containerWidth) * 100;

        newPercentage = Math.max(minLeftPercentage, Math.min(100 - minRightPercentage, newPercentage));

        setSplitPercentage(newPercentage);
        onSplitChange?.(newPercentage);
    }, [isDragging, minLeftWidth, minRightWidth]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div ref={containerRef} className="resizable-splitter-container">
            <div
                className="resizable-pane left-pane"
                style={{ width: `${splitPercentage}%` }}
                ref={leftPaneRef}
            >
                {leftPane}
            </div>

            <div
                className={`splitter-handle ${isDragging ? 'dragging' : ''}`}
                onMouseDown={handleMouseDown}
            >
                <div className="splitter-line" />
            </div>

            <div
                className="resizable-pane right-pane"
                style={{ width: `${100 - splitPercentage}%` }}
                ref={rightPaneRef}
            >
                {rightPane}
            </div>
        </div>
    );
};

export default ResizableSplitter;

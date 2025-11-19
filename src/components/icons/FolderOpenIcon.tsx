import React from 'react';

type Props = { size?: number; className?: string; title?: string };

const FolderOpenIcon: React.FC<Props> = ({ size = 24, className, title }) => (
    <svg
        className={className || 'icon'}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={title || undefined}
        aria-hidden={title ? undefined : true}
    >
        {title ? <title>{title}</title> : null}
        <path 
            d="M4 6a2 2 0 0 1 2-2h4.5l1.5 2h6a2 2 0 0 1 2 2v1" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
        />
        <path 
            d="M2 11h20l-2 8H4l-2-8Z" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            fill="none"
        />
    </svg>
);

export default FolderOpenIcon;

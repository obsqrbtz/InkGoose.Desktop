import React from 'react';

type Props = { size?: number; className?: string; title?: string };

const FolderOpenIcon: React.FC<Props> = ({ size, className, title }) => (
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
        <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 10h18a2 2 0 0 1 1.94 2.5l-1.2 4A2 2 0 0 1 19.82 18H6.18a2 2 0 0 1-1.92-1.5l-1.2-4A2 2 0 0 1 3 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default FolderOpenIcon;

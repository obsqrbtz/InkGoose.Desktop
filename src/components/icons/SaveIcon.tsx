import React from 'react';

type Props = { size?: number; className?: string; title?: string };

const SaveIcon: React.FC<Props> = ({ size, className, title }) => (
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
        <path d="M5 3h11l5 5v13a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M7 3v8h10V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <rect x="8" y="15" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="2" />
    </svg>
);

export default SaveIcon;

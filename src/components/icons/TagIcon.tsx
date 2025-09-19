import React from 'react';

type Props = { size?: number; className?: string; title?: string };

const TagIcon: React.FC<Props> = ({ size, className, title }) => (
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
        <path d="M20.59 13.41 12 22l-9-9V4a2 2 0 0 1 2-2h9l8.59 8.59a2 2 0 0 1 0 2.82Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
);

export default TagIcon;

import React from 'react';

type Props = { size?: number; className?: string; title?: string };

const EyeIcon: React.FC<Props> = ({ size, className, title }) => (
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
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
);

export default EyeIcon;

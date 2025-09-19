import React from 'react';

type Props = { size?: number; className?: string; title?: string };

const SunIcon: React.FC<Props> = ({ size, className, title }) => (
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
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

export default SunIcon;

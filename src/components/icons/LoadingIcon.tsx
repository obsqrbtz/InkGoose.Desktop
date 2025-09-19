import React from 'react';

type Props = { size?: number; className?: string; title?: string };

const LoadingIcon: React.FC<Props> = ({ size, className, title }) => (
    <svg
        className={className || 'icon loading-spin'}
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
        <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="15.708"
            strokeDashoffset="31.416"
        />
    </svg>
);

export default LoadingIcon;

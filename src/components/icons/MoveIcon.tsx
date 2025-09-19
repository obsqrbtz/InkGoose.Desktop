import React from 'react';

type Props = { size?: number; className?: string; title?: string };

const MoveIcon: React.FC<Props> = ({ size, className, title }) => (
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
        <path d="M12 19l7-7 3 3-7 7-3-3zM5 10l7-7 3 3-7 7-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default MoveIcon;

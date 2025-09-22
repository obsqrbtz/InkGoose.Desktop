import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store';
import './UserMenu.css';

const UserMenu: React.FC = () => {
    const { user, logout } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleLogout = async () => {
        try {
            await logout();
            setIsOpen(false);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    if (!user) {
        return null;
    }

    const initials = user.username
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="user-menu" ref={menuRef}>
            <button
                className="user-menu-trigger"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
            >
                <div className="user-avatar" title={user.username}>
                    {initials}
                </div>
                <span>{user.username}</span>
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                    }}
                >
                    <polyline points="6,9 12,15 18,9" />
                </svg>
            </button>

            {isOpen && (
                <div className="user-menu-dropdown" role="menu">
                    <div className="user-menu-header">
                        <div className="user-menu-name">{user.username}</div>
                        <div className="user-menu-email">{user.email}</div>
                    </div>

                    <div className="user-menu-section">
                        <button
                            className="user-menu-item"
                            onClick={() => {
                                setIsOpen(false);
                                // TODO: Implement account settings
                            }}
                            role="menuitem"
                        >
                            <svg className="user-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="m12 1 1.4 1.4L16 2l.6 1.4L18 5l1.4.6L20 8l-1.4 1.4L18 12l-1.4 1.4L16 16l-.6 1.4L14 19l-1.4-.6L10 18l-1.4-.6L7 16l-.6-1.4L5 12l.6-1.4L6 8l1.4-.6L10 6l1.4-.6L12 3Z" />
                            </svg>
                            Account Settings
                        </button>

                        <button
                            className="user-menu-item danger"
                            onClick={handleLogout}
                            role="menuitem"
                        >
                            <svg className="user-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16,17 21,12 16,7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserMenu;

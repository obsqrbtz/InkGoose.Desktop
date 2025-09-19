import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useClickOutside } from '../../hooks/useCommon';
import SunIcon from '../icons/SunIcon';
import MoonIcon from '../icons/MoonIcon';
import MonitorIcon from '../icons/MonitorIcon';
import './ThemeToggle.css';

interface ThemeToggleProps {
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ isOpen, onToggle, onClose }) => {
    const { theme, themePreference, setTheme } = useTheme();
    const ref = useClickOutside({ onClickOutside: onClose, enabled: isOpen }) as React.RefObject<HTMLDivElement>;

    const themeOptions = [
        { id: 'light' as const, label: 'Light', icon: <SunIcon /> },
        { id: 'dark' as const, label: 'Dark', icon: <MoonIcon /> },
        { id: 'system' as const, label: 'System', icon: <MonitorIcon /> }
    ];

    const handleThemeSelect = (themeId: 'light' | 'dark' | 'system') => {
        setTheme(themeId);
        onClose();
    };

    const getCurrentIcon = () => {
        if (themePreference === 'system') return <MonitorIcon />;
        return theme === 'dark' ? <MoonIcon /> : <SunIcon />;
    };

    return (
        <div className="theme-toggle-wrap" ref={ref}>
            <button
                className="icon-btn theme-btn"
                onClick={onToggle}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                title={`Theme: ${themePreference}`}
            >
                {getCurrentIcon()}
            </button>
            {isOpen && (
                <div className="theme-menu" role="menu">
                    {themeOptions.map(option => (
                        <button
                            key={option.id}
                            role="menuitemradio"
                            aria-checked={themePreference === option.id}
                            className={`menu-item ${themePreference === option.id ? 'active' : ''}`}
                            onClick={() => handleThemeSelect(option.id)}
                        >
                            <span className="menu-item-content">
                                {option.icon}
                                <span>{option.label}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
import React from 'react';
import './ContextMenu.css';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    items: ContextMenuItem[];
}

interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, items }) => {
    React.useEffect(() => {
        const handleClickOutside = () => {
            onClose();
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    return (
        <div
            className="context-menu"
            style={{
                position: 'fixed',
                left: x,
                top: y,
                zIndex: 1000
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {items.map((item, index) => (
                <button
                    key={index}
                    className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
                    onClick={() => {
                        if (!item.disabled) {
                            item.onClick();
                            onClose();
                        }
                    }}
                    disabled={item.disabled}
                >
                    {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                    <span className="context-menu-label">{item.label}</span>
                </button>
            ))}
        </div>
    );
};

export default ContextMenu;
export type { ContextMenuItem };

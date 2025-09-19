import React, { useState, useEffect } from 'react';
import './InputModal.css';

interface InputModalProps {
    isOpen: boolean;
    title: string;
    placeholder?: string;
    defaultValue?: string;
    onSubmit: (value: string) => void;
    onCancel: () => void;
}

const InputModal: React.FC<InputModalProps> = ({
    isOpen,
    title,
    placeholder,
    defaultValue = '',
    onSubmit,
    onCancel,
}) => {
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        setValue(defaultValue);
    }, [defaultValue, isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, value]);

    const handleSubmit = () => {
        if (value.trim()) {
            onSubmit(value.trim());
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">{title}</h3>
                <input
                    type="text"
                    className="modal-input"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    autoFocus
                />
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-cancel" onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        className="modal-btn modal-btn-submit"
                        onClick={handleSubmit}
                        disabled={!value.trim()}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InputModal;

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseClickOutsideProps {
    onClickOutside: () => void;
    enabled?: boolean;
}

export const useClickOutside = ({ onClickOutside, enabled = true }: UseClickOutsideProps) => {
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!enabled) return;

        const handleClick = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClickOutside();
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClickOutside();
            }
        };

        document.addEventListener('mousedown', handleClick, true);
        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            document.removeEventListener('mousedown', handleClick, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [onClickOutside, enabled]);

    return ref;
};

export const useToggle = (initialValue = false) => {
    const [value, setValue] = useState(initialValue);

    const toggle = useCallback(() => setValue(v => !v), []);
    const setTrue = useCallback(() => setValue(true), []);
    const setFalse = useCallback(() => setValue(false), []);

    return { value, toggle, setTrue, setFalse, setValue };
};

export const useLocalStorage = <T>(key: string, defaultValue: T) => {
    const [value, setValue] = useState<T>(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    const setStoredValue = useCallback((newValue: T | ((val: T) => T)) => {
        try {
            const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
            setValue(valueToStore);
            localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.warn(`Error saving to localStorage key "${key}":`, error);
        }
    }, [key, value]);

    return [value, setStoredValue] as const;
};
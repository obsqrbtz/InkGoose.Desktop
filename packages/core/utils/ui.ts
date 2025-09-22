import { ReactNode } from 'react';

export interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children?: ReactNode;
    className?: string;
}

export interface InputModalData {
    title: string;
    placeholder: string;
    value?: string;
    onSubmit: (value: string) => void | Promise<void>;
    onCancel: () => void;
}

export interface ConfirmModalData {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'danger';
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

export interface AsyncOperationResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface FormFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'email' | 'password';
    placeholder?: string;
    required?: boolean;
    error?: string;
}

export interface ThemeMenuOption {
    id: 'light' | 'dark' | 'system';
    label: string;
    icon: ReactNode;
}

export interface TabItem {
    id: string;
    label: string;
    icon?: ReactNode;
    content: ReactNode;
}

export interface MenuAction {
    id: string;
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    variant?: 'default' | 'danger';
    disabled?: boolean;
}
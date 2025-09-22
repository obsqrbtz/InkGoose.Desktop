import React from 'react';
import { FormFieldProps } from '../../../packages/core/utils/ui';
import './FormField.css';

export const FormField: React.FC<FormFieldProps> = ({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    required = false,
    error
}) => {
    return (
        <div className={`form-field ${error ? 'has-error' : ''}`}>
            <label className="form-label">
                {label}
                {required && <span className="required">*</span>}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="form-input"
                required={required}
            />
            {error && <span className="form-error">{error}</span>}
        </div>
    );
};
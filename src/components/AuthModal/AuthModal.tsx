import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { CryptoService } from '../../../packages/core/services/cryptoService/cryptoService';
import './AuthModal.css';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode?: 'optional' | 'required';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, mode = 'optional' }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [showRecoveryKey, setShowRecoveryKey] = useState(false);
    const [recoveryKey, setRecoveryKey] = useState<string>('');
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
    });

    const { login, register } = useAppStore();

    if (!isOpen) return null;

    const parseErrorMessage = (errorMessage: string): string[] => {
        try {
            const parsed = JSON.parse(errorMessage);

            // { "errors": ["Error message"], "errorCodes": [...] }
            if (parsed.errors && Array.isArray(parsed.errors)) {
                return parsed.errors.map((error: string) => error);
            }
            return [errorMessage];
        } catch {
            return [errorMessage];
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrors([]);

        try {
            if (isLogin) {
                await login(formData.email, formData.password);
            } else {
                const cryptoService = new CryptoService();
                const encryptionKeys = cryptoService.generateRegistrationKeys(formData.password);

                const recoveryKeyHex = Array.from(encryptionKeys.recoveryKey)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                setRecoveryKey(recoveryKeyHex);

                await register(
                    formData.username,
                    formData.email,
                    formData.password,
                    encryptionKeys.encMasterKey_pw,
                    encryptionKeys.encMasterKey_recovery,
                    encryptionKeys.kdfParams
                );

                setShowRecoveryKey(true);
                return;
            }
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
            const parsedErrors = parseErrorMessage(errorMessage);
            setErrors(parsedErrors);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        if (errors.length > 0) {
            setErrors([]);
        }
    };

    const handleGuestMode = () => {
        onClose();
    };

    const handleRecoveryKeySaved = () => {
        setShowRecoveryKey(false);
        setRecoveryKey('');
        onClose();
    };

    const copyRecoveryKey = () => {
        navigator.clipboard.writeText(recoveryKey);
    };

    const downloadRecoveryKey = () => {
        const blob = new Blob([recoveryKey], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recovery-key.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (showRecoveryKey) {
        return (
            <div className="auth-modal">
                <div className="auth-modal-content">
                    <div className="auth-modal-header">
                        <h2 className="auth-modal-title">Save Your Recovery Key</h2>
                        <p className="auth-modal-subtitle">
                            This is your recovery key. Save it securely - you'll need it to recover your account if you forget your password.
                            <strong> This key will only be shown once!</strong>
                        </p>
                    </div>

                    <div className="recovery-key-container">
                        <div className="recovery-key-display">
                            <code>{recoveryKey}</code>
                        </div>

                        <div className="recovery-key-actions">
                            <button
                                type="button"
                                className="auth-btn auth-btn-secondary"
                                onClick={copyRecoveryKey}
                            >
                                Copy to Clipboard
                            </button>
                            <button
                                type="button"
                                className="auth-btn auth-btn-secondary"
                                onClick={downloadRecoveryKey}
                            >
                                Download as File
                            </button>
                        </div>

                        <div className="recovery-key-warning">
                            <p>⚠️ Store this key in a safe place. Without it, you cannot recover your encrypted data if you forget your password.</p>
                        </div>

                        <button
                            type="button"
                            className="auth-btn auth-btn-primary"
                            onClick={handleRecoveryKeySaved}
                        >
                            I've Saved My Recovery Key
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-modal">
            <div className="auth-modal-content">
                <div className="auth-modal-header">
                    <h2 className="auth-modal-title">
                        {isLogin ? 'Sign In' : 'Create Account'}
                    </h2>
                    <p className="auth-modal-subtitle">
                        {isLogin
                            ? 'Welcome back! Sign in to sync your notes across devices.'
                            : 'Create an account to sync your notes across devices.'
                        }
                    </p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="auth-form-group">
                            <label className="auth-form-label" htmlFor="username">
                                Username
                            </label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                className="auth-form-input"
                                value={formData.username}
                                onChange={handleInputChange}
                                required={!isLogin}
                                disabled={loading}
                            />
                        </div>
                    )}

                    <div className="auth-form-group">
                        <label className="auth-form-label" htmlFor="email">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            className="auth-form-input"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="auth-form-group">
                        <label className="auth-form-label" htmlFor="password">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            className="auth-form-input"
                            value={formData.password}
                            onChange={handleInputChange}
                            required
                            disabled={loading}
                            minLength={6}
                        />
                    </div>

                    {errors.length > 0 && (
                        <div className="auth-form-error">
                            {errors.length === 1 ? (
                                errors[0]
                            ) : (
                                <ul className="auth-error-list">
                                    {errors.map((error, index) => (
                                        <li key={index}>{error}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <div className="auth-form-buttons">
                        <button
                            type="submit"
                            className="auth-btn auth-btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="auth-loading-spinner" />
                            ) : (
                                isLogin ? 'Sign In' : 'Create Account'
                            )}
                        </button>

                        {mode === 'optional' && (
                            <button
                                type="button"
                                className="auth-btn auth-btn-secondary"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>

                <div className="auth-toggle">
                    <span className="auth-toggle-text">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                    </span>
                    <button
                        type="button"
                        className="auth-toggle-link"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setErrors([]);
                        }}
                        disabled={loading}
                    >
                        {isLogin ? 'Create one' : 'Sign in'}
                    </button>
                </div>

                {mode === 'optional' && (
                    <div className="auth-guest-mode">
                        <button
                            type="button"
                            className="auth-guest-btn"
                            onClick={handleGuestMode}
                            disabled={loading}
                        >
                            Continue as guest
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthModal;

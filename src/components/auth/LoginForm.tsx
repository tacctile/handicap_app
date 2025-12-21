/**
 * LoginForm Component
 *
 * Email and password login form with loading state, error display,
 * forgot password link, and signup navigation.
 */

import { useState, useCallback, type FormEvent } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useToasts, ResponsiveToastContainer } from '../Toast';
import type { AuthError } from '../../services/auth/types';

// ============================================================================
// TYPES
// ============================================================================

export interface LoginFormProps {
  /** Callback when user wants to switch to signup */
  onSwitchToSignup: () => void;
  /** Callback after successful login */
  onSuccess?: () => void;
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#B4B4B6',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    color: '#EEEFF1',
    backgroundColor: '#1A1A1C',
    border: '1px solid #2A2A2C',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  inputFocus: {
    borderColor: '#19abb5',
    boxShadow: '0 0 0 2px rgba(25, 171, 181, 0.2)',
  },
  inputError: {
    borderColor: '#ef4444',
    boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)',
  },
  errorMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '14px',
  },
  errorIcon: {
    fontSize: '18px',
    flexShrink: 0,
  },
  submitButton: {
    width: '100%',
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#0A0A0B',
    backgroundColor: '#19abb5',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s, transform 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '8px',
  },
  submitButtonHover: {
    backgroundColor: '#1b7583',
  },
  submitButtonDisabled: {
    backgroundColor: '#2A2A2C',
    color: '#6E6E70',
    cursor: 'not-allowed',
  },
  forgotPassword: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '14px',
    color: '#19abb5',
    cursor: 'pointer',
    textAlign: 'right',
    alignSelf: 'flex-end',
    marginTop: '-8px',
    transition: 'color 0.2s',
  },
  forgotPasswordHover: {
    color: '#36d1da',
  },
  switchText: {
    textAlign: 'center',
    fontSize: '14px',
    color: '#B4B4B6',
    marginTop: '16px',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '14px',
    color: '#19abb5',
    cursor: 'pointer',
    fontWeight: 500,
    marginLeft: '4px',
    transition: 'color 0.2s',
  },
  switchLinkHover: {
    color: '#36d1da',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(10, 10, 11, 0.3)',
    borderTopColor: '#0A0A0B',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * LoginForm provides email/password authentication with error handling.
 *
 * @example
 * ```tsx
 * <LoginForm
 *   onSwitchToSignup={() => setShowSignup(true)}
 *   onSuccess={() => navigate('/dashboard')}
 * />
 * ```
 */
export function LoginForm({ onSwitchToSignup, onSuccess }: LoginFormProps) {
  const { signIn, isLoading, error, clearError } = useAuthContext();
  const { toasts, addToast, dismissToast } = useToasts();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      clearError();

      if (!email.trim() || !password) {
        return;
      }

      try {
        await signIn(email.trim(), password);
        onSuccess?.();
      } catch (err) {
        // Error is already in context state
        const authError = err as AuthError;
        if (authError?.message) {
          // Error already displayed via error state
        }
      }
    },
    [email, password, signIn, clearError, onSuccess]
  );

  const handleForgotPassword = useCallback(() => {
    addToast('Password reset coming soon', 'info', { duration: 3000 });
  }, [addToast]);

  const getInputStyle = (fieldName: string, hasError: boolean = false) => ({
    ...styles.input,
    ...(focusedField === fieldName ? styles.inputFocus : {}),
    ...(hasError && focusedField !== fieldName ? styles.inputError : {}),
  });

  const getButtonStyle = (
    buttonName: string,
    baseStyle: React.CSSProperties,
    hoverStyle: React.CSSProperties,
    disabled?: boolean
  ) => ({
    ...baseStyle,
    ...(hoveredButton === buttonName && !disabled ? hoverStyle : {}),
    ...(disabled ? styles.submitButtonDisabled : {}),
  });

  const isFormValid = email.trim().length > 0 && password.length > 0;
  const isSubmitDisabled = isLoading || !isFormValid;

  return (
    <>
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Error Message */}
        {error && (
          <div style={styles.errorMessage}>
            <span className="material-icons" style={styles.errorIcon}>
              error
            </span>
            {error.message}
          </div>
        )}

        {/* Email Field */}
        <div style={styles.inputGroup}>
          <label htmlFor="login-email" style={styles.label}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isLoading}
            style={getInputStyle('email', !!error)}
          />
        </div>

        {/* Password Field */}
        <div style={styles.inputGroup}>
          <label htmlFor="login-password" style={styles.label}>
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={isLoading}
            style={getInputStyle('password', !!error)}
          />
        </div>

        {/* Forgot Password Link */}
        <button
          type="button"
          onClick={handleForgotPassword}
          onMouseEnter={() => setHoveredButton('forgot')}
          onMouseLeave={() => setHoveredButton(null)}
          style={getButtonStyle('forgot', styles.forgotPassword, styles.forgotPasswordHover)}
        >
          Forgot password?
        </button>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          onMouseEnter={() => setHoveredButton('submit')}
          onMouseLeave={() => setHoveredButton(null)}
          style={getButtonStyle(
            'submit',
            styles.submitButton,
            styles.submitButtonHover,
            isSubmitDisabled
          )}
        >
          {isLoading ? (
            <>
              <div style={styles.spinner} />
              Signing in...
            </>
          ) : (
            <>
              <span className="material-icons" style={{ fontSize: '20px' }}>
                login
              </span>
              Sign In
            </>
          )}
        </button>

        {/* Switch to Signup */}
        <p style={styles.switchText}>
          Don't have an account?
          <button
            type="button"
            onClick={onSwitchToSignup}
            onMouseEnter={() => setHoveredButton('switch')}
            onMouseLeave={() => setHoveredButton(null)}
            style={getButtonStyle('switch', styles.switchLink, styles.switchLinkHover)}
          >
            Sign up
          </button>
        </p>
      </form>

      {/* Toast Container */}
      <ResponsiveToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Keyframe animation for spinner */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </>
  );
}

export default LoginForm;

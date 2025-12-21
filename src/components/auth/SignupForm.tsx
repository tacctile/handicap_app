/**
 * SignupForm Component
 *
 * Email, password, and confirm password form with validation,
 * loading state, error display, and login navigation.
 */

import { useState, useCallback, type FormEvent, useMemo } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import type { AuthError } from '../../services/auth/types';

// ============================================================================
// TYPES
// ============================================================================

export interface SignupFormProps {
  /** Callback when user wants to switch to login */
  onSwitchToLogin: () => void;
  /** Callback after successful signup */
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
  inputValid: {
    borderColor: '#10b981',
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: '#6E6E70',
    marginTop: '4px',
  },
  hintIcon: {
    fontSize: '14px',
  },
  hintValid: {
    color: '#10b981',
  },
  hintInvalid: {
    color: '#6E6E70',
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
  fieldError: {
    fontSize: '12px',
    color: '#ef4444',
    marginTop: '4px',
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
 * SignupForm provides email/password registration with validation.
 *
 * @example
 * ```tsx
 * <SignupForm
 *   onSwitchToLogin={() => setShowLogin(true)}
 *   onSuccess={() => navigate('/dashboard')}
 * />
 * ```
 */
export function SignupForm({ onSwitchToLogin, onSuccess }: SignupFormProps) {
  const { signUp, isLoading, error, clearError } = useAuthContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validation
  const validation = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = emailRegex.test(email);
    const isPasswordLongEnough = password.length >= 8;
    const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

    return {
      email: {
        valid: isEmailValid,
        error: touched.email && !isEmailValid ? 'Please enter a valid email address' : null,
      },
      password: {
        valid: isPasswordLongEnough,
        error:
          touched.password && !isPasswordLongEnough
            ? 'Password must be at least 8 characters'
            : null,
      },
      confirmPassword: {
        valid: doPasswordsMatch,
        error: touched.confirmPassword && !doPasswordsMatch ? 'Passwords do not match' : null,
      },
    };
  }, [email, password, confirmPassword, touched]);

  const handleBlur = useCallback((field: string) => {
    setFocusedField(null);
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      clearError();

      // Mark all fields as touched
      setTouched({ email: true, password: true, confirmPassword: true });

      // Validate
      if (
        !validation.email.valid ||
        !validation.password.valid ||
        !validation.confirmPassword.valid
      ) {
        return;
      }

      try {
        await signUp(email.trim(), password);
        onSuccess?.();
      } catch (err) {
        // Error is already in context state
        const authError = err as AuthError;
        if (authError?.message) {
          // Error already displayed via error state
        }
      }
    },
    [email, password, validation, signUp, clearError, onSuccess]
  );

  const getInputStyle = (
    fieldName: string,
    validationState: { valid: boolean; error: string | null }
  ) => {
    const base = { ...styles.input };

    if (focusedField === fieldName) {
      return { ...base, ...styles.inputFocus };
    }

    if (validationState.error) {
      return { ...base, ...styles.inputError };
    }

    if (touched[fieldName] && validationState.valid) {
      return { ...base, ...styles.inputValid };
    }

    return base;
  };

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

  const isFormValid =
    validation.email.valid && validation.password.valid && validation.confirmPassword.valid;
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
          <label htmlFor="signup-email" style={styles.label}>
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedField('email')}
            onBlur={() => handleBlur('email')}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isLoading}
            style={getInputStyle('email', validation.email)}
          />
          {validation.email.error && (
            <span style={styles.fieldError}>{validation.email.error}</span>
          )}
        </div>

        {/* Password Field */}
        <div style={styles.inputGroup}>
          <label htmlFor="signup-password" style={styles.label}>
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedField('password')}
            onBlur={() => handleBlur('password')}
            placeholder="Create a password"
            autoComplete="new-password"
            disabled={isLoading}
            style={getInputStyle('password', validation.password)}
          />
          <div
            style={{
              ...styles.hint,
              ...(validation.password.valid ? styles.hintValid : styles.hintInvalid),
            }}
          >
            <span
              className="material-icons"
              style={{
                ...styles.hintIcon,
                color: validation.password.valid ? '#10b981' : '#6E6E70',
              }}
            >
              {validation.password.valid ? 'check_circle' : 'info'}
            </span>
            At least 8 characters
          </div>
        </div>

        {/* Confirm Password Field */}
        <div style={styles.inputGroup}>
          <label htmlFor="signup-confirm" style={styles.label}>
            Confirm Password
          </label>
          <input
            id="signup-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onFocus={() => setFocusedField('confirmPassword')}
            onBlur={() => handleBlur('confirmPassword')}
            placeholder="Confirm your password"
            autoComplete="new-password"
            disabled={isLoading}
            style={getInputStyle('confirmPassword', validation.confirmPassword)}
          />
          {validation.confirmPassword.error && (
            <span style={styles.fieldError}>{validation.confirmPassword.error}</span>
          )}
        </div>

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
              Creating account...
            </>
          ) : (
            <>
              <span className="material-icons" style={{ fontSize: '20px' }}>
                person_add
              </span>
              Create Account
            </>
          )}
        </button>

        {/* Switch to Login */}
        <p style={styles.switchText}>
          Already have an account?
          <button
            type="button"
            onClick={onSwitchToLogin}
            onMouseEnter={() => setHoveredButton('switch')}
            onMouseLeave={() => setHoveredButton(null)}
            style={getButtonStyle('switch', styles.switchLink, styles.switchLinkHover)}
          >
            Log in
          </button>
        </p>
      </form>

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

export default SignupForm;

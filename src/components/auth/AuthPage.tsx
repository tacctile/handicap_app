/**
 * AuthPage Component
 *
 * Container page that toggles between LoginForm and SignupForm.
 * Displays app branding and centered layout.
 */

import { useState, useCallback } from 'react'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'

// ============================================================================
// TYPES
// ============================================================================

export interface AuthPageProps {
  /** Initial form to show ('login' or 'signup') */
  initialForm?: 'login' | 'signup'
  /** Callback after successful authentication */
  onAuthSuccess?: () => void
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    backgroundColor: '#0A0A0B',
  },
  content: {
    maxWidth: '400px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  branding: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '40px',
  },
  logo: {
    width: '72px',
    height: '72px',
    borderRadius: '16px',
    backgroundColor: '#19abb5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 4px 24px rgba(25, 171, 181, 0.3)',
  },
  logoIcon: {
    fontSize: '40px',
    color: '#0A0A0B',
  },
  appName: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#EEEFF1',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  tagline: {
    fontSize: '14px',
    color: '#6E6E70',
    margin: '8px 0 0 0',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#0F0F10',
    border: '1px solid #2A2A2C',
    borderRadius: '16px',
    padding: '32px',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#EEEFF1',
    margin: '0 0 24px 0',
    textAlign: 'center',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '12px',
    color: '#6E6E70',
    lineHeight: 1.6,
  },
  footerLink: {
    color: '#19abb5',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AuthPage is the main authentication container with branding and form toggle.
 *
 * @example
 * ```tsx
 * // Show login by default
 * <AuthPage onAuthSuccess={() => navigate('/dashboard')} />
 *
 * // Show signup by default
 * <AuthPage initialForm="signup" onAuthSuccess={() => navigate('/dashboard')} />
 * ```
 */
export function AuthPage({ initialForm = 'login', onAuthSuccess }: AuthPageProps) {
  const [currentForm, setCurrentForm] = useState<'login' | 'signup'>(initialForm)

  const handleSwitchToSignup = useCallback(() => {
    setCurrentForm('signup')
  }, [])

  const handleSwitchToLogin = useCallback(() => {
    setCurrentForm('login')
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Branding */}
        <div style={styles.branding}>
          <div style={styles.logo}>
            <span className="material-icons" style={styles.logoIcon}>
              analytics
            </span>
          </div>
          <h1 style={styles.appName}>Handicap Pro</h1>
          <p style={styles.tagline}>
            Professional horse racing analysis
          </p>
        </div>

        {/* Auth Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>
            {currentForm === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>

          {currentForm === 'login' ? (
            <LoginForm
              onSwitchToSignup={handleSwitchToSignup}
              onSuccess={onAuthSuccess}
            />
          ) : (
            <SignupForm
              onSwitchToLogin={handleSwitchToLogin}
              onSuccess={onAuthSuccess}
            />
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            By continuing, you agree to our Terms of Service
            <br />
            and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthPage

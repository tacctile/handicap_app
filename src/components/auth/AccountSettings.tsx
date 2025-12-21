/**
 * AccountSettings Component
 *
 * Account management page showing current email, password change,
 * logout button, and delete account with confirmation.
 */

import { useState, useCallback, type FormEvent } from 'react'
import { useAuthContext } from '../../contexts/AuthContext'
import { useToasts, ResponsiveToastContainer } from '../Toast'

// ============================================================================
// TYPES
// ============================================================================

export interface AccountSettingsProps {
  /** Callback when user logs out */
  onLogout?: () => void
  /** Callback to go back to main app */
  onBack?: () => void
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0A0A0B',
    padding: '24px 16px',
  },
  content: {
    maxWidth: '600px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    backgroundColor: '#1A1A1C',
    border: '1px solid #2A2A2C',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#EEEFF1',
    transition: 'background-color 0.2s',
  },
  backButtonHover: {
    backgroundColor: '#2A2A2C',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#EEEFF1',
    margin: 0,
  },
  section: {
    backgroundColor: '#0F0F10',
    border: '1px solid #2A2A2C',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#EEEFF1',
    margin: '0 0 16px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionIcon: {
    fontSize: '20px',
    color: '#19abb5',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #2A2A2C',
  },
  infoRowLast: {
    borderBottom: 'none',
  },
  infoLabel: {
    fontSize: '14px',
    color: '#6E6E70',
  },
  infoValue: {
    fontSize: '14px',
    color: '#EEEFF1',
    fontWeight: 500,
  },
  form: {
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
  button: {
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background-color 0.2s',
  },
  primaryButton: {
    color: '#0A0A0B',
    backgroundColor: '#19abb5',
  },
  primaryButtonHover: {
    backgroundColor: '#1b7583',
  },
  secondaryButton: {
    color: '#EEEFF1',
    backgroundColor: '#2A2A2C',
  },
  secondaryButtonHover: {
    backgroundColor: '#3A3A3C',
  },
  dangerButton: {
    color: '#EEEFF1',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  dangerButtonHover: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  successMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '8px',
    color: '#10b981',
    fontSize: '14px',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#0F0F10',
    border: '1px solid #2A2A2C',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center',
  },
  modalIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px auto',
    color: '#ef4444',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#EEEFF1',
    margin: '0 0 8px 0',
  },
  modalText: {
    fontSize: '14px',
    color: '#B4B4B6',
    margin: '0 0 24px 0',
    lineHeight: 1.5,
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(10, 10, 11, 0.3)',
    borderTopColor: '#0A0A0B',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AccountSettings provides account management features.
 *
 * @example
 * ```tsx
 * <AccountSettings
 *   onLogout={() => navigate('/login')}
 *   onBack={() => navigate('/')}
 * />
 * ```
 */
export function AccountSettings({ onLogout, onBack }: AccountSettingsProps) {
  const { user, signOut, isLoading } = useAuthContext()
  const { toasts, addToast, dismissToast } = useToasts()

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Hover states
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)

  const handleLogout = useCallback(async () => {
    try {
      await signOut()
      onLogout?.()
    } catch (_err) {
      addToast('Failed to log out. Please try again.', 'critical')
    }
  }, [signOut, onLogout, addToast])

  const handleChangePassword = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()

      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        addToast('Please fill in all password fields', 'warning')
        return
      }

      if (newPassword.length < 8) {
        addToast('New password must be at least 8 characters', 'warning')
        return
      }

      if (newPassword !== confirmPassword) {
        addToast('New passwords do not match', 'warning')
        return
      }

      setIsChangingPassword(true)

      // Mock password change - in real implementation, this would call the auth service
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        setPasswordSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        addToast('Password changed successfully', 'success')

        setTimeout(() => setPasswordSuccess(false), 3000)
      } catch (_err) {
        addToast('Failed to change password. Please try again.', 'critical')
      } finally {
        setIsChangingPassword(false)
      }
    },
    [currentPassword, newPassword, confirmPassword, addToast]
  )

  const handleDeleteAccount = useCallback(async () => {
    setIsDeleting(true)

    // Mock delete - in real implementation, this would call the auth service
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      addToast('Account deletion coming soon', 'info')
      setShowDeleteModal(false)
    } catch (_err) {
      addToast('Failed to delete account. Please try again.', 'critical')
    } finally {
      setIsDeleting(false)
    }
  }, [addToast])

  const getInputStyle = (fieldName: string) => ({
    ...styles.input,
    ...(focusedField === fieldName ? styles.inputFocus : {}),
  })

  const getButtonStyle = (
    buttonName: string,
    baseStyle: React.CSSProperties,
    hoverStyle: React.CSSProperties,
    disabled?: boolean
  ) => ({
    ...styles.button,
    ...baseStyle,
    ...(hoveredButton === buttonName && !disabled ? hoverStyle : {}),
    ...(disabled ? styles.buttonDisabled : {}),
  })

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          {onBack && (
            <button
              onClick={onBack}
              onMouseEnter={() => setHoveredButton('back')}
              onMouseLeave={() => setHoveredButton(null)}
              style={{
                ...styles.backButton,
                ...(hoveredButton === 'back' ? styles.backButtonHover : {}),
              }}
            >
              <span className="material-icons" style={{ fontSize: '20px' }}>
                arrow_back
              </span>
            </button>
          )}
          <h1 style={styles.title}>Account Settings</h1>
        </div>

        {/* Profile Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <span className="material-icons" style={styles.sectionIcon}>
              person
            </span>
            Profile
          </h2>

          <div style={{ ...styles.infoRow, ...styles.infoRowLast }}>
            <span style={styles.infoLabel}>Email</span>
            <span style={styles.infoValue}>{user?.email || 'Not signed in'}</span>
          </div>
        </div>

        {/* Change Password Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <span className="material-icons" style={styles.sectionIcon}>
              lock
            </span>
            Change Password
          </h2>

          {passwordSuccess && (
            <div style={styles.successMessage}>
              <span className="material-icons" style={{ fontSize: '18px' }}>
                check_circle
              </span>
              Password changed successfully
            </div>
          )}

          <form onSubmit={handleChangePassword} style={styles.form}>
            <div style={styles.inputGroup}>
              <label htmlFor="current-password" style={styles.label}>
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                onFocus={() => setFocusedField('current')}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter current password"
                autoComplete="current-password"
                disabled={isChangingPassword}
                style={getInputStyle('current')}
              />
            </div>

            <div style={styles.inputGroup}>
              <label htmlFor="new-password" style={styles.label}>
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setFocusedField('new')}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter new password (8+ characters)"
                autoComplete="new-password"
                disabled={isChangingPassword}
                style={getInputStyle('new')}
              />
            </div>

            <div style={styles.inputGroup}>
              <label htmlFor="confirm-new-password" style={styles.label}>
                Confirm New Password
              </label>
              <input
                id="confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField(null)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                disabled={isChangingPassword}
                style={getInputStyle('confirm')}
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              onMouseEnter={() => setHoveredButton('changePassword')}
              onMouseLeave={() => setHoveredButton(null)}
              style={getButtonStyle('changePassword', styles.primaryButton, styles.primaryButtonHover, isChangingPassword)}
            >
              {isChangingPassword ? (
                <>
                  <div style={styles.spinner} />
                  Changing...
                </>
              ) : (
                <>
                  <span className="material-icons" style={{ fontSize: '18px' }}>
                    save
                  </span>
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>

        {/* Actions Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <span className="material-icons" style={styles.sectionIcon}>
              settings
            </span>
            Account Actions
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleLogout}
              disabled={isLoading}
              onMouseEnter={() => setHoveredButton('logout')}
              onMouseLeave={() => setHoveredButton(null)}
              style={getButtonStyle('logout', styles.secondaryButton, styles.secondaryButtonHover, isLoading)}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>
                logout
              </span>
              Log Out
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              onMouseEnter={() => setHoveredButton('delete')}
              onMouseLeave={() => setHoveredButton(null)}
              style={getButtonStyle('delete', styles.dangerButton, styles.dangerButtonHover)}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>
                delete_forever
              </span>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={styles.modal} onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalIcon}>
              <span className="material-icons" style={{ fontSize: '32px' }}>
                warning
              </span>
            </div>
            <h3 style={styles.modalTitle}>Delete Account?</h3>
            <p style={styles.modalText}>
              This action cannot be undone. All your data will be permanently deleted.
            </p>
            <div style={styles.modalActions}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                onMouseEnter={() => setHoveredButton('cancel')}
                onMouseLeave={() => setHoveredButton(null)}
                style={getButtonStyle('cancel', styles.secondaryButton, styles.secondaryButtonHover, isDeleting)}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                onMouseEnter={() => setHoveredButton('confirmDelete')}
                onMouseLeave={() => setHoveredButton(null)}
                style={getButtonStyle('confirmDelete', styles.dangerButton, styles.dangerButtonHover, isDeleting)}
              >
                {isDeleting ? (
                  <>
                    <div style={{ ...styles.spinner, borderTopColor: '#ef4444' }} />
                    Deleting...
                  </>
                ) : (
                  'Delete Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}

export default AccountSettings

import React, { useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

const widthMap = {
  sm: '360px',
  md: '480px',
  lg: '640px',
  xl: '800px',
} as const;

/**
 * Drawer primitive component for slide-out panels.
 * Includes overlay, escape key handling, and smooth animations.
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  width = 'md',
}: DrawerProps): React.ReactElement | null {
  const handleEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleEscapeKey]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 'var(--z-drawer)' as unknown as number,
  };

  const drawerStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100vh',
    width: widthMap[width],
    maxWidth: '100vw',
    backgroundColor: 'var(--bg-elevated)',
    borderLeft: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-drawer)',
    zIndex: 'var(--z-drawer)' as unknown as number,
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyles: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-4)',
    borderBottom: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-elevated)',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: 'var(--text-xl)',
    fontWeight: 'var(--font-semibold)' as unknown as number,
    color: 'var(--text-primary)',
    margin: 0,
  };

  const closeButtonStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'var(--touch-target-min)',
    height: 'var(--touch-target-min)',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    transition: 'var(--transition-fast)',
  };

  const bodyStyles: React.CSSProperties = {
    flex: 1,
    padding: 'var(--space-4)',
    overflowY: 'auto',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={overlayStyles}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            style={drawerStyles}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'drawer-title' : undefined}
          >
            <div style={headerStyles}>
              {title && (
                <h2 id="drawer-title" style={titleStyles}>
                  {title}
                </h2>
              )}
              {!title && <div />}
              <button
                type="button"
                className="focus-ring"
                style={closeButtonStyles}
                onClick={onClose}
                aria-label="Close drawer"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <span className="material-icons" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            <div style={bodyStyles}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

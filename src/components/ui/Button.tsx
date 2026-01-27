import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

const sizeStyles = {
  sm: {
    padding: '8px 12px',
    fontSize: 'var(--text-sm)',
  },
  md: {
    padding: '10px 16px',
    fontSize: 'var(--text-base)',
  },
  lg: {
    padding: '12px 24px',
    fontSize: 'var(--text-lg)',
  },
} as const;

/**
 * Button primitive component with multiple variants.
 * All buttons meet 44px minimum touch target.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  type = 'button',
}: ButtonProps): React.ReactElement {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'var(--touch-target-min)',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--font-medium)' as unknown as number,
    fontFamily: 'inherit',
    transition: 'var(--transition-fast)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    border: 'none',
    ...sizeStyles[size],
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--accent-primary)',
          color: 'var(--text-inverse)',
        };
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-secondary)',
        };
      default:
        return {};
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const target = e.currentTarget;
    switch (variant) {
      case 'primary':
        target.style.backgroundColor = 'var(--accent-primary-hover)';
        break;
      case 'secondary':
        target.style.borderColor = 'var(--border-prominent)';
        target.style.backgroundColor = 'var(--bg-hover)';
        break;
      case 'ghost':
        target.style.color = 'var(--text-primary)';
        target.style.backgroundColor = 'var(--bg-hover)';
        break;
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const target = e.currentTarget;
    switch (variant) {
      case 'primary':
        target.style.backgroundColor = 'var(--accent-primary)';
        break;
      case 'secondary':
        target.style.borderColor = 'var(--border-default)';
        target.style.backgroundColor = 'transparent';
        break;
      case 'ghost':
        target.style.color = 'var(--text-secondary)';
        target.style.backgroundColor = 'transparent';
        break;
    }
  };

  return (
    <button
      type={type}
      className={`ui-button focus-ring ${className}`.trim()}
      style={{ ...baseStyles, ...getVariantStyles() }}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </button>
  );
}

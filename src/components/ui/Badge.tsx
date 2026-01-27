import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'tier1' | 'tier2' | 'tier3';
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles = {
  default: {
    backgroundColor: 'var(--bg-hover)',
    color: 'var(--text-secondary)',
  },
  success: {
    backgroundColor: 'var(--status-success-muted)',
    color: 'var(--status-success)',
  },
  warning: {
    backgroundColor: 'var(--status-warning-muted)',
    color: 'var(--status-warning)',
  },
  error: {
    backgroundColor: 'var(--status-error-muted)',
    color: 'var(--status-error)',
  },
  tier1: {
    backgroundColor: 'var(--tier-1-muted)',
    color: 'var(--tier-1)',
  },
  tier2: {
    backgroundColor: 'var(--tier-2-muted)',
    color: 'var(--tier-2)',
  },
  tier3: {
    backgroundColor: 'var(--tier-3-muted)',
    color: 'var(--tier-3)',
  },
} as const;

const sizeStyles = {
  sm: {
    padding: '2px 8px',
    fontSize: 'var(--text-xs)',
  },
  md: {
    padding: '4px 10px',
    fontSize: 'var(--text-sm)',
  },
} as const;

/**
 * Badge primitive component for status indicators and labels.
 * Supports multiple semantic variants and sizes.
 */
export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}: BadgeProps): React.ReactElement {
  const styles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'var(--font-medium)' as unknown as number,
    borderRadius: 'var(--radius-sm)',
    whiteSpace: 'nowrap',
    ...variantStyles[variant],
    ...sizeStyles[size],
  };

  return (
    <span className={`ui-badge ${className}`.trim()} style={styles}>
      {children}
    </span>
  );
}

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
}

const paddingMap = {
  none: '0',
  sm: 'var(--space-3)',
  md: 'var(--space-4)',
  lg: 'var(--space-6)',
} as const;

/**
 * Card primitive component for content containers.
 * Supports configurable padding and hover states.
 */
export function Card({
  children,
  className = '',
  padding = 'md',
  hoverable = false,
  onClick,
}: CardProps): React.ReactElement {
  const isInteractive = hoverable || !!onClick;

  const baseStyles: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: paddingMap[padding],
    transition: 'var(--transition-normal)',
    cursor: isInteractive ? 'pointer' : undefined,
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`ui-card ${className}`.trim()}
      style={baseStyles}
      onClick={onClick}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onMouseEnter={isInteractive ? (e) => {
        const target = e.currentTarget as HTMLDivElement;
        target.style.borderColor = 'var(--border-default)';
        target.style.backgroundColor = 'var(--bg-elevated)';
      } : undefined}
      onMouseLeave={isInteractive ? (e) => {
        const target = e.currentTarget as HTMLDivElement;
        target.style.borderColor = 'var(--border-subtle)';
        target.style.backgroundColor = 'var(--bg-card)';
      } : undefined}
    >
      {children}
    </div>
  );
}

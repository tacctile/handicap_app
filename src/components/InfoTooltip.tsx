/**
 * InfoTooltip Component
 *
 * A subtle, non-intrusive tooltip that appears after a hover delay.
 * Designed for beginner-friendly explanations of racing terminology.
 */

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface InfoTooltipProps {
  /** The tooltip content - keep it beginner-friendly */
  content: string;
  /** Optional header/title for the tooltip */
  title?: string;
  /** Position relative to the icon */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip in ms (default: 400ms) */
  delay?: number;
  /** Additional class name for the trigger */
  className?: string;
}

export function InfoTooltip({
  content,
  title,
  position = 'bottom',
  delay = 400,
  className = '',
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle click for mobile
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (isVisible) {
        hideTooltip();
      } else {
        // Clear any pending timeout and show immediately on click
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setIsVisible(true);
      }
    },
    [isVisible, hideTooltip]
  );

  // Close on click outside (for mobile)
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        hideTooltip();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isVisible, hideTooltip]);

  return (
    <div className={`info-tooltip-wrapper ${className}`} ref={tooltipRef}>
      <button
        type="button"
        className="info-tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onClick={handleClick}
        aria-label={title || 'More information'}
        aria-describedby={isVisible ? 'info-tooltip-content' : undefined}
      >
        <span className="material-icons info-tooltip-icon">help_outline</span>
      </button>

      {isVisible && (
        <div
          id="info-tooltip-content"
          className={`info-tooltip info-tooltip--${position}`}
          role="tooltip"
        >
          {title && (
            <div className="info-tooltip__header">
              <span className="material-icons info-tooltip__header-icon">info</span>
              <span className="info-tooltip__title">{title}</span>
            </div>
          )}
          <div className="info-tooltip__content">{content}</div>
        </div>
      )}
    </div>
  );
}

/**
 * HeaderTooltip Component
 *
 * A tooltip that wraps child elements (like header labels) as the trigger.
 * No icon is displayed - the children themselves trigger the tooltip on hover.
 * Designed for column headers where the label should trigger the tooltip.
 */
interface HeaderTooltipProps {
  /** The tooltip content - keep it beginner-friendly */
  content: string;
  /** Optional header/title for the tooltip */
  title?: string;
  /** Delay before showing tooltip in ms (default: 350ms) */
  delay?: number;
  /** Additional class name for the wrapper */
  className?: string;
  /** The child elements that become the tooltip trigger */
  children: ReactNode;
}

export function HeaderTooltip({
  content,
  title,
  delay = 350,
  className = '',
  children,
}: HeaderTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle click for mobile (toggle tooltip)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isVisible) {
        hideTooltip();
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setIsVisible(true);
      }
    },
    [isVisible, hideTooltip]
  );

  // Close on click outside (for mobile)
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        hideTooltip();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isVisible, hideTooltip]);

  return (
    <div className={`header-tooltip-wrapper ${className}`} ref={tooltipRef}>
      <div
        ref={triggerRef}
        className="header-tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        aria-label={title || 'More information'}
        aria-describedby={isVisible ? 'header-tooltip-content' : undefined}
      >
        {children}
      </div>

      {isVisible && (
        <div id="header-tooltip-content" className="header-tooltip" role="tooltip">
          {title && (
            <div className="header-tooltip__header">
              <span className="material-icons header-tooltip__header-icon">info</span>
              <span className="header-tooltip__title">{title}</span>
            </div>
          )}
          <div className="header-tooltip__content">{content}</div>
        </div>
      )}
    </div>
  );
}

export default InfoTooltip;

import React, { useRef, useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '../ui';
import { parseFileWithFallback } from '../../lib/drfWorkerClient';
import { useToastContext } from '../../contexts/ToastContext';
import { logger } from '../../services/logging';
import type { ParsedDRFFile } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

interface EmptyStateProps {
  /** Callback when a DRF file is successfully parsed */
  onParsed: (data: ParsedDRFFile) => void;
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-base)',
  padding: 'var(--space-4)',
};

const contentStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  maxWidth: '480px',
  width: '100%',
  gap: 'var(--space-6)',
};

const logoStyles: React.CSSProperties = {
  fontSize: 'var(--text-3xl)',
  fontWeight: 'var(--font-bold)' as unknown as number,
  color: 'var(--accent-primary)',
  letterSpacing: '-0.02em',
  marginBottom: 'var(--space-4)',
};

const iconContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '80px',
  height: '80px',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
};

const headingStyles: React.CSSProperties = {
  fontSize: 'var(--text-2xl)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-primary)',
  margin: 0,
  lineHeight: 'var(--leading-tight)',
};

const subtextStyles: React.CSSProperties = {
  fontSize: 'var(--text-base)',
  color: 'var(--text-secondary)',
  margin: 0,
  marginTop: 'var(--space-2)',
  lineHeight: 'var(--leading-normal)',
};

const textContainerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const loadingContainerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-3)',
};

const loadingTextStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * EmptyState component displayed when no DRF file is loaded.
 * This is the app's first impression - clean, inviting, with obvious next action.
 */
export function EmptyState({ onParsed }: EmptyStateProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const { addToast } = useToastContext();

  const handleButtonClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file extension
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (fileExtension !== '.drf') {
        addToast('Invalid file type: Only .drf files are accepted', 'warning', {
          duration: 5000,
          icon: 'warning',
        });
        // Reset input
        if (inputRef.current) {
          inputRef.current.value = '';
        }
        return;
      }

      setIsParsing(true);

      try {
        // Read file content
        const content = await readFileAsText(file);

        if (!content) {
          setIsParsing(false);
          addToast('Failed to read file content. The file may be corrupted.', 'critical', {
            duration: 6000,
            icon: 'error',
          });
          return;
        }

        // Parse using worker with automatic fallback
        const result = await parseFileWithFallback(content, file.name, {
          timeout: 30000,
        });

        setIsParsing(false);

        if (result.success && result.data) {
          onParsed(result.data);
        } else {
          const errorMsg = result.error || 'Failed to parse file';
          logger.logError(new Error(`DRF parse failed: ${errorMsg}`), {
            fileName: file.name,
            fileSize: file.size,
            usedFallback: result.usedFallback,
            error: result.error,
          });
          addToast(`Failed to parse DRF file: ${errorMsg}`, 'critical', {
            duration: 8000,
            icon: 'error',
          });
        }
      } catch (error) {
        setIsParsing(false);
        const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
        logger.logError(error instanceof Error ? error : new Error(String(error)), {
          fileName: file.name,
          fileSize: file.size,
          component: 'EmptyState',
        });
        addToast(`Error processing file: ${errorMsg}`, 'critical', {
          duration: 8000,
          icon: 'error',
        });
      }

      // Reset input to allow re-uploading same file
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [addToast, onParsed]
  );

  return (
    <div style={containerStyles}>
      <div style={contentStyles}>
        {/* Logo */}
        <div style={logoStyles}>Furlong</div>

        {/* Icon */}
        <div style={iconContainerStyles}>
          <DocumentIcon />
        </div>

        {/* Text */}
        <div style={textContainerStyles}>
          <h1 style={headingStyles}>No Race Data Loaded</h1>
          <p style={subtextStyles}>Upload a DRF file to analyze today's races</p>
        </div>

        {/* Upload Button */}
        <input
          ref={inputRef}
          type="file"
          accept=".drf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-label="Upload DRF file"
        />

        {isParsing ? (
          <div style={loadingContainerStyles}>
            <LoadingSpinner />
            <span style={loadingTextStyles}>Parsing file...</span>
          </div>
        ) : (
          <Button variant="primary" size="lg" onClick={handleButtonClick}>
            Upload DRF File
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Document icon SVG component
 */
function DocumentIcon(): React.ReactElement {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-tertiary)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

/**
 * Loading spinner SVG component
 */
function LoadingSpinner(): React.ReactElement {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="var(--border-default)"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="var(--accent-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </svg>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Read file content as text
 */
function readFileAsText(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string | null);
    };
    reader.onerror = () => {
      resolve(null);
    };
    reader.readAsText(file);
  });
}

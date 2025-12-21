import { memo, useEffect, useRef } from 'react';

interface ResetConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  changesCount: {
    scratches: number;
    oddsChanges: number;
    trackConditionChanged: boolean;
  };
}

// Material Icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

export const ResetConfirmDialog = memo(function ResetConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  changesCount,
}: ResetConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus the cancel button when dialog opens
    cancelButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const totalChanges =
    changesCount.scratches +
    changesCount.oddsChanges +
    (changesCount.trackConditionChanged ? 1 : 0);

  return (
    <div className="reset-dialog-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="reset-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-dialog-title"
      >
        <div className="reset-dialog-header">
          <div className="reset-dialog-icon-wrapper">
            <Icon name="restore" className="reset-dialog-icon" />
          </div>
          <h2 id="reset-dialog-title" className="reset-dialog-title">
            Reset All Changes?
          </h2>
        </div>

        <div className="reset-dialog-content">
          <p className="reset-dialog-description">
            This will restore all settings to their original values.
          </p>

          {totalChanges > 0 && (
            <div className="reset-changes-list">
              <p className="changes-summary">
                <span className="changes-count">{totalChanges}</span> change
                {totalChanges !== 1 ? 's' : ''} will be reverted:
              </p>
              <ul className="changes-items">
                {changesCount.trackConditionChanged && (
                  <li className="change-item">
                    <Icon name="wb_cloudy" className="change-icon" />
                    <span>Track condition reset to Fast</span>
                  </li>
                )}
                {changesCount.scratches > 0 && (
                  <li className="change-item">
                    <Icon name="cancel" className="change-icon" />
                    <span>
                      {changesCount.scratches} horse{changesCount.scratches !== 1 ? 's' : ''}{' '}
                      unscratched
                    </span>
                  </li>
                )}
                {changesCount.oddsChanges > 0 && (
                  <li className="change-item">
                    <Icon name="attach_money" className="change-icon" />
                    <span>
                      {changesCount.oddsChanges} odds change
                      {changesCount.oddsChanges !== 1 ? 's' : ''} reverted
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="reset-dialog-actions">
          <button
            ref={cancelButtonRef}
            className="reset-dialog-btn reset-dialog-btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button className="reset-dialog-btn reset-dialog-btn-primary" onClick={onConfirm}>
            <Icon name="restore" className="btn-icon" />
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
});

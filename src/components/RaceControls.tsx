import { memo, useState, useCallback } from 'react';
import { TRACK_CONDITIONS, type TrackCondition } from '../hooks/useRaceState';
import { ResetConfirmDialog } from './ResetConfirmDialog';

interface RaceControlsProps {
  trackCondition: TrackCondition;
  onTrackConditionChange: (condition: TrackCondition) => void;
  surface?: 'dirt' | 'turf' | 'synthetic' | 'all-weather';
  // Reset functionality
  hasChanges?: boolean;
  onReset?: () => void;
  scratchesCount?: number;
  oddsChangesCount?: number;
}

// Material Icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

export const RaceControls = memo(function RaceControls({
  trackCondition,
  onTrackConditionChange,
  surface = 'dirt',
  hasChanges = false,
  onReset,
  scratchesCount = 0,
  oddsChangesCount = 0,
}: RaceControlsProps) {
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Filter conditions based on surface
  const availableConditions = TRACK_CONDITIONS.filter(
    (condition) =>
      condition.surface === 'both' ||
      condition.surface === surface ||
      (surface === 'synthetic' && condition.surface === 'dirt')
  );

  const handleResetClick = useCallback(() => {
    setShowResetDialog(true);
  }, []);

  const handleConfirmReset = useCallback(() => {
    setShowResetDialog(false);
    onReset?.();
  }, [onReset]);

  const handleCancelReset = useCallback(() => {
    setShowResetDialog(false);
  }, []);

  return (
    <>
      <div className="race-controls race-controls-responsive">
        <div className="race-controls-section race-controls-section-responsive">
          <label
            className="race-controls-label race-controls-label-responsive"
            htmlFor="track-condition"
          >
            <Icon name="wb_cloudy" className="race-controls-icon" />
            <span>Track Condition</span>
          </label>
          <div className="select-wrapper select-wrapper-responsive">
            <select
              id="track-condition"
              className="race-select race-select-responsive"
              value={trackCondition}
              onChange={(e) => onTrackConditionChange(e.target.value as TrackCondition)}
            >
              {availableConditions.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
            </select>
            <Icon name="expand_more" className="select-chevron" />
          </div>
        </div>

        {/* Reset Button */}
        {onReset && (
          <div className="race-controls-section race-controls-section-responsive">
            <button
              type="button"
              className="reset-button"
              onClick={handleResetClick}
              disabled={!hasChanges}
              aria-label="Reset all changes"
            >
              <Icon name="restore" className="reset-button-icon" />
              <span>Reset to Original</span>
            </button>
          </div>
        )}
      </div>

      {/* Reset Confirmation Dialog */}
      <ResetConfirmDialog
        isOpen={showResetDialog}
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
        changesCount={{
          scratches: scratchesCount,
          oddsChanges: oddsChangesCount,
          trackConditionChanged: trackCondition !== 'fast',
        }}
      />
    </>
  );
});

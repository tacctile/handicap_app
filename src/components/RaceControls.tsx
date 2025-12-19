import { TRACK_CONDITIONS, type TrackCondition } from '../hooks/useRaceState'

interface RaceControlsProps {
  trackCondition: TrackCondition
  onTrackConditionChange: (condition: TrackCondition) => void
  surface?: 'dirt' | 'turf' | 'synthetic'
}

// Material Icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}

export function RaceControls({
  trackCondition,
  onTrackConditionChange,
  surface = 'dirt',
}: RaceControlsProps) {
  // Filter conditions based on surface
  const availableConditions = TRACK_CONDITIONS.filter(
    (condition) =>
      condition.surface === 'both' ||
      condition.surface === surface ||
      (surface === 'synthetic' && condition.surface === 'dirt')
  )

  return (
    <div className="race-controls race-controls-responsive">
      <div className="race-controls-section race-controls-section-responsive">
        <label className="race-controls-label race-controls-label-responsive" htmlFor="track-condition">
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
    </div>
  )
}

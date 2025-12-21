import React from 'react';
import './HorseExpandedView.css';
import type { HorseEntry } from '../types/drf';

interface HorseExpandedViewProps {
  horse: HorseEntry;
  isVisible: boolean;
  valuePercent?: number;
}

// Determine tier class based on value percentage
const getTierClass = (value: number): string => {
  if (value >= 100) return 'elite';
  if (value >= 50) return 'good';
  if (value >= 10) return 'fair';
  if (value >= -10) return 'neutral';
  return 'bad';
};

export const HorseExpandedView: React.FC<HorseExpandedViewProps> = ({
  horse,
  isVisible,
  valuePercent = 0,
}) => {
  if (!isVisible) return null;

  const tierClass = getTierClass(valuePercent);

  return (
    <div className={`horse-expanded-view horse-expanded-view--tier-${tierClass}`}>
      {/* Section 1: Furlong Scoring Breakdown (your value-add) */}
      <section className="horse-expanded-view__section horse-expanded-view__section--scoring">
        <div className="horse-expanded-view__section-placeholder">
          FURLONG SCORING BREAKDOWN
          <span className="horse-expanded-view__placeholder-note">(Prompt 4)</span>
        </div>
      </section>

      {/* Section 2: Horse Identity & Connections */}
      <section className="horse-expanded-view__section horse-expanded-view__section--identity">
        <div className="horse-identity">
          {/* Row 1: Horse info + Breeding */}
          <div className="horse-identity__row">
            {/* Color/Sex/Age */}
            <div className="horse-identity__field horse-identity__field--profile">
              <span className="horse-identity__value horse-identity__value--highlight">
                {horse.color || 'B'}. {horse.sexFull || horse.sex || 'c'}. {horse.age || '?'}
              </span>
              {horse.breeding?.whereBred && (
                <span className="horse-identity__bred">({horse.breeding.whereBred})</span>
              )}
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Sire */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Sire:</span>
              <span className="horse-identity__value">
                {horse.breeding?.sire || '—'}
                {horse.breeding?.sireOfSire && (
                  <span className="horse-identity__sub">({horse.breeding.sireOfSire})</span>
                )}
              </span>
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Dam */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Dam:</span>
              <span className="horse-identity__value">
                {horse.breeding?.dam || '—'}
                {horse.breeding?.damSire && (
                  <span className="horse-identity__sub">({horse.breeding.damSire})</span>
                )}
              </span>
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Breeder */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Breeder:</span>
              <span className="horse-identity__value">{horse.breeding?.breeder || '—'}</span>
            </div>
          </div>

          {/* Row 2: Connections */}
          <div className="horse-identity__row">
            {/* Owner */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Owner:</span>
              <span className="horse-identity__value">{horse.owner || '—'}</span>
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Trainer */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Trainer:</span>
              <span className="horse-identity__value">
                {horse.trainerName || '—'}
                {horse.trainerStats && (
                  <span className="horse-identity__stat">({horse.trainerStats})</span>
                )}
              </span>
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Jockey */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Jockey:</span>
              <span className="horse-identity__value">
                {horse.jockeyName || '—'}
                {horse.jockeyStats && (
                  <span className="horse-identity__stat">({horse.jockeyStats})</span>
                )}
              </span>
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Weight */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Wt:</span>
              <span className="horse-identity__value">{horse.weight || '—'}</span>
            </div>

            {/* Equipment if any */}
            {horse.equipment?.raw && (
              <>
                <span className="horse-identity__divider">|</span>
                <div className="horse-identity__field">
                  <span className="horse-identity__label">Equip:</span>
                  <span className="horse-identity__value horse-identity__value--equip">
                    {horse.equipment.raw}
                  </span>
                </div>
              </>
            )}

            {/* Medication if any */}
            {horse.medication?.raw && (
              <>
                <span className="horse-identity__divider">|</span>
                <div className="horse-identity__field">
                  <span className="horse-identity__label">Med:</span>
                  <span className="horse-identity__value horse-identity__value--med">
                    {horse.medication.raw}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Statistics Table */}
      <section className="horse-expanded-view__section horse-expanded-view__section--stats">
        <div className="horse-expanded-view__section-placeholder">
          STATISTICS TABLE
          <span className="horse-expanded-view__placeholder-note">
            (Lifetime, Current Year, Previous Year, Surface Splits)
          </span>
          <span className="horse-expanded-view__placeholder-note">(Prompt 3)</span>
        </div>
      </section>

      {/* Section 4: Past Performances */}
      <section className="horse-expanded-view__section horse-expanded-view__section--performances">
        <div className="horse-expanded-view__section-placeholder">
          PAST PERFORMANCES
          <span className="horse-expanded-view__placeholder-note">
            (Up to 10 race lines with full DRF data)
          </span>
          <span className="horse-expanded-view__placeholder-note">(Prompts 5-7)</span>
        </div>
      </section>

      {/* Section 5: Workouts */}
      <section className="horse-expanded-view__section horse-expanded-view__section--workouts">
        <div className="horse-expanded-view__section-placeholder">
          WORKOUTS
          <span className="horse-expanded-view__placeholder-note">(Up to 5 recent workouts)</span>
          <span className="horse-expanded-view__placeholder-note">(Prompt 8)</span>
        </div>
      </section>
    </div>
  );
};

export default HorseExpandedView;
